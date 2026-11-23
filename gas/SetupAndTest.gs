function setupCogniora() {
  repairKnownSheetNames();
  var ss=getSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID",ss.getId());
  if(!PropertiesService.getScriptProperties().getProperty("GAS_API_KEY")) PropertiesService.getScriptProperties().setProperty("GAS_API_KEY",randomHex_(24));
  ensureAllSheets_();
  ensureDefaultSettings_();
  ensureDefaultLevels_();
  linkBatchLevels_();
  var drive=ensureRootDriveStructure_();
  return {spreadsheet_id:ss.getId(),drive:drive,api_key_configured:!!PropertiesService.getScriptProperties().getProperty("GAS_API_KEY"),schema_version:"V2"};
}


function ensureDefaultLevels_() {
  var defaults=[
    ["SPARK","Spark",1,"Fondasi dan pengenalan bahasa Inggris."],
    ["FLOW","Flow",2,"Penggunaan bahasa dalam situasi sehari-hari."],
    ["MASTERY","Mastery",3,"Penerapan bahasa dalam situasi yang lebih kompleks."],
    ["ZENITH","Zenith",4,"Komunikasi dan penguasaan bahasa tingkat lanjut."]
  ];
  var rows=sheetToObjects_("Data_Level");
  defaults.forEach(function(x){if(!rows.some(function(r){return r.Level_Code===x[0];}))appendObject_("Data_Level",{ID_Level:makeId_("LVL"),Level_Code:x[0],Level_Name:x[1],Order_No:x[2],Description:x[3],Entry_Criteria:"",Completion_Criteria:"",Status:"ACTIVE",Created_At:now_(),Updated_At:now_()});});
}

function ensureDefaultSettings_() {
  var defaults=[
    ["TIMEZONE","Asia/Jakarta","System timezone","TEXT"],
    ["MAX_PUBLIC_IMAGE_BYTES","2097152","Maximum public image size in bytes","NUMBER"],
    ["MAX_ASSIGNMENT_FILE_BYTES","52428800","Maximum assignment upload size in bytes","NUMBER"],
    ["MAX_PROTECTED_FILE_BYTES","8388608","Maximum protected in-app preview file size in bytes","NUMBER"],
    ["MAX_UPLOAD_BYTES","52428800","Generic upload maximum","NUMBER"],
    ["MIN_ATTENDANCE_DEFAULT","80","Default attendance requirement","NUMBER"],
    ["MIN_ASSIGNMENT_DEFAULT","80","Default assignment requirement","NUMBER"],
    ["MIN_SCORE_DEFAULT","75","Default certificate minimum score","NUMBER"],
    ["PAYMENT_DUE_DAY","5","Default monthly invoice due day","NUMBER"],
    ["LOGIN_URL","","Student login URL; blank uses current GAS web app URL","TEXT"],
    ["CERTIFICATE_TEMPLATE_ID","","Google Docs certificate template ID","TEXT"],
    ["LANDING_LOGO_FILE_ID","","Google Drive file ID for landing logo","TEXT"],
    ["LANDING_HERO_IMAGE_FILE_ID","","Google Drive file ID for landing hero image","TEXT"],
    ["LEARNING_GALLERY_FILE_IDS","[]","JSON array of Drive file IDs or {file_id,caption}","TEXT"],
    ["SYSTEM_EMAIL","","Notification sender","TEXT"]
  ];
  defaults.forEach(function(d){if(!findOne_("Data_Settings","Setting_Key",d[0])) setSetting_(d[0],d[1],d[2],d[3],"SYSTEM");});
}

function bootstrapCogniora() {
  return setupCogniora();
}

