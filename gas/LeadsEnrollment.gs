function convertLeads_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), leadIds=Array.isArray(data.lead_ids)?data.lead_ids:[], batchId=String(data.batch_id||"");
  require_(leadIds.length,"VALIDATION_ERROR","Select at least one lead.");
  var batch=findOne_("Data_Batch","ID_Batch",batchId);
  require_(batch,"NOT_FOUND","Batch not found.");
  require_(batch.Status==="PLANNED"||batch.Status==="ACTIVE","BATCH_NOT_ACTIVE","Batch is not open.");
  var results=[];
  leadIds.forEach(function(leadId){
    try {
      var lead=findOne_("Data_Leads","ID_Lead",String(leadId));
      if(!lead){results.push({status:"error",message:"Lead not found.",lead_id:leadId});return;}
      if(lead.Status==="CONVERTED"){results.push({status:"skipped",message:"Lead already converted.",lead_id:leadId});return;}
      var packageRow=findOne_("Data_Package","ID_Package",lead.ID_Package);
      require_(packageRow,"VALIDATION_ERROR","Lead package not found.");
      var activeCount=findMany_("Data_Enrollment","ID_Batch",batchId).filter(function(e){return e.Status!=="CANCELLED";}).length;
      require_(activeCount<Number(batch.Max_Students||1),"BATCH_FULL","Batch capacity reached.");
      var student=findOne_("Data_Siswa","Email",normalizeEmail_(lead.Email));
      var createdStudent=false, temp="", emailSent=false;
      if(!student){
        temp=randomPassword_();
        var salt=randomHex_(16);
        student={
          ID_Siswa:makeStudentId_(),
          Nama_Lengkap:lead.Nama_Lengkap,
          Email:normalizeEmail_(lead.Email),
          Nomor_WA:lead.Nomor_WA,
          Password_Hash:hashPassword_(temp,salt),
          Password_Salt:salt,
          Must_Change_Password:true,
          Foto_File_ID:"",
          Student_Folder_ID:"",
          Status_Akun:"INACTIVE",
          Welcome_Email_Status:"PENDING",
          Welcome_Email_Sent_At:"",
          Last_Login:"",
          Created_At:now_(),Updated_At:now_()
        };
        var folders=createStudentFolder_(student.ID_Siswa,student.Nama_Lengkap);
        student.Student_Folder_ID=folders.folder_id;
        appendObject_("Data_Siswa",student);
        createdStudent=true;
        try {
          sendWelcomeEmail_(student,temp);
          updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Welcome_Email_Status:"SENT",Welcome_Email_Sent_At:now_()});
          emailSent=true;
        } catch(emailErr) {
          updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Welcome_Email_Status:"FAILED",Welcome_Email_Sent_At:""});
          audit_(ctx,"WELCOME_EMAIL_FAILED","Data_Siswa",student.ID_Siswa,String(emailErr.message||emailErr),"FAILED");
        }
      }
      var existingEnr=findMany_("Data_Enrollment","ID_Siswa",student.ID_Siswa).filter(function(e){return e.ID_Batch===batchId && e.Status!=="CANCELLED";})[0];
      if(existingEnr){
        results.push({status:"skipped",lead_id:leadId,studentId:student.ID_Siswa,message:"Student is already enrolled in this batch."});
        return;
      }
      var start=batch.Tanggal_Mulai || today_();
      var end=batch.Tanggal_Selesai;
      if(!end){
        var d=parseDateValue_(start); d.setMonth(d.getMonth()+Number(batch.Durasi_Bulan||1)); d.setDate(d.getDate()-1); end=toClientDate_(d);
      }
      var enrollment={
        ID_Enrollment:makeId_("ENR"),ID_Siswa:student.ID_Siswa,ID_Batch:batchId,ID_Package:lead.ID_Package,
        Tanggal_Mulai:start,Tanggal_Selesai:end,Harga_Disepakati_Per_Bulan:Number(packageRow.Harga_Per_Bulan||0),
        Status:"INACTIVE",Current_Month:1,Current_Meeting:0,Completion_Status:"IN_PROGRESS",Created_At:now_(),Updated_At:now_()
      };
      appendObject_("Data_Enrollment",enrollment);
      updateObject_("Data_Leads","ID_Lead",leadId,{Status:"CONVERTED",ID_Siswa:student.ID_Siswa,Converted_At:now_(),Converted_By:ctx.userId});
      audit_(ctx,"CONVERT_LEAD","Data_Leads",leadId,"Lead converted to "+student.ID_Siswa,"SUCCESS");
      results.push({status:"converted",lead_id:leadId,studentId:student.ID_Siswa,email_sent:emailSent,existing_student:!createdStudent,folder_created:createdStudent});
    } catch(e) {
      results.push({status:"error",lead_id:leadId,message:e.message||"Conversion failed."});
    }
  });
  return {results:results};
}

