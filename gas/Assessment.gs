/** COGNIORA V2 — online practice, test and examination module. */
function assessmentOwner_(token) { var ctx=getAuthContext_(token,"ADMIN"); assertOwner_(ctx); return ctx; }

function assessmentParseJson_(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(String(value)); } catch(e) { throw apiError_("VALIDATION_ERROR","Assessment JSON data is invalid."); }
}

function assessmentShuffle_(arr) {
  var out=arr.slice();
  for(var i=out.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=out[i];out[i]=out[j];out[j]=t;}
  return out;
}

function assessmentMapRows_(assessmentId) {
  return findMany_("Assessment_Question_Map","ID_Assessment",String(assessmentId||"")).sort(function(a,b){return Number(a.Order_No||0)-Number(b.Order_No||0);});
}

function assessmentQuestionClient_(q, map, includeAnswer) {
  var options=assessmentParseJson_(q.Options_JSON,[]);
  var out={id:q.ID_Question,type:q.Question_Type,prompt:q.Prompt,media_type:q.Media_Type||"",media_url:q.Media_URL||"",options:options,points:Number(map&&map.Points_Override||q.Points||1),explanation:includeAnswer?(q.Explanation||""):undefined};
  if(includeAnswer) out.correct_answer=assessmentParseJson_(q.Correct_Answer_JSON,null);
  return out;
}

function adminAssessments_(token, filters) {
  assessmentOwner_(token); filters=filters||{};
  var batches={};sheetToObjects_("Data_Batch").forEach(function(b){batches[b.ID_Batch]=b;});
  return sheetToObjects_("Data_Assessment").filter(function(a){return (!filters.batch_id||a.Batch_ID===filters.batch_id)&&(!filters.status||a.Status===filters.status);}).sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));}).map(function(a){
    return {id:a.ID_Assessment,title:a.Title,description:a.Description,type:a.Assessment_Type,batch_id:a.Batch_ID,batch_name:batches[a.Batch_ID]&&batches[a.Batch_ID].Nama_Batch,start_at:a.Start_At,end_at:a.End_At,duration:Number(a.Duration_Minutes||0),max_attempts:Number(a.Max_Attempts||1),randomize_questions:bool_(a.Randomize_Questions),randomize_options:bool_(a.Randomize_Options),show_score:bool_(a.Show_Score),status:a.Status,question_count:assessmentMapRows_(a.ID_Assessment).length};
  });
}

function saveAssessmentCore_(ctx, data) {
  data=data||{};
  var id=String(data.id||""), old=id?findOne_("Data_Assessment","ID_Assessment",id):null;
  require_(!id||old,"NOT_FOUND","Assessment not found.");
  var title=String(data.title||"").trim(), type=String(data.type||"PRACTICE").toUpperCase(), batchId=String(data.batch_id||"");
  require_(title,"VALIDATION_ERROR","Assessment title is required.");
  require_(["PRACTICE","TEST","EXAM"].indexOf(type)>=0,"VALIDATION_ERROR","Invalid assessment type.");
  if(batchId)require_(findOne_("Data_Batch","ID_Batch",batchId),"NOT_FOUND","Batch not found.");
  var start=String(data.start_at||"").trim(), end=String(data.end_at||"").trim();
  require_(!start||!isNaN(Date.parse(start)),"VALIDATION_ERROR","Start date/time is invalid.");
  require_(!end||!isNaN(Date.parse(end)),"VALIDATION_ERROR","End date/time is invalid.");
  require_(!start||!end||Date.parse(end)>Date.parse(start),"VALIDATION_ERROR","End date must be after start date.");
  var status=String(data.status||"DRAFT").toUpperCase();require_(["DRAFT","PUBLISHED","CLOSED","ARCHIVED"].indexOf(status)>=0,"VALIDATION_ERROR","Invalid assessment status.");
  var programId=String(data.program_id||old&&old.Program_ID||"");
  if(status==="PUBLISHED"){
    require_(batchId||programId,"VALIDATION_ERROR","Assign the assessment to a batch or program before publishing.");
    require_(assessmentMapRows_(id||"").length>0,"VALIDATION_ERROR","Add at least one question before publishing the assessment.");
  }
  var obj={ID_Assessment:id||makeId_("ASM"),Title:title,Description:String(data.description||""),Assessment_Type:type,Batch_ID:batchId,Program_ID:programId,Level_ID:String(data.level_id||old&&old.Level_ID||""),Start_At:start,End_At:end,Duration_Minutes:Math.max(0,Number(data.duration_minutes||0)),Max_Attempts:Math.max(1,Number(data.max_attempts||1)),Randomize_Questions:bool_(data.randomize_questions),Randomize_Options:bool_(data.randomize_options),Show_Score:bool_(data.show_score),Status:status,Created_By:old?old.Created_By:ctx.userId,Created_At:old?(old.Created_At||now_()):now_(),Updated_At:now_()};
  if(old)updateObject_("Data_Assessment","ID_Assessment",id,obj);else appendObject_("Data_Assessment",obj);
  audit_(ctx,old?"UPDATE_ASSESSMENT":"CREATE_ASSESSMENT","Data_Assessment",obj.ID_Assessment,title,"SUCCESS");return {id:obj.ID_Assessment};
}

