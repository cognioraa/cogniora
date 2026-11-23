function adminStudents_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  // V40: month / meeting / completion dihitung LIVE dari attendance + nilai, bukan dari nilai tersimpan yang bisa usang.
  return withReadCache_(function(){
    var enrollments=sheetToObjects_("Data_Enrollment");
    if(filters&&filters.batch_id) enrollments=enrollments.filter(function(x){return x.ID_Batch===filters.batch_id;});
    return enrollments.map(function(e){
      var s=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa), b=findOne_("Data_Batch","ID_Batch",e.ID_Batch), p=b&&findOne_("Data_Program","ID_Program",b.ID_Program);
      var lp=liveEnrollmentProgress_(e), month=lp.month, meeting=lp.meeting, meetingsTotal=lp.meetings_total, doneMonths=lp.months_completed, max=lp.months_total, completion=lp.completion_status;
      return {enrollment_id:e.ID_Enrollment,student_id:s&&s.ID_Siswa,name:s&&s.Nama_Lengkap,email:s&&s.Email,phone:s&&s.Nomor_WA,status:e.Status,batch_id:e.ID_Batch,batch_name:b&&b.Nama_Batch,program_name:p&&p.Nama_Program,month:month,meeting:meeting,meetings_total:meetingsTotal,months_completed:doneMonths,months_total:max,completion_status:completion};
    });
  });
}

function adminStudentDetail_(token,studentId) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var s=findOne_("Data_Siswa","ID_Siswa",String(studentId||"")); require_(s,"NOT_FOUND","Student not found.");
  var enroll=findMany_("Data_Enrollment","ID_Siswa",s.ID_Siswa);
  return {student:{id:s.ID_Siswa,name:s.Nama_Lengkap,email:s.Email,phone:s.Nomor_WA,status:s.Status_Akun,welcome_email_status:s.Welcome_Email_Status},enrollments:enroll.map(publicEnrollment_)};
}

function adminSetEnrollmentStatus_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), e=findOne_("Data_Enrollment","ID_Enrollment",String(data.enrollment_id||"")), status=String(data.status||"ACTIVE");
  require_(e,"NOT_FOUND","Enrollment not found."); require_(COGNIORA_ENUMS.ENROLLMENT_STATUS.indexOf(status)>=0,"VALIDATION_ERROR","Invalid enrollment status.");
  if(status==="ACTIVE"){
    var currentMonth=currentBillingMonth_();
    var currentInvoices=findMany_("Data_Invoice","ID_Enrollment",e.ID_Enrollment).filter(function(x){return billingMonthKey_(x.Billing_Month)===String(currentMonth);});
    var paidCurrent=currentInvoices.some(function(x){return String(x.Status)==="PAID";});
    require_(paidCurrent,"PAYMENT_REQUIRED","Enrollment can only be activated after the current invoice is paid.");
  }
  updateObject_("Data_Enrollment","ID_Enrollment",e.ID_Enrollment,{Status:status,Updated_At:now_()});
  if(status==="INACTIVE"||status==="CANCELLED") syncStudentAccountStatus_(e.ID_Siswa);
  else if(status==="ACTIVE") syncStudentAccountStatus_(e.ID_Siswa);
  audit_(ctx,"CHANGE_ENROLLMENT_STATUS","Data_Enrollment",e.ID_Enrollment,"Status changed to "+status,"SUCCESS");
  return {updated:true};
}


function adminSyllabus_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  filters=filters||{};
  var programs={};
  sheetToObjects_("Data_Program").forEach(function(p){programs[p.ID_Program]=p;});
  var rows=sheetToObjects_("Data_Syllabus");
  if(filters.program_id) rows=rows.filter(function(x){return x.ID_Program===String(filters.program_id);});
  if(filters.status && filters.status!=="ALL") rows=rows.filter(function(x){return x.Status===String(filters.status);});
  return rows.sort(function(a,b){return String(a.ID_Program).localeCompare(String(b.ID_Program)) || Number(a.Month_No)-Number(b.Month_No) || Number(a.Urutan)-Number(b.Urutan);})
    .map(function(x){
      var p=programs[x.ID_Program]||{};
      return {id:x.ID_Syllabus,program_id:x.ID_Program,program_name:p.Nama_Program||"",level:p.Level||"",month:Number(x.Month_No||1),order:Number(x.Urutan||1),topic:x.Topik||"",learning_objective:x.Learning_Objective||"",description:x.Description||"",status:x.Status||"ACTIVE"};
    });
}

