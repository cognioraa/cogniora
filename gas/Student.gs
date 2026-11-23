function studentDashboard_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  // Short server-side cache reduces repeated Google Sheets reads when the dashboard is revisited.
  var cache=CacheService.getUserCache(), cacheKey="COGNIORA_DASHBOARD_"+ctx.userId+"_"+e.ID_Enrollment;
  try{var cached=cache.get(cacheKey);if(cached)return JSON.parse(cached);}catch(cacheReadErr){}

  var s=findOne_("Data_Siswa","ID_Siswa",ctx.userId), batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), program=batch?findOne_("Data_Program","ID_Program",batch.ID_Program):null;
  var activeEnrollment=(e.Status==="ACTIVE"||e.Status==="COMPLETED");
  var progress=activeEnrollment?learningProgress_(e):{completed:0,total:0,percentage:0};
  var upcoming=activeEnrollment?upcomingSchedule_(e,5):[];
  var recentAssignments=activeEnrollment?studentAssignments_(e,{limit:5,skip_ensure:true}):[];
  var payment=paymentSummary_(e);
  var achievements=activeEnrollment?studentAchievements_(e):[];
  var existingCert=findMany_("Data_Certificate","ID_Enrollment",e.ID_Enrollment)[0]||null;
  var cert=existingCert?{status:existingCert.Status,certificate:{id:existingCert.ID_Certificate,no:existingCert.No_Sertifikat,version:Number(existingCert.Version||1)}}:{status:"LOCKED"};
  var out={
    student:{id:s.ID_Siswa,name:s.Nama_Lengkap,email:s.Email,phone:s.Nomor_WA,photo_url:getDriveImageDataUrlSafe_(s.Foto_File_ID)},
    enrollment:activeEnrollment?applyLiveProgress_(publicEnrollment_(e),e):publicEnrollment_(e),
    batch:{id:batch&&batch.ID_Batch,name:batch&&batch.Nama_Batch,level:batch&&batch.Level,duration_months:batch&&Number(batch.Durasi_Bulan||0),meetings_per_month:batch&&Number(batch.Pertemuan_Per_Bulan||0)},
    program:{id:program&&program.ID_Program,name:program&&program.Nama_Program,level:program&&program.Level},
    learning_progress:progress,
    meetings:activeEnrollment?studentMeetingsSummary_(e):{done:0,total:0,per_month:0},
    upcoming_classes:upcoming,
    recent_assignments:recentAssignments,
    payment:payment,
    certificate:cert,
    achievements:achievements
  };
  try{cache.put(cacheKey,JSON.stringify(out),15);}catch(cacheWriteErr){}
  return out;
}


function invalidateStudentDashboardCache_(studentId) {
  try{
    if(!studentId)return;
    var cache=CacheService.getUserCache();
    cache.remove("COGNIORA_DASHBOARD_"+String(studentId));
    findMany_("Data_Enrollment","ID_Siswa",String(studentId)).forEach(function(e){cache.remove("COGNIORA_DASHBOARD_"+String(studentId)+"_"+String(e.ID_Enrollment));});
  }catch(e){}
}

function studentProfile_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), s=findOne_("Data_Siswa","ID_Siswa",ctx.userId), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(s,"NOT_FOUND","Student not found.");
  var b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch), p=b&&findOne_("Data_Program","ID_Program",b.ID_Program);
  return {id:s.ID_Siswa,name:s.Nama_Lengkap,email:s.Email,phone:s.Nomor_WA,photo_url:getDriveImageDataUrlSafe_(s.Foto_File_ID),account_status:s.Status_Akun,
    enrollment:e?applyLiveProgress_(publicEnrollment_(e),e):null,batch_name:b&&b.Nama_Batch,program_name:p&&p.Nama_Program,level:b&&b.Level};
}