function validateCognioraDatabase() {
  var report={ok:true,sheets:[],errors:[]};
  Object.keys(COGNIORA_SCHEMA).forEach(function(name){
    try {
      var sh=getSpreadsheet_().getSheetByName(name);
      if(!sh){report.ok=false;report.errors.push("Missing sheet: "+name);return;}
      var headers=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(function(x){return String(x||"").trim();});
      var expected=COGNIORA_SCHEMA[name];
      var mismatch=expected.some(function(h,i){return headers[i]!==h;});
      report.sheets.push({name:name,rows:Math.max(0,sh.getLastRow()-1),ok:!mismatch});
      if(mismatch){report.ok=false;report.errors.push(name+" header mismatch.");}
    } catch(e) {report.ok=false;report.errors.push(name+": "+e.message);}
  });
  Logger.log(JSON.stringify(report,null,2));
  return report;
}

function repairKnownSheetNames() {
  var ss=getSpreadsheet_(), old=ss.getSheetByName("Data_Setting"), newer=ss.getSheetByName("Data_Settings");
  if(old && !newer){old.setName("Data_Settings"); return {renamed:true};}
  return {renamed:false};
}

function createOwnerAdmin(email,password,name) {
  require_(validEmail_(email)&&String(password||"").length>=8,"VALIDATION_ERROR","Valid email and password (min 8 chars) are required.");
  var existing=findOne_("Data_Admin","Email",normalizeEmail_(email)); require_(!existing,"DUPLICATE_RECORD","Admin email already exists.");
  var salt=randomHex_(16), row={ID_Admin:makeId_("ADM"),Nama:String(name||"Cogniora Owner"),Email:normalizeEmail_(email),Password_Hash:hashPassword_(password,salt),Password_Salt:salt,Role:"OWNER",Status:"ACTIVE",Foto_File_ID:"",Last_Login:"",Created_At:now_(),Updated_At:now_()};
  appendObject_("Data_Admin",row);
  return {created:true,id:row.ID_Admin,email:row.Email,role:row.Role};
}

function createTutorAdmin_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN"); assertOwner_(ctx);
  require_(validEmail_(data.email)&&String(data.password||"").length>=8,"VALIDATION_ERROR","Valid tutor email and password are required.");
  var email=normalizeEmail_(data.email); require_(!findOne_("Data_Admin","Email",email),"DUPLICATE_RECORD","Admin email already exists.");
  var salt=randomHex_(16), row={ID_Admin:makeId_("ADM"),Nama:String(data.name||"Tutor"),Email:email,Password_Hash:hashPassword_(data.password,salt),Password_Salt:salt,Role:"TUTOR",Status:"ACTIVE",Foto_File_ID:"",Last_Login:"",Created_At:now_(),Updated_At:now_()};
  appendObject_("Data_Admin",row); return {created:true,id:row.ID_Admin};
}

function seedMinimalDemoData() {
  var programs=sheetToObjects_("Data_Program"), now=now_();
  if(!programs.length) appendObject_("Data_Program",{ID_Program:makeId_("PRG"),Nama_Program:"Daily Conversation",Level:"Basic",Deskripsi:"English for school and everyday realistic communication.",Durasi_Default_Bulan:5,Status:"ACTIVE",Created_At:now,Updated_At:now});
  var p=sheetToObjects_("Data_Program")[0];
  if(!sheetToObjects_("Data_Package").length) appendObject_("Data_Package",{ID_Package:makeId_("PKG"),ID_Program:p.ID_Program,Nama_Paket:"Speaking",Tipe_Kelas:"GROUP",Harga_Per_Bulan:250000,Deskripsi:"Live lesson, class materials, assignment, progress tracking.",Recommended:true,Payment_Frequency:"MONTHLY",Status:"ACTIVE",Created_At:now,Updated_At:now});
  if(!sheetToObjects_("Data_Batch").length) appendObject_("Data_Batch",{ID_Batch:makeId_("BAT"),Nama_Batch:"Demo Batch",ID_Program:p.ID_Program,Level:p.Level,Tipe_Kelas:"GROUP",Max_Students:3,Tanggal_Mulai:today_(),Tanggal_Selesai:"",Durasi_Bulan:5,Minimum_Attendance:80,Minimum_Assignment:80,Minimum_Score:75,Status:"ACTIVE",Syllabus_Mode:"STANDARD",Created_At:now,Updated_At:now});
  if(!sheetToObjects_("Terms_Versions").length) appendObject_("Terms_Versions",{Terms_ID:makeId_("TOS"),Version:"1.0",Effective_Date:today_(),Title:"COGNIORA Terms of Service",Content_URL:"",Status:"ACTIVE",Created_At:now});
  return {seeded:true};
}