function adminSaveSyllabus_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_syllabus||"").trim(), programId=String(data.program_id||"").trim();
  require_(findOne_("Data_Program","ID_Program",programId),"NOT_FOUND","Program not found.");
  var existing=id?findOne_("Data_Syllabus","ID_Syllabus",id):null;
  var description=String(data.description||"").trim();
  var obj={ID_Syllabus:id||makeId_("SYL"),ID_Program:programId,Month_No:1,Urutan:1,Topik:"",Learning_Objective:"",Description:description,Status:String(data.status||"ACTIVE").trim()};
  require_(description,"VALIDATION_ERROR","Description is required.");
  require_(["ACTIVE","INACTIVE"].indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid syllabus status.");
  if(existing){
    obj.Month_No=existing.Month_No||1; obj.Urutan=existing.Urutan||1; obj.Topik=existing.Topik||""; obj.Learning_Objective=existing.Learning_Objective||"";
    updateObject_("Data_Syllabus","ID_Syllabus",id,obj);
  } else appendObject_("Data_Syllabus",obj);
  audit_(ctx,id?"UPDATE_SYLLABUS":"CREATE_SYLLABUS","Data_Syllabus",obj.ID_Syllabus,description.slice(0,120),"SUCCESS");
  return {id:obj.ID_Syllabus};
}

function adminDeleteSyllabus_(token,id) {
  var ctx=getAuthContext_(token,"ADMIN"), syllabus=findOne_("Data_Syllabus","ID_Syllabus",String(id||""));
  require_(syllabus,"NOT_FOUND","Syllabus entry not found.");
  var inBatch=findMany_("Batch_Syllabus","ID_Syllabus",syllabus.ID_Syllabus);
  require_(!inBatch.length,"VALIDATION_ERROR","This syllabus entry is already used by a batch. Deactivate it instead.");
  deleteById_("Data_Syllabus","ID_Syllabus",syllabus.ID_Syllabus);
  audit_(ctx,"DELETE_SYLLABUS","Data_Syllabus",syllabus.ID_Syllabus,"Standard syllabus deleted","SUCCESS");
  return {deleted:true};
}

function adminMaterials_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Data_Material");
  return rows.map(function(m){return {id:m.ID_Material,title:m.Judul,type:m.Tipe,description:m.Deskripsi||"",syllabus_id:m.ID_Syllabus||"",youtube_video_id:m.YouTube_Video_ID||"",drive_file_id:m.Drive_File_ID||"",external_url:m.External_URL||"",status:m.Status};});
}

function adminSaveMaterial_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_material||"").trim();
  var existing=id?findOne_("Data_Material","ID_Material",id):null;
  if(id) require_(existing,"NOT_FOUND","Material not found.");
  var obj={ID_Material:id||makeId_("MAT"),Judul:String(data.title||"").trim(),Tipe:String(data.type||"MODULE").toUpperCase(),Deskripsi:String(data.description||""),ID_Syllabus:String(data.syllabus_id||(existing&&existing.ID_Syllabus)||""),YouTube_Video_ID:String(data.youtube_video_id||""),Drive_File_ID:String(data.drive_file_id||""),External_URL:String(data.external_url||""),Status:String(data.status||"ACTIVE").toUpperCase(),Created_At:existing?(existing.Created_At||now_()):now_(),Updated_At:now_(),Created_By:existing?(existing.Created_By||ctx.userId):ctx.userId};
  require_(obj.Judul,"VALIDATION_ERROR","Material title is required.");
  require_(["MODULE","VIDEO","DOCUMENT","LINK"].indexOf(obj.Tipe)>=0,"VALIDATION_ERROR","Invalid material type.");
  require_(["ACTIVE","INACTIVE"].indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid material status.");
  if(obj.Tipe==="VIDEO") require_(obj.YouTube_Video_ID,"VALIDATION_ERROR","YouTube video ID is required.");
  if(existing) updateObject_("Data_Material","ID_Material",id,obj); else appendObject_("Data_Material",obj);
  return {id:obj.ID_Material};
}

