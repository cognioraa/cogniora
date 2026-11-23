function certificateEligibility_(e) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch);
  var completed=completedMonths_(e), max=Number(batch.Durasi_Bulan||1);
  var schedules=doneSchedulesForBatch_(e.ID_Batch), doneIds={};
  schedules.forEach(function(x){doneIds[x.ID_Schedule]=true;});
  var attendance=findMany_("Student_Attendance","ID_Enrollment",e.ID_Enrollment);
  var attendancePct=schedules.length?attendance.filter(function(a){return doneIds[a.ID_Schedule]&&["PRESENT","LATE"].indexOf(a.Status)>=0;}).length/schedules.length*100:100;
  var assignments=findMany_("Batch_Assignment","ID_Batch",e.ID_Batch).filter(function(x){var a=findOne_("Data_Assignment","ID_Assignment",x.ID_Assignment);return x.Status==="ACTIVE"&&a&&a.Status==="ACTIVE"&&bool_(a.Required);});
  var sa=findMany_("Student_Assignment","ID_Enrollment",e.ID_Enrollment);
  var assignmentPct=assignments.length?assignments.filter(function(x){return sa.some(function(y){return y.ID_Batch_Assignment===x.ID_Batch_Assignment&&y.Status==="ACCEPTED";});}).length/assignments.length*100:100;
  var reports=findMany_("Data_Report","ID_Enrollment",e.ID_Enrollment), finalAverage=reports.length?reports.reduce(function(a,r){return a+Number(r.Average||0);},0)/reports.length:0;
  var invoices=findMany_("Data_Invoice","ID_Enrollment",e.ID_Enrollment).filter(function(i){return String(i.Status)!=="CANCELLED";}), expectedMonths=billingMonthsForEnrollment_(e), paymentOk=expectedMonths.length>0 && expectedMonths.every(function(m){return invoices.some(function(i){return billingMonthKey_(i.Billing_Month)===m && String(i.Status)==="PAID";});});
  var reasons=[];
  if(completed.length<max) reasons.push("All months must be completed.");
  if(attendancePct<Number(batch.Minimum_Attendance||80)) reasons.push("Attendance requirement not met.");
  if(finalAverage<Number(batch.Minimum_Score||75)) reasons.push("Minimum average score not met.");
  if(!paymentOk) reasons.push("All invoices must be paid.");
  return {eligible:reasons.length===0,reasons:reasons,attendance_percentage:Math.round(attendancePct*100)/100,assignment_percentage:Math.round(assignmentPct*100)/100,average:Math.round(finalAverage*100)/100,completed_months:completed.length,total_months:max,reports:reports};
}

function studentCertificate_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId), existing=findMany_("Data_Certificate","ID_Enrollment",e.ID_Enrollment)[0]||null, elig=certificateEligibility_(e);
  if(existing) return {status:existing.Status,eligible:elig.eligible,requirements:elig,certificate:{id:existing.ID_Certificate,no:existing.No_Sertifikat,verification_code:existing.Verification_Code,issue_date:formatIndonesianLongDate_(existing.Issue_Date),file_url:existing.File_URL||"",version:Number(existing.Version||1)}};
  return {status:elig.eligible?"ELIGIBLE":"LOCKED",eligible:elig.eligible,requirements:elig,certificate:null};
}

function adminCertificates_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  return sheetToObjects_("Data_Certificate").map(function(c){var e=findOne_("Data_Enrollment","ID_Enrollment",c.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch);return {id:c.ID_Certificate,enrollment_id:c.ID_Enrollment,student_id:s&&s.ID_Siswa,student_name:s&&s.Nama_Lengkap,batch_name:b&&b.Nama_Batch,no:c.No_Sertifikat,verification_code:c.Verification_Code,issue_date:formatIndonesianLongDate_(c.Issue_Date),status:c.Status,version:Number(c.Version||1),file_url:c.File_URL||(c.File_ID?"https://drive.google.com/file/d/"+c.File_ID+"/view":""),file_id:c.File_ID||""};});
}

function adminCertificateEligibility_(token,data) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||"")); require_(e,"NOT_FOUND","Enrollment not found.");
  return certificateEligibility_(e);
}

