function doGet(e) {
  var params=e&&e.parameter?e.parameter:{};
  var action=String(params.action||"");
  var apiAlias=String(params.api||"");
  if(action==="health" || apiAlias==="health") return jsonResponse_({success:true,data:{service:"COGNIORA GAS",status:"online",time:now_()}});
  if(action==="api" || (apiAlias && apiAlias!=="health")) {
    try {
      var requestedAction=String(params.api_action||params.api||"");
      return jsonResponse_(handleApiPayload_(requestedAction,params.data?parseJson_(params.data):{},params.session_token||"",params.api_key||""));
    } catch(err){ return jsonResponse_(errorPayload_(err)); }
  }
  return HtmlService.createHtmlOutputFromFile("index").setTitle("COGNIORA — Learning, Progress, and Growth.").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleApiPayload_(action,data,sessionToken,apiKey) {
  if(action==="health") return {success:true,data:{service:"COGNIORA GAS",status:"online",time:now_()}};
  if(apiKey) requireApiKey_(apiKey);
  else if(action.indexOf("public.")!==0 && action.indexOf("auth.")!==0) requireApiKey_(data.api_key||"");
  if(action.indexOf("form:")===0) return {success:true,data:safeJson_(apiFormInternal_(action.substring(5),data)),message:"OK"}; // upload dari Vercel (file berupa data URL base64)
  return {success:true,data:safeJson_(handleInternalAction_(action,data,sessionToken)),message:"OK"};
}

function doPost(e) {
  try {
    var payload=e&&e.postData&&e.postData.contents?parseJson_(e.postData.contents):{};
    return handleApiResponse_(String(payload.action||""),payload.data||{},payload.session_token||"",payload.api_key||"");
  } catch(err) { return jsonResponse_(errorPayload_(err)); }
}

function apiInvoke(action,data,sessionToken) {
  try {
    // Direct GAS HTML Service calls do not need the Vercel-to-GAS API key.
    return {success:true,data:safeJson_(handleInternalAction_(String(action||""),data||{},String(sessionToken||""))),message:"OK"};
  } catch(err) { return errorPayload_(err); }
}

function handleApiResponse_(action,data,sessionToken,apiKey) {
  return jsonResponse_(handleApiPayload_(action,data,sessionToken,apiKey));
}

function handleInternalAction_(action,data,sessionToken) {
  data=data||{};
  // V2 access boundary: legacy admin namespace is Owner-only. Tutors use scoped tutor.* actions.
  if(action.indexOf("admin.")===0 || action.indexOf("report.export.")===0 || action.indexOf("package.")===0) {
    var ownerCtx=getAuthContext_(sessionToken,"ADMIN"); assertOwner_(ownerCtx);
  }
  if(action.indexOf("tutor.")===0) v2TutorOrOwner_(sessionToken);
  if(action==="public.content") return publicContent_();
  if(action==="public.programs") return publicPrograms_();
  if(action==="public.packages") return publicPackages_();
  if(action==="public.syllabus") return publicSyllabus_(data);
  if(action==="public.testimonials") return publicTestimonials_();
  if(action==="public.leads.create") return publicCreateLead_(data);
  if(action==="public.certificate.verify") return publicCertificateVerify_(data);
  if(action==="public.image") return publicSiteImage_(data);

  if(action==="auth.student.login") return studentLogin_(data);
  if(action==="auth.admin.login") return adminLogin_(data);
  if(action==="auth.session") return authSession_(sessionToken||data.session_token);
  if(action==="auth.logout") return authLogout_(sessionToken||data.session_token);
  if(action==="auth.forgotPassword") return forgotPassword_(data);
  if(action==="auth.resetPassword") return resetPassword_(data);
  if(action==="auth.changePassword") return changePassword_(sessionToken||data.session_token,data);
  if(action==="auth.admin.changePassword") return adminChangePassword_(sessionToken||data.session_token,data);
  if(action==="auth.termsStatus") return termsStatus_(sessionToken||data.session_token);
  if(action==="auth.acceptTerms") return acceptTerms_(sessionToken||data.session_token,data);

  if(action==="student.dashboard") return studentDashboard_(sessionToken);
  if(action==="student.profile") return studentProfile_(sessionToken);
  if(action==="student.materials") return studentMaterials_(sessionToken,data);
  if(action==="student.material.complete") return completeMaterial_(sessionToken,data);
  if(action==="student.assignments") return studentAssignments_(getSelectedStudentEnrollment_(sessionToken,getAuthContext_(sessionToken,"STUDENT").userId,data.enrollment_id),data);
  if(action==="student.schedule") return studentSchedule_(sessionToken);
  if(action==="student.payments") return studentPayments_(sessionToken);
  if(action==="student.progress") return learningProgress_(getSelectedStudentEnrollment_(sessionToken,getAuthContext_(sessionToken,"STUDENT").userId,data.enrollment_id));
  if(action==="student.progress.overview") return studentProgressOverview_(sessionToken);
  if(action==="student.report.months") return studentReportMonths_(sessionToken);
  if(action==="student.report.month") return studentReports_(sessionToken,data.month);
  if(action==="student.achievements") return studentAchievements_(getSelectedStudentEnrollment_(sessionToken,getAuthContext_(sessionToken,"STUDENT").userId,data.enrollment_id));
  if(action==="student.file") return studentProtectedFile_(sessionToken,data);
  if(action==="student.file.link") return studentMaterialDriveLink_(sessionToken,data);
  if(action==="student.assignment.link") return studentAssignmentDriveLink_(sessionToken,data);
  if(action==="student.certificate.link") return studentCertificateDriveLink_(sessionToken,data);
  if(action==="student.certificate") return studentCertificate_(sessionToken);
  if(action==="student.certificate.file") return studentCertificateFile_(sessionToken,data);

  if(action==="admin.overview") return adminOverview_(sessionToken);
  if(action==="admin.leads") return adminGetLeads_(sessionToken,data);
  if(action==="admin.leads.convert") return convertLeads_(sessionToken,data);
  if(action==="admin.batches") return adminListBatches_(sessionToken);
  if(action==="admin.batch.save") return adminSaveBatch_(sessionToken,data);
  if(action==="admin.batch.delete") return adminDeleteBatch_(sessionToken,data.id);
  if(action==="admin.batch.syllabus") return adminBatchSyllabus_(sessionToken,data);
  if(action==="admin.students") return adminStudents_(sessionToken,data);
  if(action==="admin.student.detail") return adminStudentDetail_(sessionToken,data.student_id);
  if(action==="admin.student.status") return adminSetEnrollmentStatus_(sessionToken,data);
  if(action==="admin.materials") return adminMaterials_(sessionToken,data);
  if(action==="admin.material.save") return adminSaveMaterial_(sessionToken,data);
  if(action==="admin.material.assign") return adminAssignMaterialToBatch_(sessionToken,data);
  if(action==="admin.material.assignMultiple") return adminAssignMaterialToBatches_(sessionToken,data);
  if(action==="admin.assignments") return adminAssignments_(sessionToken);
  if(action==="admin.assignment.save") return adminSaveAssignment_(sessionToken,data);
  if(action==="admin.assignment.assign") return adminAssignAssignmentToBatch_(sessionToken,data);
  if(action==="admin.assignment.submissions") return adminAssignmentSubmissions_(sessionToken,data);
  if(action==="admin.assignment.review") return adminReviewSubmission_(sessionToken,data);
  if(action==="admin.schedules") return adminSchedules_(sessionToken,data);
  if(action==="admin.schedule.save") return adminSaveSchedule_(sessionToken,data);
  if(action==="admin.schedule.delete") return adminDeleteSchedule_(sessionToken,data.id);
  if(action==="admin.schedule.status") return adminSetScheduleStatus_(sessionToken,data);
  if(action==="admin.batchMaterials") return adminBatchMaterials_(sessionToken,data);
  if(action==="admin.batchMaterial.save") return adminSaveBatchMaterial_(sessionToken,data);
  if(action==="admin.batchMaterial.status") return adminSetBatchMaterialStatus_(sessionToken,data);
  if(action==="admin.batchAssignments") return adminBatchAssignments_(sessionToken,data);
  if(action==="admin.batchAssignment.save") return adminSaveBatchAssignment_(sessionToken,data);
  if(action==="admin.batchAssignment.status") return adminSetBatchAssignmentStatus_(sessionToken,data);
  if(action==="admin.attendance") return adminAttendance_(sessionToken,data);
  if(action==="admin.attendance.save") return adminSaveAttendance_(sessionToken,data);
  if(action==="admin.attendance.saveBulk") return adminSaveAttendanceBulk_(sessionToken,data);
  if(action==="admin.payments") return adminPayments_(sessionToken,data);
  if(action==="admin.payment.approve") return adminApprovePayment_(sessionToken,data.payment_id);
  if(action==="admin.payment.reject") return adminRejectPayment_(sessionToken,data.payment_id,data.reason);
  if(action==="admin.payment.proof") return adminPaymentProof_(sessionToken,data);
  if(action==="admin.reports") return adminReports_(sessionToken,data);
  if(action==="admin.report.save") return adminSaveReport_(sessionToken,data);
  if(action==="admin.achievements") return adminAchievements_(sessionToken);
  if(action==="admin.achievement.save") return adminSaveAchievement_(sessionToken,data);
  if(action==="admin.achievement.award") return awardAchievement_(sessionToken,data);
  if(action==="admin.certificates") return adminCertificates_(sessionToken);
  if(action==="admin.certificate.eligibility") return adminCertificateEligibility_(sessionToken,data);
  if(action==="admin.certificate.generate") return adminGenerateCertificate_(sessionToken,data,"GENERATED");
  if(action==="admin.certificate.regenerate") return adminGenerateCertificate_(sessionToken,data,"REGENERATED");
  if(action==="admin.certificate.reissue") return adminGenerateCertificate_(sessionToken,data,"REISSUED");
  if(action==="admin.certificate.revoke") return adminRevokeCertificate_(sessionToken,data);
  if(action==="admin.certificate.file") return adminCertificateFile_(sessionToken,data);
  if(action==="admin.invoices") return adminInvoices_(sessionToken,data);
  if(action==="admin.invoice.preview") return adminPreviewBatchInvoices_(sessionToken,data);
  if(action==="admin.invoice.generate") return adminGenerateBatchInvoices_(sessionToken,data);
  if(action==="admin.invoice.save") return adminSaveInvoice_(sessionToken,data);
  if(action==="admin.testimonials") return adminListTestimonials_(sessionToken);
  if(action==="admin.testimonial.save") return adminSaveTestimonial_(sessionToken,data);
  if(action==="admin.programs") return adminPrograms_(sessionToken);
  if(action==="admin.program.save") return adminSaveProgram_(sessionToken,data);
  if(action==="admin.packages") return adminPackages_(sessionToken);
  if(action==="admin.package.save") return adminSavePackage_(sessionToken,data);
  if(action==="admin.terms") return adminTerms_(sessionToken);
  if(action==="admin.terms.save") return adminSaveTerms_(sessionToken,data);
  if(action==="admin.landing.save") return adminSaveLandingSettings_(sessionToken,data);
  if(action==="admin.settings") return adminSettings_(sessionToken);
  if(action==="admin.syllabus") return adminSyllabus_(sessionToken,data);
  if(action==="admin.syllabus.save") return adminSaveSyllabus_(sessionToken,data);
  if(action==="admin.syllabus.delete") return adminDeleteSyllabus_(sessionToken,data.id_syllabus);

  // COGNIORA V2 — student enrollment selection and package balance.
  if(action==="student.enrollments") return studentEnrollments_(sessionToken);
  if(action==="student.enrollment.select") return studentSelectEnrollment_(sessionToken,data);
  if(action==="student.package.balance") return studentPackageBalance_(sessionToken,data);
  if(action==="student.skills") return studentSkills_(sessionToken,data);
  if(action==="student.assessments") return studentAssessments_(sessionToken,data);
  if(action==="student.assessment.start") return studentAssessmentStart_(sessionToken,data);
  if(action==="student.assessment.answer") return studentAssessmentSaveAnswer_(sessionToken,data);
  if(action==="student.assessment.submit") return studentAssessmentSubmit_(sessionToken,data);
  if(action==="student.assessment.result") return studentAssessmentResult_(sessionToken,data);

  // COGNIORA V2 — Owner/Tutor workspace.
  if(action==="tutor.dashboard") return tutorDashboard_(sessionToken);
  if(action==="tutor.materials") return tutorMaterials_(sessionToken,data);
  if(action==="tutor.material.save") return tutorSaveMaterial_(sessionToken,data);
  if(action==="tutor.material.assign") return tutorAssignMaterial_(sessionToken,data);
  if(action==="tutor.assignments") return tutorAssignments_(sessionToken,data);
  if(action==="tutor.assignment.save") return tutorSaveAssignment_(sessionToken,data);
  if(action==="tutor.assignment.assign") return tutorAssignAssignment_(sessionToken,data);
  if(action==="tutor.sessions") return tutorSessions_(sessionToken,data);
  if(action==="tutor.students") return tutorStudents_(sessionToken,data);
  if(action==="tutor.batches") return tutorBatches_(sessionToken);
  if(action==="tutor.attendance.save") return tutorSaveAttendance_(sessionToken,data);
  if(action==="tutor.lessonReports") return tutorLessonReports_(sessionToken,data);
  if(action==="tutor.lessonReport.save") return tutorSaveLessonReport_(sessionToken,data);
  if(action==="tutor.skill.save") return tutorSaveSkillAssessment_(sessionToken,data);
  if(action==="tutor.skills") return tutorSkillAssessments_(sessionToken,data);
  if(action==="tutor.assignment.submissions") return tutorAssignmentSubmissions_(sessionToken,data);
  if(action==="tutor.assignment.review") return tutorReviewSubmission_(sessionToken,data);
  if(action==="tutor.assessments") return tutorAssessments_(sessionToken,data);
  if(action==="tutor.assessment.save") return tutorSaveAssessment_(sessionToken,data);
  if(action==="tutor.assessment.assign") return tutorAssignAssessment_(sessionToken,data);
  if(action==="tutor.assessment.question.save") return tutorSaveAssessmentQuestion_(sessionToken,data);
  if(action==="tutor.assessment.questions") return tutorAssessmentQuestions_(sessionToken,data);
  if(action==="tutor.assessment.attempt.detail") return tutorAssessmentAttemptDetail_(sessionToken,data);
  if(action==="tutor.assessment.results") return tutorAssessmentResults_(sessionToken,data);
  if(action==="tutor.assessment.gradeEssay") return tutorAssessmentGradeEssay_(sessionToken,data);

  // COGNIORA V2 — tutor accounts and assignments (Owner-only through guard above).
  if(action==="admin.tutors") return adminTutors_(sessionToken);
  if(action==="admin.tutor.create") return adminCreateTutor_(sessionToken,data);
  if(action==="admin.tutor.status") return adminSetTutorStatus_(sessionToken,data);
  if(action==="admin.tutor.assign") return adminAssignTutorBatch_(sessionToken,data);
  if(action==="admin.tutor.assignment.remove") return adminRemoveTutorAssignment_(sessionToken,data);
  if(action==="admin.levels") return adminLevels_(sessionToken);
  if(action==="admin.level.save") return adminSaveLevel_(sessionToken,data);
  if(action==="admin.package.rules") return adminPackageRules_(sessionToken);
  if(action==="admin.package.rule.save") return adminSavePackageRule_(sessionToken,data);
  if(action==="admin.package.ledger") return adminPackageLedger_(sessionToken,data);
  if(action==="admin.package.credit.adjust") return adminAdjustPackageCredits_(sessionToken,data);
  if(action==="admin.expenses") return adminExpenses_(sessionToken,data);
  if(action==="admin.expense.save") return adminSaveExpense_(sessionToken,data);
  if(action==="admin.skill.save") return adminSaveSkillAssessment_(sessionToken,data);
  if(action==="admin.skills") return adminSkillAssessments_(sessionToken,data);

  // COGNIORA V2 — Assessment Management.
  if(action==="admin.assessments") return adminAssessments_(sessionToken,data);
  if(action==="admin.assessment.save") return adminSaveAssessment_(sessionToken,data);
  if(action==="admin.assessment.assign") return adminAssignAssessment_(sessionToken,data);
  if(action==="admin.assessment.question.save") return adminSaveAssessmentQuestion_(sessionToken,data);
  if(action==="admin.assessment.questions") return adminAssessmentQuestions_(sessionToken,data);
  if(action==="admin.assessment.question.remove") return adminRemoveAssessmentQuestion_(sessionToken,data);
  if(action==="admin.assessment.results") return adminAssessmentResults_(sessionToken,data);
  if(action==="admin.assessment.attempt.detail") return adminAssessmentAttemptDetail_(sessionToken,data);
  if(action==="admin.assessment.gradeEssay") return adminAssessmentGradeEssay_(sessionToken,data);

  // COGNIORA V2 — Report Center.
  if(action==="report.export.generate") return adminGenerateReport_(sessionToken,data);
  if(action==="report.export.history") return adminExportHistory_(sessionToken);

  throw apiError_("NOT_FOUND","Unknown API action: "+action);
}

function apiFormInternal_(action,form) {
  form=form||{};
  var data={};
  Object.keys(form).forEach(function(k){if(k!=="file"&&k!=="file_data")data[k]=form[k];});
  if(form.file_data){
    var raw=String(form.file_data), comma=raw.indexOf(",");
    var b64=comma>=0?raw.substring(comma+1):raw;
    var mime=String(form.file_type||"application/octet-stream"), name=String(form.file_name||"upload_"+Date.now());
    var bytes=Utilities.base64Decode(b64);
    form.file=Utilities.newBlob(bytes,mime,name);
  }
  if(action==="student.assignment.submit") return submitAssignmentForm_(form);
  if(action==="student.payment.proof") return uploadPaymentProofForm_(form);
  if(action==="student.profile.photo") return saveStudentProfilePhoto_(form);
  throw apiError_("NOT_FOUND","Unknown form action: "+action);
}

function apiFormInvoke(action,form) {
  try{return {success:true,data:safeJson_(apiFormInternal_(String(action||""),form||{})),message:"OK"};}
  catch(err){return errorPayload_(err);}
}

function adminPaymentProof_(token,data) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var pay=findOne_("Data_Payment","ID_Payment",String(data.payment_id||""));
  require_(pay,"NOT_FOUND","Payment not found.");
  require_(pay.Proof_Drive_File_ID,"FILE_INVALID","Payment proof is not available.");
  var d=getProtectedDriveDataUrl_(pay.Proof_Drive_File_ID);
  var file=DriveApp.getFileById(pay.Proof_Drive_File_ID);
  return {data_url:d,name:file.getName(),mime_type:file.getMimeType()};
}

