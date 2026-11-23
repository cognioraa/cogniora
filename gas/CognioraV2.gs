/**
 * COGNIORA V2 — tutor management, levels, session reports, package credits,
 * skill assessment and finance utilities.
 * This module is additive: legacy sheets and functions remain in place.
 */

function v2Owner_(token) {
  var ctx = getAuthContext_(token, "ADMIN");
  assertOwner_(ctx);
  return ctx;
}

function v2TutorOrOwner_(token) {
  var ctx = getAuthContext_(token, "ADMIN");
  require_(ctx.role === "OWNER" || ctx.role === "TUTOR", "AUTH_FORBIDDEN", "Tutor/Owner access required.");
  return ctx;
}

function tutorAssignedBatchIds_(adminId) {
  var today = today_();
  return sheetToObjects_("Batch_Tutor_Assignment").filter(function(x) {
    if (String(x.ID_Admin) !== String(adminId) || String(x.Status || "ACTIVE") !== "ACTIVE") return false;
    // Blueprint 11.2: penugasan hanya berlaku di antara Start_Date dan End_Date.
    var start = toClientDate_(x.Start_Date), end = toClientDate_(x.End_Date);
    if (start && start > today) return false;
    if (end && end < today) return false;
    return true;
  }).map(function(x) { return String(x.ID_Batch); });
}

function tutorCanAccessBatch_(ctx, batchId) {
  if (ctx && ctx.role === "OWNER") return true;
  return tutorAssignedBatchIds_(ctx.userId).indexOf(String(batchId || "")) >= 0;
}

function requireTutorBatch_(ctx, batchId) {
  require_(tutorCanAccessBatch_(ctx, batchId), "AUTH_FORBIDDEN", "Tutor is not assigned to this learning group.");
}

function adminTutors_(token) {
  v2Owner_(token);
  var admins = sheetToObjects_("Data_Admin").filter(function(x) { return x.Role === "TUTOR"; });
  var profiles = sheetToObjects_("Data_Tutor_Profile");
  var assignments = sheetToObjects_("Batch_Tutor_Assignment");
  var batches = {};
  sheetToObjects_("Data_Batch").forEach(function(b) { batches[b.ID_Batch] = b; });
  return admins.map(function(a) {
    var p = profiles.filter(function(x) { return x.ID_Admin === a.ID_Admin; })[0] || {};
    var assigned = assignments.filter(function(x) { return x.ID_Admin === a.ID_Admin && x.Status === "ACTIVE"; }).map(function(x) {
      return {assignment_id:x.ID_Assignment,batch_id:x.ID_Batch,batch_name:batches[x.ID_Batch] ? batches[x.ID_Batch].Nama_Batch : x.ID_Batch,start_date:x.Start_Date||"",end_date:x.End_Date||""};
    });
    return {id:a.ID_Admin,name:a.Nama,email:a.Email,status:a.Status,last_login:a.Last_Login||"",specialization:p.Spesialisasi||"",bio:p.Bio||"",phone:p.Nomor_WA||"",assignments:assigned};
  });
}

function adminCreateTutor_(token, data) {
  var ctx = v2Owner_(token);
  data = data || {};
  var name = String(data.name || "").trim();
  var email = normalizeEmail_(data.email);
  var password = String(data.password || "");
  require_(name.length >= 2, "VALIDATION_ERROR", "Nama tutor minimal 2 karakter.");
  require_(validEmail_(email), "VALIDATION_ERROR", "Email tutor tidak valid.");
  require_(password.length >= 10, "VALIDATION_ERROR", "Password awal minimal 10 karakter.");
  var created = createTutorAdmin_(token, {name:name,email:email,password:password});
  var profile = {
    ID_Tutor_Profile:makeId_("TPR"), ID_Admin:created.id,
    Spesialisasi:String(data.specialization||"").trim(), Bio:String(data.bio||"").trim(),
    Nomor_WA:String(data.phone||"").trim(), Status:"ACTIVE", Created_At:now_(), Updated_At:now_()
  };
  appendObject_("Data_Tutor_Profile", profile);
  audit_(ctx,"CREATE_TUTOR","Data_Admin",created.id,"Tutor account created: "+email,"SUCCESS");
  return {created:true,id:created.id,email:email,role:"TUTOR"};
}

function adminSetTutorStatus_(token, data) {
  var ctx = v2Owner_(token), id = String(data.tutor_id || ""), status = String(data.status || "").toUpperCase();
  var tutor = findOne_("Data_Admin","ID_Admin",id);
  require_(tutor && tutor.Role === "TUTOR", "NOT_FOUND", "Tutor account not found.");
  require_(status === "ACTIVE" || status === "INACTIVE", "VALIDATION_ERROR", "Invalid tutor status.");
  updateObject_("Data_Admin","ID_Admin",id,{Status:status,Updated_At:now_()});
  var p = findMany_("Data_Tutor_Profile","ID_Admin",id)[0];
  if (p) updateObject_("Data_Tutor_Profile","ID_Tutor_Profile",p.ID_Tutor_Profile,{Status:status,Updated_At:now_()});
  if (status === "INACTIVE") {
    sheetToObjects_("Batch_Tutor_Assignment").filter(function(x){return x.ID_Admin===id && x.Status==="ACTIVE";}).forEach(function(x){
      updateObject_("Batch_Tutor_Assignment","ID_Assignment",x.ID_Assignment,{Status:"INACTIVE"});
    });
  }
  audit_(ctx,"SET_TUTOR_STATUS","Data_Admin",id,status,"SUCCESS");
  return {updated:true,status:status};
}

