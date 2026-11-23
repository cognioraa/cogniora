function studentReports_(token,month) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  var m=Math.max(1,Number(month||1)), rep=findMany_("Data_Report","ID_Enrollment",e.ID_Enrollment).filter(function(x){return Number(x.Month_No)===m;})[0];
  if(!rep) return {month:m,month_label:monthLabel_(m),scores:null};
  return {month:m,month_label:monthLabel_(m),scores:{listening:Number(rep.Listening||0),speaking:Number(rep.Speaking||0),reading:Number(rep.Reading||0),writing:Number(rep.Writing||0),grammar:Number(rep.Grammar||0)},average:Number(rep.Average||0),
    feedback:{listening:rep.Listening_Feedback||"",speaking:rep.Speaking_Feedback||"",reading:rep.Reading_Feedback||"",writing:rep.Writing_Feedback||"",grammar:rep.Grammar_Feedback||""},general_feedback:rep.General_Feedback||""};
}

function studentReportMonths_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId), rows=e?findMany_("Data_Report","ID_Enrollment",e.ID_Enrollment):[];
  var batch=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch), max=batch?Number(batch.Durasi_Bulan||1):1, out=[];
  for(var m=1;m<=max;m++){
    var r=rows.filter(function(x){return Number(x.Month_No)===m;})[0];
    out.push({month:m,label:monthLabel_(m),average:r?Number(r.Average||0):null});
  }
  return out;
}

function adminReports_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Data_Report");
  if(filters&&filters.enrollment_id) rows=rows.filter(function(x){return x.ID_Enrollment===filters.enrollment_id;});
  return rows.map(function(x){
    var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa);
    return {id:x.ID_Report,enrollment_id:x.ID_Enrollment,student_id:s&&s.ID_Siswa,student_name:s&&s.Nama_Lengkap,month:Number(x.Month_No||0),scores:{listening:Number(x.Listening||0),speaking:Number(x.Speaking||0),reading:Number(x.Reading||0),writing:Number(x.Writing||0),grammar:Number(x.Grammar||0)},average:Number(x.Average||0),feedback:{listening:x.Listening_Feedback||"",speaking:x.Speaking_Feedback||"",reading:x.Reading_Feedback||"",writing:x.Writing_Feedback||"",grammar:x.Grammar_Feedback||""},general_feedback:x.General_Feedback||""};
  });
}

function adminSaveReport_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), enrollment=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||""));
  require_(enrollment,"NOT_FOUND","Enrollment not found.");
  var m=Math.max(1,Number(data.month||1)), scores=["listening","speaking","reading","writing","grammar"].map(function(k){return clamp_(Number(data[k]||0),0,100);});
  var avg=Math.round(scores.reduce(function(a,b){return a+b;},0)/5*100)/100;
  var existing=findMany_("Data_Report","ID_Enrollment",enrollment.ID_Enrollment).filter(function(x){return Number(x.Month_No)===m;})[0];
  var obj={ID_Report:existing?existing.ID_Report:makeId_("REP"),ID_Enrollment:enrollment.ID_Enrollment,Month_No:m,Listening:scores[0],Speaking:scores[1],Reading:scores[2],Writing:scores[3],Grammar:scores[4],Average:avg,
    Listening_Feedback:String(data.listening_feedback||""),Speaking_Feedback:String(data.speaking_feedback||""),Reading_Feedback:String(data.reading_feedback||""),Writing_Feedback:String(data.writing_feedback||""),Grammar_Feedback:String(data.grammar_feedback||""),General_Feedback:String(data.general_feedback||""),Updated_By:ctx.userId,Updated_At:now_()};
  if(existing) updateObject_("Data_Report","ID_Report",existing.ID_Report,obj); else appendObject_("Data_Report",obj);
  recalculateEnrollmentState_(enrollment.ID_Enrollment);
  return {id:obj.ID_Report,average:avg};
}