function testBatchesAndAdmin() {
  setupCogniora();
  var sheets=["Data_Admin","Data_Batch","Data_Program","Data_Enrollment"];
  var out={ok:true,checks:{}};
  sheets.forEach(function(s){out.checks[s]=!!getSpreadsheet_().getSheetByName(s); if(!out.checks[s])out.ok=false;});
  var batches=sheetToObjects_("Data_Batch"), admins=sheetToObjects_("Data_Admin");
  out.checks.batch_rows=batches.length;
  out.checks.admin_rows=admins.length;
  out.message=out.ok?"Batches/Admin module is reachable.":"One or more required sheets are missing.";
  Logger.log(JSON.stringify(out,null,2));
  return out;
}

function testDriveImage(fileId) {
  return {ok:!!getDriveImageDataUrlSafe_(String(fileId||"")),image_url:getDriveImageDataUrlSafe_(String(fileId||""))};
}


function printSetupInfo() {
  var props=PropertiesService.getScriptProperties(), ss=getSpreadsheet_();
  var out={spreadsheet_id:ss.getId(),web_app_url:(function(){try{return ScriptApp.getService().getUrl()||"";}catch(e){return "";}})(),api_key_set:!!props.getProperty("GAS_API_KEY"),settings_count:sheetToObjects_("Data_Settings").length};
  Logger.log(JSON.stringify(out,null,2));
  return out;
}


function createOwnerAdminFromPrompt() {
  var ui=SpreadsheetApp.getUi();
  var email=ui.prompt("Cogniora Owner Admin","Email:",ui.ButtonSet.OK_CANCEL);
  if(email.getSelectedButton()!==ui.Button.OK) return {cancelled:true};
  var pass=ui.prompt("Cogniora Owner Admin","Password (minimum 8 characters):",ui.ButtonSet.OK_CANCEL);
  if(pass.getSelectedButton()!==ui.Button.OK) return {cancelled:true};
  var name=ui.prompt("Cogniora Owner Admin","Nama owner:",ui.ButtonSet.OK_CANCEL);
  if(name.getSelectedButton()!==ui.Button.OK) return {cancelled:true};
  var result=createOwnerAdmin(email.getResponseText(),pass.getResponseText(),name.getResponseText());
  Logger.log(JSON.stringify(result,null,2));
  return result;
}

function configureCognioraFromPrompt() {
  var ui=SpreadsheetApp.getUi();
  var items=[
    ["LANDING_LOGO_FILE_ID","Google Drive File ID untuk logo"],
    ["LANDING_HERO_IMAGE_FILE_ID","Google Drive File ID untuk landing hero"],
    ["CERTIFICATE_TEMPLATE_ID","Google Docs Template ID untuk certificate"]
  ];
  var result={};
  items.forEach(function(item){
    var p=ui.prompt("Cogniora Settings",item[1]+" (boleh kosong):",ui.ButtonSet.OK_CANCEL);
    if(p.getSelectedButton()===ui.Button.OK){setSetting_(item[0],p.getResponseText().trim(),item[1],"TEXT","SYSTEM");result[item[0]]=p.getResponseText().trim();}
  });
  var gallery=ui.prompt("Cogniora Settings","Learning gallery JSON. Contoh: [{\"file_id\":\"ID1\",\"caption\":\"Class activity\"}]",ui.ButtonSet.OK_CANCEL);
  if(gallery.getSelectedButton()===ui.Button.OK && gallery.getResponseText().trim()){
    try { JSON.parse(gallery.getResponseText()); setSetting_("LEARNING_GALLERY_FILE_IDS",gallery.getResponseText().trim(),"Learning gallery JSON","TEXT","SYSTEM"); result.LEARNING_GALLERY_FILE_IDS=gallery.getResponseText().trim(); }
    catch(e){ throw apiError_("VALIDATION_ERROR","Gallery JSON tidak valid."); }
  }
  Logger.log(JSON.stringify(result,null,2)); return result;
}