function adminSaveAssessment_(token, data) { return saveAssessmentCore_(assessmentOwner_(token),data); }

function assignAssessmentCore_(ctx,data){
  data=data||{};
  var id=String(data.assessment_id||""), batchId=String(data.batch_id||""), status=String(data.status||"PUBLISHED").toUpperCase();
  var assessment=findOne_("Data_Assessment","ID_Assessment",id), batch=findOne_("Data_Batch","ID_Batch",batchId);
  require_(assessment,"NOT_FOUND","Assessment not found.");
  require_(batch,"NOT_FOUND","Batch not found.");
  require_(["DRAFT","PUBLISHED","CLOSED","ARCHIVED"].indexOf(status)>=0,"VALIDATION_ERROR","Invalid assessment status.");
  if(ctx.role==="TUTOR") requireTutorBatch_(ctx,batchId);
  if(status==="PUBLISHED") require_(assessmentMapRows_(id).length>0,"VALIDATION_ERROR","Add at least one question before publishing the assessment.");
  updateObject_("Data_Assessment","ID_Assessment",id,{Batch_ID:batchId,Program_ID:String(batch.ID_Program||assessment.Program_ID||""),Level_ID:String(batch.Level_ID||assessment.Level_ID||""),Status:status,Updated_At:now_()});
  audit_(ctx,"ASSIGN_ASSESSMENT","Data_Assessment",id,"Assigned to batch "+String(batch.Nama_Batch||batchId)+" as "+status,"SUCCESS");
  return {assigned:true,id:id,batch_id:batchId,status:status};
}

