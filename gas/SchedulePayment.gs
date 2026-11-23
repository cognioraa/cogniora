function studentSchedule_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  require_(e.Status==="ACTIVE"||e.Status==="COMPLETED","ACCESS_RESTRICTED","Schedule is unavailable while your enrollment is inactive.");
  var info=doneScheduleMap_(e.ID_Batch);
  return info.schedules.sort(function(a,b){return String(a.Tanggal+" "+a.Jam_Mulai).localeCompare(String(b.Tanggal+" "+b.Jam_Mulai));}).map(function(x){return scheduleClient_(x,info.attended);});
}

function adminSchedules_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Data_Schedule");
  if(filters&&filters.batch_id) rows=rows.filter(function(x){return x.ID_Batch===filters.batch_id;});
  var counts={}; sheetToObjects_("Student_Attendance").forEach(function(a){counts[a.ID_Schedule]=(counts[a.ID_Schedule]||0)+1;});
  var batches={}; sheetToObjects_("Data_Batch").forEach(function(b){batches[b.ID_Batch]=b;});
  return rows.sort(function(a,b){return String(a.Tanggal+" "+a.Jam_Mulai).localeCompare(String(b.Tanggal+" "+b.Jam_Mulai));}).map(function(x){
    var o=scheduleClient_(x,counts); o.attendance_count=counts[x.ID_Schedule]||0; o.batch_name=batches[x.ID_Batch]?batches[x.ID_Batch].Nama_Batch:x.ID_Batch;
    o.material_id=x.ID_Material||""; return o;
  });
}

function adminSetScheduleStatus_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id||data.id_schedule||""), status=String(data.status||"").toUpperCase();
  var s=findOne_("Data_Schedule","ID_Schedule",id);
  require_(s,"NOT_FOUND","Schedule not found.");
  require_(["PLANNED","ACTIVE","EXPIRED","CANCELLED"].indexOf(status)>=0,"VALIDATION_ERROR","Status must be PLANNED, ACTIVE, EXPIRED or CANCELLED.");
  updateObject_("Data_Schedule","ID_Schedule",id,{Status:status,Updated_At:now_()});
  if(status==="CANCELLED"&&s.Status!=="CANCELLED"&&typeof refundCreditsForCancelledSchedule_==="function")refundCreditsForCancelledSchedule_(ctx,s);
  audit_(ctx,"UPDATE_SCHEDULE_STATUS","Data_Schedule",id,status,"SUCCESS");
  return {id:id,status:status};
}

function adminSaveSchedule_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_schedule||""), now=now_();
  var batch=findOne_("Data_Batch","ID_Batch",String(data.batch_id||""));
  require_(batch,"NOT_FOUND","Batch not found.");
  var type=String(data.type||"GOOGLE_MEET");
  require_(COGNIORA_ENUMS.SCHEDULE_TYPE.indexOf(type)>=0,"VALIDATION_ERROR","Invalid schedule type.");
  if(type==="GOOGLE_MEET") require_(String(data.meet_url||"").trim(),"VALIDATION_ERROR","Google Meet URL is required.");
  var statusIn=String(data.status||"PLANNED").toUpperCase();
  require_(COGNIORA_ENUMS.SCHEDULE_STATUS.indexOf(statusIn)>=0,"VALIDATION_ERROR","Invalid schedule status.");
  var monthIn=Math.max(1,toNumber_(data.month,1));
  require_(monthIn<=Math.max(1,Number(batch.Durasi_Bulan||1)),"VALIDATION_ERROR","Month must be between 1 and "+Number(batch.Durasi_Bulan||1)+" for this batch.");
  var obj={ID_Schedule:id||makeId_("SCH"),ID_Batch:batch.ID_Batch,Month_No:Math.max(1,toNumber_(data.month,1)),Meeting_No:Math.max(1,toNumber_(data.meeting_no,1)),Tipe:type,Judul:String(data.title||""),Tanggal:String(data.date||today_()),Jam_Mulai:String(data.start||"00:00"),Jam_Selesai:String(data.end||"00:00"),Google_Meet_URL:normalizeMeetUrl_(data.meet_url),ID_Material:String(data.material_id||""),Requires_Attendance:type==="GOOGLE_MEET"?true:bool_(data.requires_attendance),Status:statusIn,Created_At:id?(findOne_("Data_Schedule","ID_Schedule",id)||{}).Created_At||now_():now_(),Updated_At:now_(),Created_By:ctx.userId};
  require_(obj.Judul,"VALIDATION_ERROR","Schedule title is required.");
  if(id) {
    var previous=findOne_("Data_Schedule","ID_Schedule",id);
    if(previous && (String(previous.Tanggal)!==obj.Tanggal || String(previous.Jam_Mulai)!==obj.Jam_Mulai || String(previous.Jam_Selesai)!==obj.Jam_Selesai)) {
      appendObject_("Data_Schedule_History",{ID_History:makeId_("SCHH"),ID_Schedule:id,Old_Date:toClientDate_(previous.Tanggal),Old_Start:previous.Jam_Mulai,Old_End:previous.Jam_Selesai,New_Date:obj.Tanggal,New_Start:obj.Jam_Mulai,New_End:obj.Jam_Selesai,Reason:String(data.change_reason||"Schedule updated"),Changed_By:ctx.userId,Changed_At:now_()});
    }
    updateObject_("Data_Schedule","ID_Schedule",id,obj);
    if(obj.Status==="CANCELLED"&&previous&&previous.Status!=="CANCELLED"&&typeof refundCreditsForCancelledSchedule_==="function")refundCreditsForCancelledSchedule_(ctx,previous);
  } else appendObject_("Data_Schedule",obj);
  audit_(ctx,id?"UPDATE_SCHEDULE":"CREATE_SCHEDULE","Data_Schedule",obj.ID_Schedule,obj.Judul,"SUCCESS");
  return {id:obj.ID_Schedule};
}