function adminAssignMaterialToBatch_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), batch=findOne_("Data_Batch","ID_Batch",String(data.batch_id||"")), material=findOne_("Data_Material","ID_Material",String(data.material_id||""));
  require_(batch&&material,"NOT_FOUND","Batch or material not found.");
  var id=String(data.id_batch_material||""), existing=id?findOne_("Batch_Materials","ID_Batch_Material",id):findMany_("Batch_Materials","ID_Batch",batch.ID_Batch).filter(function(x){return x.ID_Material===material.ID_Material&&Number(x.Month_No)===Number(data.month||1);})[0];
  var obj={ID_Batch_Material:existing?existing.ID_Batch_Material:(id||makeId_("BMAT")),ID_Batch:batch.ID_Batch,ID_Material:material.ID_Material,Month_No:Math.max(1,toNumber_(data.month,1)),Required:bool_(data.required),Unlock_After_Meeting_No:Math.max(0,toNumber_(data.unlock_after_meeting,0)),Unlock_Date:String(data.unlock_date||""),Status:String(data.status||"ACTIVE"),Created_At:existing?existing.Created_At:now_(),Updated_At:now_()};
  if(existing) updateObject_("Batch_Materials","ID_Batch_Material",existing.ID_Batch_Material,obj); else appendObject_("Batch_Materials",obj);
  return {id:obj.ID_Batch_Material};
}

function adminAssignMaterialToBatches_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN");
  data=data||{};
  var materialId=String(data.material_id||"").trim();
  var material=findOne_("Data_Material","ID_Material",materialId);
  require_(material,"NOT_FOUND","Material not found.");

  var selectedIds=Array.isArray(data.batch_ids)?data.batch_ids.map(function(x){return String(x||"").trim();}).filter(Boolean):[];
  var uniqueIds=[];
  selectedIds.forEach(function(id){if(uniqueIds.indexOf(id)<0)uniqueIds.push(id);});

  // Validasi seluruh batch terlebih dahulu agar tidak terjadi perubahan parsial karena ID batch yang tidak valid.
  var batchRows=sheetToObjects_("Data_Batch"), batchMap={};
  batchRows.forEach(function(b){batchMap[String(b.ID_Batch)]=b;});
  uniqueIds.forEach(function(id){
    var batch=batchMap[id];
    require_(batch,"NOT_FOUND","Salah satu batch yang dipilih tidak ditemukan.");
    require_(String(batch.Status||"").toUpperCase()!=="CANCELLED","VALIDATION_ERROR","Batch yang dibatalkan tidak dapat menerima materi.");
  });

  var rows=sheetToObjects_("Batch_Materials").filter(function(x){return String(x.ID_Material)===materialId;});
  var selectedMap={}; uniqueIds.forEach(function(id){selectedMap[id]=true;});
  var now=now_(), activated=0, deactivated=0, created=0;

  // Pertahankan pengaturan Month / Required / Unlock yang sudah ada pada setiap batch.
  rows.forEach(function(row){
    var shouldBeActive=!!selectedMap[String(row.ID_Batch)];
    var currentStatus=String(row.Status||"ACTIVE").toUpperCase();
    if(shouldBeActive && currentStatus!=="ACTIVE"){
      updateObject_("Batch_Materials","ID_Batch_Material",row.ID_Batch_Material,{Status:"ACTIVE",Updated_At:now});
      activated++;
    } else if(!shouldBeActive && currentStatus==="ACTIVE"){
      updateObject_("Batch_Materials","ID_Batch_Material",row.ID_Batch_Material,{Status:"INACTIVE",Updated_At:now});
      deactivated++;
    }
  });

  // Batch baru untuk materi ini dibuat dengan default akses langsung; pengaturan dapat diubah melalui alur materi batch yang sudah tersedia.
  uniqueIds.forEach(function(batchId){
    var exists=rows.some(function(row){return String(row.ID_Batch)===batchId;});
    if(exists) return;
    appendObject_("Batch_Materials",{
      ID_Batch_Material:makeId_("BMAT"),
      ID_Batch:batchId,
      ID_Material:materialId,
      Month_No:1,
      Required:false,
      Unlock_After_Meeting_No:0,
      Unlock_Date:"",
      Status:"ACTIVE",
      Created_At:now,
      Updated_At:now
    });
    created++;
  });

  audit_(ctx,"ASSIGN_MATERIAL_BATCHES","Data_Material",materialId,
    "Batch access updated. Selected: "+uniqueIds.length+", created: "+created+", activated: "+activated+", deactivated: "+deactivated,"SUCCESS");
  return {material_id:materialId,selected_count:uniqueIds.length,created_count:created,activated_count:activated,deactivated_count:deactivated};
}