function saveStudentProfilePhoto_(form) {
  var token=String(form.token||""), ctx=getAuthContext_(token,"STUDENT"), s=findOne_("Data_Siswa","ID_Siswa",ctx.userId);
  var blob=form.file; require_(blob,"FILE_INVALID","No profile photo selected.");
  var bytes=blob.getBytes(); require_(bytes.length<=2097152,"FILE_TOO_LARGE","Profile photo must be 2 MB or smaller.");
  require_(/^image\/(jpeg|png|webp)$/i.test(blob.getContentType()||""),"FILE_INVALID","Profile photo must be JPG, PNG, or WebP.");
  var file=saveBlobToStudentFolder_(s,blob,"Profile","profile_"+s.ID_Siswa+"_"+Date.now());
  if(s.Foto_File_ID) { try{DriveApp.getFileById(s.Foto_File_ID).setTrashed(true);}catch(e){} }
  updateObject_("Data_Siswa","ID_Siswa",s.ID_Siswa,{Foto_File_ID:file.getId(),Updated_At:now_()});
  invalidateStudentDashboardCache_(s.ID_Siswa);
  return {photo_url:getDriveImageDataUrlSafe_(file.getId()),file_id:file.getId()};
}

function studentMaterials_(token,filters) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  require_(e.Status==="ACTIVE"||e.Status==="COMPLETED","ACCESS_RESTRICTED","Learning Sources are unavailable while your enrollment is inactive.");
  var rows=findMany_("Batch_Materials","ID_Batch",e.ID_Batch).filter(function(x){return x.Status==="ACTIVE" && (!filters || !filters.month || Number(x.Month_No)===Number(filters.month));});
  var highestCompletedMeeting=highestCompletedMeeting_(e.ID_Batch);
  var currentMonth=Number(liveEnrollmentProgress_(e).month||e.Current_Month||1);
  var allProgress=findMany_("Student_Material_Progress","ID_Enrollment",e.ID_Enrollment), out=[];
  rows.forEach(function(bm){
    var m=findOne_("Data_Material","ID_Material",bm.ID_Material); if(!m||m.Status!=="ACTIVE") return;
    var locked=false, reason="", materialMonth=Math.max(1,Number(bm.Month_No||1));
    if(e.Status==="ACTIVE"){
      if(currentMonth<materialMonth){locked=true;reason="Available from Month "+materialMonth+". Your current learning month is "+currentMonth+".";}
      var req=Number(bm.Unlock_After_Meeting_No||0);
      var unlockDate=parseDateValue_(bm.Unlock_Date);
      if(!locked && req>0 && highestCompletedMeeting<req){locked=true;reason="Available after Meeting "+req+" is completed.";}
      if(!locked && unlockDate && new Date().getTime()<unlockDate.getTime()){locked=true;reason="Available from "+toClientDate_(unlockDate)+".";}
    }
    var p=allProgress.filter(function(x){return x.ID_Batch_Material===bm.ID_Batch_Material;})[0];
    out.push({
      id:m.ID_Material,batch_material_id:bm.ID_Batch_Material,title:m.Judul,type:m.Tipe,description:m.Deskripsi||"",
      youtube_video_id:m.YouTube_Video_ID||"",drive_file_id:m.Drive_File_ID||"",external_url:m.External_URL||"",
      thumbnail_url:m.YouTube_Video_ID?("https://i.ytimg.com/vi/"+encodeURIComponent(m.YouTube_Video_ID)+"/hqdefault.jpg"):getDriveThumbnailDataUrlSafe_(m.Drive_File_ID),
      month:Number(bm.Month_No||1),required:bool_(bm.Required),locked:locked,lock_reason:reason,
      progress_status:p&&p.Status||"NOT_STARTED",unlock_after_meeting:Number(bm.Unlock_After_Meeting_No||0)
    });
  });
  return out;
}