function adminSaveAttendance_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), schedule=findOne_("Data_Schedule","ID_Schedule",String(data.schedule_id||"")), enrollment=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||""));
  require_(schedule&&enrollment,"NOT_FOUND","Schedule or enrollment not found.");
  require_(schedule.ID_Batch===enrollment.ID_Batch,"VALIDATION_ERROR","Enrollment does not belong to this batch.");
  require_(String(schedule.Status||"")!=="CANCELLED","VALIDATION_ERROR","Attendance cannot be recorded for a cancelled session.");
  var status=String(data.status||"PRESENT");
  require_(COGNIORA_ENUMS.ATTENDANCE_STATUS.indexOf(status)>=0,"VALIDATION_ERROR","Invalid attendance status.");
  var existing=findMany_("Student_Attendance","ID_Schedule",schedule.ID_Schedule).filter(function(x){return x.ID_Enrollment===enrollment.ID_Enrollment;})[0];
  var obj={ID_Attendance:existing?existing.ID_Attendance:makeId_("ATT"),ID_Schedule:schedule.ID_Schedule,ID_Enrollment:enrollment.ID_Enrollment,Status:status,Check_In:String(data.check_in||now_()),Note:String(data.note||""),Recorded_By:ctx.userId,Recorded_At:now_()};
  if(existing) updateObject_("Student_Attendance","ID_Attendance",existing.ID_Attendance,obj); else appendObject_("Student_Attendance",obj);
  // V2: penggunaan kuota hanya berjalan jika Owner mengaktifkan aturan untuk paket terkait.
  var creditResult={applied:false};
  try { if(typeof syncAttendancePackageCredit_==="function") creditResult=syncAttendancePackageCredit_(ctx,enrollment,schedule,status); } catch(creditErr) { audit_(ctx,"PACKAGE_CREDIT_SYNC_FAILED","Package_Credit_Ledger",enrollment.ID_Enrollment,String(creditErr.message||creditErr),"FAILED"); }
  recalculateEnrollmentState_(enrollment.ID_Enrollment);
  syncBatchCompletion_(schedule.ID_Batch);
  invalidateStudentDashboardCache_(enrollment.ID_Siswa);
  return {saved:true,package_credit:creditResult};
}

// V37: input attendance satu batch sekaligus. Pertemuan dianggap SELESAI setelah attendance diinput
// (berlaku untuk Learning Source maupun Google Meet).
function adminSaveAttendanceBulk_(token,data) {
  getAuthContext_(token,"ADMIN");
  var schedule=findOne_("Data_Schedule","ID_Schedule",String(data.schedule_id||""));
  require_(schedule,"NOT_FOUND","Schedule not found.");
  var recs=Array.isArray(data.records)?data.records:[];
  require_(recs.length,"VALIDATION_ERROR","Pilih minimal satu siswa.");
  var saved=0, errors=[];
  withReadCache_(function(){ // V40: sheet referensi dibaca sekali untuk seluruh siswa batch (lebih cepat)
    recs.forEach(function(r){
      try{ adminSaveAttendance_(token,{schedule_id:schedule.ID_Schedule,enrollment_id:r.enrollment_id,status:r.status||"PRESENT",note:r.note||""}); saved++; }
      catch(err){ errors.push({enrollment_id:r.enrollment_id,message:err.message||"Failed"}); }
    });
  });
  return {saved:saved,error_count:errors.length,errors:errors};
}