function testPublicImageFromPrompt() {
  var ui=SpreadsheetApp.getUi(), p=ui.prompt("Test Cogniora Public Image","Masukkan Drive File ID yang sudah dikonfigurasi sebagai logo/hero/gallery:",ui.ButtonSet.OK_CANCEL);
  if(p.getSelectedButton()!==ui.Button.OK) return {cancelled:true};
  var r=publicSiteImage_({file_id:p.getResponseText().trim()});
  var out={ok:!!(r&&r.image_url),file_id:p.getResponseText().trim(),mime_prefix:String(r.image_url||"").substring(0,30)};
  Logger.log(JSON.stringify(out,null,2)); return out;
}
// V38: jalankan fungsi ini lalu buka View > Logs untuk menyalin nilai yang dibutuhkan Vercel.
// JANGAN bagikan GAS_API_KEY ke siapa pun.
function printVercelConfig() {
  var url=""; try { url=ScriptApp.getService().getUrl()||""; } catch(e) {}
  var out={GAS_URL:url,GAS_API_KEY:PropertiesService.getScriptProperties().getProperty("GAS_API_KEY")||"(belum ada — jalankan setupCogniora() dulu)"};
  Logger.log(JSON.stringify(out,null,2));
  return out;
}


// V42: jalankan SEKALI setelah update. Memformat kolom nomor WA / hash password sebagai teks dan
// memulihkan angka 0 di depan nomor WA yang hilang (angka yang diawali 8 => ditambah 0).
function repairTextColumns() {
  var report={};
  Object.keys(COGNIORA_TEXT_COLUMNS).forEach(function(name){
    var sh=getSpreadsheet_().getSheetByName(name); if(!sh || sh.getLastRow()<1) return;
    var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    COGNIORA_TEXT_COLUMNS[name].forEach(function(col){
      var ci=headers.indexOf(col); if(ci<0) return;
      var rows=Math.max(1,sh.getMaxRows()-1), rng=sh.getRange(2,ci+1,rows,1);
      var vals=rng.getValues(), fixed=0;
      rng.setNumberFormat("@");
      if(col==="Nomor_WA") vals=vals.map(function(r){var v=r[0]; if(typeof v==="number"&&v>0){var t=String(Math.round(v)); if(t.charAt(0)==="8"){fixed++;return ["0"+t];}} return [v===""?"":String(v)];});
      else vals=vals.map(function(r){return [r[0]===""?"":String(r[0])];});
      rng.setValues(vals);
      report[name+"."+col]=fixed;
    });
  });
  Logger.log(JSON.stringify(report));
  return report;
}

// V42: diagnosis login. Jalankan dari editor Apps Script: diagnoseLogin("email@siswa.com","password-dari-email")
function diagnoseLogin(email,password) {
  var e=normalizeEmail_(email), s=findOne_("Data_Siswa","Email",e), out={email:e,student_found:!!s};
  if(s){
    out.status_akun=s.Status_Akun; out.hash_length=String(s.Password_Hash||"").length; out.salt_type=typeof s.Password_Salt;
    out.must_change_password=s.Must_Change_Password;
    out.password_matches=password?passwordMatches_(s,password):"(password tidak diisi)";
  }
  out.rate_limited=loginAttemptsBlocked_("LOGIN:"+e,8);
  Logger.log(JSON.stringify(out,null,2));
  return out;
}
