function publicPrograms_() {
  return sheetToObjects_("Data_Program").filter(function(x){return x.Status==="ACTIVE";})
    .map(function(x){return {id:x.ID_Program,name:x.Nama_Program,level:x.Level,description:x.Deskripsi,duration_months:Number(x.Durasi_Default_Bulan||0)};});
}

function publicPackages_() {
  var programs={}; publicPrograms_().forEach(function(p){programs[p.id]=p;});
  return sheetToObjects_("Data_Package").filter(function(x){return x.Status==="ACTIVE";})
    .map(function(x){return {id:x.ID_Package,program_id:x.ID_Program,program_name:programs[x.ID_Program]&&programs[x.ID_Program].name,level:programs[x.ID_Program]&&programs[x.ID_Program].level,name:x.Nama_Paket,type:x.Tipe_Kelas,price_per_month:Number(x.Harga_Per_Bulan||0),description:x.Deskripsi,recommended:bool_(x.Recommended),payment_frequency:x.Payment_Frequency};});
}

function publicSyllabus_(data) {
  var programId=String(data&&data.program_id||"");
  var rows=sheetToObjects_("Data_Syllabus").filter(function(x){return x.Status==="ACTIVE" && (!programId || x.ID_Program===programId);});
  var programs={};
  sheetToObjects_("Data_Program").forEach(function(p){programs[p.ID_Program]=p;});
  return rows.sort(function(a,b){return String(a.ID_Program).localeCompare(String(b.ID_Program)) || String(a.ID_Syllabus).localeCompare(String(b.ID_Syllabus));})
    .map(function(x){
      var p=programs[x.ID_Program]||{};
      return {id:x.ID_Syllabus,program_id:x.ID_Program,program_name:p.Nama_Program||"",level:p.Level||"",description:x.Description||""};
    });
}

function publicTestimonials_() {
  return sheetToObjects_("Data_Testimonial").filter(function(x){return x.Status==="ACTIVE";})
    .sort(function(a,b){return Number(a.Urutan)-Number(b.Urutan);})
    .map(function(x){return {id:x.ID_Testimonial,name:x.Nama,role:x.Role,testimonial:x.Testimonial,rating:x.Rating?Number(x.Rating):null,photo_file_id:x.Foto_File_ID||""};});
}

function publicCreateLead_(data) {
  data=data||{};
  var name=String(data.full_name||"").trim(), email=normalizeEmail_(data.email), wa=String(data.whatsapp||"").trim();
  var packageId=String(data.package_id||"").trim();
  require_(name.length>=2,"VALIDATION_ERROR","Nama lengkap wajib diisi.");
  require_(validEmail_(email),"VALIDATION_ERROR","Email tidak valid.");
  require_(wa.length>=6,"VALIDATION_ERROR","Nomor WhatsApp wajib diisi.");
  require_(findOne_("Data_Package","ID_Package",packageId) && findOne_("Data_Package","ID_Package",packageId).Status==="ACTIVE","VALIDATION_ERROR","Paket tidak ditemukan.");
  var lead={ID_Lead:makeId_("LED"),Timestamp:now_(),Nama_Lengkap:name,Email:email,Nomor_WA:wa,ID_Package:packageId,Kode_Referral:String(data.referral_code||""),Pesan:String(data.message||""),Status:"NEW",ID_Siswa:"",Converted_At:"",Converted_By:"",Source:"LANDING_PAGE"};
  appendObject_("Data_Leads",lead);
  return {lead_id:lead.ID_Lead};
}

function publicContent_() {
  var logoId=getSetting_("LANDING_LOGO_FILE_ID","");
  var heroId=getSetting_("LANDING_HERO_IMAGE_FILE_ID","");
  var galleryRaw=getSetting_("LEARNING_GALLERY_FILE_IDS","[]"), gallery=[];
  try { gallery=JSON.parse(galleryRaw); } catch(e) { gallery=[]; }
  return {
    logo_file_id:logoId,
    hero_file_id:heroId,
    gallery:gallery.map(function(x){
      var id=typeof x==="string"?x:x.file_id;
      return {file_id:id,caption:typeof x==="string"?"":String(x.caption||"")};
    }).filter(function(x){return !!x.file_id;}),
    how_to_login_url:getSetting_("HOW_TO_LOGIN_URL",""),
    programs:publicPrograms_(),
    packages:publicPackages_(),
    testimonials:publicTestimonials_()
  };
}

function publicSiteImage_(data) {
  var id=String(data&&data.file_id||"").trim();
  require_(id,"VALIDATION_ERROR","Image file ID is required.");
  var allowed=[];
  [getSetting_("LANDING_LOGO_FILE_ID",""),getSetting_("LANDING_HERO_IMAGE_FILE_ID","")].forEach(function(x){if(x)allowed.push(String(x));});
  var galleryRaw=getSetting_("LEARNING_GALLERY_FILE_IDS","[]"), gallery=[]; try{gallery=JSON.parse(galleryRaw);}catch(e){}
  gallery.forEach(function(x){var gid=typeof x==="string"?x:x.file_id;if(gid)allowed.push(String(gid));});
  sheetToObjects_("Data_Testimonial").filter(function(x){return x.Status==="ACTIVE"&&x.Foto_File_ID;}).forEach(function(x){allowed.push(String(x.Foto_File_ID));});
  require_(allowed.indexOf(id)>=0,"AUTH_FORBIDDEN","This image is not configured as a public Cogniora image.");
  return {file_id:id,image_url:getDriveImageDataUrl_(id)};
}

function publicCertificateVerify_(data) {
  var code=String(data&& (data.verification_code||data.code)||"").trim();
  require_(code,"VALIDATION_ERROR","Verification code is required.");
  var cert=findOne_("Data_Certificate","Verification_Code",code);
  if(!cert) return {verified:false};
  var enr=findOne_("Data_Enrollment","ID_Enrollment",cert.ID_Enrollment);
  var student=enr?findOne_("Data_Siswa","ID_Siswa",enr.ID_Siswa):null;
  var batch=enr?findOne_("Data_Batch","ID_Batch",enr.ID_Batch):null;
  var program=batch?findOne_("Data_Program","ID_Program",batch.ID_Program):null;
  return {verified:true,certificate_number:cert.No_Sertifikat,name:student&&student.Nama_Lengkap,program:program&&program.Nama_Program,batch:batch&&batch.Nama_Batch,issue_date:formatIndonesianLongDate_(cert.Issue_Date),status:cert.Status};
}