function adminAssignTutorBatch_(token, data) {
  var ctx = v2Owner_(token), tutorId = String(data.tutor_id||""), batchId = String(data.batch_id||"");
  var tutor = findOne_("Data_Admin","ID_Admin",tutorId), batch = findOne_("Data_Batch","ID_Batch",batchId);
  require_(tutor && tutor.Role === "TUTOR" && tutor.Status === "ACTIVE", "NOT_FOUND", "Active tutor not found.");
  require_(batch, "NOT_FOUND", "Learning group not found.");
  var rows = findMany_("Batch_Tutor_Assignment","ID_Batch",batchId);
  var existing = rows.filter(function(x){return x.ID_Admin===tutorId;})[0];
  var obj = {
    ID_Assignment:existing ? existing.ID_Assignment : makeId_("TAS"),
    ID_Batch:batchId, ID_Admin:tutorId,
    Start_Date:String(data.start_date||today_()), End_Date:String(data.end_date||""),
    Status:String(data.status||"ACTIVE").toUpperCase(), Assigned_By:ctx.userId,
    Assigned_At:existing ? (existing.Assigned_At||now_()) : now_(), Notes:String(data.notes||"")
  };
  require_(obj.Status === "ACTIVE" || obj.Status === "INACTIVE", "VALIDATION_ERROR", "Invalid assignment status.");
  if (obj.End_Date && obj.End_Date < obj.Start_Date) throw apiError_("VALIDATION_ERROR","Tanggal akhir penugasan tidak boleh sebelum tanggal mulai.");
  if (existing) updateObject_("Batch_Tutor_Assignment","ID_Assignment",existing.ID_Assignment,obj);
  else appendObject_("Batch_Tutor_Assignment",obj);
  audit_(ctx,"ASSIGN_TUTOR_BATCH","Batch_Tutor_Assignment",obj.ID_Assignment,batch.Nama_Batch,"SUCCESS");
  return {saved:true,id:obj.ID_Assignment};
}

function adminRemoveTutorAssignment_(token, data) {
  var ctx = v2Owner_(token), id = String(data.assignment_id||"");
  var row = findOne_("Batch_Tutor_Assignment","ID_Assignment",id);
  require_(row,"NOT_FOUND","Tutor assignment not found.");
  updateObject_("Batch_Tutor_Assignment","ID_Assignment",id,{Status:"INACTIVE"});
  audit_(ctx,"REMOVE_TUTOR_ASSIGNMENT","Batch_Tutor_Assignment",id,"Assignment deactivated","SUCCESS");
  return {updated:true};
}

function tutorDashboard_(token) {
  var ctx = v2TutorOrOwner_(token);
  var batchIds = ctx.role === "OWNER" ? sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}) : tutorAssignedBatchIds_(ctx.userId);
  var batchMap = {};
  sheetToObjects_("Data_Batch").forEach(function(b){if(batchIds.indexOf(b.ID_Batch)>=0)batchMap[b.ID_Batch]=b;});
  var schedules = sheetToObjects_("Data_Schedule").filter(function(s){return !!batchMap[s.ID_Batch] && s.Status !== "CANCELLED";});
  var today = today_();
  var upcoming = schedules.filter(function(s){return String(s.Tanggal)>=today && s.Status!=="COMPLETED";}).sort(function(a,b){return String(a.Tanggal+a.Jam_Mulai).localeCompare(String(b.Tanggal+b.Jam_Mulai));}).slice(0,8);
  var batchEnrollments = sheetToObjects_("Data_Enrollment").filter(function(e){return batchIds.indexOf(e.ID_Batch)>=0 && e.Status==="ACTIVE";});
  var pendingReports = sheetToObjects_("Data_Lesson_Report").filter(function(r){return batchIds.indexOf(r.ID_Batch)>=0 && (!r.Tutor_ID || r.Tutor_ID===ctx.userId);});
  var attn = sheetToObjects_("Student_Attendance");
  var todaySchedules = schedules.filter(function(s){return String(s.Tanggal)===today;});
  var completedToday = todaySchedules.filter(function(s){return s.Status==="COMPLETED";}).length;
  var dueReview = sheetToObjects_("Student_Assignment").filter(function(sa){
    if(sa.Status!=="SUBMITTED") return false;
    var ba=findOne_("Batch_Assignment","ID_Batch_Assignment",sa.ID_Batch_Assignment);
    return ba && batchIds.indexOf(ba.ID_Batch)>=0;
  }).length;
  return {
    role:ctx.role, batches:Object.keys(batchMap).length, students:batchEnrollments.length,
    sessions_today:todaySchedules.length, completed_today:completedToday,
    pending_attendance:todaySchedules.filter(function(s){return !attn.some(function(a){return a.ID_Schedule===s.ID_Schedule;});}).length,
    pending_reviews:dueReview, upcoming:upcoming.map(function(s){return {id:s.ID_Schedule,batch_id:s.ID_Batch,batch_name:batchMap[s.ID_Batch].Nama_Batch,title:s.Judul,date:toClientDate_(s.Tanggal),start:s.Jam_Mulai,end:s.Jam_Selesai,status:s.Status,type:s.Tipe,meet_url:s.Google_Meet_URL||""};})
  };
}

function tutorSessions_(token, filters) {
  var ctx = v2TutorOrOwner_(token), ids = ctx.role === "OWNER" ? sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}) : tutorAssignedBatchIds_(ctx.userId);
  filters = filters || {};
  var batchMap = {}; sheetToObjects_("Data_Batch").forEach(function(b){batchMap[b.ID_Batch]=b;});
  return sheetToObjects_("Data_Schedule").filter(function(s){return ids.indexOf(s.ID_Batch)>=0 && (!filters.batch_id||s.ID_Batch===filters.batch_id) && (!filters.from||String(s.Tanggal)>=String(filters.from)) && (!filters.to||String(s.Tanggal)<=String(filters.to));})
    .sort(function(a,b){return String(a.Tanggal+a.Jam_Mulai).localeCompare(String(b.Tanggal+b.Jam_Mulai));})
    .map(function(s){
      var enrollments=sheetToObjects_("Data_Enrollment").filter(function(e){return e.ID_Batch===s.ID_Batch && e.Status!=="CANCELLED";});
      var attendance=findMany_("Student_Attendance","ID_Schedule",s.ID_Schedule);
      return {id:s.ID_Schedule,batch_id:s.ID_Batch,batch_name:batchMap[s.ID_Batch]&&batchMap[s.ID_Batch].Nama_Batch,title:s.Judul,date:toClientDate_(s.Tanggal),start:s.Jam_Mulai,end:s.Jam_Selesai,type:s.Tipe,status:s.Status,meet_url:s.Google_Meet_URL||"",attendance_count:attendance.length,students:enrollments.map(function(e){var st=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa);var a=attendance.filter(function(x){return x.ID_Enrollment===e.ID_Enrollment;})[0];return {enrollment_id:e.ID_Enrollment,student_id:e.ID_Siswa,name:st&&st.Nama_Lengkap,email:st&&st.Email,attendance:a?a.Status:"NOT_RECORDED"};})};
    });
}