function completeMaterial_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e && e.Status==="ACTIVE","ACCESS_RESTRICTED","Only active enrollments can update learning progress.");
  var bm=findOne_("Batch_Materials","ID_Batch_Material",String(data.batch_material_id||""));
  require_(bm && bm.ID_Batch===e.ID_Batch,"NOT_FOUND","Material not found.");
  var available=studentMaterials_(token,{}).filter(function(x){return x.batch_material_id===bm.ID_Batch_Material;})[0];
  require_(available && !available.locked,"ACCESS_RESTRICTED",available?available.lock_reason:"Material is locked.");
  var existing=findMany_("Student_Material_Progress","ID_Enrollment",e.ID_Enrollment).filter(function(x){return x.ID_Batch_Material===bm.ID_Batch_Material;})[0];
  var now=now_();
  if(existing) updateObject_("Student_Material_Progress","ID_Student_Material",existing.ID_Student_Material,{Status:"COMPLETED",Completed_At:now,Last_Accessed_At:now});
  else appendObject_("Student_Material_Progress",{ID_Student_Material:makeId_("SMP"),ID_Enrollment:e.ID_Enrollment,ID_Batch_Material:bm.ID_Batch_Material,Status:"COMPLETED",Started_At:now,Completed_At:now,Last_Accessed_At:now});
  recalculateEnrollmentState_(e.ID_Enrollment);
  return learningProgress_(e);
}

// V38: progress dihitung dari bulan yang selesai (pertemuan + nilai minimum), bukan dari material.
function learningProgress_(e) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), total=Math.max(1,Number(batch&&batch.Durasi_Bulan||1));
  var done=completedMonths_(e).length;
  return {completed:done,total:total,percentage:Math.round(done/total*100)};
}

// V38: jumlah pertemuan yang sudah diinput kehadirannya untuk siswa ini.
function studentMeetingsSummary_(e) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), max=Math.max(1,Number(batch&&batch.Durasi_Bulan||1)), per=Number(batch&&batch.Pertemuan_Per_Bulan||0), done=0, sched=0;
  for(var m=1;m<=max;m++){ var mm=studentMonthMeetings_(e,m); done+=mm.done; sched+=mm.scheduled; }
  return {done:done,total:per>0?per*max:sched,per_month:per};
}

function studentAssignments_(e,filters) {
  require_(e && (e.Status==="ACTIVE"||e.Status==="COMPLETED"),"ACCESS_RESTRICTED","Assignments are unavailable while your enrollment is inactive.");
  if(!(filters&&filters.skip_ensure)) ensureStudentAssignmentsForEnrollment_(e);
  var rows=findMany_("Student_Assignment","ID_Enrollment",e.ID_Enrollment), out=[];
  var doneMeeting=highestCompletedMeeting_(e.ID_Batch), today=today_();
  var filesBySa={}; sheetToObjects_("Assignment_Submissions").forEach(function(x){ if(x.Drive_File_ID) filesBySa[x.ID_Student_Assignment]=true; });
  rows.forEach(function(sa){
    var ba=findOne_("Batch_Assignment","ID_Batch_Assignment",sa.ID_Batch_Assignment), a=ba&&findOne_("Data_Assignment","ID_Assignment",ba.ID_Assignment);
    if(!a||a.Status!=="ACTIVE") return;
    var st=String(ba.Status||"ACTIVE");
    if(st==="INACTIVE"||st==="PLANNED") return; // PLANNED: belum dibuka untuk student
    var unlocked=Number(ba.Unlock_After_Meeting_No||0)<=doneMeeting && (!ba.Unlock_Date || String(ba.Unlock_Date)<=today);
    if(!unlocked && e.Status!=="COMPLETED") return;
    out.push({id:sa.ID_Student_Assignment,assignment_id:a.ID_Assignment,batch_assignment_id:ba.ID_Batch_Assignment,title:a.Judul,description:a.Deskripsi,month:Number(a.Month_No||1),deadline:toClientDate_(a.Due_Date),required:bool_(a.Required),status:sa.Status,assignment_status:st,expired:st==="EXPIRED",score:sa.Score===""?null:Number(sa.Score),feedback:sa.Feedback||"",revision_count:Number(sa.Revision_Count||0),unlocked:unlocked,has_file:!!filesBySa[sa.ID_Student_Assignment]});
  });
  out.sort(function(a,b){return Number(a.month)-Number(b.month)||a.title.localeCompare(b.title);});
  if(filters&&filters.limit) out=out.slice(0,Number(filters.limit));
  return out;
}