function adminCertificateFile_(token,data) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var cert=findOne_("Data_Certificate","ID_Certificate",String(data.certificate_id||""));
  require_(cert,"NOT_FOUND","Certificate not found.");
  require_(cert.File_ID,"FILE_INVALID","Certificate file is not available.");
  var d=getProtectedDriveDataUrl_(cert.File_ID);
  var file=DriveApp.getFileById(cert.File_ID);
  return {data_url:d,name:file.getName(),mime_type:file.getMimeType()};
}

function parseJson_(s) { try{return JSON.parse(String(s||"{}"));}catch(e){throw apiError_("VALIDATION_ERROR","Invalid JSON.");} }

function jsonResponse_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function errorPayload_(err) {
  var code=err&&err.name&&/^[A-Z_]+$/.test(err.name)?err.name:"SERVER_ERROR";
  return {success:false,code:code,message:String(err&&err.message||"Server error"),details:err&&err.details||null};
}

function requireApiKey_(provided) {
  var expected=PropertiesService.getScriptProperties().getProperty("GAS_API_KEY")||"";
  require_(expected && provided===expected,"AUTH_FORBIDDEN","Invalid API key.");
}

function adminListTestimonials_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  return sheetToObjects_("Data_Testimonial");
}

function adminSaveTestimonial_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_testimonial||""), obj={ID_Testimonial:id||makeId_("TEST"),Nama:String(data.name||""),Role:String(data.role||""),Testimonial:String(data.testimonial||""),Foto_File_ID:String(data.photo_file_id||""),Rating:data.rating===""?"":clamp_(Number(data.rating||0),0,5),Urutan:Number(data.order_no||1),Status:String(data.status||"ACTIVE"),Created_At:id?(findOne_("Data_Testimonial","ID_Testimonial",id)||{}).Created_At||now_():now_(),Updated_At:now_()};
  require_(obj.Nama&&obj.Testimonial,"VALIDATION_ERROR","Name and testimonial are required.");
  if(id) updateObject_("Data_Testimonial","ID_Testimonial",id,obj); else appendObject_("Data_Testimonial",obj);
  return {id:obj.ID_Testimonial};
}