function adminAchievements_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Data_Achievement").filter(function(x){return x.Status==="ACTIVE" && String(x.ID_Batch||"").trim()!=="";});
  if(filters&&filters.batch_id) rows=rows.filter(function(x){return String(x.ID_Batch)===String(filters.batch_id);});
  return rows.map(function(x){
    var b=findOne_("Data_Batch","ID_Batch",x.ID_Batch);
    return {id:x.ID_Achievement,name:x.Nama_Achievement,description:x.Description,icon_file_id:x.Icon_File_ID||"",type:x.Type,requirement_type:x.Requirement_Type||"",requirement_value:x.Requirement_Value||"",batch_id:x.ID_Batch,batch_name:b&&b.Nama_Batch,status:x.Status};
  });
}

function adminSaveAchievement_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"),id=String(data.id_achievement||""),batchId=String(data.batch_id||"").trim();
  require_(batchId,"VALIDATION_ERROR","Batch is required for every achievement.");
  require_(findOne_("Data_Batch","ID_Batch",batchId),"NOT_FOUND","Batch not found.");
  var existing=id?findOne_("Data_Achievement","ID_Achievement",id):null;
  var obj={ID_Achievement:id||makeId_("ACH"),Nama_Achievement:String(data.name||"").trim(),Description:String(data.description||"").trim(),Icon_File_ID:String(data.icon_file_id||"").trim(),Type:String(data.type||"MANUAL").trim(),Requirement_Type:String(data.requirement_type||"").trim(),Requirement_Value:String(data.requirement_value||"").trim(),Status:String(data.status||"ACTIVE").trim(),Created_At:existing?existing.Created_At||now_():now_(),Created_By:existing?existing.Created_By||ctx.userId:ctx.userId,ID_Batch:batchId};
  require_(obj.Nama_Achievement,"VALIDATION_ERROR","Achievement name is required.");
  require_(["AUTOMATIC","MANUAL"].indexOf(obj.Type)>=0,"VALIDATION_ERROR","Invalid achievement type.");
  require_(["ACTIVE","INACTIVE"].indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid achievement status.");
  if(obj.Type==="AUTOMATIC") require_(obj.Requirement_Type && obj.Requirement_Value!=="","VALIDATION_ERROR","Automatic achievement requires a requirement type and value.");
  if(id) updateObject_("Data_Achievement","ID_Achievement",id,obj); else appendObject_("Data_Achievement",obj);
  audit_(ctx,id?"UPDATE_ACHIEVEMENT":"CREATE_ACHIEVEMENT","Data_Achievement",obj.ID_Achievement,obj.Nama_Achievement+" | Batch "+batchId,"SUCCESS");
  return {id:obj.ID_Achievement,batch_id:batchId};
}

function studentAchievements_(e) {
  var rows=findMany_("Student_Achievement","ID_Enrollment",e.ID_Enrollment);
  var schedules=findMany_("Data_Schedule","ID_Batch",e.ID_Batch).filter(function(x){return String(x.Status)!=="CANCELLED";})
    .sort(function(a,b){return String(a.Tanggal).localeCompare(String(b.Tanggal));});
  return rows.map(function(x){
    var a=findOne_("Data_Achievement","ID_Achievement",x.ID_Achievement);
    return {id:x.ID_Student_Achievement,achievement_id:x.ID_Achievement,name:a&&a.Nama_Achievement,description:a&&a.Description,icon_url:a?getDriveImageDataUrlSafe_(a.Icon_File_ID):"",awarded_at:x.Awarded_At,source:x.Source,note:x.Note||"",month:achievementMonth_(x,a,schedules)};
  });
}

// Bulan achievement: untuk achievement otomatis "MONTH_COMPLETED" memakai nilai requirement;
// selain itu dihitung dari pertemuan terakhir yang tanggalnya <= tanggal achievement diberikan.
function achievementMonth_(sa,a,schedules) {
  if(a && String(a.Requirement_Type)==="MONTH_COMPLETED" && Number(a.Requirement_Value)>0) return Number(a.Requirement_Value);
  var d=toClientDate_(sa.Awarded_At), month=0;
  (schedules||[]).forEach(function(s){ if(d && String(s.Tanggal)<=d) month=Number(s.Month_No||0)||month; });
  return month>0?month:1;
}