function ensureStudentAssignmentsForEnrollment_(e) {
  if(!e) return;
  var bas=findMany_("Batch_Assignment","ID_Batch",e.ID_Batch).filter(function(x){return String(x.Status||"ACTIVE")!=="INACTIVE";});
  bas.forEach(function(ba){
    if(!findMany_("Student_Assignment","ID_Enrollment",e.ID_Enrollment).some(function(sa){return sa.ID_Batch_Assignment===ba.ID_Batch_Assignment;})){
      appendObject_("Student_Assignment",{ID_Student_Assignment:makeId_("SA"),ID_Enrollment:e.ID_Enrollment,ID_Batch_Assignment:ba.ID_Batch_Assignment,Status:"NOT_SUBMITTED",Score:"",Feedback:"",Revision_Count:0,Reviewed_By:"",Reviewed_At:"",Updated_At:now_()});
    }
  });
}

function submitAssignmentForm_(form) {
  var token=String(form.token||""), ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e && e.Status==="ACTIVE","ACCESS_RESTRICTED","Only active students can submit assignments.");
  ensureStudentAssignmentsForEnrollment_(e);
  var sa=findOne_("Student_Assignment","ID_Student_Assignment",String(form.student_assignment_id||""));
  require_(sa,"NOT_FOUND","Assignment not found.");
  require_(sa.ID_Enrollment===e.ID_Enrollment,"AUTH_FORBIDDEN","Assignment does not belong to you.");
  require_(["NOT_SUBMITTED","NEED_REVISION"].indexOf(sa.Status)>=0,"ASSIGNMENT_NOT_SUBMITTED","This assignment is not available for submission.");
  var ba=findOne_("Batch_Assignment","ID_Batch_Assignment",sa.ID_Batch_Assignment);
  require_(ba,"NOT_FOUND","Batch assignment not found.");
  require_(Number(ba.Unlock_After_Meeting_No||0)<=highestCompletedMeeting_(e.ID_Batch),"ASSIGNMENT_NOT_OPEN","This assignment is still locked.");
  require_(!ba.Unlock_Date || String(ba.Unlock_Date)<=today_(),"ASSIGNMENT_NOT_OPEN","This assignment is not open yet.");
  require_(String(ba.Status||"ACTIVE")==="ACTIVE","ASSIGNMENT_NOT_OPEN","This assignment is "+String(ba.Status||"closed").toLowerCase()+" and no longer accepts submissions.");
  var a=findOne_("Data_Assignment","ID_Assignment",ba.ID_Assignment), student=findOne_("Data_Siswa","ID_Siswa",ctx.userId);
  require_(a&&a.Status==="ACTIVE","ASSIGNMENT_NOT_OPEN","Assignment is inactive.");
  var blob=form.file;
  var fileId="";
  if(blob && blob.getBytes && blob.getBytes().length){
    var allowed=["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","audio/mpeg","audio/wav","audio/x-m4a","video/mp4","video/quicktime","image/jpeg","image/png"];
    require_(allowed.indexOf(blob.getContentType())>=0 || /^application\/octet-stream$/i.test(blob.getContentType()||""),"FILE_INVALID","Unsupported assignment file type.");
    require_(blob.getBytes().length<=Number(getSetting_("MAX_ASSIGNMENT_FILE_BYTES","52428800")),"FILE_TOO_LARGE","Assignment file is too large.");
    var file=saveBlobToStudentFolder_(student,blob,"Assignments",a.ID_Assignment+"_attempt_"+(countSubmissions_(sa.ID_Student_Assignment)+1));
    fileId=file.getId();
  }
  require_(fileId || String(form.submission_text||"").trim(),"VALIDATION_ERROR","Please attach a file or enter a submission.");
  var next=countSubmissions_(sa.ID_Student_Assignment)+1, now=now_();
  appendObject_("Assignment_Submissions",{ID_Submission:makeId_("SUB"),ID_Student_Assignment:sa.ID_Student_Assignment,Attempt_No:next,Submission_Text:String(form.submission_text||""),Drive_File_ID:fileId,Submitted_At:now,Status:"SUBMITTED",Reviewed_By:"",Reviewed_At:""});
  updateObject_("Student_Assignment","ID_Student_Assignment",sa.ID_Student_Assignment,{Status:"SUBMITTED",Updated_At:now});
  recalculateEnrollmentState_(e.ID_Enrollment);
  invalidateStudentDashboardCache_(ctx.userId);
  return {submitted:true,attempt:next};
}