function adminGetLeads_(token,filters) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var rows=sheetToObjects_("Data_Leads");
  if(filters&&filters.status&&filters.status!=="ALL") rows=rows.filter(function(x){return x.Status===filters.status;});
  return rows.map(function(x){
    var pkg=findOne_("Data_Package","ID_Package",x.ID_Package);
    return {id:x.ID_Lead,timestamp:x.Timestamp,name:x.Nama_Lengkap,email:x.Email,phone:x.Nomor_WA,package_id:x.ID_Package,package_name:pkg&&pkg.Nama_Paket,status:x.Status,referral_code:x.Kode_Referral,message:x.Pesan,student_id:x.ID_Siswa};
  }).sort(function(a,b){return String(b.timestamp).localeCompare(String(a.timestamp));});
}

function adminListBatches_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  return sheetToObjects_("Data_Batch").map(function(b){
    var level=findOne_("Data_Level","ID_Level",String(b.Level_ID||""));
    return {id:b.ID_Batch,name:b.Nama_Batch,program_id:b.ID_Program,level:b.Level,level_id:b.Level_ID||"",level_name:level&&level.Level_Name||b.Level,class_type:b.Tipe_Kelas,max_students:Number(b.Max_Students||0),start_date:toClientDate_(b.Tanggal_Mulai),end_date:toClientDate_(b.Tanggal_Selesai),duration_months:Number(b.Durasi_Bulan||0),meetings_per_month:Number(b.Pertemuan_Per_Bulan||0),meetings_total:Number(b.Pertemuan_Per_Bulan||0)*Number(b.Durasi_Bulan||0),meetings_done:completedMeetingCount_(b.ID_Batch),min_attendance:Number(b.Minimum_Attendance||0),min_assignment:Number(b.Minimum_Assignment||0),min_score:Number(b.Minimum_Score||0),status:b.Status,syllabus_mode:b.Syllabus_Mode};
  });
}