function tutorBatches_(token) {
  var ctx=v2TutorOrOwner_(token), ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return String(x.ID_Batch);}):tutorAssignedBatchIds_(ctx.userId);
  return sheetToObjects_("Data_Batch").filter(function(b){return ids.indexOf(String(b.ID_Batch))>=0 && String(b.Status||"ACTIVE")==="ACTIVE";}).map(function(b){return {id:b.ID_Batch,name:b.Nama_Batch,program_id:b.ID_Program,level:b.Level,duration_months:Number(b.Durasi_Bulan||0)};});
}

function tutorStudents_(token, filters) {
  var ctx = v2TutorOrOwner_(token), ids = ctx.role === "OWNER" ? sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}) : tutorAssignedBatchIds_(ctx.userId);
  filters=filters||{};
  var batches={}; sheetToObjects_("Data_Batch").forEach(function(b){batches[b.ID_Batch]=b;});
  return sheetToObjects_("Data_Enrollment").filter(function(e){return ids.indexOf(e.ID_Batch)>=0 && (!filters.batch_id||e.ID_Batch===filters.batch_id) && (!filters.status||e.Status===filters.status);}).map(function(e){
    var s=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa), b=batches[e.ID_Batch];
    return {enrollment_id:e.ID_Enrollment,student_id:e.ID_Siswa,name:s&&s.Nama_Lengkap,email:s&&s.Email,phone:s&&s.Nomor_WA,batch_id:e.ID_Batch,batch_name:b&&b.Nama_Batch,program_id:b&&b.ID_Program,level:b&&b.Level,status:e.Status};
  }).sort(function(a,b){return String(a.name||"").localeCompare(String(b.name||""));});
}

function tutorSaveAttendance_(token, data) {
  var ctx = v2TutorOrOwner_(token), schedule=findOne_("Data_Schedule","ID_Schedule",String(data.schedule_id||""));
  require_(schedule,"NOT_FOUND","Session not found.");
  requireTutorBatch_(ctx,schedule.ID_Batch);
  var records=Array.isArray(data.records)?data.records:[];
  require_(records.length>0,"VALIDATION_ERROR","Attendance records are required.");
  var saved=0, errors=[];
  records.forEach(function(r){
    try {
      var e=findOne_("Data_Enrollment","ID_Enrollment",String(r.enrollment_id||""));
      require_(e && e.ID_Batch===schedule.ID_Batch,"VALIDATION_ERROR","Enrollment does not belong to this session batch.");
      adminSaveAttendance_(token,{schedule_id:schedule.ID_Schedule,enrollment_id:e.ID_Enrollment,status:r.status||"PRESENT",note:r.note||""});
      saved++;
    } catch(err) { errors.push({enrollment_id:r.enrollment_id||"",message:err.message||"Failed"}); }
  });
  return {saved:saved,error_count:errors.length,errors:errors};
}

function tutorLessonReports_(token, filters) {
  var ctx=v2TutorOrOwner_(token), ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}):tutorAssignedBatchIds_(ctx.userId);
  filters=filters||{};
  var schedules={}; sheetToObjects_("Data_Schedule").forEach(function(s){schedules[s.ID_Schedule]=s;});
  return sheetToObjects_("Data_Lesson_Report").filter(function(r){return ids.indexOf(r.ID_Batch)>=0 && (ctx.role==="OWNER" || !r.Tutor_ID || r.Tutor_ID===ctx.userId) && (!filters.batch_id||r.ID_Batch===filters.batch_id);}).sort(function(a,b){return String(b.Updated_At).localeCompare(String(a.Updated_At));}).map(function(r){
    var s=schedules[r.ID_Schedule]||{};
    return {id:r.ID_Lesson_Report,schedule_id:r.ID_Schedule,batch_id:r.ID_Batch,batch_name:(findOne_("Data_Batch","ID_Batch",r.ID_Batch)||{}).Nama_Batch||"",title:s.Judul||"",date:toClientDate_(s.Tanggal),topic:r.Topic,objective:r.Learning_Objective,activities:r.Activities,vocabulary:r.Vocabulary,competency:r.Competency,performance:r.Student_Performance,challenges:r.Challenges,follow_up:r.Follow_Up,updated_at:r.Updated_At};
  });
}

function tutorSaveLessonReport_(token, data) {
  var ctx=v2TutorOrOwner_(token), schedule=findOne_("Data_Schedule","ID_Schedule",String(data.schedule_id||""));
  require_(schedule,"NOT_FOUND","Session not found."); requireTutorBatch_(ctx,schedule.ID_Batch);
  var enrollmentId=String(data.enrollment_id||"");
  if(enrollmentId){var e=findOne_("Data_Enrollment","ID_Enrollment",enrollmentId);require_(e && e.ID_Batch===schedule.ID_Batch,"VALIDATION_ERROR","Enrollment does not belong to this session batch.");}
  var existing=sheetToObjects_("Data_Lesson_Report").filter(function(x){return x.ID_Schedule===schedule.ID_Schedule && String(x.ID_Enrollment||"")===enrollmentId;})[0];
  var obj={ID_Lesson_Report:existing?existing.ID_Lesson_Report:makeId_("LSR"),ID_Schedule:schedule.ID_Schedule,ID_Batch:schedule.ID_Batch,ID_Enrollment:enrollmentId,Tutor_ID:ctx.userId,
    Topic:String(data.topic||schedule.Judul||"").trim(),Learning_Objective:String(data.objective||"").trim(),Activities:String(data.activities||"").trim(),Vocabulary:String(data.vocabulary||"").trim(),Competency:String(data.competency||"").trim(),Student_Performance:String(data.performance||"").trim(),Challenges:String(data.challenges||"").trim(),Follow_Up:String(data.follow_up||"").trim(),Created_At:existing?(existing.Created_At||now_()):now_(),Updated_At:now_()};
  require_(obj.Topic,"VALIDATION_ERROR","Topic is required.");
  if(existing)updateObject_("Data_Lesson_Report","ID_Lesson_Report",existing.ID_Lesson_Report,obj);else appendObject_("Data_Lesson_Report",obj);
  audit_(ctx,existing?"UPDATE_LESSON_REPORT":"CREATE_LESSON_REPORT","Data_Lesson_Report",obj.ID_Lesson_Report,obj.Topic,"SUCCESS");
  return {saved:true,id:obj.ID_Lesson_Report};
}