function countSubmissions_(studentAssignmentId) {
  return findMany_("Assignment_Submissions","ID_Student_Assignment",studentAssignmentId).length;
}

function upcomingSchedule_(e,limit) {
  var today=today_(), info=doneScheduleMap_(e.ID_Batch);
  return info.schedules.filter(function(x){
    var st=String(x.Status||"PLANNED");
    if(info.attended[x.ID_Schedule]||st==="COMPLETED") return false; // pertemuan yang sudah di-attendance dianggap selesai
    return st==="ACTIVE"; // V38: hanya schedule berstatus ACTIVE; PLANNED/EXPIRED tidak tampil
  }).sort(function(a,b){return String(a.Tanggal+" "+a.Jam_Mulai).localeCompare(String(b.Tanggal+" "+b.Jam_Mulai));})
    .slice(0,Number(limit||10)).map(function(x){return scheduleClient_(x,info.attended);});
}

function scheduleClient_(x,attended) {
  var done=String(x.Status)==="COMPLETED"||!!(attended&&attended[x.ID_Schedule]);
  return {id:x.ID_Schedule,batch_id:x.ID_Batch,month:Number(x.Month_No||1),meeting:Number(x.Meeting_No||0),type:x.Tipe,title:x.Judul,date:toClientDate_(x.Tanggal),start:x.Jam_Mulai,end:x.Jam_Selesai,meet_url:normalizeMeetUrl_(x.Google_Meet_URL),status:x.Status,done:done,requires_attendance:bool_(x.Requires_Attendance)};
}

// V36: sebuah pertemuan dianggap SELESAI ketika admin sudah menginput attendance (learning source maupun Google Meet).
// Status COMPLETED lama tetap dihitung selesai agar data lama tidak berubah perilaku.
function doneScheduleMap_(batchId) {
  var schedules=findMany_("Data_Schedule","ID_Batch",batchId).filter(function(x){return String(x.Status)!=="CANCELLED";});
  var ids={}, attended={};
  schedules.forEach(function(x){ids[x.ID_Schedule]=true;});
  if(schedules.length){
    sheetToObjects_("Student_Attendance").forEach(function(a){ if(ids[a.ID_Schedule]) attended[a.ID_Schedule]=true; });
  }
  var done=schedules.filter(function(x){return String(x.Status)==="COMPLETED"||attended[x.ID_Schedule];});
  return {schedules:schedules,done:done,attended:attended};
}

function doneSchedulesForBatch_(batchId) { return doneScheduleMap_(batchId).done; }

// V37: nomor pertemuan dihitung sebagai URUTAN DALAM BATCH.
// Mendukung penomoran per-bulan (Month 2 / Meeting 1 => ke-(per+1)) maupun penomoran langsung berurutan (Month 2 / Meeting 5).
function globalMeetingNo_(s,per) {
  var m=Math.max(1,Number(s.Month_No||1)), n=Number(s.Meeting_No||0);
  if(per>0 && m>1 && n<=per) return (m-1)*per+n;
  return n;
}

function highestCompletedMeeting_(batchId) {
  var b=findOne_("Data_Batch","ID_Batch",batchId), per=Number(b&&b.Pertemuan_Per_Bulan||0);
  return doneSchedulesForBatch_(batchId).reduce(function(m,x){return Math.max(m,globalMeetingNo_(x,per));},0);
}