function adminSaveBatch_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN");
  ensureSheet_("Data_Batch",COGNIORA_SCHEMA.Data_Batch);
  var id=String(data.id_batch||""), type=String(data.class_type||"GROUP"), dur=Math.max(1,toNumber_(data.duration_months,1));
  var prevBatch=id?findOne_("Data_Batch","ID_Batch",id):null;
  var perRaw=data.meetings_per_month, perMonth=(perRaw===undefined||perRaw===null||perRaw==="")?Number(prevBatch&&prevBatch.Pertemuan_Per_Bulan||0):Math.round(toNumber_(perRaw,0));
  if(perRaw!==undefined&&perRaw!==null&&perRaw!=="") require_(perMonth>=1&&perMonth<=31,"VALIDATION_ERROR","Pertemuan per bulan harus antara 1 dan 31.");
  require_(["GROUP","PRIVATE"].indexOf(type)>=0,"VALIDATION_ERROR","Invalid class type.");
  require_(findOne_("Data_Program","ID_Program",String(data.program_id||"")),"VALIDATION_ERROR","Program is required.");
  if(type==="PRIVATE") require_(Number(data.max_students||1)===1 || !data.max_students,"VALIDATION_ERROR","Private batch must have one student.");
  var start=String(data.start_date||today_()), end=String(data.end_date||"");
  if(!end){var d=parseDateValue_(start); d.setMonth(d.getMonth()+dur); d.setDate(d.getDate()-1); end=toClientDate_(d);}
  var levelText=String(data.level||"").trim(), levelId=String(data.level_id||"").trim();
  if(!levelId && levelText){var levelMatch=sheetToObjects_("Data_Level").filter(function(x){return String(x.Status||"ACTIVE")==="ACTIVE" && (String(x.Level_Name||"").toLowerCase()===levelText.toLowerCase() || String(x.Level_Code||"").toLowerCase()===levelText.toLowerCase());})[0];if(levelMatch)levelId=levelMatch.ID_Level;}
  if(!levelText && levelId){var chosenLevel=findOne_("Data_Level","ID_Level",levelId);if(chosenLevel)levelText=chosenLevel.Level_Name;}
  var obj={
    ID_Batch:id||makeId_("BAT"),Nama_Batch:String(data.name||"").trim(),ID_Program:String(data.program_id||""),
    Level:levelText,Level_ID:levelId,Tipe_Kelas:type,Max_Students:type==="PRIVATE"?1:Math.max(1,toNumber_(data.max_students,3)),
    Tanggal_Mulai:start,Tanggal_Selesai:end,Durasi_Bulan:dur,Pertemuan_Per_Bulan:perMonth,
    Minimum_Attendance:clamp_(toNumber_(data.minimum_attendance,getSetting_("MIN_ATTENDANCE_DEFAULT","80")),0,100),
    Minimum_Assignment:clamp_(toNumber_(data.minimum_assignment,getSetting_("MIN_ASSIGNMENT_DEFAULT","80")),0,100),
    Minimum_Score:clamp_(toNumber_(data.minimum_score,getSetting_("MIN_SCORE_DEFAULT","75")),0,100),
    Status:String(data.status||"PLANNED"),Syllabus_Mode:type==="PRIVATE"?"CUSTOM":String(data.syllabus_mode||"STANDARD"),
    Created_At:id?(findOne_("Data_Batch","ID_Batch",id)||{}).Created_At||now_():now_(),Updated_At:now_()
  };
  require_(obj.Nama_Batch,"VALIDATION_ERROR","Batch name is required.");
  require_(COGNIORA_ENUMS.BATCH_STATUS.indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid batch status.");
  if(id){require_(findOne_("Data_Batch","ID_Batch",id),"NOT_FOUND","Batch not found.");updateObject_("Data_Batch","ID_Batch",id,obj);}
  else appendObject_("Data_Batch",obj);
  audit_(ctx,id?"UPDATE_BATCH":"CREATE_BATCH","Data_Batch",obj.ID_Batch,"Batch saved","SUCCESS");
  return {id:obj.ID_Batch};
}

function adminDeleteBatch_(token,id) {
  var ctx=getAuthContext_(token,"ADMIN"), b=findOne_("Data_Batch","ID_Batch",String(id||""));
  require_(b,"NOT_FOUND","Batch not found.");
  require_(!findMany_("Data_Enrollment","ID_Batch",id).length,"VALIDATION_ERROR","Batch has enrollments. Set status to CANCELLED instead.");
  deleteById_("Data_Batch","ID_Batch",id);
  audit_(ctx,"DELETE_BATCH","Data_Batch",id,"Batch deleted","SUCCESS");
  return {deleted:true};
}

function adminBatchSyllabus_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), batchId=String(data.batch_id||"");
  require_(findOne_("Data_Batch","ID_Batch",batchId),"NOT_FOUND","Batch not found.");
  if(data.mode==="list") return findMany_("Batch_Syllabus","ID_Batch",batchId);
  var id=String(data.id_batch_syllabus||"");
  var obj={ID_Batch_Syllabus:id||makeId_("BSL"),ID_Batch:batchId,ID_Syllabus:String(data.syllabus_id||""),
    Month_No:Math.max(1,toNumber_(data.month_no,1)),Urutan:Math.max(1,toNumber_(data.order_no,1)),Topik:String(data.topic||""),
    Learning_Objective:String(data.learning_objective||""),Description:String(data.description||""),
    Is_Customized:bool_(data.is_customized) || findOne_("Data_Batch","ID_Batch",batchId).Tipe_Kelas==="PRIVATE",Status:String(data.status||"ACTIVE")};
  require_(obj.Topik,"VALIDATION_ERROR","Topic is required.");
  if(id) updateObject_("Batch_Syllabus","ID_Batch_Syllabus",id,obj); else appendObject_("Batch_Syllabus",obj);
  audit_(ctx,id?"UPDATE_BATCH_SYLLABUS":"CREATE_BATCH_SYLLABUS","Batch_Syllabus",obj.ID_Batch_Syllabus,obj.Topik,"SUCCESS");
  return {id:obj.ID_Batch_Syllabus};
}