function adminLevels_(token) {
  v2Owner_(token);
  return sheetToObjects_("Data_Level").sort(function(a,b){return Number(a.Order_No||0)-Number(b.Order_No||0);}).map(function(x){return {id:x.ID_Level,code:x.Level_Code,name:x.Level_Name,order:Number(x.Order_No||0),description:x.Description||"",entry_criteria:x.Entry_Criteria||"",completion_criteria:x.Completion_Criteria||"",status:x.Status};});
}

function adminSaveLevel_(token,data) {
  var ctx=v2Owner_(token), id=String(data.id||""), code=String(data.code||"").trim().toUpperCase(), name=String(data.name||"").trim();
  require_(code&&name,"VALIDATION_ERROR","Level code and name are required.");
  require_(/^[A-Z0-9_-]{2,20}$/.test(code),"VALIDATION_ERROR","Level code format is invalid.");
  var existing=id?findOne_("Data_Level","ID_Level",id):null;
  require_(!sheetToObjects_("Data_Level").some(function(x){return x.Level_Code===code && x.ID_Level!==id;}),"DUPLICATE_RECORD","Level code already exists.");
  var obj={ID_Level:id||makeId_("LVL"),Level_Code:code,Level_Name:name,Order_No:Math.max(1,Number(data.order||1)),Description:String(data.description||""),Entry_Criteria:String(data.entry_criteria||""),Completion_Criteria:String(data.completion_criteria||""),Status:String(data.status||"ACTIVE"),Created_At:existing?(existing.Created_At||now_()):now_(),Updated_At:now_()};
  require_(obj.Status==="ACTIVE"||obj.Status==="INACTIVE","VALIDATION_ERROR","Invalid level status.");
  if(existing)updateObject_("Data_Level","ID_Level",id,obj);else appendObject_("Data_Level",obj);
  audit_(ctx,existing?"UPDATE_LEVEL":"CREATE_LEVEL","Data_Level",obj.ID_Level,name,"SUCCESS");return {id:obj.ID_Level};
}

function adminPackageRules_(token) {
  v2Owner_(token);
  var rules={}; sheetToObjects_("Data_Package_Rules").forEach(function(r){rules[r.ID_Package]=r;});
  return sheetToObjects_("Data_Package").map(function(p){var r=rules[p.ID_Package]||{};return {package_id:p.ID_Package,package_name:p.Nama_Paket,program_id:p.ID_Program,credit_amount:Number(r.Credit_Amount||0),validity_days:Number(r.Validity_Days||0),deduct_present:r.Deduct_On_Present===""?true:bool_(r.Deduct_On_Present),deduct_late:r.Deduct_On_Late===""?true:bool_(r.Deduct_On_Late),deduct_absent:bool_(r.Deduct_On_Absent),deduct_excused:bool_(r.Deduct_On_Excused),session_credit_cost:Number(r.Credit_Cost_Per_Session||1),status:r.Status||"INACTIVE",rule_id:r.ID_Rule||""};});
}

function adminSavePackageRule_(token,data) {
  var ctx=v2Owner_(token), packageId=String(data.package_id||""), p=findOne_("Data_Package","ID_Package",packageId);
  require_(p,"NOT_FOUND","Package not found.");
  var old=findMany_("Data_Package_Rules","ID_Package",packageId)[0];
  var obj={ID_Rule:old?old.ID_Rule:makeId_("PKR"),ID_Package:packageId,Credit_Amount:Math.max(0,Number(data.credit_amount||0)),Validity_Days:Math.max(0,Number(data.validity_days||0)),Deduct_On_Present:bool_(data.deduct_present),Deduct_On_Late:bool_(data.deduct_late),Deduct_On_Absent:bool_(data.deduct_absent),Deduct_On_Excused:bool_(data.deduct_excused),Credit_Cost_Per_Session:Math.max(0,Number(data.session_credit_cost===undefined?1:data.session_credit_cost)),Status:String(data.status||"ACTIVE"),Created_At:old?(old.Created_At||now_()):now_(),Updated_At:now_()};
  require_(obj.Status==="ACTIVE"||obj.Status==="INACTIVE","VALIDATION_ERROR","Invalid rule status.");
  if(old)updateObject_("Data_Package_Rules","ID_Rule",old.ID_Rule,obj);else appendObject_("Data_Package_Rules",obj);
  audit_(ctx,old?"UPDATE_PACKAGE_RULE":"CREATE_PACKAGE_RULE","Data_Package_Rules",obj.ID_Rule,p.Nama_Paket,"SUCCESS");return {saved:true,id:obj.ID_Rule};
}

function packageCreditBalance_(enrollmentId) {
  return findMany_("Package_Credit_Ledger","ID_Enrollment",String(enrollmentId||"")).reduce(function(sum,x){return sum+Number(x.Credit_Change||0);},0);
}

function addPackageCreditLedger_(data) {
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    if(data.source_key){
      var duplicate=findMany_("Package_Credit_Ledger","ID_Enrollment",String(data.enrollment_id||"")).filter(function(x){return x.Source_Key===String(data.source_key);})[0];
      if(duplicate)return duplicate;
    }
    var balance=packageCreditBalance_(data.enrollment_id)+Number(data.credit_change||0);
    var row={ID_Ledger:makeId_("CRD"),ID_Enrollment:String(data.enrollment_id),ID_Package:String(data.package_id||""),ID_Schedule:String(data.schedule_id||""),Source_Key:String(data.source_key||""),Transaction_Type:String(data.transaction_type||"ADJUSTMENT"),Credit_Change:Number(data.credit_change||0),Balance_After:balance,Note:String(data.note||""),Created_By:String(data.created_by||"SYSTEM"),Created_At:now_()};
    appendObject_("Package_Credit_Ledger",row);return row;
  } finally {lock.releaseLock();}
}