function adminAssignments_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  return sheetToObjects_("Data_Assignment").map(function(a){return {id:a.ID_Assignment,title:a.Judul,description:a.Deskripsi,month:Number(a.Month_No||1),deadline:toClientDate_(a.Due_Date),required:bool_(a.Required),status:a.Status};});
}

function adminSaveAssignment_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_assignment||""), obj={ID_Assignment:id||makeId_("ASS"),Judul:String(data.title||""),Deskripsi:String(data.description||""),Month_No:Math.max(1,toNumber_(data.month,1)),ID_Syllabus:String(data.syllabus_id||""),Due_Date:String(data.due_date||""),Required:bool_(data.required),Status:String(data.status||"ACTIVE"),Created_At:id?(findOne_("Data_Assignment","ID_Assignment",id)||{}).Created_At||now_():now_(),Updated_At:now_(),Created_By:ctx.userId};
  require_(obj.Judul,"VALIDATION_ERROR","Assignment title is required.");
  if(id) updateObject_("Data_Assignment","ID_Assignment",id,obj); else appendObject_("Data_Assignment",obj);
  return {id:obj.ID_Assignment};
}

function adminAssignAssignmentToBatch_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), batch=findOne_("Data_Batch","ID_Batch",String(data.batch_id||"")), a=findOne_("Data_Assignment","ID_Assignment",String(data.assignment_id||""));
  require_(batch&&a,"NOT_FOUND","Batch or assignment not found.");
  var existing=findMany_("Batch_Assignment","ID_Batch",batch.ID_Batch).filter(function(x){return x.ID_Assignment===a.ID_Assignment;})[0];
  var obj={ID_Batch_Assignment:existing?existing.ID_Batch_Assignment:makeId_("BA"),ID_Batch:batch.ID_Batch,ID_Assignment:a.ID_Assignment,Unlock_After_Meeting_No:Math.max(0,toNumber_(data.unlock_after_meeting,0)),Status:String(data.status||"ACTIVE"),Created_At:existing?existing.Created_At:now_(),Updated_At:now_()};
  if(existing) updateObject_("Batch_Assignment","ID_Batch_Assignment",existing.ID_Batch_Assignment,obj); else appendObject_("Batch_Assignment",obj);
  ensureStudentAssignmentsForBatch_(batch.ID_Batch);
  return {id:obj.ID_Batch_Assignment};
}

function ensureStudentAssignmentsForBatch_(batchId) {
  var enroll=findMany_("Data_Enrollment","ID_Batch",batchId).filter(function(e){return e.Status==="ACTIVE";});
  enroll.forEach(ensureStudentAssignmentsForEnrollment_);
}