// Rekap Progress student: nilai per bulan + achievement per bulan + progres pertemuan.
function studentProgressOverview_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), max=batch?Math.max(1,Number(batch.Durasi_Bulan||1)):1, per=batch?Number(batch.Pertemuan_Per_Bulan||0):0;
  var active=(e.Status==="ACTIVE"||e.Status==="COMPLETED");
  var reports=findMany_("Data_Report","ID_Enrollment",e.ID_Enrollment);
  var achs=active?studentAchievements_(e):[];
  var info=doneScheduleMap_(e.ID_Batch), completed=active?completedMonths_(e):[];
  var months=[], sum=0, n=0, myMeetings=0;
  for(var m=1;m<=max;m++){
    var r=reports.filter(function(x){return Number(x.Month_No)===m;})[0];
    var mm=studentMonthMeetings_(e,m); myMeetings+=mm.done;
    var item={month:m,label:monthLabel_(m),completed:completed.indexOf(m)>=0,meetings_done:mm.done,meetings_total:per>0?per:mm.scheduled,
      scores:null,average:null,feedback:{},general_feedback:"",achievements:achs.filter(function(a){return Number(a.month)===m;})};
    if(r){
      item.scores={listening:Number(r.Listening||0),speaking:Number(r.Speaking||0),reading:Number(r.Reading||0),writing:Number(r.Writing||0),grammar:Number(r.Grammar||0)};
      item.average=Number(r.Average||0); sum+=item.average; n++;
      item.feedback={listening:r.Listening_Feedback||"",speaking:r.Speaking_Feedback||"",reading:r.Reading_Feedback||"",writing:r.Writing_Feedback||"",grammar:r.Grammar_Feedback||""};
      item.general_feedback=r.General_Feedback||"";
    }
    months.push(item);
  }
  var totalDone=myMeetings;
  return {
    learning:active?learningProgress_(e):{completed:0,total:0,percentage:0},
    meetings:{done:totalDone,total:per>0?per*max:0,per_month:per},
    overall_average:n?Math.round(sum/n*100)/100:null,
    achievements_total:achs.length,
    current_month:Number(e.Current_Month||1),
    months:months
  };
}

function awardAchievement_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||"")), a=findOne_("Data_Achievement","ID_Achievement",String(data.achievement_id||""));
  require_(e&&a,"NOT_FOUND","Enrollment or achievement not found.");
  require_(String(a.ID_Batch||"")===String(e.ID_Batch),"VALIDATION_ERROR","This achievement belongs to a different batch.");
  if(findMany_("Student_Achievement","ID_Enrollment",e.ID_Enrollment).some(function(x){return x.ID_Achievement===a.ID_Achievement;})) return {already_awarded:true};
  var row={ID_Student_Achievement:makeId_("SACH"),ID_Enrollment:e.ID_Enrollment,ID_Achievement:a.ID_Achievement,Awarded_At:now_(),Awarded_By:ctx.userId,Source:"MANUAL",Note:String(data.note||"")};
  appendObject_("Student_Achievement",row); invalidateStudentDashboardCache_(e.ID_Siswa); return {awarded:true};
}

function autoAwardMonthAchievements_(e) {
  var completed=completedMonths_(e), ach=sheetToObjects_("Data_Achievement").filter(function(a){return a.Status==="ACTIVE"&&a.Type==="AUTOMATIC"&&a.Requirement_Type==="MONTH_COMPLETED"&&String(a.ID_Batch||"")===String(e.ID_Batch||"");});
  completed.forEach(function(m){
    ach.filter(function(a){return Number(a.Requirement_Value)===m;}).forEach(function(a){
      var already=findMany_("Student_Achievement","ID_Enrollment",e.ID_Enrollment).some(function(x){return x.ID_Achievement===a.ID_Achievement;});
      if(!already) appendObject_("Student_Achievement",{ID_Student_Achievement:makeId_("SACH"),ID_Enrollment:e.ID_Enrollment,ID_Achievement:a.ID_Achievement,Awarded_At:now_(),Awarded_By:"SYSTEM",Source:"AUTOMATIC",Note:"Automatically awarded when Month "+m+" was completed."});
    });
  });
}