function adminPrograms_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  return sheetToObjects_("Data_Program").map(function(x){
    return {
      id:x.ID_Program,name:x.Nama_Program,level:x.Level,description:x.Deskripsi||"",duration_months:Number(x.Durasi_Default_Bulan||0),status:x.Status,
      ID_Program:x.ID_Program,Nama_Program:x.Nama_Program,Level:x.Level,Deskripsi:x.Deskripsi||"",Durasi_Default_Bulan:Number(x.Durasi_Default_Bulan||0),Status:x.Status
    };
  });
}
function adminSaveProgram_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_program||"").trim();
  var obj={ID_Program:id||makeId_("PRG"),Nama_Program:String(data.name||"").trim(),Level:String(data.level||"Basic").trim(),Deskripsi:String(data.description||"").trim(),Durasi_Default_Bulan:Math.max(1,toNumber_(data.duration_months,5)),Status:String(data.status||"ACTIVE"),Created_At:id?(findOne_("Data_Program","ID_Program",id)||{}).Created_At||now_():now_(),Updated_At:now_()};
  require_(obj.Nama_Program,"VALIDATION_ERROR","Program name is required.");
  require_(obj.Level,"VALIDATION_ERROR","Program level is required.");
  require_(COGNIORA_ENUMS.MATERIAL_STATUS.indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid program status.");
  if(id) updateObject_("Data_Program","ID_Program",id,obj); else appendObject_("Data_Program",obj);
  audit_(ctx,id?"UPDATE_PROGRAM":"CREATE_PROGRAM","Data_Program",obj.ID_Program,obj.Nama_Program,"SUCCESS");
  return {id:obj.ID_Program};
}
function adminPackages_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  var programs={};sheetToObjects_("Data_Program").forEach(function(p){programs[p.ID_Program]=p;});
  return sheetToObjects_("Data_Package").map(function(x){return {id:x.ID_Package,program_id:x.ID_Program,program_name:programs[x.ID_Program]&&programs[x.ID_Program].Nama_Program,level:programs[x.ID_Program]&&programs[x.ID_Program].Level,name:x.Nama_Paket,type:x.Tipe_Kelas,price_per_month:Number(x.Harga_Per_Bulan||0),description:x.Deskripsi||"",recommended:bool_(x.Recommended),payment_frequency:x.Payment_Frequency,status:x.Status};});
}
function adminSavePackage_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.id_package||"").trim(), programId=String(data.program_id||"").trim();
  require_(findOne_("Data_Program","ID_Program",programId),"VALIDATION_ERROR","Program is required.");
  var obj={ID_Package:id||makeId_("PKG"),ID_Program:programId,Nama_Paket:String(data.name||"").trim(),Tipe_Kelas:String(data.type||"GROUP"),Harga_Per_Bulan:Math.max(0,toNumber_(data.price_per_month,0)),Deskripsi:String(data.description||"").trim(),Recommended:bool_(data.recommended),Payment_Frequency:String(data.payment_frequency||"MONTHLY"),Status:String(data.status||"ACTIVE"),Created_At:id?(findOne_("Data_Package","ID_Package",id)||{}).Created_At||now_():now_(),Updated_At:now_()};
  require_(obj.Nama_Paket,"VALIDATION_ERROR","Package name is required.");
  require_(["GROUP","PRIVATE","ONLINE"].indexOf(obj.Tipe_Kelas)>=0,"VALIDATION_ERROR","Invalid package class type.");
  require_(["ACTIVE","INACTIVE"].indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid package status.");
  if(id) updateObject_("Data_Package","ID_Package",id,obj); else appendObject_("Data_Package",obj);
  audit_(ctx,id?"UPDATE_PACKAGE":"CREATE_PACKAGE","Data_Package",obj.ID_Package,obj.Nama_Paket,"SUCCESS");
  return {id:obj.ID_Package};
}
function adminTerms_(token) {
  assertAdmin_(getAuthContext_(token,"ADMIN"));
  return sheetToObjects_("Terms_Versions").sort(function(a,b){return String(b.Effective_Date).localeCompare(String(a.Effective_Date));});
}
function adminSaveTerms_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"), id=String(data.terms_id||"").trim();
  var obj={Terms_ID:id||makeId_("TOS"),Version:String(data.version||"1.0").trim(),Effective_Date:String(data.effective_date||today_()).trim(),Title:String(data.title||"COGNIORA Terms of Service").trim(),Content_URL:String(data.content_url||"").trim(),Status:String(data.status||"ACTIVE"),Created_At:id?(findOne_("Terms_Versions","Terms_ID",id)||{}).Created_At||now_():now_()};
  require_(obj.Version&&obj.Title,"VALIDATION_ERROR","Terms version and title are required.");
  require_(["ACTIVE","INACTIVE"].indexOf(obj.Status)>=0,"VALIDATION_ERROR","Invalid terms status.");
  if(obj.Status==="ACTIVE"){
    var rows=sheetToObjects_("Terms_Versions"); rows.forEach(function(x){if(x.Terms_ID!==obj.Terms_ID&&x.Status==="ACTIVE")updateObject_("Terms_Versions","Terms_ID",x.Terms_ID,{Status:"INACTIVE"});});
  }
  if(id) updateObject_("Terms_Versions","Terms_ID",id,obj); else appendObject_("Terms_Versions",obj);
  if(Object.prototype.hasOwnProperty.call(data,"content")) setSetting_("TERMS_CONTENT",String(data.content||""),"Terms of Service plain text content","TEXT",ctx.userId);
  audit_(ctx,id?"UPDATE_TERMS":"CREATE_TERMS","Terms_Versions",obj.Terms_ID,"Terms saved","SUCCESS");
  return {id:obj.Terms_ID};
}
function adminSaveLandingSettings_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN");
  var fields={LANDING_LOGO_FILE_ID:"logo_file_id",LANDING_HERO_IMAGE_FILE_ID:"hero_file_id",CERTIFICATE_TEMPLATE_ID:"certificate_template_id",LEARNING_GALLERY_FILE_IDS:"learning_gallery"};
  Object.keys(fields).forEach(function(k){
    var incoming=data[fields[k]];
    if(incoming!==undefined){
      if(k==="LEARNING_GALLERY_FILE_IDS"){var v=String(incoming||"[]");try{JSON.parse(v);}catch(e){throw apiError_("VALIDATION_ERROR","Learning gallery JSON is invalid.");}setSetting_(k,v,"Learning gallery JSON","TEXT",ctx.userId);}
      else setSetting_(k,String(incoming||"").trim(),k,"TEXT",ctx.userId);
    }
  });
  return {saved:true};
}

function adminSettings_(token) {
  var ctx=getAuthContext_(token,"ADMIN"); assertOwner_(ctx);
  return sheetToObjects_("Data_Settings").filter(function(x){return String(x.Setting_Key).indexOf("PASSWORD")!==0;});
}