function adminAttendance_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Student_Attendance");
  if(filters&&filters.batch_id){
    var enr=findMany_("Data_Enrollment","ID_Batch",filters.batch_id).map(function(x){return x.ID_Enrollment;});
    rows=rows.filter(function(x){return enr.indexOf(x.ID_Enrollment)>=0;});
  }
  return rows.map(function(x){
    var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment), s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa), sh=findOne_("Data_Schedule","ID_Schedule",x.ID_Schedule);
    return {id:x.ID_Attendance,student_id:s&&s.ID_Siswa,student_name:s&&s.Nama_Lengkap,enrollment_id:x.ID_Enrollment,schedule_id:x.ID_Schedule,title:sh&&sh.Judul,date:sh&&toClientDate_(sh.Tanggal),meeting:sh&&Number(sh.Meeting_No||0),status:x.Status,note:x.Note||""};
  });
}

function getPaymentAccounts_() {
  try {
    var raw=PropertiesService.getScriptProperties().getProperty("COGNIORA_PAYMENT_ACCOUNTS_JSON")||"";
    var rows=raw?JSON.parse(raw):COGNIORA_PAYMENT_ACCOUNTS;
    if(!Array.isArray(rows)) return [];
    return rows.map(function(a){return {bank:String(a.bank||""),number:String(a.number||""),holder:String(a.holder||"")};}).filter(function(a){return a.bank||a.number||a.holder;});
  } catch(e) { return []; }
}

function paymentSummary_(e) {
  // V35: semua invoice milik enrollment dikirim ke student console (tidak lagi dibatasi bulan berjalan).
  var invoices=findMany_("Data_Invoice","ID_Enrollment",e.ID_Enrollment).filter(function(x){return String(x.Status||"")!=="CANCELLED" && billingMonthKey_(x.Billing_Month);});
  var payments=findMany_("Data_Payment","ID_Enrollment",e.ID_Enrollment);
  var grouped={};
  invoices.forEach(function(x){
    var k=billingMonthKey_(x.Billing_Month);
    if(!grouped[k]) grouped[k]=x;
    else {
      var px=invoicePriority_(x.Status), py=invoicePriority_(grouped[k].Status);
      if(px>py || (px===py && String(x.Created_At)<String(grouped[k].Created_At))) grouped[k]=x;
    }
  });
  var months=Object.keys(grouped).sort();
  var unique=months.slice().reverse().map(function(k){return grouped[k];});
  // Invoice aktif: tagihan yang belum lunas paling awal; jika semua lunas, tampilkan yang terbaru.
  var open=months.filter(function(k){return ["UNPAID","OVERDUE","PENDING"].indexOf(String(grouped[k].Status))>=0;});
  var current=open.length?grouped[open[0]]:(months.length?grouped[months[months.length-1]]:null);
  return {
    current_invoice:current?invoiceClient_(current):null,
    open_invoices:open.map(function(k){return invoiceClient_(grouped[k]);}),
    history:unique.slice(0,24).map(invoiceClient_),
    payments:payments.sort(function(a,b){return String(b.Submitted_At).localeCompare(String(a.Submitted_At));}).slice(0,12).map(paymentClient_),
    payment_accounts:getPaymentAccounts_()
  };
}

function invoicePriority_(status) {
  return {PAID:5,PENDING:4,OVERDUE:3,UNPAID:2,CANCELLED:1}[String(status||"")]||0;
}

function invoiceClient_(x) {
  var status=String(x.Status||"");
  if(status==="UNPAID" && typeof invoicePastDue_==="function" && invoicePastDue_(x.Due_Date)) status="OVERDUE";
  return {id:x.ID_Invoice,number:x.Invoice_Number,billing_month:billingMonthKey_(x.Billing_Month),amount:Number(x.Nominal||0),
    original_amount:Number(x.Harga_Asli||x.Nominal||0),discount_percent:Number(x.Diskon_Persen||0),discount_amount:Number(x.Potongan_Nominal||0),referral_code:String(x.Kode_Referral||""),
    due_date:toClientDate_(x.Due_Date),status:status};
}