function recalculateEnrollmentState_(enrollmentId) {
  var e=findOne_("Data_Enrollment","ID_Enrollment",enrollmentId); if(!e) return;
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch); if(!batch) return;
  var max=Number(batch.Durasi_Bulan||1), completed=completedMonths_(e), currentMonth=1;
  for(var m=1;m<=max;m++){ if(completed.indexOf(m)<0){currentMonth=m;break;} currentMonth=Math.min(max,m+1); }
  var currentMeeting=studentMeetingsSummary_(e).done; // V40: jumlah pertemuan yang kehadirannya sudah diinput untuk siswa ini
  var status=e.Status, completionStatus=completed.length>=max?"COMPLETED":"IN_PROGRESS";
  if(status!=="CANCELLED" && completed.length>=max) status="COMPLETED";
  updateObject_("Data_Enrollment","ID_Enrollment",e.ID_Enrollment,{Status:status,Current_Month:currentMonth,Current_Meeting:currentMeeting,Completion_Status:completionStatus,Updated_At:now_()});
  autoAwardMonthAchievements_(findOne_("Data_Enrollment","ID_Enrollment",e.ID_Enrollment));
}

function completedMonths_(e) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch); if(!batch) return [];
  var max=Number(batch.Durasi_Bulan||1), out=[];
  for(var m=1;m<=max;m++){
    if(monthIsComplete_(e,m)) out.push(m);
    else break;
  }
  return out;
}

// V38: sebuah bulan SELESAI bila (1) seluruh pertemuan bulan itu sudah diinput kehadirannya untuk siswa ini
// dan (2) nilai bulanan siswa >= Minimum_Score batch. Material dan assignment BUKAN syarat penyelesaian.
function studentMonthMeetings_(e,m) {
  var info=doneScheduleMap_(e.ID_Batch);
  var att=findMany_("Student_Attendance","ID_Enrollment",e.ID_Enrollment);
  var sch=info.schedules.filter(function(x){return Number(x.Month_No||1)===m;});
  var all={}, got={}, recorded=[];
  sch.forEach(function(s){
    var key=Number(s.Meeting_No||0); all[key]=true;
    var a=att.filter(function(x){return x.ID_Schedule===s.ID_Schedule;})[0];
    if(a){ got[key]=true; recorded.push(a); }
  });
  return {scheduled:Object.keys(all).length,done:Object.keys(got).length,recorded:recorded};
}

function monthIsComplete_(e,m) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch); if(!batch) return false;
  var mm=studentMonthMeetings_(e,m), perMonth=Number(batch.Pertemuan_Per_Bulan||0);
  var required=perMonth>0?perMonth:mm.scheduled;
  if(required<=0 || mm.done<required) return false;
  var present=mm.recorded.filter(function(a){return ["PRESENT","LATE"].indexOf(a.Status)>=0;}).length;
  if(mm.recorded.length && present/mm.recorded.length*100 < Number(batch.Minimum_Attendance||80)) return false;
  var rep=findMany_("Data_Report","ID_Enrollment",e.ID_Enrollment).filter(function(x){return Number(x.Month_No)===m;})[0];
  if(!rep || Number(rep.Average||0) < Number(batch.Minimum_Score||75)) return false;
  return true;
}