function adminAssignAssessment_(token,data){return assignAssessmentCore_(assessmentOwner_(token),data);}
function tutorAssignAssessment_(token,data){
  var ctx=v2TutorOrOwner_(token), id=String((data||{}).assessment_id||""), assessment=findOne_("Data_Assessment","ID_Assessment",id);
  require_(assessment,"NOT_FOUND","Assessment not found.");
  if(ctx.role!=="OWNER") require_(String(assessment.Created_By||"")===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only assign assessments they created.");
  return assignAssessmentCore_(ctx,data);
}
function tutorSaveAssessment_(token, data) {
  var ctx=v2TutorOrOwner_(token), d=Object.assign({},data||{}), batchId=String(d.batch_id||""), assessmentId=String(d.id||"");
  if(batchId) requireTutorBatch_(ctx,batchId);
  if(assessmentId){
    var existing=findOne_("Data_Assessment","ID_Assessment",assessmentId);
    require_(existing,"NOT_FOUND","Assessment not found.");
    if(ctx.role!=="OWNER") require_(String(existing.Created_By||"")===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only edit assessments they created.");
    if(existing.Batch_ID && !batchId) d.batch_id=existing.Batch_ID;
    if(existing.Batch_ID && batchId) requireTutorBatch_(ctx,existing.Batch_ID);
  }
  return saveAssessmentCore_(ctx,d);
}

function saveAssessmentQuestionCore_(ctx,data) {
  data=data||{};
  var assessment=findOne_("Data_Assessment","ID_Assessment",String(data.assessment_id||""));
  require_(assessment,"NOT_FOUND","Assessment not found.");
  var id=String(data.question_id||""), old=id?findOne_("Data_Question_Bank","ID_Question",id):null;
  require_(!id||old,"NOT_FOUND","Question not found.");
  var type=String(data.question_type||"MCQ").toUpperCase();
  require_(["MCQ","MULTI_SELECT","TRUE_FALSE","MATCHING","SHORT_ANSWER","ESSAY"].indexOf(type)>=0,"VALIDATION_ERROR","Invalid question type.");
  var options=assessmentParseJson_(data.options_json,[]), correct=assessmentParseJson_(data.correct_answer_json,null);
  require_(String(data.prompt||"").trim(),"VALIDATION_ERROR","Question prompt is required.");
  if(["MCQ","MULTI_SELECT","MATCHING"].indexOf(type)>=0)require_(Array.isArray(options)&&options.length>=2,"VALIDATION_ERROR","At least two options/items are required.");
  if(type!=="ESSAY")require_(correct!==null && correct!=="","VALIDATION_ERROR","Correct answer is required for auto-graded questions.");
  var pts=Math.max(0.1,Number(data.points||1));
  var obj={ID_Question:id||makeId_("QST"),Question_Type:type,Prompt:String(data.prompt||"").trim(),Media_Type:String(data.media_type||""),Media_URL:String(data.media_url||""),Options_JSON:JSON.stringify(options),Correct_Answer_JSON:correct===null?"":JSON.stringify(correct),Points:pts,Explanation:String(data.explanation||""),Program_ID:assessment.Program_ID||"",Level_ID:assessment.Level_ID||"",Status:String(data.status||"ACTIVE"),Created_By:old?old.Created_By:ctx.userId,Created_At:old?(old.Created_At||now_()):now_(),Updated_At:now_()};
  if(old)updateObject_("Data_Question_Bank","ID_Question",id,obj);else appendObject_("Data_Question_Bank",obj);
  var maps=assessmentMapRows_(assessment.ID_Assessment), map=maps.filter(function(x){return x.ID_Question===obj.ID_Question;})[0];
  if(!map)appendObject_("Assessment_Question_Map",{ID_Map:makeId_("AQM"),ID_Assessment:assessment.ID_Assessment,ID_Question:obj.ID_Question,Order_No:Math.max(1,maps.length+1),Points_Override:""});
  audit_(ctx,old?"UPDATE_QUESTION":"CREATE_QUESTION","Data_Question_Bank",obj.ID_Question,assessment.Title,"SUCCESS");return {id:obj.ID_Question};
}

function adminSaveAssessmentQuestion_(token, data) { return saveAssessmentQuestionCore_(assessmentOwner_(token),data); }
function tutorSaveAssessmentQuestion_(token,data) {
  var ctx=v2TutorOrOwner_(token),assessment=findOne_("Data_Assessment","ID_Assessment",String((data||{}).assessment_id||""));
  require_(assessment,"NOT_FOUND","Assessment not found.");
  if(ctx.role!=="OWNER") require_(String(assessment.Created_By||"")===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only add questions to assessments they created.");
  if(assessment.Batch_ID) requireTutorBatch_(ctx,assessment.Batch_ID);
  var questionId=String((data||{}).question_id||"");
  if(questionId){
    var existingQuestion=findOne_("Data_Question_Bank","ID_Question",questionId);
    var linked=assessmentMapRows_(assessment.ID_Assessment).some(function(m){return m.ID_Question===questionId;});
    require_(existingQuestion && linked && String(existingQuestion.Created_By||"")===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only edit questions they created for this assessment.");
  }
  return saveAssessmentQuestionCore_(ctx,data);
}

function adminAssessmentQuestions_(token, data) {
  assessmentOwner_(token);var id=String(data.assessment_id||""), a=findOne_("Data_Assessment","ID_Assessment",id);require_(a,"NOT_FOUND","Assessment not found.");
  return assessmentMapRows_(id).map(function(m){var q=findOne_("Data_Question_Bank","ID_Question",m.ID_Question);return q?assessmentQuestionClient_(q,m,true):null;}).filter(Boolean);
}

function tutorAssessmentQuestions_(token, data) {
  var ctx=v2TutorOrOwner_(token);
  var id=String((data||{}).assessment_id||"");
  var assessment=findOne_("Data_Assessment","ID_Assessment",id);
  require_(assessment,"NOT_FOUND","Assessment not found.");
  if(ctx.role!=="OWNER") require_(String(assessment.Created_By||"")===String(ctx.userId),"AUTH_FORBIDDEN","Tutor may only access questions for assessments they created.");
  if(assessment.Batch_ID) requireTutorBatch_(ctx,assessment.Batch_ID);
  return assessmentMapRows_(id).map(function(m){
    var q=findOne_("Data_Question_Bank","ID_Question",m.ID_Question);
    return q?assessmentQuestionClient_(q,m,true):null;
  }).filter(Boolean);
}

function adminRemoveAssessmentQuestion_(token,data) {
  var ctx=assessmentOwner_(token), id=String(data.map_id||""), m=findOne_("Assessment_Question_Map","ID_Map",id);require_(m,"NOT_FOUND","Assessment question mapping not found.");
  deleteById_("Assessment_Question_Map","ID_Map",id);audit_(ctx,"REMOVE_ASSESSMENT_QUESTION","Assessment_Question_Map",id,m.ID_Question,"SUCCESS");return {removed:true};
}

function studentAssessments_(token, filters) {
  var ctx=getAuthContext_(token,"STUDENT"), e=getSelectedStudentEnrollment_(token,ctx.userId,filters&&filters.enrollment_id);require_(e,"NOT_FOUND","Enrollment not found.");
  var now=Date.now();
  return sheetToObjects_("Data_Assessment").filter(function(a){
    if(a.Status!=="PUBLISHED")return false;
    if(!a.Batch_ID&&!a.Program_ID)return false;
    if(a.Batch_ID && a.Batch_ID!==e.ID_Batch)return false;
    if(a.Program_ID){var b=findOne_("Data_Batch","ID_Batch",e.ID_Batch);if(!b||b.ID_Program!==a.Program_ID)return false;}
    if(a.Start_At && Date.parse(a.Start_At)>now)return true;
    if(a.End_At && Date.parse(a.End_At)<now)return false;
    return true;
  }).map(function(a){
    var attempts=findMany_("Assessment_Attempts","ID_Assessment",a.ID_Assessment).filter(function(x){return x.ID_Siswa===ctx.userId && x.ID_Enrollment===e.ID_Enrollment;});
    var last=attempts.sort(function(x,y){return String(y.Started_At).localeCompare(String(x.Started_At));})[0];
    return {id:a.ID_Assessment,title:a.Title,description:a.Description,type:a.Assessment_Type,start_at:a.Start_At,end_at:a.End_At,duration:Number(a.Duration_Minutes||0),max_attempts:Number(a.Max_Attempts||1),attempt_count:attempts.length,last_status:last&&last.Status||"",last_score:last&&a.Show_Score?Number(last.Score||0):null,question_count:assessmentMapRows_(a.ID_Assessment).length,available:(!a.Start_At||Date.parse(a.Start_At)<=now)&&(!a.End_At||Date.parse(a.End_At)>=now)&&attempts.length<Math.max(1,Number(a.Max_Attempts||1))};
  });
}

function makeAssessmentManifest_(assessment) {
  var maps=assessmentMapRows_(assessment.ID_Assessment);
  if(bool_(assessment.Randomize_Questions))maps=assessmentShuffle_(maps);
  return maps.map(function(m){
    var q=findOne_("Data_Question_Bank","ID_Question",m.ID_Question);if(!q)return null;
    var opts=assessmentParseJson_(q.Options_JSON,[]);
    var optionOrder=[];
    if(Array.isArray(opts)){optionOrder=opts.map(function(o){return String(o.id!==undefined?o.id:o.value!==undefined?o.value:o.label!==undefined?o.label:o);});if(bool_(assessment.Randomize_Options))optionOrder=assessmentShuffle_(optionOrder);}
    return {question_id:q.ID_Question,option_order:optionOrder};
  }).filter(Boolean);
}

function studentAssessmentStart_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), assessment=findOne_("Data_Assessment","ID_Assessment",String(data.assessment_id||""));
  require_(assessment && assessment.Status==="PUBLISHED","NOT_FOUND","Published assessment not found.");
  var e=getSelectedStudentEnrollment_(token,ctx.userId,data.enrollment_id);require_(e,"NOT_FOUND","Enrollment not found.");
  require_(assessment.Batch_ID||assessment.Program_ID,"AUTH_FORBIDDEN","Assessment has not been assigned to a batch or program.");
  require_(!assessment.Batch_ID||assessment.Batch_ID===e.ID_Batch,"AUTH_FORBIDDEN","Assessment is not assigned to this group.");
  if(assessment.Program_ID){var b=findOne_("Data_Batch","ID_Batch",e.ID_Batch);require_(b&&b.ID_Program===assessment.Program_ID,"AUTH_FORBIDDEN","Assessment is not assigned to this program.");}
  var now=Date.now();
  require_(!assessment.Start_At||Date.parse(assessment.Start_At)<=now,"ASSESSMENT_NOT_OPEN","Assessment has not opened yet.");
  require_(!assessment.End_At||Date.parse(assessment.End_At)>=now,"ASSESSMENT_CLOSED","Assessment is closed.");
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  var expiredAttemptId="";
  try {
    var all=findMany_("Assessment_Attempts","ID_Assessment",assessment.ID_Assessment).filter(function(x){return x.ID_Siswa===ctx.userId&&x.ID_Enrollment===e.ID_Enrollment;});
    var active=all.filter(function(x){return ["IN_PROGRESS","PENDING_REVIEW"].indexOf(x.Status)>=0;}).sort(function(a,b){return String(b.Started_At).localeCompare(String(a.Started_At));})[0];
    var attempt=active;
    if(!attempt){
      require_(all.length<Math.max(1,Number(assessment.Max_Attempts||1)),"ATTEMPT_LIMIT","Maximum attempts have been reached.");
      var deadline=assessment.Duration_Minutes>0?new Date(now+Number(assessment.Duration_Minutes)*60000).toISOString():"";
      if(assessment.End_At && (!deadline||Date.parse(assessment.End_At)<Date.parse(deadline)))deadline=assessment.End_At;
      attempt={ID_Attempt:makeId_("ATM"),ID_Assessment:assessment.ID_Assessment,ID_Enrollment:e.ID_Enrollment,ID_Siswa:ctx.userId,Attempt_No:all.length+1,Started_At:new Date(now).toISOString(),Deadline_At:deadline,Submitted_At:"",Status:"IN_PROGRESS",Score:"",Max_Score:100,Question_Order_JSON:JSON.stringify(makeAssessmentManifest_(assessment)),Graded_At:"",Graded_By:""};
      appendObject_("Assessment_Attempts",attempt);
    }
    if(attempt.Deadline_At && Date.parse(attempt.Deadline_At)<now && attempt.Status==="IN_PROGRESS") expiredAttemptId=attempt.ID_Attempt;
    else return assessmentAttemptForStudent_(attempt,assessment);
  } finally {lock.releaseLock();}
  return studentAssessmentSubmit_(token,{attempt_id:expiredAttemptId,auto_submit:true});
}

function assessmentAttemptForStudent_(attempt, assessment) {
  var manifest=assessmentParseJson_(attempt.Question_Order_JSON,[]), answerRows=findMany_("Assessment_Answers","ID_Attempt",attempt.ID_Attempt), answers={};
  answerRows.forEach(function(a){answers[a.ID_Question]=assessmentParseJson_(a.Answer_JSON,null);});
  var questions=manifest.map(function(m){var q=findOne_("Data_Question_Bank","ID_Question",m.question_id);if(!q)return null;var c=assessmentQuestionClient_(q,null,false);if(Array.isArray(c.options)&&m.option_order&&m.option_order.length)c.options=c.options.slice().sort(function(a,b){var ai=m.option_order.indexOf(String(a.id!==undefined?a.id:a.value!==undefined?a.value:a.label!==undefined?a.label:a));var bi=m.option_order.indexOf(String(b.id!==undefined?b.id:b.value!==undefined?b.value:b.label!==undefined?b.label:b));return ai-bi;});c.saved_answer=answers[c.id]===undefined?null:answers[c.id];return c;}).filter(Boolean);
  return {attempt_id:attempt.ID_Attempt,attempt_no:Number(attempt.Attempt_No),status:attempt.Status,started_at:attempt.Started_At,deadline_at:attempt.Deadline_At,assessment:{id:assessment.ID_Assessment,title:assessment.Title,description:assessment.Description,duration:Number(assessment.Duration_Minutes||0)},questions:questions};
}

function studentAssessmentSaveAnswer_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), attempt=findOne_("Assessment_Attempts","ID_Attempt",String(data.attempt_id||""));
  require_(attempt&&attempt.ID_Siswa===ctx.userId,"AUTH_FORBIDDEN","Assessment attempt does not belong to this student.");
  require_(attempt.Status==="IN_PROGRESS","ASSESSMENT_CLOSED","This attempt is no longer accepting answers.");
  if(attempt.Deadline_At && Date.parse(attempt.Deadline_At)<Date.now())throw apiError_("ASSESSMENT_TIME_EXPIRED","The assessment time has expired.");
  var qid=String(data.question_id||""), mapped=assessmentMapRows_(attempt.ID_Assessment).some(function(m){return m.ID_Question===qid;});
  require_(mapped,"VALIDATION_ERROR","Question does not belong to this assessment.");
  var answer=data.answer;
  var json=JSON.stringify(answer===undefined?null:answer), old=findMany_("Assessment_Answers","ID_Attempt",attempt.ID_Attempt).filter(function(x){return x.ID_Question===qid;})[0];
  var obj={ID_Answer:old?old.ID_Answer:makeId_("ANS"),ID_Attempt:attempt.ID_Attempt,ID_Question:qid,Answer_JSON:json,Is_Correct:"",Score_Awarded:"",Feedback:"",Saved_At:now_()};
  if(old)updateObject_("Assessment_Answers","ID_Answer",old.ID_Answer,obj);else appendObject_("Assessment_Answers",obj);
  return {saved:true};
}