function completedMeetingCount_(batchId) {
  var seen={}; doneSchedulesForBatch_(batchId).forEach(function(x){seen[Number(x.Month_No||1)+"-"+Number(x.Meeting_No||0)]=true;});
  return Object.keys(seen).length;
}

// V37: jumlah pertemuan per bulan x durasi bulan = patokan penyelesaian batch.
function syncBatchCompletion_(batchId) {
  var b=findOne_("Data_Batch","ID_Batch",batchId); if(!b || String(b.Status)!=="ACTIVE") return;
  var per=Number(b.Pertemuan_Per_Bulan||0), dur=Math.max(1,Number(b.Durasi_Bulan||1));
  if(per<=0) return;
  if(completedMeetingCount_(batchId)>=per*dur) updateObject_("Data_Batch","ID_Batch",batchId,{Status:"COMPLETED",Updated_At:now_()});
}

function updateEnrollmentCache_(e) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch);
  if(!batch) return;
  var completed=completedMonths_(e), currentMonth=1;
  for(var m=1;m<=Number(batch.Durasi_Bulan||1);m++){ if(completed.indexOf(m)<0){currentMonth=m;break;} currentMonth=Math.min(Number(batch.Durasi_Bulan||1),m+1); }
  var currentMeeting=studentMeetingsSummary_(e).done;
  updateObject_("Data_Enrollment","ID_Enrollment",e.ID_Enrollment,{Current_Month:currentMonth,Current_Meeting:currentMeeting,Updated_At:now_()});
}



function studentProtectedFile_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e && (e.Status==="ACTIVE"||e.Status==="COMPLETED"),"ACCESS_RESTRICTED","This file is unavailable while your enrollment is inactive.");
  var fileId=String(data.file_id||"").trim();
  require_(fileId,"FILE_INVALID","File ID is required.");
  var rows=findMany_("Batch_Materials","ID_Batch",e.ID_Batch), linked=null;
  for(var i=0;i<rows.length;i++){
    var m=findOne_("Data_Material","ID_Material",rows[i].ID_Material);
    if(m && m.Drive_File_ID===fileId){linked=rows[i];break;}
  }
  require_(linked,"AUTH_FORBIDDEN","This file is not assigned to your enrollment.");
  var available=studentMaterials_(token,{}).filter(function(x){return x.id===linked.ID_Material;})[0];
  require_(available && !available.locked,"ACCESS_RESTRICTED",available?available.lock_reason:"Material is locked.");
  var file=DriveApp.getFileById(fileId), blob=file.getBlob();
  return {file_id:fileId,name:file.getName(),mime_type:blob.getContentType(),data_url:getProtectedDriveDataUrl_(fileId),size_bytes:blob.getBytes().length};
}

function studentCertificateFile_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e,"NOT_FOUND","No enrollment found.");
  var cert=findMany_("Data_Certificate","ID_Enrollment",e.ID_Enrollment)[0];
  require_(cert,"NOT_FOUND","Certificate not found.");
  var requested=String(data.certificate_id||"");
  if(requested) require_(cert.ID_Certificate===requested,"AUTH_FORBIDDEN","Certificate does not belong to you.");
  require_(["GENERATED","ISSUED"].indexOf(cert.Status)>=0,"NOT_FOUND","Certificate file is not available.");
  return {file_id:cert.File_ID,name:cert.No_Sertifikat+".pdf",mime_type:"application/pdf",data_url:getProtectedDriveDataUrl_(cert.File_ID,15728640),size_bytes:DriveApp.getFileById(cert.File_ID).getSize()};
}