// V40: topik bulanan per Learning Package dibaca dari sheet Monthly_Topic (diisi manual).
// Kecocokan: ID_Package ATAU Learning_Package (nama paket / ID paket), Month_No angka, Status bukan INACTIVE.
function monthlyTopicsForEnrollment_(enrollment) {
  var out={};
  try { ensureSheet_("Monthly_Topic",COGNIORA_SCHEMA.Monthly_Topic); } catch(ensureErr) { return out; }
  var pkg=findOne_("Data_Package","ID_Package",enrollment&&enrollment.ID_Package);
  var pkgId=String(enrollment&&enrollment.ID_Package||"").trim().toLowerCase();
  var pkgName=String(pkg&&pkg.Nama_Paket||"").trim().toLowerCase();
  var rows=sheetToObjects_("Monthly_Topic").filter(function(r){
    if(String(r.Status||"").toUpperCase()==="INACTIVE") return false;
    var rid=String(r.ID_Package||"").trim().toLowerCase(), rname=String(r.Learning_Package||"").trim().toLowerCase();
    return (pkgId && (rid===pkgId || rname===pkgId)) || (pkgName && (rname===pkgName || rid===pkgName));
  }).sort(function(a,b){return Number(a.Month_No)-Number(b.Month_No)||Number(a.Urutan||0)-Number(b.Urutan||0);});
  rows.forEach(function(r){
    var m=Number(r.Month_No), t=String(r.Topic||"").trim();
    if(!m||!t) return;
    out[m]=out[m]?out[m]+", "+t:t;
  });
  return out;
}

function certificatePlaceholderMap_(student,enrollment,batch,program,eligibility,no,verification) {
  var map={No_Sertifikat:no,Nama_Lengkap:student.Nama_Lengkap,Program:program&&program.Nama_Program,Level:batch.Level,ID_Siswa:student.ID_Siswa,Nama_Batch:batch.Nama_Batch,ID_Batch:batch.ID_Batch,Tanggal_Mulai:formatIndonesianLongDate_(enrollment.Tanggal_Mulai),Tanggal_Selesai:formatIndonesianLongDate_(enrollment.Tanggal_Selesai),
    Rata_Rata_Akhir:eligibility.average?String(Math.round(eligibility.average*100)/100):"0",Predikat:predicateFromAverage_(eligibility.average),Tanggal_Diterbitkan:formatIndonesianLongDate_(new Date()),Kode_Verifikasi:verification};
  var rows=eligibility.reports||[];
  var syllabus=findMany_("Batch_Syllabus","ID_Batch",batch.ID_Batch), monthly=monthlyTopicsForEnrollment_(enrollment);
  var pkgRow=findOne_("Data_Package","ID_Package",enrollment&&enrollment.ID_Package);
  map.Learning_Package=pkgRow?pkgRow.Nama_Paket:"";
  for(var m=1;m<=Number(batch.Durasi_Bulan||1);m++){
    // Sumber utama: Monthly_Topic. Cadangan (jika belum diisi): syllabus batch.
    var topics=monthly[m]||syllabus.filter(function(x){return Number(x.Month_No)===m;}).sort(function(a,b){return Number(a.Urutan)-Number(b.Urutan);}).map(function(x){return x.Topik;}).filter(Boolean).join(", ");
    var rep=rows.filter(function(x){return Number(x.Month_No)===m;})[0];
    map["Topik_Bulan_"+m]=topics;
    map["Rata_Rata_Bulan_"+m]=rep?String(rep.Average):"";
    map["Rata-rata_Bulan_"+m]=rep?String(rep.Average):"";
  }
  map.Learning_Performances=rows.sort(function(a,b){return Number(a.Month_No)-Number(b.Month_No);}).map(function(r){
    var topic=map["Topik_Bulan_"+Number(r.Month_No)]||"";
    return "Month "+r.Month_No+" — "+topic+" — Average: "+r.Average;
  }).join("\n");
  return map;
}

