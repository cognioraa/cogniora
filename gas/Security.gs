function getAuthContext_(token,expectedType) {
  var raw=String(token||"");
  require_(raw,"AUTH_REQUIRED","Authentication is required.");
  var cache=CacheService.getScriptCache();
  var json=cache.get("COGNIORA_SESSION_"+raw);
  require_(json,"AUTH_EXPIRED","Session expired. Please log in again.");
  var s=JSON.parse(json);
  require_(s.type===expectedType,"AUTH_FORBIDDEN","You are not authorized to perform this action.");
  // V2: re-check account status and role on every protected request so a disabled
  // tutor cannot keep using an old six-hour session.
  if(expectedType==="ADMIN") {
    var admin=findOne_("Data_Admin","ID_Admin",String(s.userId||""));
    require_(admin && admin.Status==="ACTIVE","AUTH_LOCKED","Akun admin/tutor tidak aktif.");
    require_(String(admin.Role||"")===String(s.role||""),"AUTH_FORBIDDEN","Role akun telah berubah. Silakan login kembali.");
  }
  if(expectedType==="STUDENT") {
    var student=findOne_("Data_Siswa","ID_Siswa",String(s.userId||""));
    require_(student && ["ACTIVE","INACTIVE"].indexOf(String(student.Status_Akun))>=0,"AUTH_LOCKED","Akun siswa tidak aktif.");
  }
  return s;
}

function createSession_(type,userId,role,enrollmentId) {
  var token=randomHex_(48);
  var payload={type:type,userId:userId,role:role||type,enrollmentId:enrollmentId||"",createdAt:Date.now()};
  CacheService.getScriptCache().put("COGNIORA_SESSION_"+token,JSON.stringify(payload),21600);
  return token;
}

function revokeSession_(token) {
  if(token) CacheService.getScriptCache().remove("COGNIORA_SESSION_"+String(token));
}

function assertAdmin_(ctx) { require_(ctx && (ctx.type==="ADMIN"),"AUTH_FORBIDDEN","Admin/Tutor access required."); }

function assertOwner_(ctx) { require_(ctx && ctx.role==="OWNER","AUTH_FORBIDDEN","Owner access required."); }

function assertStudentOwnsEnrollment_(ctx,enrollmentId) {
  var e=findOne_("Data_Enrollment","ID_Enrollment",String(enrollmentId||ctx.enrollmentId||""));
  require_(e,"NOT_FOUND","Enrollment not found.");
  require_(e.ID_Siswa===ctx.userId,"AUTH_FORBIDDEN","Enrollment does not belong to this student.");
  return e;
}

function audit_(ctx,action,entity,entityId,description,result) {
  try {
    appendObject_("Audit_Log",{
      ID_Log:makeId_("LOG"),
      Timestamp:now_(),
      Actor_ID:ctx&&ctx.userId||ctx&&ctx.id||"SYSTEM",
      Actor_Role:ctx&&ctx.role||ctx&&ctx.type||"SYSTEM",
      Action:action,
      Entity:entity,
      Entity_ID:entityId||"",
      Description:description||"",
      Result:result||"SUCCESS"
    });
  } catch(e) {}
}

function maxAttempts_(key,ttlSeconds,maxAllowed) {
  var cache=CacheService.getScriptCache(), k="COGNIORA_RATE_"+sha256Hex_(key);
  var n=Number(cache.get(k)||0);
  if(n>=maxAllowed) return false;
  cache.put(k,String(n+1),ttlSeconds);
  return true;
}

// V42: batas percobaan login hanya menghitung percobaan GAGAL, direset saat berhasil.
function loginAttemptsBlocked_(key,maxAllowed) {
  try { return Number(CacheService.getScriptCache().get("COGNIORA_LOGINFAIL_"+sha256Hex_(key))||0)>=maxAllowed; } catch(e) { return false; }
}
function loginAttemptFailed_(key,ttlSeconds) {
  try {
    var cache=CacheService.getScriptCache(), k="COGNIORA_LOGINFAIL_"+sha256Hex_(key);
    cache.put(k,String(Number(cache.get(k)||0)+1),ttlSeconds);
  } catch(e) {}
}
function loginAttemptsReset_(key) {
  try { CacheService.getScriptCache().remove("COGNIORA_LOGINFAIL_"+sha256Hex_(key)); } catch(e) {}
}

// V42: password dari email sering ikut membawa spasi/baris baru saat di-copy. Terima exact match,
// lalu varian yang di-trim.
function passwordMatches_(record,password) {
  var raw=String(password==null?"":password), hash=String(record.Password_Hash||""), salt=record.Password_Salt;
  if(hash===hashPassword_(raw,salt)) return true;
  var trimmed=raw.replace(/^[\s\u200B\uFEFF]+|[\s\u200B\uFEFF]+$/g,"");
  return trimmed!==raw && trimmed!=="" && hash===hashPassword_(trimmed,salt);
}