function adminAssignmentSubmissions_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Assignment_Submissions");
  return rows.sort(function(a,b){return String(b.Submitted_At).localeCompare(String(a.Submitted_At));}).map(function(x){
    var sa=findOne_("Student_Assignment","ID_Student_Assignment",x.ID_Student_Assignment), e=sa&&findOne_("Data_Enrollment","ID_Enrollment",sa.ID_Enrollment), s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa), ba=sa&&findOne_("Batch_Assignment","ID_Batch_Assignment",sa.ID_Batch_Assignment), a=ba&&findOne_("Data_Assignment","ID_Assignment",ba.ID_Assignment);
    return {id:x.ID_Submission,student_assignment_id:x.ID_Student_Assignment,student_id:s&&s.ID_Siswa,student_name:s&&s.Nama_Lengkap,assignment_id:a&&a.ID_Assignment,assignment_title:a&&a.Judul,attempt:Number(x.Attempt_No||0),text:x.Submission_Text||"",file_id:x.Drive_File_ID||"",submitted_at:x.Submitted_At,status:x.Status,assignment_status:sa&&sa.Status,score:sa&&sa.Score===""?null:Number(sa&&sa.Score),feedback:sa&&sa.Feedback||""};
  }).filter(function(x){return !filters||!filters.status||filters.status==="ALL"||x.assignment_status===filters.status;});
}

function adminReviewSubmission_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), sa=findOne_("Student_Assignment","ID_Student_Assignment",String(data.student_assignment_id||""));
  require_(sa,"NOT_FOUND","Student assignment not found.");
  var decision=String(data.decision||"NEED_REVISION");
  require_(["NEED_REVISION","ACCEPTED"].indexOf(decision)>=0,"VALIDATION_ERROR","Invalid review decision.");
  var upd={Status:decision,Feedback:String(data.feedback||""),Score:decision==="ACCEPTED"?clamp_(Number(data.score||0),0,100):"",Reviewed_By:ctx.userId,Reviewed_At:now_(),Updated_At:now_()};
  if(decision==="NEED_REVISION") upd.Revision_Count=Number(sa.Revision_Count||0)+1;
  updateObject_("Student_Assignment","ID_Student_Assignment",sa.ID_Student_Assignment,upd);
  var latest=findMany_("Assignment_Submissions","ID_Student_Assignment",sa.ID_Student_Assignment).sort(function(a,b){return Number(b.Attempt_No)-Number(a.Attempt_No);})[0];
  if(latest) updateObject_("Assignment_Submissions","ID_Submission",latest.ID_Submission,{Status:"REVIEWED",Reviewed_By:ctx.userId,Reviewed_At:now_()});
  var e=findOne_("Data_Enrollment","ID_Enrollment",sa.ID_Enrollment); if(e) recalculateEnrollmentState_(e.ID_Enrollment);
  return {reviewed:true,status:decision};
}

function adminDeleteSchedule_(token,id) {
  var ctx=getAuthContext_(token,"ADMIN");
  var schedule=findOne_("Data_Schedule","ID_Schedule",String(id||"")); require_(schedule,"NOT_FOUND","Schedule not found.");
  require_(!findMany_("Student_Attendance","ID_Schedule",schedule.ID_Schedule).length,"VALIDATION_ERROR","Attendance already exists; mark schedule CANCELLED instead.");
  deleteById_("Data_Schedule","ID_Schedule",schedule.ID_Schedule);
  audit_(ctx,"DELETE_SCHEDULE","Data_Schedule",schedule.ID_Schedule,"Schedule deleted","SUCCESS");
  return {deleted:true};
}

// ===================== V36: Materials & Assignments dalam satu form =====================
function adminBatchMaterials_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var batches={}; sheetToObjects_("Data_Batch").forEach(function(b){batches[b.ID_Batch]=b;});
  var mats={}; sheetToObjects_("Data_Material").forEach(function(m){mats[m.ID_Material]=m;});
  var bms=sheetToObjects_("Batch_Materials"), used={}, out=[];
  bms.forEach(function(bm){
    used[bm.ID_Material]=true;
    if(filters&&filters.batch_id&&bm.ID_Batch!==filters.batch_id) return;
    var m=mats[bm.ID_Material]; if(!m) return;
    out.push(batchMaterialClient_(bm,m,batches[bm.ID_Batch]));
  });
  // Material lama yang belum pernah di-assign ke batch (penyebab modul tidak muncul di student console).
  if(!(filters&&filters.batch_id)) Object.keys(mats).forEach(function(id){
    if(used[id]) return;
    out.push(batchMaterialClient_(null,mats[id],null));
  });
  return out;
}