function adminAdjustPackageCredits_(token,data) {
  var ctx=v2Owner_(token), e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||""));
  require_(e,"NOT_FOUND","Enrollment not found.");
  var change=Number(data.credit_change||0), type=String(data.transaction_type||"ADJUSTMENT").toUpperCase();
  require_(isFinite(change)&&change!==0,"VALIDATION_ERROR","Credit change must be a non-zero number.");
  require_(Math.abs(change)<=100,"VALIDATION_ERROR","Credit adjustment exceeds the allowed limit.");
  require_(change>0 ? ["PURCHASE","ADJUSTMENT","REFUND"].indexOf(type)>=0 : ["ADJUSTMENT","CORRECTION"].indexOf(type)>=0,"VALIDATION_ERROR","Invalid transaction type for credit direction.");
  var row=addPackageCreditLedger_({enrollment_id:e.ID_Enrollment,package_id:e.ID_Package,transaction_type:type,credit_change:change,note:String(data.note||""),created_by:ctx.userId,source_key:"MANUAL:"+makeId_("SRC")});
  audit_(ctx,"ADJUST_PACKAGE_CREDIT","Package_Credit_Ledger",row.ID_Ledger,type+" "+change,"SUCCESS");
  return {saved:true,balance:packageCreditBalance_(e.ID_Enrollment),id:row.ID_Ledger};
}

function syncAttendancePackageCredit_(ctx, enrollment, schedule, status) {
  var rules=findMany_("Data_Package_Rules","ID_Package",enrollment.ID_Package).filter(function(x){return x.Status==="ACTIVE";})[0];
  if(!rules) return {applied:false,reason:"NO_ACTIVE_RULE"};
  var flags={PRESENT:rules.Deduct_On_Present===""?true:bool_(rules.Deduct_On_Present),LATE:rules.Deduct_On_Late===""?true:bool_(rules.Deduct_On_Late),ABSENT:bool_(rules.Deduct_On_Absent),EXCUSED:bool_(rules.Deduct_On_Excused)};
  var amount=Number(rules.Credit_Cost_Per_Session||1); if(!amount) return {applied:false,reason:"NO_SESSION_CREDIT_COST"};
  var source="ATTENDANCE:"+schedule.ID_Schedule+":"+enrollment.ID_Enrollment;
  var oldRows=findMany_("Package_Credit_Ledger","ID_Enrollment",enrollment.ID_Enrollment).filter(function(x){return String(x.Source_Key||"").indexOf(source+":")===0 || x.Source_Key===source;});
  var previous=oldRows.reduce(function(n,x){return n+Number(x.Credit_Change||0);},0);
  var desired=flags[status]?-amount:0;
  var delta=desired-previous;
  if(!delta) return {applied:false,reason:"UNCHANGED",balance:packageCreditBalance_(enrollment.ID_Enrollment)};
  // Include the latest ledger row ID in the key. Repeated requests with the same state
  // become no-ops after the first commit, while a later status reversal can be recorded.
  var latest=oldRows.length?oldRows[oldRows.length-1].ID_Ledger:"INITIAL";
  var row=addPackageCreditLedger_({enrollment_id:enrollment.ID_Enrollment,package_id:enrollment.ID_Package,schedule_id:schedule.ID_Schedule,source_key:source+":"+latest+":"+status,transaction_type:delta<0?"USAGE":"USAGE_REVERSAL",credit_change:delta,note:"Attendance status: "+status,created_by:ctx.userId});
  return {applied:true,delta:delta,balance:row.Balance_After};
}

/**
 * Sesi dibatalkan => kuota yang sudah terpakai untuk sesi itu dikembalikan (blueprint 11.6).
 * Memakai prefix Source_Key yang sama dengan presensi sehingga syncAttendancePackageCredit_ tetap konsisten.
 */
function refundCreditsForCancelledSchedule_(ctx, schedule) {
  var rows=sheetToObjects_("Package_Credit_Ledger").filter(function(x){return String(x.ID_Schedule)===String(schedule.ID_Schedule) && String(x.Source_Key||"").indexOf("ATTENDANCE:"+schedule.ID_Schedule+":")===0;});
  var byEnr={};rows.forEach(function(x){(byEnr[x.ID_Enrollment]=byEnr[x.ID_Enrollment]||[]).push(x);});
  var refunded=0;
  Object.keys(byEnr).forEach(function(enrId){
    var list=byEnr[enrId], net=list.reduce(function(n,x){return n+Number(x.Credit_Change||0);},0);
    if(net>=0)return;
    var e=findOne_("Data_Enrollment","ID_Enrollment",enrId);
    addPackageCreditLedger_({enrollment_id:enrId,package_id:e?e.ID_Package:"",schedule_id:schedule.ID_Schedule,source_key:"ATTENDANCE:"+schedule.ID_Schedule+":"+enrId+":CANCEL:"+list[list.length-1].ID_Ledger,transaction_type:"USAGE_REVERSAL",credit_change:-net,note:"Session cancelled",created_by:ctx&&ctx.userId||"SYSTEM"});
    refunded++;
  });
  return refunded;
}

/** Ganti password Owner/Tutor sendiri (blueprint 4.2). */
function adminChangePassword_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), admin=findOne_("Data_Admin","ID_Admin",ctx.userId);
  require_(admin,"NOT_FOUND","Account not found.");
  var next=String(data&&data.new_password||"");
  require_(passwordMatches_(admin,String(data&&data.current_password||"")),"AUTH_INVALID","Current password is incorrect.");
  require_(next.length>=10,"VALIDATION_ERROR","New password must be at least 10 characters.");
  var salt=randomHex_(16);
  updateObject_("Data_Admin","ID_Admin",admin.ID_Admin,{Password_Salt:salt,Password_Hash:hashPassword_(next,salt),Updated_At:now_()});
  audit_(ctx,"CHANGE_PASSWORD","Data_Admin",admin.ID_Admin,"Password changed","SUCCESS");
  return {changed:true};
}

/** Backfill Data_Batch.Level_ID dari teks Level (idempotent; tidak menimpa Level_ID yang sudah ada). */
function linkBatchLevels_() {
  var levels=sheetToObjects_("Data_Level").filter(function(x){return String(x.Status||"ACTIVE")==="ACTIVE";}), linked=0;
  sheetToObjects_("Data_Batch").forEach(function(b){
    if(b.Level_ID||!b.Level)return;
    var t=String(b.Level).trim().toLowerCase(), m=levels.filter(function(l){return String(l.Level_Name||"").toLowerCase()===t||String(l.Level_Code||"").toLowerCase()===t;})[0];
    if(m){updateObject_("Data_Batch","ID_Batch",b.ID_Batch,{Level_ID:m.ID_Level});linked++;}
  });
  return {linked:linked};
}