function assessmentCanonical_(value) {
  if(Array.isArray(value))return value.map(assessmentCanonical_).sort(function(a,b){return JSON.stringify(a).localeCompare(JSON.stringify(b));});
  if(value && typeof value==="object"){var o={};Object.keys(value).sort().forEach(function(k){o[k]=assessmentCanonical_(value[k]);});return o;}
  if(typeof value==="string")return value.trim().toLowerCase();
  return value;
}

function assessmentGradeObjective_(q, answer) {
  if(q.Question_Type==="ESSAY")return {graded:false,correct:null,score:0};
  var correct=assessmentParseJson_(q.Correct_Answer_JSON,null), given=answer;
  if(q.Question_Type==="SHORT_ANSWER"){
    var accepted=Array.isArray(correct)?correct:[correct];
    var ok=accepted.some(function(x){return String(x).trim().toLowerCase()===String(given==null?"":given).trim().toLowerCase();});
    return {graded:true,correct:ok,score:ok?Number(q.Points||1):0};
  }
  var isCorrect=JSON.stringify(assessmentCanonical_(correct))===JSON.stringify(assessmentCanonical_(given));
  return {graded:true,correct:isCorrect,score:isCorrect?Number(q.Points||1):0};
}

function studentAssessmentSubmit_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), id=String(data.attempt_id||""), attempt=findOne_("Assessment_Attempts","ID_Attempt",id);
  require_(attempt&&attempt.ID_Siswa===ctx.userId,"AUTH_FORBIDDEN","Assessment attempt does not belong to this student.");
  if(attempt.Status!=="IN_PROGRESS")return {submitted:true,status:attempt.Status,score:attempt.Score};
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    attempt=findOne_("Assessment_Attempts","ID_Attempt",id);
    if(attempt.Status!=="IN_PROGRESS")return {submitted:true,status:attempt.Status,score:attempt.Score};
    var maps=assessmentMapRows_(attempt.ID_Assessment), answers=findMany_("Assessment_Answers","ID_Attempt",id), total=0,max=0,hasEssay=false;
    maps.forEach(function(m){var q=findOne_("Data_Question_Bank","ID_Question",m.ID_Question);if(!q)return;var pts=Number(m.Points_Override||q.Points||1);max+=pts;var a=answers.filter(function(x){return x.ID_Question===q.ID_Question;})[0];var ans=a?assessmentParseJson_(a.Answer_JSON,null):null;var g=assessmentGradeObjective_(q,ans);if(!g.graded){hasEssay=true;return;}total+=g.score;if(a)updateObject_("Assessment_Answers","ID_Answer",a.ID_Answer,{Is_Correct:g.correct,Score_Awarded:g.score,Feedback:g.correct?(q.Explanation||""):"Jawaban belum tepat.",Saved_At:now_()});});
    var pct=max?Math.round(total/max*10000)/100:0, status=hasEssay?"PENDING_REVIEW":"GRADED";
    updateObject_("Assessment_Attempts","ID_Attempt",id,{Submitted_At:now_(),Status:status,Score:pct,Max_Score:100,Graded_At:hasEssay?"":now_(),Graded_By:hasEssay?"":"AUTO"});
    audit_({userId:ctx.userId,role:"STUDENT"},"SUBMIT_ASSESSMENT","Assessment_Attempts",id,"Score "+pct,"SUCCESS");
    return {submitted:true,status:status,score:pct,manual_review_required:hasEssay,show_score:bool_(findOne_("Data_Assessment","ID_Assessment",attempt.ID_Assessment).Show_Score)};
  } finally {lock.releaseLock();}
}