function batchMaterialClient_(bm,m,b) {
  return {batch_material_id:bm?bm.ID_Batch_Material:"",material_id:m.ID_Material,batch_id:bm?bm.ID_Batch:"",batch_name:b?b.Nama_Batch:"",
    month:bm?Number(bm.Month_No||1):1,unlock_after_meeting:bm?Number(bm.Unlock_After_Meeting_No||0):0,unlock_date:bm?toClientDate_(bm.Unlock_Date):"",
    required:bm?bool_(bm.Required):false,status:bm?String(bm.Status||"ACTIVE"):"UNASSIGNED",unassigned:!bm,
    title:m.Judul,type:m.Tipe,description:m.Deskripsi||"",youtube_video_id:m.YouTube_Video_ID||"",drive_file_id:m.Drive_File_ID||"",external_url:m.External_URL||""};
}

function adminSaveBatchMaterial_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN");
  var batch=findOne_("Data_Batch","ID_Batch",String(data.batch_id||"").trim());
  require_(batch,"VALIDATION_ERROR","Pilih batch terlebih dahulu.");
  var month=Math.max(1,toNumber_(data.month,1));
  require_(month<=Math.max(1,Number(batch.Durasi_Bulan||1)),"VALIDATION_ERROR","Month harus antara 1 dan "+Number(batch.Durasi_Bulan||1)+".");
  var type=String(data.type||"MODULE").toUpperCase();
  require_(["MODULE","VIDEO","DOCUMENT","LINK"].indexOf(type)>=0,"VALIDATION_ERROR","Tipe material tidak valid.");
  var title=String(data.title||"").trim(), yt=String(data.youtube_video_id||"").trim(), drive=String(data.drive_file_id||"").trim(), ext=String(data.external_url||"").trim();
  require_(title,"VALIDATION_ERROR","Title wajib diisi.");
  if(type==="VIDEO") require_(yt||ext,"VALIDATION_ERROR","Video membutuhkan YouTube Video ID atau External URL.");
  else require_(drive||ext,"VALIDATION_ERROR","Modul membutuhkan Drive File ID atau External URL.");
  var status=String(data.status||"ACTIVE").toUpperCase();
  require_(["ACTIVE","INACTIVE"].indexOf(status)>=0,"VALIDATION_ERROR","Status tidak valid.");
  var unlockDate=String(data.unlock_date||"").trim();
  require_(!unlockDate||/^\d{4}-\d{2}-\d{2}$/.test(unlockDate),"VALIDATION_ERROR","Unlock date tidak valid.");

  var bmId=String(data.batch_material_id||"").trim(), matId=String(data.material_id||"").trim();
  var existingBm=bmId?findOne_("Batch_Materials","ID_Batch_Material",bmId):null;
  if(bmId) require_(existingBm,"NOT_FOUND","Material batch tidak ditemukan.");
  if(existingBm) matId=existingBm.ID_Material;
  var mat=matId?findOne_("Data_Material","ID_Material",matId):null;
  // Jika material dipakai batch lain, edit dibuat sebagai salinan agar batch lain tidak ikut berubah.
  if(mat && existingBm){
    var shared=sheetToObjects_("Batch_Materials").some(function(x){return x.ID_Material===matId && x.ID_Batch_Material!==existingBm.ID_Batch_Material;});
    if(shared) mat=null;
  }
  var matObj={ID_Material:mat?mat.ID_Material:makeId_("MAT"),Judul:title,Tipe:type,Deskripsi:String(data.description||""),ID_Syllabus:mat?String(mat.ID_Syllabus||""):"",
    YouTube_Video_ID:yt,Drive_File_ID:drive,External_URL:ext,Status:"ACTIVE",Created_At:mat?(mat.Created_At||now_()):now_(),Updated_At:now_(),Created_By:mat?(mat.Created_By||ctx.userId):ctx.userId};
  if(mat) updateObject_("Data_Material","ID_Material",mat.ID_Material,matObj); else appendObject_("Data_Material",matObj);

  var bmObj={ID_Batch_Material:existingBm?existingBm.ID_Batch_Material:makeId_("BMAT"),ID_Batch:batch.ID_Batch,ID_Material:matObj.ID_Material,Month_No:month,
    Required:bool_(data.required),Unlock_After_Meeting_No:Math.max(0,Math.round(toNumber_(data.unlock_after_meeting,0))),Unlock_Date:unlockDate,Status:status,
    Created_At:existingBm?(existingBm.Created_At||now_()):now_(),Updated_At:now_()};
  if(existingBm) updateObject_("Batch_Materials","ID_Batch_Material",existingBm.ID_Batch_Material,bmObj); else appendObject_("Batch_Materials",bmObj);
  audit_(ctx,existingBm?"UPDATE_BATCH_MATERIAL":"CREATE_BATCH_MATERIAL","Batch_Materials",bmObj.ID_Batch_Material,title+" | "+batch.ID_Batch,"SUCCESS");
  return {batch_material_id:bmObj.ID_Batch_Material,material_id:matObj.ID_Material};
}