function adminGenerateCertificate_(token,data,action) {
  var ctx=getAuthContext_(token,"ADMIN"), e=null, existing=null;
  if(action==="GENERATED") e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||""));
  else {
    existing=findOne_("Data_Certificate","ID_Certificate",String(data.certificate_id||""));
    require_(existing,"NOT_FOUND","Certificate not found.");
    e=findOne_("Data_Enrollment","ID_Enrollment",existing.ID_Enrollment);
  }
  require_(e,"NOT_FOUND","Enrollment not found.");
  var eligibility=certificateEligibility_(e); require_(eligibility.eligible,"CERTIFICATE_NOT_ELIGIBLE","Student is not eligible for the certificate.",eligibility);
  var templateId=getSetting_("CERTIFICATE_TEMPLATE_ID","");
  require_(templateId,"CERTIFICATE_NOT_ELIGIBLE","Certificate template ID is not configured.");
  var student=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa), batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), program=findOne_("Data_Program","ID_Program",batch.ID_Program);
  if(!existing) existing=findMany_("Data_Certificate","ID_Enrollment",e.ID_Enrollment)[0]||null;
  var no=existing?existing.No_Sertifikat:makeCertificateNumber_(batch);
  var verification=existing?existing.Verification_Code:"CGN-"+randomHex_(12);
  var version=existing?Number(existing.Version||1)+1:1;
  var certFolderId=studentSubfolderId_(student.Student_Folder_ID,"Certificates");
  var tmpDocId="", pdfFile=null;
  try {
    var tmp=DriveApp.getFileById(templateId).makeCopy("COGNIORA_CERT_"+student.ID_Siswa+"_v"+version);
    tmpDocId=tmp.getId();
    var doc=DocumentApp.openById(tmpDocId), body=doc.getBody(), map=certificatePlaceholderMap_(student,e,batch,program,eligibility,no,verification);
    Object.keys(map).forEach(function(k){body.replaceText(escapeRegex_("{{"+k+"}}"),String(map[k]||""));});
    doc.saveAndClose();
    var pdf=UrlFetchApp.fetch("https://docs.google.com/document/d/"+encodeURIComponent(tmpDocId)+"/export?format=pdf",{headers:{Authorization:"Bearer "+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    require_(pdf.getResponseCode()===200,"DRIVE_ERROR","Could not export certificate PDF.");
    pdfFile=DriveApp.getFolderById(certFolderId).createFile(pdf.getBlob().setName(no+"_v"+version+".pdf"));
    shareFileWithStudent_(pdfFile.getId(),student.Email);
    var cert={ID_Certificate:existing?existing.ID_Certificate:makeId_("CERT"),ID_Enrollment:e.ID_Enrollment,No_Sertifikat:no,Verification_Code:verification,Issue_Date:today_(),File_ID:pdfFile.getId(),File_URL:pdfFile.getUrl(),Status:"ISSUED",Version:version,Generated_At:now_(),Generated_By:ctx.userId};
    if(existing) updateObject_("Data_Certificate","ID_Certificate",existing.ID_Certificate,cert); else appendObject_("Data_Certificate",cert);
    appendObject_("Certificate_History",{ID_History:makeId_("CHIS"),ID_Certificate:cert.ID_Certificate,Version:version,Action:action||"GENERATED",Previous_File_ID:existing?existing.File_ID:"",New_File_ID:pdfFile.getId(),Reason:String(data.reason||""),Performed_By:ctx.userId,Performed_At:now_()});
    try{sendCertificateEmail_(student,cert);}catch(e2){}
    audit_(ctx,action||"GENERATE_CERTIFICATE","Data_Certificate",cert.ID_Certificate,"Certificate version "+version,"SUCCESS");
    return {certificate:{id:cert.ID_Certificate,no:cert.No_Sertifikat,verification_code:cert.Verification_Code,file_url:cert.File_URL,version:cert.Version,status:cert.Status}};
  } finally {
    if(tmpDocId) try{DriveApp.getFileById(tmpDocId).setTrashed(true);}catch(e3){}
  }
}

function adminRevokeCertificate_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), c=findOne_("Data_Certificate","ID_Certificate",String(data.certificate_id||"")); require_(c,"NOT_FOUND","Certificate not found.");
  updateObject_("Data_Certificate","ID_Certificate",c.ID_Certificate,{Status:"LOCKED"});
  appendObject_("Certificate_History",{ID_History:makeId_("CHIS"),ID_Certificate:c.ID_Certificate,Version:Number(c.Version||1)+1,Action:"REVOKED",Previous_File_ID:c.File_ID,New_File_ID:c.File_ID,Reason:String(data.reason||"Certificate revoked."),Performed_By:ctx.userId,Performed_At:now_()});
  return {revoked:true};
}

// V42: View certificate (student) -> Drive.
function studentCertificateDriveLink_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  var cert=findMany_("Data_Certificate","ID_Enrollment",e.ID_Enrollment)[0];
  require_(cert && cert.File_ID,"NOT_FOUND","Certificate file is not available yet.");
  return driveViewLinkForStudent_(String(cert.File_ID),ctx.userId);
}