function assessmentResultsRows_(assessment) {
  return findMany_("Assessment_Attempts","ID_Assessment",assessment.ID_Assessment).map(function(a){var s=findOne_("Data_Siswa","ID_Siswa",a.ID_Siswa),en=findOne_("Data_Enrollment","ID_Enrollment",a.ID_Enrollment);return {attempt_id:a.ID_Attempt,student_id:a.ID_Siswa,student_name:s&&s.Nama_Lengkap,batch_id:en&&en.ID_Batch,attempt_no:Number(a.Attempt_No),status:a.Status,score:a.Score===""?null:Number(a.Score),submitted_at:a.Submitted_At};}).sort(function(a,b){return String(a.student_name||"").localeCompare(String(b.student_name||""));});
}

function adminAssessmentResults_(token,data) {
  assessmentOwner_(token);var assessment=findOne_("Data_Assessment","ID_Assessment",String(data.assessment_id||""));require_(assessment,"NOT_FOUND","Assessment not found.");
  return assessmentResultsRows_(assessment);
}

function gradeAssessmentEssayCore_(ctx,data) {
  var attempt=findOne_("Assessment_Attempts","ID_Attempt",String(data.attempt_id||"")), q=findOne_("Data_Question_Bank","ID_Question",String(data.question_id||""));
  require_(attempt&&q,"NOT_FOUND","Attempt or question not found.");
  require_(q.Question_Type==="ESSAY","VALIDATION_ERROR","Only essay questions need manual grading.");
  var answer=findMany_("Assessment_Answers","ID_Attempt",attempt.ID_Attempt).filter(function(x){return x.ID_Question===q.ID_Question;})[0];require_(answer,"NOT_FOUND","Student answer not found.");
  var map=assessmentMapRows_(attempt.ID_Assessment).filter(function(x){return x.ID_Question===q.ID_Question;})[0], max=Number(map&&map.Points_Override||q.Points||1), score=Number(data.score);
  require_(isFinite(score)&&score>=0&&score<=max,"VALIDATION_ERROR","Essay score must be between 0 and "+max+".");
  updateObject_("Assessment_Answers","ID_Answer",answer.ID_Answer,{Is_Correct:"MANUAL",Score_Awarded:score,Feedback:String(data.feedback||""),Saved_At:now_()});
  var maps=assessmentMapRows_(attempt.ID_Assessment),answers=findMany_("Assessment_Answers","ID_Attempt",attempt.ID_Attempt),awarded=0,total=0,allGraded=true;
  maps.forEach(function(m){var qq=findOne_("Data_Question_Bank","ID_Question",m.ID_Question);if(!qq)return;var pts=Number(m.Points_Override||qq.Points||1);total+=pts;var aa=answers.filter(function(x){return x.ID_Question===qq.ID_Question;})[0];if(!aa||aa.Score_Awarded===""){allGraded=false;return;}awarded+=Number(aa.Score_Awarded||0);});
  if(allGraded){var pct=total?Math.round(awarded/total*10000)/100:0;updateObject_("Assessment_Attempts","ID_Attempt",attempt.ID_Attempt,{Status:"GRADED",Score:pct,Max_Score:100,Graded_At:now_(),Graded_By:ctx.userId});}
  audit_(ctx,"GRADE_ASSESSMENT_ESSAY","Assessment_Answers",answer.ID_Answer,"Score "+score+"/"+max,"SUCCESS");
  return {saved:true,graded:allGraded,score:allGraded?(total?Math.round(awarded/total*10000)/100:0):null};
}