function studentPackageBalance_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId,data&&data.enrollment_id);
  require_(e,"NOT_FOUND","No active enrollment found.");
  var rows=findMany_("Package_Credit_Ledger","ID_Enrollment",e.ID_Enrollment);
  return {enrollment_id:e.ID_Enrollment,balance:packageCreditBalance_(e.ID_Enrollment),transactions:rows.sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));}).slice(0,30).map(function(x){return {type:x.Transaction_Type,change:Number(x.Credit_Change||0),balance:Number(x.Balance_After||0),note:x.Note||"",date:x.Created_At};})};
}

function adminPackageLedger_(token,filters) {
  v2Owner_(token); filters=filters||{};
  var rows=sheetToObjects_("Package_Credit_Ledger");
  if(filters.enrollment_id) rows=rows.filter(function(x){return x.ID_Enrollment===filters.enrollment_id;});
  if(filters.student_id){var eids=findMany_("Data_Enrollment","ID_Siswa",filters.student_id).map(function(x){return x.ID_Enrollment;});rows=rows.filter(function(x){return eids.indexOf(x.ID_Enrollment)>=0;});}
  return rows.sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));}).map(function(x){var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa);return {id:x.ID_Ledger,enrollment_id:x.ID_Enrollment,student_name:s&&s.Nama_Lengkap,type:x.Transaction_Type,change:Number(x.Credit_Change||0),balance:Number(x.Balance_After||0),note:x.Note,date:x.Created_At};});
}

function adminExpenses_(token,filters) {
  v2Owner_(token); filters=filters||{};
  var rows=sheetToObjects_("Data_Expenses");
  if(filters.from) rows=rows.filter(function(x){return String(x.Expense_Date)>=String(filters.from);});
  if(filters.to) rows=rows.filter(function(x){return String(x.Expense_Date)<=String(filters.to);});
  if(filters.category) rows=rows.filter(function(x){return x.Category===filters.category;});
  return rows.sort(function(a,b){return String(b.Expense_Date).localeCompare(String(a.Expense_Date));}).map(function(x){return {id:x.ID_Expense,date:toClientDate_(x.Expense_Date),category:x.Category,description:x.Description,amount:Number(x.Amount||0),method:x.Payment_Method,receipt_file_id:x.Receipt_File_ID||""};});
}

function adminSaveExpense_(token,data) {
  var ctx=v2Owner_(token), id=String(data.id||""), old=id?findOne_("Data_Expenses","ID_Expense",id):null;
  require_(!id||old,"NOT_FOUND","Expense not found.");
  var amount=Number(data.amount||0), date=String(data.date||today_());
  require_(amount>0 && isFinite(amount),"VALIDATION_ERROR","Amount must be greater than zero.");
  require_(/^\d{4}-\d{2}-\d{2}$/.test(date),"VALIDATION_ERROR","Expense date is invalid.");
  var obj={ID_Expense:id||makeId_("EXP"),Expense_Date:date,Category:String(data.category||"Other").trim(),Description:String(data.description||"").trim(),Amount:amount,Payment_Method:String(data.payment_method||"CASH"),Receipt_File_ID:String(data.receipt_file_id||""),Created_By:old?old.Created_By:ctx.userId,Created_At:old?old.Created_At:now_(),Updated_At:now_()};
  require_(obj.Category&&obj.Description,"VALIDATION_ERROR","Category and description are required.");
  if(old)updateObject_("Data_Expenses","ID_Expense",id,obj);else appendObject_("Data_Expenses",obj);
  audit_(ctx,old?"UPDATE_EXPENSE":"CREATE_EXPENSE","Data_Expenses",obj.ID_Expense,obj.Description,"SUCCESS");return {saved:true,id:obj.ID_Expense};
}

function studentEnrollments_(token) {
  var ctx=getAuthContext_(token,"STUDENT");
  return findMany_("Data_Enrollment","ID_Siswa",ctx.userId).map(function(e){
    var pub=publicEnrollment_(e), balance=packageCreditBalance_(e.ID_Enrollment);
    pub.credit_balance=balance;
    pub.is_selected=String(e.ID_Enrollment)===String(ctx.enrollmentId||"");
    return pub;
  }).sort(function(a,b){return (a.status==="ACTIVE"?-1:1)-(b.status==="ACTIVE"?-1:1);});
}

function studentSelectEnrollment_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), id=String(data.enrollment_id||"");
  var e=findOne_("Data_Enrollment","ID_Enrollment",id);
  require_(e && e.ID_Siswa===ctx.userId,"AUTH_FORBIDDEN","Enrollment does not belong to this student.");
  require_(e.Status==="ACTIVE"||e.Status==="COMPLETED","ACCESS_RESTRICTED","This enrollment is not available.");
  var cache=CacheService.getScriptCache(), key="COGNIORA_SESSION_"+String(token), raw=cache.get(key);
  require_(raw,"AUTH_EXPIRED","Session expired.");
  var s=JSON.parse(raw); s.enrollmentId=e.ID_Enrollment;
  cache.put(key,JSON.stringify(s),21600);
  invalidateStudentDashboardCache_(ctx.userId);
  return {selected:true,enrollment:publicEnrollment_(e)};
}

function getSelectedStudentEnrollment_(token,studentId,requestedId) {
  var id=String(requestedId||"");
  if(!id){
    try { var raw=CacheService.getScriptCache().get("COGNIORA_SESSION_"+String(token||"")); if(raw)id=String(JSON.parse(raw).enrollmentId||""); } catch(e){}
  }
  if(id){var e=findOne_("Data_Enrollment","ID_Enrollment",id);if(e&&e.ID_Siswa===String(studentId))return e;}
  return findBestEnrollment_(studentId);
}