function adminSetBatchMaterialStatus_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.batch_material_id||""), status=String(data.status||"").toUpperCase();
  require_(findOne_("Batch_Materials","ID_Batch_Material",id),"NOT_FOUND","Material batch tidak ditemukan.");
  require_(["ACTIVE","INACTIVE"].indexOf(status)>=0,"VALIDATION_ERROR","Status tidak valid.");
  updateObject_("Batch_Materials","ID_Batch_Material",id,{Status:status,Updated_At:now_()});
  audit_(ctx,"UPDATE_BATCH_MATERIAL_STATUS","Batch_Materials",id,status,"SUCCESS");
  return {batch_material_id:id,status:status};
}

function adminBatchAssignments_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var batches={}; sheetToObjects_("Data_Batch").forEach(function(b){batches[b.ID_Batch]=b;});
  var asg={}; sheetToObjects_("Data_Assignment").forEach(function(a){asg[a.ID_Assignment]=a;});
  var out=[], used={};
  sheetToObjects_("Batch_Assignment").forEach(function(ba){
    used[ba.ID_Assignment]=true;
    if(filters&&filters.batch_id&&ba.ID_Batch!==filters.batch_id) return;
    var a=asg[ba.ID_Assignment]; if(!a) return;
    out.push(batchAssignmentClient_(ba,a,batches[ba.ID_Batch]));
  });
  if(!(filters&&filters.batch_id)) Object.keys(asg).forEach(function(id){ if(!used[id]) out.push(batchAssignmentClient_(null,asg[id],null)); });
  return out;
}

function batchAssignmentClient_(ba,a,b) {
  return {batch_assignment_id:ba?ba.ID_Batch_Assignment:"",assignment_id:a.ID_Assignment,batch_id:ba?ba.ID_Batch:"",batch_name:b?b.Nama_Batch:"",
    month:Number(a.Month_No||1),unlock_after_meeting:ba?Number(ba.Unlock_After_Meeting_No||0):0,unlock_date:ba?toClientDate_(ba.Unlock_Date):"",
    required:bool_(a.Required),status:ba?String(ba.Status||"ACTIVE"):"UNASSIGNED",unassigned:!ba,title:a.Judul,description:a.Deskripsi||""};
}