function adminAssessmentGradeEssay_(token,data) { return gradeAssessmentEssayCore_(assessmentOwner_(token),data); }

function assessmentAttemptDetail_(attemptId) {
  var attempt=findOne_("Assessment_Attempts","ID_Attempt",String(attemptId||""));require_(attempt,"NOT_FOUND","Attempt not found.");
  var assessment=findOne_("Data_Assessment","ID_Assessment",attempt.ID_Assessment),enrollment=findOne_("Data_Enrollment","ID_Enrollment",attempt.ID_Enrollment),student=findOne_("Data_Siswa","ID_Siswa",attempt.ID_Siswa);
  var answers=findMany_("Assessment_Answers","ID_Attempt",attempt.ID_Attempt);
  return {attempt_id:attempt.ID_Attempt,assessment_id:attempt.ID_Assessment,assessment_title:assessment&&assessment.Title,student_id:attempt.ID_Siswa,student_name:student&&student.Nama_Lengkap,enrollment_id:attempt.ID_Enrollment,batch_id:enrollment&&enrollment.ID_Batch,attempt_no:Number(attempt.Attempt_No),status:attempt.Status,score:attempt.Score===""?null:Number(attempt.Score),questions:answers.map(function(a){var q=findOne_("Data_Question_Bank","ID_Question",a.ID_Question);return {question_id:a.ID_Question,type:q&&q.Question_Type,prompt:q&&q.Prompt,answer:assessmentParseJson_(a.Answer_JSON,null),score:a.Score_Awarded===""?null:Number(a.Score_Awarded),max_score:Number(q&&q.Points||1),feedback:a.Feedback||""};})};
}

function adminAssessmentAttemptDetail_(token,data) { assessmentOwner_(token);return assessmentAttemptDetail_(data.attempt_id); }

function studentAssessmentResult_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"),attempt=findOne_("Assessment_Attempts","ID_Attempt",String(data.attempt_id||""));
  require_(attempt&&attempt.ID_Siswa===ctx.userId,"AUTH_FORBIDDEN","Attempt does not belong to this student.");
  var assessment=findOne_("Data_Assessment","ID_Assessment",attempt.ID_Assessment);require_(assessment,"NOT_FOUND","Assessment not found.");
  if(!bool_(assessment.Show_Score))return {status:attempt.Status,score:null,answers:[]};
  return {status:attempt.Status,score:attempt.Status==="GRADED"?Number(attempt.Score):null,answers:findMany_("Assessment_Answers","ID_Attempt",attempt.ID_Attempt).map(function(a){var q=findOne_("Data_Question_Bank","ID_Question",a.ID_Question);return {question:q&&q.Prompt,score:a.Score_Awarded===""?null:Number(a.Score_Awarded),feedback:a.Feedback||""};})};
}