function adminSaveSkillAssessment_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"); assertOwner_(ctx);
  var e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||""));require_(e,"NOT_FOUND","Enrollment not found.");
  var skill=String(data.skill||"").toUpperCase();
  require_( ["LISTENING","SPEAKING","READING","WRITING","GRAMMAR","VOCABULARY"].indexOf(skill)>=0,"VALIDATION_ERROR","Invalid skill.");
  var score=Number(data.score), max=Number(data.max_score||100);require_(isFinite(score)&&max>0&&score>=0&&score<=max,"VALIDATION_ERROR","Invalid skill score.");
  var rubric=String(data.rubric_json||"{}");try{JSON.parse(rubric);}catch(ex){throw apiError_("VALIDATION_ERROR","Rubric JSON is invalid.");}
  var row={ID_Skill_Assessment:makeId_("SKL"),ID_Enrollment:e.ID_Enrollment,Skill:skill,Score:score,Max_Score:max,Rubric_JSON:rubric,Feedback:String(data.feedback||""),Evidence_File_ID:String(data.evidence_file_id||""),Assessment_Date:String(data.assessment_date||today_()),Assessed_By:ctx.userId,Created_At:now_()};
  appendObject_("Student_Skill_Assessments",row);audit_(ctx,"CREATE_SKILL_ASSESSMENT","Student_Skill_Assessments",row.ID_Skill_Assessment,skill,"SUCCESS");return {saved:true,id:row.ID_Skill_Assessment};
}

function grantPackageCreditsForPayment_(payment, enrollment, actorId) {
  if(!payment || !enrollment || !enrollment.ID_Package)return {applied:false,reason:"NO_PACKAGE"};
  var rule=findMany_("Data_Package_Rules","ID_Package",enrollment.ID_Package).filter(function(x){return x.Status==="ACTIVE";})[0];
  if(!rule || Number(rule.Credit_Amount||0)<=0)return {applied:false,reason:"NO_ACTIVE_PACKAGE_RULE"};
  var source="PAYMENT:"+String(payment.ID_Payment);
  var row=addPackageCreditLedger_({enrollment_id:enrollment.ID_Enrollment,package_id:enrollment.ID_Package,transaction_type:"PURCHASE",credit_change:Number(rule.Credit_Amount),note:"Package credit granted after payment approval",created_by:actorId||"SYSTEM",source_key:source});
  return {applied:true,balance:packageCreditBalance_(enrollment.ID_Enrollment),ledger_id:row.ID_Ledger};
}

function tutorSaveSkillAssessment_(token,data) {
  var ctx=v2TutorOrOwner_(token), e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||""));
  require_(e,"NOT_FOUND","Enrollment not found.");
  requireTutorBatch_(ctx,e.ID_Batch);
  var skill=String(data.skill||"").toUpperCase();
  require_(["LISTENING","SPEAKING","READING","WRITING","GRAMMAR","VOCABULARY"].indexOf(skill)>=0,"VALIDATION_ERROR","Invalid skill.");
  var score=Number(data.score), max=Number(data.max_score||100);
  require_(isFinite(score)&&max>0&&score>=0&&score<=max,"VALIDATION_ERROR","Invalid skill score.");
  var rubric=String(data.rubric_json||"{}");try{JSON.parse(rubric);}catch(ex){throw apiError_("VALIDATION_ERROR","Rubric JSON is invalid.");}
  var row={ID_Skill_Assessment:makeId_("SKL"),ID_Enrollment:e.ID_Enrollment,Skill:skill,Score:score,Max_Score:max,Rubric_JSON:rubric,Feedback:String(data.feedback||""),Evidence_File_ID:String(data.evidence_file_id||""),Assessment_Date:String(data.assessment_date||today_()),Assessed_By:ctx.userId,Created_At:now_()};
  appendObject_("Student_Skill_Assessments",row);audit_(ctx,"CREATE_SKILL_ASSESSMENT","Student_Skill_Assessments",row.ID_Skill_Assessment,skill,"SUCCESS");
  return {saved:true,id:row.ID_Skill_Assessment};
}

function tutorSkillAssessments_(token,filters) {
  var ctx=v2TutorOrOwner_(token), ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}):tutorAssignedBatchIds_(ctx.userId);
  filters=filters||{};
  return sheetToObjects_("Student_Skill_Assessments").filter(function(x){var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment);return e&&ids.indexOf(e.ID_Batch)>=0&&(!filters.enrollment_id||x.ID_Enrollment===filters.enrollment_id);}).map(function(x){var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa);return {id:x.ID_Skill_Assessment,enrollment_id:x.ID_Enrollment,student_name:s&&s.Nama_Lengkap,skill:x.Skill,score:Number(x.Score||0),max_score:Number(x.Max_Score||100),feedback:x.Feedback||"",assessment_date:toClientDate_(x.Assessment_Date)};});
}

function tutorAssignmentSubmissions_(token,filters) {
  var ctx=v2TutorOrOwner_(token), ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}):tutorAssignedBatchIds_(ctx.userId);
  var all=adminAssignmentSubmissions_(token,filters||{});
  return all.filter(function(x){var sa=findOne_("Student_Assignment","ID_Student_Assignment",x.student_assignment_id),e=sa&&findOne_("Data_Enrollment","ID_Enrollment",sa.ID_Enrollment);return e&&ids.indexOf(e.ID_Batch)>=0;});
}

function tutorReviewSubmission_(token,data) {
  var ctx=v2TutorOrOwner_(token), sa=findOne_("Student_Assignment","ID_Student_Assignment",String(data.student_assignment_id||""));
  require_(sa,"NOT_FOUND","Student assignment not found.");requireTutorBatch_(ctx,(findOne_("Data_Enrollment","ID_Enrollment",sa.ID_Enrollment)||{}).ID_Batch);
  return adminReviewSubmission_(token,data);
}

function tutorAssessments_(token,filters) {
  var ctx=v2TutorOrOwner_(token), ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}):tutorAssignedBatchIds_(ctx.userId);
  filters=filters||{};var batches={};sheetToObjects_("Data_Batch").forEach(function(b){batches[b.ID_Batch]=b;});
  return sheetToObjects_("Data_Assessment").filter(function(a){var visible=a.Batch_ID?ids.indexOf(a.Batch_ID)>=0:(ctx.role==="OWNER"||String(a.Created_By||"")===String(ctx.userId));return visible&&(!filters.status||a.Status===filters.status);}).sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));}).map(function(a){return {id:a.ID_Assessment,title:a.Title,description:a.Description,type:a.Assessment_Type,batch_id:a.Batch_ID,batch_name:batches[a.Batch_ID]&&batches[a.Batch_ID].Nama_Batch,start_at:a.Start_At,end_at:a.End_At,duration:Number(a.Duration_Minutes||0),max_attempts:Number(a.Max_Attempts||1),randomize_questions:bool_(a.Randomize_Questions),randomize_options:bool_(a.Randomize_Options),show_score:bool_(a.Show_Score),status:a.Status,question_count:assessmentMapRows_(a.ID_Assessment).length};});
}