function paymentClient_(x) {
  return {id:x.ID_Payment,invoice_id:x.ID_Invoice,amount:Number(x.Nominal||0),method:x.Payment_Method,submitted_at:x.Submitted_At,status:x.Status,rejection_reason:x.Rejection_Reason||""};
}

function studentPayments_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  return paymentSummary_(e);
}

function uploadPaymentProofForm_(form) {
  var token=String(form.token||""), ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId), invoice=findOne_("Data_Invoice","ID_Invoice",String(form.invoice_id||"")), student=findOne_("Data_Siswa","ID_Siswa",ctx.userId);
  require_(e&&invoice&&student,"NOT_FOUND","Invoice not found.");
  require_(invoice.ID_Enrollment===e.ID_Enrollment,"AUTH_FORBIDDEN","Invoice does not belong to you.");
  require_(invoice.Status!=="PAID","PAYMENT_ALREADY_APPROVED","This invoice is already paid.");
  require_(!findMany_("Data_Payment","ID_Invoice",invoice.ID_Invoice).some(function(x){return x.Status==="PENDING";}),"PAYMENT_PENDING","A payment proof for this invoice is already awaiting verification.");
  var blob=form.file; require_(blob,"FILE_INVALID","Payment proof is required.");
  require_(blob.getBytes().length<=10485760,"FILE_TOO_LARGE","Payment proof must be 10 MB or smaller.");
  require_([ "application/pdf","image/jpeg","image/png" ].indexOf(blob.getContentType())>=0,"FILE_INVALID","Payment proof must be PDF, JPG, or PNG.");
  var file=saveBlobToStudentFolder_(student,blob,"Payments",invoice.Invoice_Number+"_proof_"+Date.now());
  var pay={ID_Payment:makeId_("PAY"),ID_Invoice:invoice.ID_Invoice,ID_Enrollment:e.ID_Enrollment,Nominal:Number(invoice.Nominal||0),Payment_Method:String(form.payment_method||"BANK_TRANSFER"),Proof_Drive_File_ID:file.getId(),Submitted_At:now_(),Status:"PENDING",Approved_By:"",Approved_At:"",Rejection_Reason:""};
  appendObject_("Data_Payment",pay);
  updateObject_("Data_Invoice","ID_Invoice",invoice.ID_Invoice,{Status:"PENDING",Updated_At:now_()});
  invalidateStudentDashboardCache_(ctx.userId);
  return {payment_id:pay.ID_Payment};
}

function adminPayments_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Data_Payment");
  if(filters&&filters.status&&filters.status!=="ALL") rows=rows.filter(function(x){return x.Status===filters.status;});
  return rows.sort(function(a,b){return String(b.Submitted_At).localeCompare(String(a.Submitted_At));}).map(function(x){
    var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment), s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa), inv=findOne_("Data_Invoice","ID_Invoice",x.ID_Invoice);
    return {id:x.ID_Payment,student_id:s&&s.ID_Siswa,student_name:s&&s.Nama_Lengkap,invoice_number:inv&&inv.Invoice_Number,billing_month:inv&&billingMonthKey_(inv.Billing_Month),amount:Number(x.Nominal||0),method:x.Payment_Method,proof_file_id:x.Proof_Drive_File_ID,status:x.Status,submitted_at:x.Submitted_At,rejection_reason:x.Rejection_Reason||""};
  });
}

function syncStudentAccountStatus_(studentId) {
  var rows=findMany_("Data_Enrollment","ID_Siswa",studentId);
  var activeOrCompleted=rows.some(function(x){return x.Status==="ACTIVE"||x.Status==="COMPLETED";});
  var student=findOne_("Data_Siswa","ID_Siswa",studentId);
  if(student) updateObject_("Data_Siswa","ID_Siswa",studentId,{Status_Akun:activeOrCompleted?"ACTIVE":"INACTIVE",Updated_At:now_()});
  return activeOrCompleted;
}

