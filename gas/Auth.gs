function studentLogin_(data) {
  var email=normalizeEmail_(data.email), password=String(data.password==null?"":data.password);
  require_(validEmail_(email)&&password,"AUTH_INVALID","Invalid email or password.");
  var key="LOGIN:"+email;
  require_(!loginAttemptsBlocked_(key,8),"AUTH_RATE_LIMIT","Terlalu banyak percobaan login yang salah. Coba lagi dalam 5 menit atau gunakan Forgot password.");
  var student=findOne_("Data_Siswa","Email",email);
  if(!student){ loginAttemptFailed_(key,300); throw apiError_("AUTH_INVALID","Invalid email or password."); }
  require_(["ACTIVE","INACTIVE"].indexOf(String(student.Status_Akun))>=0,"AUTH_LOCKED","Your account is locked.");
  if(!passwordMatches_(student,password)){ loginAttemptFailed_(key,300); throw apiError_("AUTH_INVALID","Invalid email or password."); }
  loginAttemptsReset_(key);
  var enrollment=findBestEnrollment_(student.ID_Siswa);
  var token=createSession_("STUDENT",student.ID_Siswa,"STUDENT",enrollment?enrollment.ID_Enrollment:"");
  updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Last_Login:now_(),Updated_At:now_()});
  var tos=latestTerms_();
  var accepted=tos ? findMany_("Terms_Acceptance","ID_Siswa",student.ID_Siswa).some(function(x){return x.Terms_ID===tos.Terms_ID;}) : true;
  return {
    session_token:token,
    student:{id:student.ID_Siswa,name:student.Nama_Lengkap,email:student.Email},
    must_change_password:bool_(student.Must_Change_Password),
    terms_required:!accepted,
    terms:tos?{id:tos.Terms_ID,version:tos.Version,title:tos.Title,content_url:tos.Content_URL}:null,
    enrollment:enrollment?publicEnrollment_(enrollment):null
  };
}

function adminLogin_(data) {
  var email=normalizeEmail_(data.email), password=String(data.password==null?"":data.password);
  require_(validEmail_(email)&&password,"AUTH_INVALID","Invalid email or password.");
  var key="ADMINLOGIN:"+email;
  require_(!loginAttemptsBlocked_(key,8),"AUTH_RATE_LIMIT","Terlalu banyak percobaan login yang salah. Coba lagi dalam 5 menit.");
  var admin=findOne_("Data_Admin","Email",email);
  if(!admin){ loginAttemptFailed_(key,300); throw apiError_("AUTH_INVALID","Invalid email or password."); }
  require_(admin.Status==="ACTIVE","AUTH_LOCKED","Admin/Tutor account is inactive.");
  if(!passwordMatches_(admin,password)){ loginAttemptFailed_(key,300); throw apiError_("AUTH_INVALID","Invalid email or password."); }
  loginAttemptsReset_(key);
  updateObject_("Data_Admin","ID_Admin",admin.ID_Admin,{Last_Login:now_(),Updated_At:now_()});
  var token=createSession_("ADMIN",admin.ID_Admin,admin.Role,"");
  return {session_token:token,admin:{id:admin.ID_Admin,name:admin.Nama,email:admin.Email,role:admin.Role,photo_file_id:admin.Foto_File_ID||"",photo_url:getDriveImageDataUrlSafe_(admin.Foto_File_ID)}};
}

function authSession_(token) {
  var raw=String(token||"");
  try {
    var json=CacheService.getScriptCache().get("COGNIORA_SESSION_"+raw);
    if(!json) return {authenticated:false};
    var s=JSON.parse(json);
    if(s.type==="STUDENT"){
      var st=findOne_("Data_Siswa","ID_Siswa",s.userId);
      if(!st || ["ACTIVE","INACTIVE"].indexOf(String(st.Status_Akun))<0) return {authenticated:false};
      var en=getSelectedStudentEnrollment_(token,st.ID_Siswa), tos=latestTerms_();
      var accepted=tos ? findMany_("Terms_Acceptance","ID_Siswa",st.ID_Siswa).some(function(x){return String(x.Terms_ID)===String(tos.Terms_ID);}) : true;
      return {
        authenticated:true,type:"STUDENT",
        user:{id:st.ID_Siswa,name:st.Nama_Lengkap,email:st.Email},
        enrollment:en?publicEnrollment_(en):null,
        terms_required:!accepted,
        terms:tos?{id:tos.Terms_ID,version:tos.Version,title:tos.Title,content_url:tos.Content_URL,content:getSetting_("TERMS_CONTENT","")}:null
      };
    }
    var a=findOne_("Data_Admin","ID_Admin",s.userId);
    if(!a || a.Status!=="ACTIVE") return {authenticated:false};
    var photoUrl="";
    try{ if(a.Foto_File_ID) photoUrl=getDriveImageDataUrlSafe_(a.Foto_File_ID)||""; }catch(photoErr){}
    return {authenticated:true,type:"ADMIN",user:{id:a.ID_Admin,name:a.Nama,email:a.Email,role:a.Role,photo_file_id:a.Foto_File_ID||"",photo_url:photoUrl}};
  } catch(e) { return {authenticated:false}; }
}