function adminOverview_(token) {
  var ctx=getAuthContext_(token,"ADMIN");
  var leads=sheetToObjects_("Data_Leads"), students=sheetToObjects_("Data_Siswa"), batches=sheetToObjects_("Data_Batch");
  var payments=sheetToObjects_("Data_Payment"), invoices=sheetToObjects_("Data_Invoice"), enrollments=sheetToObjects_("Data_Enrollment");
  var pendingPayments=payments.filter(function(x){return x.Status==="PENDING";});
  var pendingAssignments=sheetToObjects_("Student_Assignment").filter(function(x){return x.Status==="SUBMITTED"||x.Status==="NEED_REVISION";});
  var thisMonth=today_().substring(0,7), today=today_();
  // Blueprint 11.10: kas masuk = pembayaran APPROVED; piutang = invoice belum lunas.
  var revenueThisMonth=payments.filter(function(x){return x.Status==="APPROVED"&&String(x.Approved_At||x.Submitted_At||"").substring(0,7)===thisMonth;}).reduce(function(n,x){return n+Number(x.Nominal||0);},0);
  var outstanding=invoices.filter(function(x){return ["UNPAID","PENDING","OVERDUE"].indexOf(String(x.Status))>=0;}).reduce(function(n,x){return n+Number(x.Nominal||0);},0);
  var batchMap={};batches.forEach(function(b){batchMap[b.ID_Batch]=b;});
  var upcoming=sheetToObjects_("Data_Schedule").filter(function(x){return x.Status!=="CANCELLED"&&String(x.Tanggal)>=today;}).sort(function(a,b){return String(a.Tanggal+" "+a.Jam_Mulai).localeCompare(String(b.Tanggal+" "+b.Jam_Mulai));}).slice(0,10).map(function(x){return {id:x.ID_Schedule,title:x.Judul,batch_id:batchMap[x.ID_Batch]?batchMap[x.ID_Batch].Nama_Batch:x.ID_Batch,date:x.Tanggal,start:x.Jam_Mulai,type:x.Tipe,status:x.Status};});
  var lowCredit=0;
  try{
    var ruleByPkg={};sheetToObjects_("Data_Package_Rules").forEach(function(r){if(r.Status==="ACTIVE")ruleByPkg[r.ID_Package]=r;});
    var bal={};sheetToObjects_("Package_Credit_Ledger").forEach(function(l){bal[l.ID_Enrollment]=(bal[l.ID_Enrollment]||0)+Number(l.Credit_Change||0);});
    enrollments.forEach(function(e){if(e.Status==="ACTIVE"&&ruleByPkg[e.ID_Package]&&(bal[e.ID_Enrollment]||0)<=1)lowCredit++;});
  }catch(creditErr){}
  var pendingAssessments=sheetToObjects_("Assessment_Attempts").filter(function(x){return x.Status==="PENDING_REVIEW";}).length;
  return {
    leads_total:leads.length,leads_new:leads.filter(function(x){return x.Status==="NEW";}).length,
    students_total:students.filter(function(x){return x.Status_Akun==="ACTIVE";}).length,
    active_enrollments:enrollments.filter(function(x){return x.Status==="ACTIVE";}).length,
    active_batches:batches.filter(function(x){return x.Status==="ACTIVE"||x.Status==="PLANNED";}).length,
    revenue_this_month:revenueThisMonth,outstanding_payments:outstanding,
    pending_payments:pendingPayments.length,pending_assignments:pendingAssignments.length,pending_assessments:pendingAssessments,low_credit_enrollments:lowCredit,
    sessions_today:upcoming.filter(function(x){return String(x.date)===today;}).length,
    upcoming_sessions:upcoming,
    upcoming_batches:batches.filter(function(x){return ["PLANNED","ACTIVE"].indexOf(x.Status)>=0;}).slice(0,10).map(function(b){return {id:b.ID_Batch,name:b.Nama_Batch,start_date:toClientDate_(b.Tanggal_Mulai),end_date:toClientDate_(b.Tanggal_Selesai),status:b.Status};})
  };
}

function studentReportMonthsFromBatch_(e) { return studentReportMonthsByEnrollment_(e); }
function studentReportMonthsByEnrollment_(e) { 
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), max=batch?Number(batch.Durasi_Bulan||1):1, out=[];
  for(var m=1;m<=max;m++){ var r=findMany_("Data_Report","ID_Enrollment",e.ID_Enrollment).filter(function(x){return Number(x.Month_No)===m;})[0]; out.push({month:m,label:monthLabel_(m),average:r?Number(r.Average||0):null});}
  return out;
}