function adminSaveBatchAssignment_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN");
  ensureSheet_("Batch_Assignment",COGNIORA_SCHEMA.Batch_Assignment);
  var batch=findOne_("Data_Batch","ID_Batch",String(data.batch_id||"").trim());
  require_(batch,"VALIDATION_ERROR","Pilih batch terlebih dahulu.");
  var month=Math.max(1,toNumber_(data.month,1));
  require_(month<=Math.max(1,Number(batch.Durasi_Bulan||1)),"VALIDATION_ERROR","Month harus antara 1 dan "+Number(batch.Durasi_Bulan||1)+".");
  var title=String(data.title||"").trim(); require_(title,"VALIDATION_ERROR","Title wajib diisi.");
  var status=String(data.status||"ACTIVE").toUpperCase();
  require_(["ACTIVE","PLANNED","EXPIRED"].indexOf(status)>=0,"VALIDATION_ERROR","Status harus ACTIVE, PLANNED atau EXPIRED.");
  var unlockDate=String(data.unlock_date||"").trim();
  require_(!unlockDate||/^\d{4}-\d{2}-\d{2}$/.test(unlockDate),"VALIDATION_ERROR","Unlock date tidak valid.");

  var baId=String(data.batch_assignment_id||"").trim(), asId=String(data.assignment_id||"").trim();
  var existingBa=baId?findOne_("Batch_Assignment","ID_Batch_Assignment",baId):null;
  if(baId) require_(existingBa,"NOT_FOUND","Assignment batch tidak ditemukan.");
  if(existingBa) asId=existingBa.ID_Assignment;
  var a=asId?findOne_("Data_Assignment","ID_Assignment",asId):null;
  if(a && existingBa){
    var shared=sheetToObjects_("Batch_Assignment").some(function(x){return x.ID_Assignment===asId && x.ID_Batch_Assignment!==existingBa.ID_Batch_Assignment;});
    if(shared) a=null;
  }
  var aObj={ID_Assignment:a?a.ID_Assignment:makeId_("ASS"),Judul:title,Deskripsi:String(data.description||""),Month_No:month,ID_Syllabus:a?String(a.ID_Syllabus||""):"",
    Due_Date:a?String(a.Due_Date||""):"",Required:bool_(data.required),Status:"ACTIVE",Created_At:a?(a.Created_At||now_()):now_(),Updated_At:now_(),Created_By:a?(a.Created_By||ctx.userId):ctx.userId};
  if(a) updateObject_("Data_Assignment","ID_Assignment",a.ID_Assignment,aObj); else appendObject_("Data_Assignment",aObj);

  var baObj={ID_Batch_Assignment:existingBa?existingBa.ID_Batch_Assignment:makeId_("BA"),ID_Batch:batch.ID_Batch,ID_Assignment:aObj.ID_Assignment,
    Unlock_After_Meeting_No:Math.max(0,Math.round(toNumber_(data.unlock_after_meeting,0))),Unlock_Date:unlockDate,Status:status,
    Created_At:existingBa?(existingBa.Created_At||now_()):now_(),Updated_At:now_()};
  if(existingBa) updateObject_("Batch_Assignment","ID_Batch_Assignment",existingBa.ID_Batch_Assignment,baObj); else appendObject_("Batch_Assignment",baObj);
  ensureStudentAssignmentsForBatch_(batch.ID_Batch);
  audit_(ctx,existingBa?"UPDATE_BATCH_ASSIGNMENT":"CREATE_BATCH_ASSIGNMENT","Batch_Assignment",baObj.ID_Batch_Assignment,title+" | "+batch.ID_Batch,"SUCCESS");
  return {batch_assignment_id:baObj.ID_Batch_Assignment,assignment_id:aObj.ID_Assignment};
}

function adminSetBatchAssignmentStatus_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.batch_assignment_id||""), status=String(data.status||"").toUpperCase();
  var ba=findOne_("Batch_Assignment","ID_Batch_Assignment",id);
  require_(ba,"NOT_FOUND","Assignment batch tidak ditemukan.");
  require_(["ACTIVE","PLANNED","EXPIRED"].indexOf(status)>=0,"VALIDATION_ERROR","Status harus ACTIVE, PLANNED atau EXPIRED.");
  updateObject_("Batch_Assignment","ID_Batch_Assignment",id,{Status:status,Updated_At:now_()});
  ensureStudentAssignmentsForBatch_(ba.ID_Batch);
  audit_(ctx,"UPDATE_BATCH_ASSIGNMENT_STATUS","Batch_Assignment",id,status,"SUCCESS");
  return {batch_assignment_id:id,status:status};
}