function authLogout_(token) { revokeSession_(token); return {logged_out:true}; }

function forgotPassword_(data) {
  // V35: sistem otomatis membuat password sementara (di-hash) lalu mengirimkannya via email.
  // Tanpa membuat folder (berbeda dari convert lead -> student).
  var email=normalizeEmail_(data.email);
  require_(validEmail_(email),"VALIDATION_ERROR","Please enter a valid email.");
  var generic={message:"If the account exists, a temporary password has been sent to the email address."};
  if(!maxAttempts_("RESET:"+email,3600,5)) return generic;
  var student=findOne_("Data_Siswa","Email",email);
  if(!student || ["ACTIVE","INACTIVE"].indexOf(String(student.Status_Akun))<0) return generic;

  var temp=randomPassword_(), salt=randomHex_(16);
  var previous={Password_Hash:student.Password_Hash,Password_Salt:student.Password_Salt,Must_Change_Password:student.Must_Change_Password};
  updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Password_Hash:hashPassword_(temp,salt),Password_Salt:salt,Must_Change_Password:true,Updated_At:now_()});
  try {
    sendTemporaryPasswordEmail_(student,temp);
    audit_({userId:student.ID_Siswa,role:"STUDENT"},"FORGOT_PASSWORD","Data_Siswa",student.ID_Siswa,"Temporary password emailed","SUCCESS");
  } catch(mailErr) {
    // Email gagal: kembalikan password lama agar siswa tidak terkunci.
    try { updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Password_Hash:previous.Password_Hash,Password_Salt:previous.Password_Salt,Must_Change_Password:previous.Must_Change_Password,Updated_At:now_()}); } catch(rollbackErr) {}
    audit_({userId:student.ID_Siswa,role:"STUDENT"},"FORGOT_PASSWORD","Data_Siswa",student.ID_Siswa,String(mailErr&&mailErr.message||mailErr),"FAILED");
  }
  return generic;
}

function resetPassword_(data) {
  var token=String(data.token||""), password=String(data.new_password||"");
  require_(token.length>=16&&password.length>=8,"VALIDATION_ERROR","Reset data is invalid.");
  var hash=sha256Hex_(token), rows=sheetToObjects_("Password_Reset_Tokens"), row=null;
  for(var i=0;i<rows.length;i++){
    if(rows[i].Token_Hash===hash && rows[i].Status==="ACTIVE"){row=rows[i];break;}
  }
  require_(row,"AUTH_INVALID","Reset token is invalid or expired.");
  var exp=parseDateValue_(row.Expires_At);
  require_(exp && exp.getTime()>Date.now(),"AUTH_EXPIRED","Reset token expired.");
  var student=findOne_("Data_Siswa","ID_Siswa",row.ID_Siswa);
  require_(student,"NOT_FOUND","Student not found.");
  var salt=randomHex_(16);
  updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Password_Salt:salt,Password_Hash:hashPassword_(password,salt),Must_Change_Password:false,Updated_At:now_()});
  updateObject_("Password_Reset_Tokens","ID_Reset",row.ID_Reset,{Status:"USED",Used_At:now_()});
  return {message:"Password reset successfully."};
}