function adminApprovePayment_(token,paymentId) {
  var ctx=getAuthContext_(token,"ADMIN"), p=findOne_("Data_Payment","ID_Payment",String(paymentId||""));
  require_(p,"NOT_FOUND","Payment not found.");
  var inv=findOne_("Data_Invoice","ID_Invoice",p.ID_Invoice); require_(inv,"NOT_FOUND","Invoice not found.");
  var e=findOne_("Data_Enrollment","ID_Enrollment",p.ID_Enrollment||inv.ID_Enrollment); require_(e,"NOT_FOUND","Enrollment not found.");
  if(p.Status==="APPROVED") return {approved:true,already_approved:true,student_active:e.Status==="ACTIVE",package_credit:{applied:false,reason:"ALREADY_APPROVED"}};
  require_(!findMany_("Data_Payment","ID_Invoice",inv.ID_Invoice).some(function(x){return x.ID_Payment!==p.ID_Payment&&x.Status==="APPROVED";}),"PAYMENT_ALREADY_APPROVED","This invoice has already been paid by another approved payment.");
  updateObject_("Data_Payment","ID_Payment",p.ID_Payment,{Status:"APPROVED",Approved_By:ctx.userId,Approved_At:now_(),Rejection_Reason:""});
  updateObject_("Data_Invoice","ID_Invoice",inv.ID_Invoice,{Status:"PAID",Updated_At:now_()});
  var paidNow=findOne_("Data_Invoice","ID_Invoice",inv.ID_Invoice);
  require_(paidNow && paidNow.Status==="PAID","PAYMENT_NOT_PAID","Payment approval could not activate the enrollment.");
  if(e.Status==="INACTIVE") updateObject_("Data_Enrollment","ID_Enrollment",e.ID_Enrollment,{Status:"ACTIVE",Updated_At:now_()});
  var creditGrant={applied:false};
  try { if(typeof grantPackageCreditsForPayment_==="function")creditGrant=grantPackageCreditsForPayment_(p,e,ctx.userId); } catch(creditErr) { audit_(ctx,"PACKAGE_PURCHASE_CREDIT_FAILED","Package_Credit_Ledger",e.ID_Enrollment,String(creditErr.message||creditErr),"FAILED"); }
  ensureStudentAssignmentsForEnrollment_(findOne_("Data_Enrollment","ID_Enrollment",e.ID_Enrollment));
  syncStudentAccountStatus_(e.ID_Siswa);
  invalidateStudentDashboardCache_(e.ID_Siswa);
  audit_(ctx,"APPROVE_PAYMENT","Data_Payment",p.ID_Payment,"Payment approved; enrollment activated","SUCCESS");
  return {approved:true,student_active:true,package_credit:creditGrant};
}

function adminRejectPayment_(token,paymentId,reason) {
  var ctx=getAuthContext_(token,"ADMIN"), p=findOne_("Data_Payment","ID_Payment",String(paymentId||""));
  require_(p,"NOT_FOUND","Payment not found.");
  var inv=findOne_("Data_Invoice","ID_Invoice",p.ID_Invoice);
  if(p.Status==="REJECTED") return {rejected:true,already_rejected:true};
  var wasApproved=p.Status==="APPROVED", reversal={applied:false};
  if(wasApproved){ // blueprint 11.7: pembatalan pembayaran yang sudah disetujui harus membalik kredit lewat ledger
    var granted=findMany_("Package_Credit_Ledger","Source_Key","PAYMENT:"+p.ID_Payment)[0];
    if(granted&&Number(granted.Credit_Change)>0){var row=addPackageCreditLedger_({enrollment_id:granted.ID_Enrollment,package_id:granted.ID_Package,transaction_type:"REVERSAL",credit_change:-Number(granted.Credit_Change),note:"Payment approval reversed",created_by:ctx.userId,source_key:"PAYMENT_REVERSAL:"+p.ID_Payment});reversal={applied:true,ledger_id:row.ID_Ledger};}
  }
  updateObject_("Data_Payment","ID_Payment",p.ID_Payment,{Status:"REJECTED",Approved_By:ctx.userId,Approved_At:now_(),Rejection_Reason:String(reason||"Payment proof rejected.")});
  if(inv) updateObject_("Data_Invoice","ID_Invoice",inv.ID_Invoice,{Status:"UNPAID",Updated_At:now_()});
  var e=findOne_("Data_Enrollment","ID_Enrollment",p.ID_Enrollment||inv&&inv.ID_Enrollment); if(e && e.Status==="INACTIVE") syncStudentAccountStatus_(e.ID_Siswa);
  audit_(ctx,"REJECT_PAYMENT","Data_Payment",p.ID_Payment,String(reason||"Payment proof rejected."),"SUCCESS");
  return {rejected:true,credit_reversal:reversal};
}