function tutorAssessmentAttemptDetail_(token,data) {
  var ctx=v2TutorOrOwner_(token),detail=assessmentAttemptDetail_(data.attempt_id),e=findOne_("Data_Enrollment","ID_Enrollment",detail.enrollment_id);
  require_(e,"NOT_FOUND","Enrollment not found.");requireTutorBatch_(ctx,e.ID_Batch);return detail;
}

function tutorAssessmentResults_(token,data) {
  var ctx=v2TutorOrOwner_(token),assessment=findOne_("Data_Assessment","ID_Assessment",String(data.assessment_id||""));
  require_(assessment,"NOT_FOUND","Assessment not found.");
  if(assessment.Batch_ID)requireTutorBatch_(ctx,assessment.Batch_ID);
  else if(ctx.role!=="OWNER"&&assessment.Program_ID){var eligible=sheetToObjects_("Data_Batch").filter(function(b){return b.ID_Program===assessment.Program_ID&&tutorCanAccessBatch_(ctx,b.ID_Batch);});require_(eligible.length>0,"AUTH_FORBIDDEN","This assessment is outside your assigned groups.");}
  else require_(ctx.role==="OWNER","AUTH_FORBIDDEN","Tutor access is limited to assessments assigned to a batch.");
  return assessmentResultsRows_(assessment);
}

function tutorAssessmentGradeEssay_(token,data) {
  var ctx=v2TutorOrOwner_(token),attempt=findOne_("Assessment_Attempts","ID_Attempt",String(data.attempt_id||""));
  require_(attempt,"NOT_FOUND","Assessment attempt not found.");var e=findOne_("Data_Enrollment","ID_Enrollment",attempt.ID_Enrollment);require_(e,"NOT_FOUND","Enrollment not found.");requireTutorBatch_(ctx,e.ID_Batch);
  return gradeAssessmentEssayCore_(ctx,data);
}

function studentSkills_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"),e=getSelectedStudentEnrollment_(token,ctx.userId,data&&data.enrollment_id);require_(e,"NOT_FOUND","Enrollment not found.");
  return findMany_("Student_Skill_Assessments","ID_Enrollment",e.ID_Enrollment).sort(function(a,b){return String(a.Assessment_Date).localeCompare(String(b.Assessment_Date));}).map(function(x){return {id:x.ID_Skill_Assessment,skill:x.Skill,score:Number(x.Score||0),max_score:Number(x.Max_Score||100),percentage:Number(x.Max_Score?x.Score/x.Max_Score*100:0),feedback:x.Feedback||"",assessment_date:toClientDate_(x.Assessment_Date),assessed_by:x.Assessed_By};});
}

function adminSkillAssessments_(token,filters) {
  v2Owner_(token);filters=filters||{};var rows=sheetToObjects_("Student_Skill_Assessments");
  if(filters.enrollment_id)rows=rows.filter(function(x){return x.ID_Enrollment===filters.enrollment_id;});
  if(filters.skill)rows=rows.filter(function(x){return x.Skill===String(filters.skill).toUpperCase();});
  return rows.sort(function(a,b){return String(b.Assessment_Date).localeCompare(String(a.Assessment_Date));}).map(function(x){var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa);return {id:x.ID_Skill_Assessment,enrollment_id:x.ID_Enrollment,student_name:s&&s.Nama_Lengkap,skill:x.Skill,score:Number(x.Score||0),max_score:Number(x.Max_Score||100),feedback:x.Feedback,assessment_date:toClientDate_(x.Assessment_Date)};});
}

// V2.1 — scoped Tutor content authoring; tutors can only distribute to assigned batches.
function tutorMaterials_(token,filters) {
  var ctx=v2TutorOrOwner_(token), ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}):tutorAssignedBatchIds_(ctx.userId);
  var out=[];ids.forEach(function(id){adminBatchMaterials_(token,{batch_id:id}).forEach(function(x){if(!filters||!filters.status||x.status===filters.status)out.push(x);});});
  var seen={};return out.filter(function(x){var k=x.batch_id+"|"+x.material_id;if(seen[k])return false;seen[k]=true;return true;});
}
function tutorSaveMaterial_(token,data) {
  var ctx=v2TutorOrOwner_(token); data=data||{};
  var id=String(data.id_material||"").trim();
  if(id && ctx.role!=="OWNER"){var m=findOne_("Data_Material","ID_Material",id);require_(m && String(m.Created_By)===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only edit materials they created.");}
  return adminSaveMaterial_(token,data);
}
function tutorAssignMaterial_(token,data) {
  var ctx=v2TutorOrOwner_(token);data=data||{};requireTutorBatch_(ctx,String(data.batch_id||""));
  if(ctx.role!=="OWNER"){var safe={};Object.keys(data).forEach(function(k){if(k!=="id_batch_material")safe[k]=data[k];});data=safe;} // jangan izinkan menimpa mapping batch lain
  return adminAssignMaterialToBatch_(token,data);
}
function tutorAssignments_(token,filters) {
  var ctx=v2TutorOrOwner_(token),ids=ctx.role==="OWNER"?sheetToObjects_("Data_Batch").map(function(x){return x.ID_Batch;}):tutorAssignedBatchIds_(ctx.userId),out=[];
  ids.forEach(function(id){adminBatchAssignments_(token,{batch_id:id}).forEach(function(x){if(!filters||!filters.status||x.status===filters.status)out.push(x);});});
  var seen={};return out.filter(function(x){var k=x.batch_id+"|"+x.assignment_id;if(seen[k])return false;seen[k]=true;return true;});
}
function tutorSaveAssignment_(token,data) {
  var ctx=v2TutorOrOwner_(token); data=data||{};
  var id=String(data.id_assignment||"").trim();
  if(id && ctx.role!=="OWNER"){var a=findOne_("Data_Assignment","ID_Assignment",id);require_(a && String(a.Created_By)===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only edit assignments they created.");}
  return adminSaveAssignment_(token,data);
}
function tutorAssignAssignment_(token,data) { var ctx=v2TutorOrOwner_(token);requireTutorBatch_(ctx,String((data||{}).batch_id||""));return adminAssignAssignmentToBatch_(token,data||{}); }