// V40: link Google Drive untuk materi (modul). Akses tetap dicek (enrollment aktif, materi ter-assign & tidak terkunci);
// file dibagikan sebagai Viewer ke email siswa jika belum dapat dibuka lewat link.
function studentMaterialDriveLink_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e && (e.Status==="ACTIVE"||e.Status==="COMPLETED"),"ACCESS_RESTRICTED","This file is unavailable while your enrollment is inactive.");
  var fileId=String(data.file_id||"").trim();
  require_(fileId,"FILE_INVALID","File ID is required.");
  var rows=findMany_("Batch_Materials","ID_Batch",e.ID_Batch), linked=null;
  for(var i=0;i<rows.length;i++){
    var m=findOne_("Data_Material","ID_Material",rows[i].ID_Material);
    if(m && m.Drive_File_ID===fileId && String(rows[i].Status)==="ACTIVE"){linked=rows[i];break;}
  }
  require_(linked,"AUTH_FORBIDDEN","This file is not assigned to your enrollment.");
  var available=studentMaterials_(token,{}).filter(function(x){return x.id===linked.ID_Material;})[0];
  require_(available && !available.locked,"ACCESS_RESTRICTED",available?available.lock_reason:"Material is locked.");
  return driveViewLinkForStudent_(fileId,ctx.userId);
}


// V42: progress enrollment LIVE (sama persis dengan panel Students admin): month, meeting, completion.
function liveEnrollmentProgress_(e) {
  var b=findOne_("Data_Batch","ID_Batch",e.ID_Batch), max=Math.max(1,Number(b&&b.Durasi_Bulan||1));
  var out={month:Number(e.Current_Month||1),meeting:Number(e.Current_Meeting||0),meetings_total:0,months_completed:0,months_total:max,completion_status:e.Completion_Status||"IN_PROGRESS"};
  if(!b || String(e.Status)==="CANCELLED") return out;
  try{
    var completed=completedMonths_(e), ms=studentMeetingsSummary_(e);
    out.months_completed=completed.length; out.meeting=ms.done; out.meetings_total=ms.total;
    out.month=Math.min(max,completed.length+1);
    out.completion_status=completed.length>=max?"COMPLETED":"IN_PROGRESS";
  }catch(err){}
  return out;
}

function applyLiveProgress_(enrollment,e) {
  var p=liveEnrollmentProgress_(e);
  enrollment.current_month=p.month; enrollment.current_meeting=p.meeting; enrollment.meetings_total=p.meetings_total;
  enrollment.months_completed=p.months_completed; enrollment.months_total=p.months_total; enrollment.completion_status=p.completion_status;
  return enrollment;
}

// V42: bagikan file Drive sebagai Viewer ke email siswa bila belum bisa dibuka lewat link, lalu kembalikan URL Drive.
function driveViewLinkForStudent_(fileId,studentId) {
  var file=DriveApp.getFileById(fileId), shared=false;
  try {
    var acc=file.getSharingAccess();
    if(acc!==DriveApp.Access.ANYONE && acc!==DriveApp.Access.ANYONE_WITH_LINK){
      var student=findOne_("Data_Siswa","ID_Siswa",studentId), email=String(student&&student.Email||"").toLowerCase();
      var has=file.getViewers().concat(file.getEditors()).some(function(u){return String(u.getEmail()).toLowerCase()===email;});
      if(email && !has){ file.addViewer(email); shared=true; }
    }
  } catch(shareErr) {}
  return {url:"https://drive.google.com/file/d/"+encodeURIComponent(fileId)+"/view",name:file.getName(),shared:shared};
}

// V42: View submission assignment -> Drive.
function studentAssignmentDriveLink_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId);
  require_(e && (e.Status==="ACTIVE"||e.Status==="COMPLETED"),"ACCESS_RESTRICTED","Assignments are unavailable while your enrollment is inactive.");
  var sa=findOne_("Student_Assignment","ID_Student_Assignment",String(data.id||""));
  require_(sa && sa.ID_Enrollment===e.ID_Enrollment,"AUTH_FORBIDDEN","Assignment not found.");
  var subs=findMany_("Assignment_Submissions","ID_Student_Assignment",sa.ID_Student_Assignment).filter(function(x){return x.Drive_File_ID;})
    .sort(function(a,b){return Number(b.Attempt_No||0)-Number(a.Attempt_No||0);});
  require_(subs.length,"NOT_FOUND","No submitted file for this assignment.");
  return driveViewLinkForStudent_(String(subs[0].Drive_File_ID),ctx.userId);
}