function changePassword_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), student=findOne_("Data_Siswa","ID_Siswa",ctx.userId);
  require_(student,"NOT_FOUND","Student not found.");
  var current=String(data.current_password||""), next=String(data.new_password||"");
  require_(passwordMatches_(student,current),"AUTH_INVALID","Current password is incorrect.");
  require_(next.length>=8,"VALIDATION_ERROR","New password must be at least 8 characters.");
  var salt=randomHex_(16);
  updateObject_("Data_Siswa","ID_Siswa",student.ID_Siswa,{Password_Salt:salt,Password_Hash:hashPassword_(next,salt),Must_Change_Password:false,Updated_At:now_()});
  return {changed:true};
}

function termsStatus_(token) {
  var ctx=getAuthContext_(token,"STUDENT"), tos=latestTerms_();
  if(!tos) return {required:false,terms:null};
  var accepted=findMany_("Terms_Acceptance","ID_Siswa",ctx.userId).some(function(x){return String(x.Terms_ID)===String(tos.Terms_ID);});
  return {required:!accepted,terms:{id:tos.Terms_ID,version:tos.Version,title:tos.Title,content_url:tos.Content_URL,content:getSetting_("TERMS_CONTENT","")}};
}

function acceptTerms_(token,data) {
  var ctx=getAuthContext_(token,"STUDENT"), requested=String(data&&data.terms_id||""), terms=requested?findOne_("Terms_Versions","Terms_ID",requested):null;
  if(!terms || terms.Status!=="ACTIVE") terms=latestTerms_();
  require_(terms && terms.Status==="ACTIVE","NOT_FOUND","Active Terms of Service version is unavailable.");
  if(!findMany_("Terms_Acceptance","ID_Siswa",ctx.userId).some(function(x){return String(x.Terms_ID)===String(terms.Terms_ID);})){
    appendObject_("Terms_Acceptance",{ID_Acceptance:makeId_("TOSA"),ID_Siswa:ctx.userId,Terms_ID:terms.Terms_ID,Accepted_At:now_()});
  }
  return {accepted:true,terms_id:terms.Terms_ID,version:terms.Version};
}

function latestTerms_() {
  var rows=sheetToObjects_("Terms_Versions").filter(function(x){return x.Status==="ACTIVE";});
  if(!rows.length){
    var all=sheetToObjects_("Terms_Versions");
    if(all.length){
      all.sort(function(a,b){return String(b.Effective_Date).localeCompare(String(a.Effective_Date));});
      updateObject_("Terms_Versions","Terms_ID",all[0].Terms_ID,{Status:"ACTIVE"});
      rows=[all[0]];
    }else{
      var id=makeId_("TOS");
      var now=now_(), today=today_();
      var terms={Terms_ID:id,Version:"1.0",Effective_Date:today,Title:"COGNIORA Terms of Service",Content_URL:"",Status:"ACTIVE",Created_At:now};
      appendObject_("Terms_Versions",terms);
      rows=[terms];
    }
  }
  rows.sort(function(a,b){return String(b.Effective_Date).localeCompare(String(a.Effective_Date))||String(b.Version).localeCompare(String(a.Version));});
  return rows[0];
}

function hashPassword_(password,salt) { return sha256Hex_(String(salt)+"::"+String(password)); }

function findBestEnrollment_(studentId) {
  var rows=findMany_("Data_Enrollment","ID_Siswa",studentId);
  if(!rows.length) return null;
  rows.sort(function(a,b){
    var rank=function(s){return s==="ACTIVE"?3:s==="INACTIVE"?2:s==="COMPLETED"?1:0;};
    return rank(String(b.Status))-rank(String(a.Status)) || String(b.Updated_At).localeCompare(String(a.Updated_At));
  });
  return rows[0];
}

function publicEnrollment_(e) {
  var batch=findOne_("Data_Batch","ID_Batch",e.ID_Batch), pkg=findOne_("Data_Package","ID_Package",e.ID_Package), program=batch?findOne_("Data_Program","ID_Program",batch.ID_Program):null;
  return {
    id:e.ID_Enrollment,batch_id:e.ID_Batch,batch_name:batch&&batch.Nama_Batch,
    package_id:e.ID_Package,package_name:pkg&&pkg.Nama_Paket,program_name:program&&program.Nama_Program,
    start_date:toClientDate_(e.Tanggal_Mulai),end_date:toClientDate_(e.Tanggal_Selesai),
    status:e.Status,current_month:Number(e.Current_Month||0),current_meeting:Number(e.Current_Meeting||0),
    completion_status:e.Completion_Status
  };
}