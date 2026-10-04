/* COGNIORA V40 — Performance optimized + certificate support helpers */
/**
 * COGNIORA LMS - Google Apps Script backend.
 * Execute as deployment owner (USER_DEPLOYING). Student passwords are stored
 * as plain text in Data_Siswa[Password_PIN] for direct manual sheet entry.
 * Student and admin sessions use signed session tokens.
 * Database source is fixed to Spreadsheet: Cogniora Database.
 */
const COG = {
  NAME: 'COGNIORA',
  DATABASE_ID: '1beUzStIYNJR8usKEVLLcf3NXDplMZ5pbuK7Pk9XkDhk',
  DATABASE_NAME: 'Cogniora Database',
  TTL: 21600,
  MAX_FILE: 10 * 1024 * 1024,
  CERTIFICATE: {
    DEFAULT_TEMPLATE_ID: '1ku_fTQqvGqN5oMBJYWDq6atA660KOy22_vDC_S68s_c',
    DEFAULT_TEMPLATE_VERSION: 'V1',
    DEFAULT_NUMBER_PREFIX: 'COGNIORA-CERT',
    TEMPLATE_TYPE: 'GOOGLE_DOCS',
    DOCS_SCOPE: 'https://www.googleapis.com/auth/documents'
  },
  TERMS: {
    VERSION: '1.0'
  },
  SHEETS: {
    STUDENTS:'Data_Siswa', MATERIALS:'Data_Materi', TASKS:'Data_Tugas',
    PAYMENTS:'Data_Pembayaran', SCHEDULE:'Jadwal_Kalender', REPORTS:'Data_Rapor',
    SETTINGS:'Pengaturan_Sistem', LEADS:'Leads', CERTS:'Data_Sertifikat',
    CERT_LOG:'Data_Sertifikat_Log', CERT_SCORES:'Data_Sertifikat_Nilai',
    ADMINS:'Data_Admin', BATCHES:'Data_Batch', SUBMISSIONS:'Data_Submission',
    REPORT_ASPECTS:'Data_Rapor_Aspek', REPORT_SCORES:'Data_Rapor_Nilai',
    TOPICS:'Data_Topik_Bulanan'
  },
  HEADERS: {
    Data_Siswa:['ID_Siswa','Nama_Lengkap','Email','Password_PIN','Nomor_WA','Bulan_Aktif','Pertemuan_Ke','Status_Kelulusan','ID_Folder_Drive','Foto_Profil','ID_Batch','Status_Aktif','Terms_Agreed','Terms_Agreed_At','Terms_Version'],
    Data_Materi:['ID_Materi','ID_Batch','Syarat_Pertemuan','Kategori','Judul_Materi','Deskripsi','Link_Akses','Status_Aktif','Created_At'],
    Data_Tugas:['ID_Tugas','ID_Batch','Syarat_Pertemuan','Topik_Tugas','Deskripsi_Tugas','Deadline','Status_Aktif','Created_At','Email_Siswa','Link_File','Tanggal_Submission','Status_Penilaian','Nilai','Feedback'],
    Data_Submission:['ID_Submission','ID_Tugas','ID_Siswa','Email_Siswa','Link_File','Jenis_File','Catatan','Tanggal_Submission','Status_Penilaian','Nilai','Feedback','Updated_At'],
    Data_Pembayaran:['ID_Tagihan','Email_Siswa','Bulan_Program','Nominal_Tagihan','Tanggal_Jatuh_Tempo','Status_Payment','Link_Bukti_Transfer'],
    Jadwal_Kalender:['ID_Sesi','ID_Batch','Nama_Kegiatan','Waktu_Mulai','Waktu_Selesai','Link_Meet','Status_Reminder_WA'],
    Data_Rapor:['Email_Siswa','Bulan_Evaluasi','Link_PDF_Rapor'],
    Data_Rapor_Aspek:['ID_Aspek','Bulan_Evaluasi','Nama_Aspek','Deskripsi_Aspek','Urutan','Status_Aktif'],
    Data_Rapor_Nilai:['ID_Nilai','ID_Aspek','ID_Siswa','Email_Siswa','Nilai','Feedback','Updated_At'],
    Data_Batch:['ID_Batch','Nama_Batch','Program','Level','Tanggal_Mulai','Tanggal_Selesai','Month','Meeting','Status'],
    Pengaturan_Sistem:['Key','Value'],
    Data_Admin:['ID_Admin','Nama_Admin','Email','Password','Role','Status'],
    Leads:['Nama','Email','Nomor_WA','Program_Diminati','Pesan','Created_At','Status','ID_Siswa','Converted_At'],
    Data_Topik_Bulanan:['ID_Topik','Level','Bulan','Topik','Deskripsi_Topik','Urutan','Status_Aktif'],
    Data_Sertifikat:['ID_Sertifikat','No_Sertifikat','ID_Siswa','Email_Siswa','Nama_Siswa','ID_Batch','Nama_Batch','Program','Level','Tanggal_Mulai','Tanggal_Selesai','Tanggal_Diterbitkan','Template_ID','Template_Version','Template_Type','File_ID_Document','Link_Document','File_ID_Spreadsheet','Link_Spreadsheet','File_ID_PDF','Link_PDF','Status','Generated_At','Generated_By','Updated_At'],
    Data_Sertifikat_Log:['ID_Log','ID_Sertifikat','No_Sertifikat','ID_Siswa','Email_Siswa','Nama_Siswa','ID_Batch','Action','Action_By','Action_At','Previous_Status','New_Status','Reason','Template_Version','Template_Type','File_ID_Document','Link_Document','File_ID_Spreadsheet','Link_Spreadsheet','File_ID_PDF','Link_PDF','Certificate_Data_Snapshot'],
    Data_Sertifikat_Nilai:['ID_Sertifikat_Nilai','ID_Sertifikat','ID_Siswa','Bulan','Topik','Speaking','Listening','Reading','Writing','Grammar','Rata_Rata_Bulanan','Created_At']
  },
  UPLOAD_EXT:['pdf','doc','docx','mp3','wav','m4a','mp4','mov','avi','jpg','jpeg','png']
};

/* -------------------- V39 performance layer -------------------- */
const COG_RUNTIME={db:null,sheets:Object.create(null),rows:Object.create(null)};
const COG_CACHE={VERSION:'39',TTL:30,MAX_ITEM:85000,CACHED_SHEETS:new Set(['Data_Materi','Data_Batch','Jadwal_Kalender','Data_Rapor_Aspek','Data_Topik_Bulanan','Pengaturan_Sistem'])};
function cacheKeyRows_(name){return 'cog:v'+COG_CACHE.VERSION+':rows:'+String(name||'');}
function invalidateRowsCache_(name){const key=String(name||'');delete COG_RUNTIME.rows[key];try{CacheService.getScriptCache().remove(cacheKeyRows_(key));}catch(e){}}

function doGet(e) {
  try {
    const no = text_(e && e.parameter && e.parameter.verify,120);
    if(no){
      const tpl = HtmlService.createTemplateFromFile('Verify');
      tpl.verifyNo = no;
      return tpl.evaluate()
        .setTitle(COG.NAME + ' — Certificate Verification')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
    }
  } catch(err){ console.error(err); }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(COG.NAME + ' — Learning, Progress, and Growth.')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Returns COGNIORA brand/hero images as data URLs.
 * This avoids relying on Google Drive viewer/download URLs in the browser.
 * The Apps Script deployment owner must have access to these Drive files.
 */

function doPost(e) {
  try {
    const body = JSON.parse(e?.postData?.contents || '{}');

    const action = String(body.action || '').trim();
    const args = Array.isArray(body.args) ? body.args : [];

    const handlers = {
      loginStudent,
      loginAdmin,

      validateSession,
      validateAdminSession,
      logoutSession,
      logoutAdminSession,

      registerLead,
      verifyCertificatePublic,

      getLandingImages,
      getAboutLearningGallery,
      getAboutLearningImage,

      getDashboardData,
      getMaterials,
      getAssignments,
      getSchedule,
      getPayments,
      getReports,
      getCertificate,
      getStudentProfile,
      getStudentPhoto,
      getMonthlyProgress,

      acceptTermsOfService,

      getAdminOverview,
      getAdminLeads,
      getAdminBatches,
      getAdminStudents,
      getAdminMaterials,
      getAdminTasks,
      getAdminTaskSubmissions,
      getAdminAssignmentReview,
      getAdminPayments,
      getAdminSchedule,
      getAdminReportBook,
      getAdminCertificates,
      getAdminCertificateConfig,

      saveAdminBatch,
      saveAdminMaterial,
      saveAdminTask,
      saveAdminSchedule,

      assignStudentBatch,
      updateStudentActiveStatus,

      saveSubmissionGrade,
      saveAdminCertificateConfig,
      saveCertificateTemplateSettings,

      generateCertificate,
      generateCertificatesForBatch,
      regenerateCertificate,
      reissueCertificate,
      revokeCertificate,

      reviewPaymentProof,

      saveReportAspect,
      saveReportScores
    };

    if (!action || !handlers[action]) {
      return jsonApi_({
        success: false,
        message: 'API action tidak diizinkan.'
      });
    }

    const result = handlers[action](...args);

    return jsonApi_(result);

  } catch (err) {
    console.error(err);

    return jsonApi_({
      success: false,
      message: err_(err)
    });
  }
}

function jsonApi_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data ?? {
      success: false,
      message: 'Empty response.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}


/* -------------------- About learning gallery -------------------- */
const COGNIORA_LEARNING_GALLERY_FILES = [
  '1cDUW2WK494oaCJXTD7yI71Y-BulzooEe',
  '10t-6TSDi_eEU9gmmHtSl01HCoNIUgFME',
  '18i33fTEVpHWLkmhKjonf_G08CnulGLdI',
  '1W4rQ4m9zZIhM1oKvShGyH_hXIDua1PLq',
  '1FCanrLUirbQPXmTBbyqV715dszFP4zJF'
];

function getAboutLearningImage(index){
  try{
    const i=Number(index);
    if(!Number.isInteger(i) || i<0 || i>=COGNIORA_LEARNING_GALLERY_FILES.length){
      return fail_('Nomor foto pembelajaran tidak valid.');
    }
    const fileId=COGNIORA_LEARNING_GALLERY_FILES[i];
    const file=DriveApp.getFileById(fileId);
    const image=driveFileDataUrl_(fileId);
    return ok_('Foto pembelajaran berhasil dimuat.',{
      index:i,
      total:COGNIORA_LEARNING_GALLERY_FILES.length,
      name:file.getName(),
      image
    });
  }catch(e){
    console.error(e);
    return fail_('Foto pembelajaran tidak dapat dimuat. Pastikan file Google Drive dapat diakses oleh akun pemilik Web App.');
  }
}

function getAboutLearningGallery(){
  try{
    // Jangan mengirim URL thumbnail Google Drive ke browser.
    // Vercel/browser dapat menerima redirect/403 dari URL thumbnail Drive.
    // Frontend akan meminta foto satu per satu melalui getAboutLearningImage(),
    // yang mengubah file Drive menjadi data URL di sisi Apps Script.
    const items=COGNIORA_LEARNING_GALLERY_FILES.map((fileId,index)=>({
      index,
      name:'Momen belajar '+String(index+1).padStart(2,'0'),
      fileId:String(fileId)
    }));

    return ok_('Daftar foto pembelajaran berhasil dimuat.',{
      total:items.length,
      items
    });
  }catch(e){
    console.error(e);
    return fail_('Daftar foto pembelajaran tidak dapat dimuat.');
  }
}


/**
 * Diagnostic helper for landing-page Drive assets.
 * Run this manually once from the Apps Script editor after authorizing Drive.
 */
function testLandingAssets(){
  try{
    const ids={
      logo:'1aPg0foc5qygX-VqGpFlQ0kn1Ogbb52iT',
      hero:'1Vo4IeV5NMGkzEPA7z1UeiTHwkbiJWjm2'
    };
    const result={success:true,files:{}};
    Object.keys(ids).forEach(key=>{
      const file=DriveApp.getFileById(ids[key]);
      const blob=file.getBlob();
      result.files[key]={
        id:ids[key],
        name:file.getName(),
        mimeType:blob.getContentType()||'',
        size:blob.getBytes().length,
        url:file.getUrl()
      };
    });
    return result;
  }catch(e){
    return {success:false,message:driveError_(e)};
  }
}

function getLandingImages() {
  try {
    const ids = {
      logo: '1aPg0foc5qygX-VqGpFlQ0kn1Ogbb52iT',
      hero: '1Vo4IeV5NMGkzEPA7z1UeiTHwkbiJWjm2'
    };
    return ok_('Gambar landing page berhasil dimuat.', {
      logo: driveFileDataUrl_(ids.logo),
      hero: driveFileDataUrl_(ids.hero)
    });
  } catch (e) {
    console.error(e);
    return fail_('Gambar landing page tidak dapat dimuat. Pastikan file Drive dapat diakses oleh akun pemilik Web App.');
  }
}

function driveFileDataUrl_(fileId) {
  const id = String(fileId || '').trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('ID file Drive tidak valid.');
  const file = DriveApp.getFileById(id);
  const blob = file.getBlob();
  const bytes = blob.getBytes();
  if (!bytes.length) throw new Error('File Drive kosong: ' + id);
  const contentType = blob.getContentType() || 'application/octet-stream';
  return 'data:' + contentType + ';base64,' + Utilities.base64Encode(bytes);
}

function setupDatabase() {
  try {
    requireMaintenance_();
    const ss = getDb_(true);
    Object.keys(COG.HEADERS).forEach(name => ensureSheet_(ss,name,COG.HEADERS[name]));
    const defaults = {
      NAMA_PROGRAM:'COGNIORA',
      TAGLINE:'Learning, Progress, and Growth.',
      EMAIL_ADMIN:Session.getEffectiveUser().getEmail() || '',
      CALENDAR_ID:'',
      LINK_GRUP_ALUMNI:'',
      ROOT_FOLDER_ID:'',
      TOTAL_PERTEMUAN_PROGRAM:'16',
      CERTIFICATE_TEMPLATE_ID:COG.CERTIFICATE.DEFAULT_TEMPLATE_ID,
      CERTIFICATE_TEMPLATE_VERSION:COG.CERTIFICATE.DEFAULT_TEMPLATE_VERSION,
      CERTIFICATE_NUMBER_PREFIX:COG.CERTIFICATE.DEFAULT_NUMBER_PREFIX
    };
    Object.keys(defaults).forEach(k => {
      if (!findSetting_(k)) append_(COG.SHEETS.SETTINGS,{Key:k,Value:defaults[k]});
    });
    removeCertificateQrSetting_();
    initSecurity_();
    return ok_('Database COGNIORA berhasil disiapkan.',{spreadsheetId:ss.getId(),spreadsheetName:ss.getName(),url:ss.getUrl(),fixedDatabase:true});
  } catch(e){ return fail_('Setup database gagal: '+err_(e)); }
}

function setupDriveStructure() {
  try {
    requireMaintenance_();
    const root=ensureCognioraRoot_();
    const students=root && folder_(root,'Students');
    const materials=root && folder_(root,'Materials');
    folder_(materials,'PDF'); folder_(materials,'Audio'); folder_(materials,'Other');
    folder_(root,'Certificates');
    return ok_('Struktur Google Drive berhasil disiapkan.',{rootId:root.getId(),studentsId:students.getId(),url:root.getUrl()});
  } catch(e) {
    return fail_('Setup Drive gagal: '+err_(e));
  }
}

/**
 * Run this once from the Apps Script editor under the deployment owner account.
 * It forces the Drive authorization prompt when the project has not yet been
 * authorized to use Google Drive.
 */
function authorizeDriveAccess(){
  try{
    const root=DriveApp.getRootFolder();
    return ok_('Akses Google Drive berhasil diotorisasi.',{rootName:root.getName()});
  }catch(e){
    return fail_('Otorisasi Google Drive gagal: '+driveError_(e));
  }
}

function setupLmsSchema(){
  try{
    requireMaintenance_();
    const ss=getDb_(true);
    Object.keys(COG.HEADERS).forEach(name=>ensureSheet_(ss,name,COG.HEADERS[name]));
    return ok_('Schema LMS diperiksa dan dilengkapi.',{sheets:Object.keys(COG.HEADERS)});
  }catch(e){return fail_('Setup schema LMS gagal: '+err_(e));}
}

function connectExistingCognioraRoot(folderId){
  try{
    requireMaintenance_();
    const id=String(folderId||'').trim();
    if(!id)throw new Error('Folder ID belum diisi.');
    const root=DriveApp.getFolderById(id);
    const students=folder_(root,'Students');
    const materials=folder_(root,'Materials');
    folder_(materials,'PDF');folder_(materials,'Audio');folder_(materials,'Other');
    folder_(root,'Certificates');
    setSetting_('ROOT_FOLDER_ID',root.getId());
    return ok_('Folder COGNIORA berhasil dihubungkan.',{rootId:root.getId(),rootName:root.getName(),studentsId:students.getId(),url:root.getUrl()});
  }catch(e){return fail_('Gagal menghubungkan folder COGNIORA: '+err_(e));}
}

function syncStudentFolders(){
  try{
    requireMaintenance_();
    const students=rows_(COG.SHEETS.STUDENTS),results=[];
    students.forEach(st=>{
      const id=String(st.ID_Siswa||'').trim(),name=String(st.Nama_Lengkap||'').trim(),email=normEmail_(st.Email);
      if(!id||!name||!validEmail_(email)){results.push({email,status:'skipped',message:'Data siswa belum lengkap.'});return;}
      if(st.ID_Folder_Drive){
        try{
          const f=DriveApp.getFolderById(String(st.ID_Folder_Drive));
          ['Assignments','Payment','Reports','Certificate','Profile'].forEach(x=>folder_(f,x));
          results.push({email,id,status:'existing',folderId:f.getId(),folderUrl:f.getUrl()});
          return;
        }catch(e){}
      }
      const f=createStudentFolder_(id,name);
      update_(COG.SHEETS.STUDENTS,st._row,{ID_Folder_Drive:f.getId()});
      results.push({email,id,status:'created',folderId:f.getId(),folderUrl:f.getUrl()});
    });
    return ok_('Sinkronisasi folder siswa selesai.',{totalStudents:students.length,results});
  }catch(e){return fail_('Sinkronisasi folder siswa gagal: '+err_(e));}
}

function normalizeMonthLabel_(v){
  const s=String(v??'').trim();
  const m=s.match(/(\d+)/);
  return m?'Month '+Number(m[1]):s||'Month 1';
}
function isActiveValue_(v){const s=String(v??'').trim();return s===''?true:bool_(v);}
function taskStatusForSubmission_(v){
  const n=norm_(v);
  if(['sudah dinilai','assessed','graded'].includes(n))return 'Assessed';
  if(['perlu revisi','needs revision','revision required'].includes(n))return 'Needs Revision';
  if(['sedang dinilai','under assessment','under review','submitted'].includes(n))return 'Under Assessment';
  return 'Not Submitted';
}
function id_(prefix){return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase();}

function insertDemoData() {
  try {
    requireMaintenance_();
    if(!findRow_(COG.SHEETS.STUDENTS,'Email','demo@cogniora.local')){
      createStudentInternal_({id:'STUDENT-001',name:'Ahsani Demo',email:'demo@cogniora.local',pin:'123456',wa:'081111111111',activeMonth:2,meeting:6,status:'Belum Lulus'});
    }
    if(!rows_(COG.SHEETS.MATERIALS).length){
      append_(COG.SHEETS.MATERIALS,{ID_Materi:'MAT-001',Syarat_Pertemuan:1,Kategori:'PDF',Judul_Materi:'Self Introduction',Deskripsi:'Materi pengantar self introduction.',Link_Akses:'https://drive.google.com/',Status_Aktif:true});
      append_(COG.SHEETS.MATERIALS,{ID_Materi:'MAT-002',Syarat_Pertemuan:3,Kategori:'VIDEO',Judul_Materi:'Daily Conversation',Deskripsi:'Video percakapan sehari-hari.',Link_Akses:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',Status_Aktif:true});
      append_(COG.SHEETS.MATERIALS,{ID_Materi:'MAT-003',Syarat_Pertemuan:8,Kategori:'AUDIO',Judul_Materi:'Listening Practice',Deskripsi:'Listening practice.',Link_Akses:'',Status_Aktif:true});
    }
    if(!findRow_(COG.SHEETS.TASKS,'ID_Tugas','TASK-001')){
      const d=new Date(Date.now()+86400000);
      append_(COG.SHEETS.TASKS,{ID_Tugas:'TASK-001',Email_Siswa:'demo@cogniora.local',Topik_Tugas:'Introduce Yourself',Deskripsi_Tugas:'Buat video self-introduction 60 detik.',Link_File:'',Tanggal_Submission:'',Status_Penilaian:'Belum Dinilai',Nilai:'',Feedback:'',Deadline:d});
      const d2=new Date(Date.now()+7*86400000);
      append_(COG.SHEETS.TASKS,{ID_Tugas:'TASK-002',Email_Siswa:'demo@cogniora.local',Topik_Tugas:'Daily Routine',Deskripsi_Tugas:'Tulis 10 kalimat daily routine.',Link_File:'',Tanggal_Submission:'',Status_Penilaian:'Belum Dinilai',Nilai:'',Feedback:'',Deadline:d2});
    }
    if(!findRow_(COG.SHEETS.PAYMENTS,'ID_Tagihan','INV-001')){
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+1);
      append_(COG.SHEETS.PAYMENTS,{ID_Tagihan:'INV-001',Email_Siswa:'demo@cogniora.local',Bulan_Program:'Month 1',Nominal_Tagihan:350000,Tanggal_Jatuh_Tempo:d,Status_Payment:'Lunas',Link_Bukti_Transfer:''});
      const d2=new Date(d); d2.setMonth(d2.getMonth()+1);
      append_(COG.SHEETS.PAYMENTS,{ID_Tagihan:'INV-002',Email_Siswa:'demo@cogniora.local',Bulan_Program:'Month 2',Nominal_Tagihan:350000,Tanggal_Jatuh_Tempo:d2,Status_Payment:'Belum Bayar',Link_Bukti_Transfer:''});
    }
    if(!rows_(COG.SHEETS.SCHEDULE).length){
      const s=new Date(Date.now()+2*86400000); s.setHours(19,0,0,0); const e=new Date(s);e.setMinutes(90);
      append_(COG.SHEETS.SCHEDULE,{ID_Sesi:'SESSION-001',Nama_Kegiatan:'English Speaking Class',Waktu_Mulai:s,Waktu_Selesai:e,Link_Meet:'https://meet.google.com/',Status_Reminder_WA:'Belum'});
      const s2=new Date(s);s2.setDate(s2.getDate()+7);const e2=new Date(s2);e2.setMinutes(90);
      append_(COG.SHEETS.SCHEDULE,{ID_Sesi:'SESSION-002',Nama_Kegiatan:'English Listening Class',Waktu_Mulai:s2,Waktu_Selesai:e2,Link_Meet:'https://meet.google.com/',Status_Reminder_WA:'Belum'});
    }
    if(!rows_(COG.SHEETS.REPORTS).length){
      append_(COG.SHEETS.REPORTS,{Email_Siswa:'demo@cogniora.local',Bulan_Evaluasi:'Month 1',Link_PDF_Rapor:'https://drive.google.com/'});
      append_(COG.SHEETS.REPORTS,{Email_Siswa:'demo@cogniora.local',Bulan_Evaluasi:'Month 2',Link_PDF_Rapor:'https://drive.google.com/'});
    }
    return ok_('Demo data berhasil dibuat.',{email:'demo@cogniora.local',pin:'123456'});
  } catch(e){ return fail_('Demo data gagal: '+err_(e)); }
}

function createStudent(p, adminToken){
  try{
    requireAdminSession_(adminToken);
    return createStudentInternal_(p);
  }catch(e){return fail_('Gagal membuat siswa: '+err_(e));}
}



function generatePassword_(length){
  const n=Math.max(4,Math.min(64,Number(length)||10));
  const raw=(Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'')).slice(0,n);
  return raw.slice(0,1).toUpperCase()+raw.slice(1);
}
function nextStudentId_(){
  const prefix='CGN-'+Utilities.formatDate(new Date(),tz_(),'yyyy')+'-';
  let max=0;
  rows_(COG.SHEETS.STUDENTS).forEach(r=>{const id=String(r.ID_Siswa||'');if(id.indexOf(prefix)===0){const n=Number(id.slice(prefix.length));if(isFinite(n))max=Math.max(max,n);}});
  return prefix+String(max+1).padStart(4,'0');
}

function getSystemConfig(){
  const s=getSettings_();
  return ok_('Konfigurasi dimuat.',{
    programName:s.NAMA_PROGRAM||COG.NAME,tagline:s.TAGLINE||'Learning, Progress, and Growth.',
    totalMeetings:Number(s.TOTAL_PERTEMUAN_PROGRAM||16),alumniLink:safeUrl_(s.LINK_GRUP_ALUMNI||'')
  });
}

function registerLead(p){
  try{
    const name=text_(p&&p.name,120), email=normEmail_(p&&p.email), wa=normPhone_(p&&p.wa), program=text_(p&&p.program,120), message=text_(p&&p.message,1500);
    const allowedPrograms=['Speaking','Regular','Private','Online Class'];
    if(name.length<2||!validEmail_(email)||!program) return fail_('Data pendaftaran belum lengkap.');
    if(!allowedPrograms.includes(program)) return fail_('Program yang dipilih tidak valid.');
    if(wa && !/^\d{8,15}$/.test(wa)) return fail_('Nomor WhatsApp tidak valid.');
    const c=CacheService.getScriptCache(), key='lead:'+sha_(email);
    if(c.get(key)) return fail_('Pendaftaran baru saja dikirim.'); c.put(key,'1',600);
    append_(COG.SHEETS.LEADS,{Nama:name,Email:email,Nomor_WA:wa,Program_Diminati:program,Pesan:message,Created_At:new Date(),Status:'New'});
    const admin=getSettings_().EMAIL_ADMIN;
    if(validEmail_(admin)){try{MailApp.sendEmail({to:admin,subject:'COGNIORA — Lead baru: '+name,htmlBody:'<p>Lead baru.</p><p><b>Nama:</b> '+h_(name)+'<br><b>Email:</b> '+h_(email)+'<br><b>WA:</b> '+h_(wa||'-')+'<br><b>Program:</b> '+h_(program)+'</p>'})}catch(e){console.log(e)}}
    return ok_('Pendaftaran berhasil dikirim.');
  }catch(e){return fail_('Pendaftaran gagal: '+err_(e));}
}

function loginStudent(email,password){
  try{
    const em=normEmail_(email), pw=String(password??'').trim();
    if(!validEmail_(em)||pw.length<4||pw.length>64)return fail_('Email atau password salah.');
    const cache=CacheService.getScriptCache(),rk='loginfail:'+sha_(em),attempts=Number(cache.get(rk)||0);
    if(attempts>=5)return fail_('Terlalu banyak percobaan. Coba lagi setelah beberapa menit.');

    // Pastikan kolom Terms tersedia sebelum membaca status persetujuan.
    ensureStudentTermsSchema_();
    let st=findRow_(COG.SHEETS.STUDENTS,'Email',em);
    const stored=st?String(st.Password_PIN??'').trim():'';
    if(!st||!stored||stored!==pw){cache.put(rk,String(attempts+1),600);return fail_('Email atau password salah.');}

    // Kompatibilitas untuk siswa yang sudah menyetujui pada versi sebelumnya
    // tetapi kolom versi belum terisi. Persetujuan yang sudah ada tetap dihormati
    // selama Terms of Service masih pada versi yang sama.
    if(termsAcceptedValue_(st.Terms_Agreed) && !String(st.Terms_Version??'').trim()){
      update_(COG.SHEETS.STUDENTS,st._row,{Terms_Agreed:'Agreed',Terms_Version:COG.TERMS.VERSION,Terms_Agreed_At:st.Terms_Agreed_At||new Date()});
      st=findRow_(COG.SHEETS.STUDENTS,'Email',em)||st;
    }

    cache.remove(rk);
    const token=createSession_(st,'student');
    return ok_('Login berhasil.',{token:token.token,expiresAt:token.exp,student:safeStudent_(st)});
  }catch(e){console.log(e);return fail_('Login gagal.');}
}

function testLoginStudent(email,password){
  try{
    const r=loginStudent(email,password);
    if(!r.success)return r;
    return ok_('Login siswa berhasil diuji.',{student:r.data.student,expiresAt:r.data.expiresAt});
  }catch(e){return fail_('Test login gagal: '+err_(e));}
}

function validateSession(token){
  try{
    const s=requireStudentSession_(token);
    ensureStudentTermsSchema_();
    const st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Akun siswa tidak ditemukan.');
    if(termsAcceptedValue_(st.Terms_Agreed) && !String(st.Terms_Version??'').trim()){
      update_(COG.SHEETS.STUDENTS,st._row,{Terms_Agreed:'Agreed',Terms_Version:COG.TERMS.VERSION,Terms_Agreed_At:st.Terms_Agreed_At||new Date()});
      const refreshed=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
      return ok_('Sesi siswa valid.',{student:safeStudent_(refreshed||st),expiresAt:s.exp});
    }
    return ok_('Sesi siswa valid.',{student:safeStudent_(st),expiresAt:s.exp});
  }catch(e){return fail_(err_(e));}
}

function logoutSession(token){
  try{invalidateToken_(token);return ok_('Logout berhasil.');}
  catch(e){return ok_('Sesi ditutup.');}
}


/* -------------------- admin authentication and lead conversion -------------------- */

/**
 * Admin credentials are stored manually in Data_Admin.
 * Expected headers:
 * ID_Admin | Nama_Admin | Email | Password | Role | Status
 */
function loginAdmin(email,password){
  try{
    initSecurity_();
    const em=normEmail_(email),pw=String(password??'').trim();
    if(!validEmail_(em)||pw.length<1||pw.length>128)return fail_('Email atau password admin salah.');

    const cache=CacheService.getScriptCache(),rk='adminloginfail:'+sha_(em),attempts=Number(cache.get(rk)||0);
    if(attempts>=5)return fail_('Terlalu banyak percobaan admin. Coba lagi setelah beberapa menit.');

    const row=findRow_(COG.SHEETS.ADMINS,'Email',em);
    if(!row || norm_(row.Status)!=='aktif' || norm_(row.Role)!=='admin' || String(row.Password??'').trim()!==pw){
      cache.put(rk,String(attempts+1),600);
      return fail_('Email atau password admin salah.');
    }

    cache.remove(rk);
    const admin={
      id:String(row.ID_Admin||''),
      name:String(row.Nama_Admin||''),
      email:em,
      role:'admin'
    };
    const token=createAdminSession_(admin);
    return ok_('Login admin berhasil.',{token:token.token,expiresAt:token.exp,admin});
  }catch(e){console.error(e);return fail_('Login admin gagal: '+err_(e));}
}

function validateAdminSession(token){
  try{
    const s=requireAdminSession_(token);
    const row=findRow_(COG.SHEETS.ADMINS,'Email',s.email);
    if(!row || norm_(row.Status)!=='aktif' || norm_(row.Role)!=='admin')throw new Error('Akun admin tidak aktif atau tidak ditemukan.');
    return ok_('Sesi admin valid.',{admin:{id:String(row.ID_Admin||''),name:String(row.Nama_Admin||''),email:s.email,role:'admin'},expiresAt:s.exp});
  }catch(e){return fail_(err_(e));}
}

function logoutAdminSession(token){
  try{invalidateToken_(token);return ok_('Logout admin berhasil.');}
  catch(e){return ok_('Sesi admin ditutup.');}
}

function getAdminOverview(token){
  try{
    requireAdminSession_(token);
    const leads=rows_(COG.SHEETS.LEADS),students=rows_(COG.SHEETS.STUDENTS),payments=rows_(COG.SHEETS.PAYMENTS);
    return ok_('Overview admin dimuat.',{leadsTotal:leads.length,leadsNew:leads.filter(r=>norm_(r.Status)==='new').length,leadsConverted:leads.filter(r=>norm_(r.Status)==='converted').length,studentsTotal:students.length,paymentsPending:payments.filter(r=>norm_(r.Status_Payment)==='menunggu verifikasi').length});
  }catch(e){return fail_('Overview admin gagal dimuat: '+err_(e));}
}

function getAdminLeads(token){
  try{
    requireAdminSession_(token);
    const list=rows_(COG.SHEETS.LEADS).map(r=>({row:r._row,name:String(r.Nama||''),email:normEmail_(r.Email),phone:normPhone_(r.Nomor_WA||''),program:String(r.Program_Diminati||''),message:String(r.Pesan||''),createdAt:dt_(r.Created_At),status:String(r.Status||'New')}));
    return ok_('Data leads dimuat.',list);
  }catch(e){return fail_('Data leads gagal dimuat: '+err_(e));}
}



function getDashboardData(token){
  try{
    const s=requireSession_(token), st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email); if(!st) return fail_('Data siswa tidak ditemukan.');
    const progress=progress_(st), classes=schedule_(), tasks=assignments_(s.email), pay=payments_(s.email), reports=reports_(st), cert=certificate_(st);
    return ok_('Dashboard berhasil dimuat.',{
      student:safeStudent_(st),progress,upcomingClasses:classes.slice(0,5),recentAssignments:tasks.slice(0,5),
      paymentSummary:pay.summary,availableReports:reports,certificate:cert,
      alumni:{active:cert.status==='available'&&!!getSettings_().LINK_GRUP_ALUMNI,link:safeUrl_(getSettings_().LINK_GRUP_ALUMNI||'')}
    });
  }catch(e){return fail_('Dashboard gagal dimuat: '+err_(e));}
}

function getStudentProfile(token){
  try{const s=requireSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);return st?ok_('Profil dimuat.',Object.assign(safeStudent_(st),{photo:studentPhotoDataUrl_(st.Foto_Profil||'')})):fail_('Data siswa tidak ditemukan.')}
  catch(e){return fail_('Profil gagal dimuat: '+err_(e));}
}

function getStudentPhoto(token){
  try{
    const s=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Data siswa tidak ditemukan.');
    return ok_('Foto profil dimuat.',{photo:studentPhotoDataUrl_(st.Foto_Profil||'')});
  }catch(e){return fail_('Foto profil gagal dimuat: '+err_(e));}
}

function resolveUploadArgs_(token,form){
  if(form===undefined && token && typeof token==='object'){
    form=token;
    token=formValue_(form,'token');
  }
  token=String(token??'').trim();
  if(!token)throw new Error('Sesi siswa tidak ditemukan pada upload form.');
  return {token,form};
}

function formValue_(form,name){
  if(!form || !name)return '';
  const value=form[name];
  return typeof value==='string' ? value.trim() : String(value??'').trim();
}

function saveStudentProfilePhoto(token,form){
  try{
    const args=resolveUploadArgs_(token,form),sessionToken=args.token,uploadForm=args.form;
    const s=requireStudentSession_(sessionToken),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Data siswa tidak ditemukan.');
    const blob=uploadForm&&uploadForm.file;
    validateProfileImage_(blob);
    const root=ensureStudentRootFolder_(st),dir=folder_(root,'Profile');
    const oldStored=String(st.Foto_Profil||'').trim();
    const fileName='PROFILE-'+String(st.ID_Siswa||'STUDENT')+'-'+Utilities.formatDate(new Date(),tz_(),'yyyyMMdd-HHmmss')+'-'+safeFile_(blob.getName());
    const file=dir.createFile(blob.copyBlob().setName(fileName));
    file.setDescription('COGNIORA profile picture\nStudent: '+s.email);
    const oldId=driveFileId_(oldStored);
    if(oldId && oldId!==file.getId()){
      try{DriveApp.getFileById(oldId).setTrashed(true);}catch(e){console.log('Old profile photo warning: %s',e);}
    }
    update_(COG.SHEETS.STUDENTS,st._row,{Foto_Profil:file.getId()});
    const photo=driveFileDataUrl_(file.getId());
    return ok_('Foto profil berhasil diperbarui.',{photo,driveFileId:file.getId(),fileName:file.getName()});
  }catch(e){return fail_('Upload foto profil gagal: '+err_(e));}
}

function getMaterials(token){try{const x=requireActiveStudent_(token);return ok_('Materi dimuat.',materials_(x.student));}
  catch(e){return fail_('Materi gagal dimuat: '+err_(e));}}

function getAssignments(token){try{const x=requireActiveStudent_(token);return ok_('Tugas dimuat.',assignments_(x.session.email));}
  catch(e){return fail_('Tugas gagal dimuat: '+err_(e));}}

function submitAssignment(token,form){
  try{
    const args=resolveUploadArgs_(token,form),sessionToken=args.token,uploadForm=args.form;
    const s=requireSession_(sessionToken), taskId=text_(uploadForm&&uploadForm.taskId,100), task=findRow_(COG.SHEETS.TASKS,'ID_Tugas',taskId);
    if(!task||normEmail_(task.Email_Siswa)!==s.email) return fail_('Tugas tidak ditemukan atau bukan milik Anda.');
    if(norm_(task.Status_Penilaian)==='sudah dinilai') return fail_('Tugas yang sudah dinilai tidak dapat dikirim ulang.');
    const blob=uploadForm&&uploadForm.file; validateBlob_(blob);
    const st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email), root=ensureStudentRootFolder_(st), dir=folder_(root,'Assignments');
    const name='TASK-'+taskId+'-'+Utilities.formatDate(new Date(),tz_(),'yyyyMMdd-HHmmss')+'-'+safeFile_(blob.getName());
    const file=dir.createFile(blob.copyBlob().setName(name));
    file.setDescription('COGNIORA assignment submission\nStudent: '+s.email+'\nTask: '+taskId+'\nType: '+text_(uploadForm.jenis,50)+'\nNote: '+text_(uploadForm.catatan,1000));
    update_(COG.SHEETS.TASKS,task._row,{Link_File:file.getUrl(),Tanggal_Submission:new Date(),Status_Penilaian:'Belum Dinilai'});
    return ok_('Tugas berhasil dikirim.',{url:file.getUrl()});
  }catch(e){return fail_('Pengiriman tugas gagal: '+err_(e));}
}

function uploadStudentFile(token,form){
  try{
    const args=resolveUploadArgs_(token,form),sessionToken=args.token,uploadForm=args.form;
    const purpose=norm_(uploadForm&&uploadForm.purpose);
    return purpose==='assignment'?submitAssignment(sessionToken,uploadForm):purpose==='payment'?uploadPaymentProof(sessionToken,uploadForm):fail_('Jenis upload tidak dikenali.');
  }catch(e){
    return fail_('Upload siswa gagal: '+err_(e));
  }
}

function getSchedule(token){try{requireSession_(token);return ok_('Jadwal dimuat.',schedule_())}catch(e){return fail_('Jadwal gagal dimuat: '+err_(e));}}
function getUpcomingClasses(token){return getSchedule(token)}

function getPayments(token){try{const s=requireSession_(token);return ok_('Pembayaran dimuat.',payments_(s.email))}catch(e){return fail_('Pembayaran gagal dimuat: '+err_(e));}}

function uploadPaymentProof(token,form){
  try{
    const args=resolveUploadArgs_(token,form),sessionToken=args.token,uploadForm=args.form;
    const s=requireStudentSession_(sessionToken);
    const id=text_(uploadForm&&uploadForm.invoiceId,100);
    const row=findRow_(COG.SHEETS.PAYMENTS,'ID_Tagihan',id);
    if(!row||normEmail_(row.Email_Siswa)!==s.email)return fail_('Invoice not found or does not belong to you.');

    const current=paymentDisplayStatus_(row.Status_Payment||'');
    if(current==='Paid')return fail_('This payment has already been accepted.');
    if(current==='Under Verification')return fail_('Payment proof is already submitted and under verification.');

    const blob=uploadForm&&uploadForm.file;
    validateBlob_(blob);
    const st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Student data not found.');
    const root=ensureStudentRootFolder_(st),dir=folder_(root,'Payment');
    const submittedAt=new Date();
    const name='PAY-'+id+'-'+Utilities.formatDate(submittedAt,tz_(),'yyyyMMdd-HHmmss')+'-'+safeFile_(blob.getName());
    const file=dir.createFile(blob.copyBlob().setName(name));
    file.setDescription('COGNIORA payment proof\nStudent: '+s.email+'\nInvoice: '+id);
    update_(COG.SHEETS.PAYMENTS,row._row,{Link_Bukti_Transfer:file.getUrl(),Status_Payment:'Menunggu Verifikasi'});

    return ok_('Payment proof has been submitted.',{url:file.getUrl(),status:'Under Verification',submittedAt:dt_(submittedAt)});
  }catch(e){return fail_('Payment proof submission failed: '+err_(e));}
}

function getReports(token){
  try{const s=requireSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);return ok_('Rapor dimuat.',reports_(st))}
  catch(e){return fail_('Rapor gagal dimuat: '+err_(e));}
}

function getCertificate(token){
  try{const s=requireSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);return ok_('Sertifikat dimuat.',certificate_(st))}
  catch(e){return fail_('Sertifikat gagal dimuat: '+err_(e));}
}

function sendEmailReminder(to,subject,message){
  try{
    requireMaintenance_();
    const email=normEmail_(to);
    if(!validEmail_(email))return fail_('Alamat email tidak valid.');
    const sub=text_(subject,200)||'COGNIORA Reminder';
    const body=text_(message,5000);
    MailApp.sendEmail({to:email,subject:sub,htmlBody:'<div style="font-family:Arial,sans-serif;line-height:1.6">'+h(body).replace(/\\n/g,'<br>')+'</div>'});
    return ok_('Email reminder berhasil dikirim.');
  }catch(e){return fail_('Email reminder gagal: '+err_(e));}
}
function sendWhatsAppReminder(phone,message){
  try{
    requireMaintenance_();
    const p=normPhone_(phone);
    if(!/^\\d{8,15}$/.test(p))return fail_('Nomor WhatsApp tidak valid.');
    return sendWa_(p,text_(message,2000));
  }catch(e){return fail_('WhatsApp reminder gagal: '+err_(e));}
}
function sendClassReminder(){
  try{requireMaintenance_();scheduleReminders_();return ok_('Class reminder diproses.');}
  catch(e){return fail_('Class reminder gagal: '+err_(e));}
}

function syncCalendarToSheet(){
  try{
    requireMaintenance_();
    return syncCalendarCore_();
  }catch(err){
    return fail_('Sinkronisasi kalender gagal.',err_(err));
  }
}

function installReminderTriggers(){
  try{
    requireMaintenance_();
    ScriptApp.getProjectTriggers().forEach(t=>{if(['runScheduledReminders','runScheduledCalendarSync'].includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t)});
    ScriptApp.newTrigger('runScheduledReminders').timeBased().everyHours(1).create();
    ScriptApp.newTrigger('runScheduledCalendarSync').timeBased().everyDays(1).create();
    return ok_('Trigger reminder dan calendar berhasil dipasang.');
  }catch(e){return fail_('Gagal memasang trigger: '+err_(e));}
}

function runScheduledReminders(e){
  if(!validTrigger_(e))return;
  try{scheduleReminders_();}catch(err){console.error(err);}
}

function testConfiguration(){
  try{
    requireMaintenance_();
    const s=getSettings_(),db=getDb_();
    let drive=false,driveError='';
    if(!s.ROOT_FOLDER_ID){
      driveError='ROOT_FOLDER_ID belum tersedia.';
    }else{
      try{drive=!!DriveApp.getFolderById(s.ROOT_FOLDER_ID);}catch(e){driveError=driveError_(e);}
    }
    let calendar=false,calendarError='';
    if(s.CALENDAR_ID){
      try{calendar=!!CalendarApp.getCalendarById(s.CALENDAR_ID);}catch(e){calendarError=err_(e);}
    }
    return ok_('Konfigurasi diperiksa.',{
      database:true,
      spreadsheetId:db.getId(),
      spreadsheetName:db.getName(),
      expectedSpreadsheetId:COG.DATABASE_ID,
      expectedSpreadsheetName:COG.DATABASE_NAME,
      databaseMatch:db.getId()===COG.DATABASE_ID,
      drive,
      driveError,
      calendar,
      calendarError,
      adminEmail:validEmail_(s.EMAIL_ADMIN||'')
    });
  }catch(e){return fail_('Test konfigurasi gagal: '+err_(e));}
}

function onOpen(){
  try{
    SpreadsheetApp.getUi()
      .createMenu('COGNIORA')
      .addItem('Setup Database','setupDatabase')
      .addItem('Setup Drive','setupDriveStructure')
      .addItem('Authorize Drive','authorizeDriveAccess')
      .addItem('Demo Data','insertDemoData')
      .addItem('Test Configuration','testConfiguration')
      .addItem('Install Reminders','installReminderTriggers')
      .addItem('Sync Calendar','syncCalendarToSheet')
      .addItem('Certificate Schema','setupCertificateSchema')
      .addItem('Certificate Config','configureCertificateSettings')
      .addItem('Test Certificate','testCertificateConfiguration')
      .addItem('Seed Basic Topics','seedBasicCertificateTopics')
      .addToUi();
  }catch(e){}
}

/* -------------------- private helpers -------------------- */

function ensureCognioraRoot_(){
  // Make sure the settings sheet exists before reading/writing ROOT_FOLDER_ID.
  const ss=getDb_(true);
  ensureSheet_(ss,COG.SHEETS.SETTINGS,COG.HEADERS[COG.SHEETS.SETTINGS]);

  let root=null;
  const s=getSettings_();
  const storedId=String(s.ROOT_FOLDER_ID||'').trim();

  if(storedId){
    try{
      root=DriveApp.getFolderById(storedId);
    }catch(e){
      // The stored folder may have been deleted or access may have changed.
      root=null;
    }
  }

  try{
    if(!root){
      const home=DriveApp.getRootFolder();
      const it=home.getFoldersByName(COG.NAME);
      root=it.hasNext()?it.next():home.createFolder(COG.NAME);
      setSetting_('ROOT_FOLDER_ID',root.getId());
    }

    const students=folder_(root,'Students');
    const materials=folder_(root,'Materials');
    folder_(materials,'PDF');
    folder_(materials,'Audio');
    folder_(materials,'Other');
    folder_(root,'Certificates');

    // Persist the valid root even when the old setting was stale.
    if(storedId!==root.getId())setSetting_('ROOT_FOLDER_ID',root.getId());
    return root;
  }catch(e){
    throw new Error(driveError_(e));
  }
}

function driveError_(e){
  const msg=err_(e);
  return 'Google Drive COGNIORA tidak dapat digunakan. Pastikan akun pemilik Web App sudah memberikan izin Google Drive, deployment menggunakan USER_DEPLOYING, dan folder root masih dapat diakses. Detail: '+msg;
}

function studentFolderName_(id,name){
  const cleanId=String(id||'').trim();
  const cleanName=String(name||'Student').trim().replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').slice(0,150) || 'Student';
  return cleanId+' - '+cleanName;
}

function studentDriveFolder_(id,name){
  const root=ensureCognioraRoot_();
  const students=folder_(root,'Students');
  const f=folder_(students,studentFolderName_(id,name));
  ['Assignments','Payment','Reports','Certificate','Profile'].forEach(x=>folder_(f,x));
  return f;
}

function getDb_(create){
  if(COG_RUNTIME.db)return COG_RUNTIME.db;
  const id=String(COG.DATABASE_ID||'').trim();
  if(!id)throw new Error('COG.DATABASE_ID belum dikonfigurasi.');
  try{COG_RUNTIME.db=SpreadsheetApp.openById(id);return COG_RUNTIME.db;}
  catch(e){throw new Error('Database COGNIORA tidak dapat dibuka. Pastikan Spreadsheet ID benar dan akun pemilik Web App memiliki akses ke spreadsheet "'+COG.DATABASE_NAME+'" ('+id+'). Detail: '+err_(e));}
}
function sheet_(name){
  const key=String(name||'');
  if(COG_RUNTIME.sheets[key])return COG_RUNTIME.sheets[key];
  const s=getDb_().getSheetByName(key);
  if(!s)throw new Error('Sheet tidak ditemukan: '+key);
  COG_RUNTIME.sheets[key]=s;
  return s;
}
function map_(sheet){const a=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0],m={};a.forEach((h,i)=>{if(String(h||'').trim())m[String(h).trim()]=i});return m}
function rows_(name){
  const key=String(name||'');
  if(Object.prototype.hasOwnProperty.call(COG_RUNTIME.rows,key))return COG_RUNTIME.rows[key];
  const useScriptCache=COG_CACHE.CACHED_SHEETS.has(key);
  const ck=cacheKeyRows_(key),sc=CacheService.getScriptCache();
  if(useScriptCache){try{const cached=sc.get(ck);if(cached){const parsed=JSON.parse(cached);COG_RUNTIME.rows[key]=parsed;return parsed;}}catch(e){}}
  const s=sheet_(key),m=map_(s),lr=s.getLastRow(),lc=s.getLastColumn();
  if(lr<2){COG_RUNTIME.rows[key]=[];return COG_RUNTIME.rows[key];}
  const result=s.getRange(2,1,lr-1,lc).getValues().map((r,i)=>{const o={_row:i+2};Object.keys(m).forEach(k=>o[k]=r[m[k]]);return o;});
  COG_RUNTIME.rows[key]=result;
  if(useScriptCache){try{const payload=JSON.stringify(result);if(payload.length<=COG_CACHE.MAX_ITEM)sc.put(ck,payload,COG_CACHE.TTL);}catch(e){}}
  return result;
}
function rowsOptional_(name){try{return rows_(name)}catch(e){return []}}

// Certificate support schema helpers kept in the performance-optimized build.
// These functions are required by dashboard/certificate lookups and setup actions.
function setupCertificateSchema(){
  const ss=getDb_(true);
  ['Data_Sertifikat','Data_Sertifikat_Log','Data_Sertifikat_Nilai','Data_Topik_Bulanan']
    .forEach(name=>ensureSheet_(ss,name,COG.HEADERS[name]));
  return true;
}

function ensureCertificateSupportSheets_(){
  const ss=getDb_(true);
  ['Data_Sertifikat','Data_Sertifikat_Log','Data_Sertifikat_Nilai','Data_Topik_Bulanan']
    .forEach(name=>ensureSheet_(ss,name,COG.HEADERS[name]));
  return true;
}
function findRow_(name,col,val){const n=norm_(val);return rows_(name).find(r=>norm_(r[col])===n)||null}
function append_(name,obj){const s=sheet_(name),m=map_(s),row=new Array(s.getLastColumn()).fill('');Object.keys(obj||{}).forEach(k=>{if(m[k]!=null)row[m[k]]=obj[k]});s.appendRow(row);invalidateRowsCache_(name);return s.getLastRow()}
function update_(name,row,obj){const s=sheet_(name),m=map_(s),r=s.getRange(row,1,1,s.getLastColumn()).getValues()[0];Object.keys(obj||{}).forEach(k=>{if(m[k]!=null)r[m[k]]=obj[k]});s.getRange(row,1,1,s.getLastColumn()).setValues([r]);invalidateRowsCache_(name)}
function deleteRow_(name,row){sheet_(name).deleteRow(row);invalidateRowsCache_(name)}
function ensureSheet_(ss,name,headers){
  let s=ss.getSheetByName(name),changed=false;
  if(!s){s=ss.insertSheet(name);changed=true;}
  const lc=s.getLastColumn(),cur=lc?s.getRange(1,1,1,lc).getValues()[0].map(String):[];
  if(!cur.length){s.getRange(1,1,1,headers.length).setValues([headers]);changed=true;}
  else{const have=cur.map(norm_),add=headers.filter(h=>!have.includes(norm_(h)));if(add.length){s.getRange(1,cur.length+1,1,add.length).setValues([add]);changed=true;}}
  if(changed)s.setFrozenRows(1);
  if(changed)invalidateRowsCache_(name);
}

function settingsRows_(){try{return rows_(COG.SHEETS.SETTINGS)}catch(e){return []}}
function getSettings_(){const s={};settingsRows_().forEach(r=>{if(r.Key)s[String(r.Key)]=String(r.Value??'').trim()});if(!s.NAMA_PROGRAM)s.NAMA_PROGRAM=COG.NAME;if(!s.TAGLINE)s.TAGLINE='Learning, Progress, and Growth.';if(!s.TOTAL_PERTEMUAN_PROGRAM)s.TOTAL_PERTEMUAN_PROGRAM='16';return s}
function findSetting_(k){return settingsRows_().find(r=>norm_(r.Key)===norm_(k))||null}
function setSetting_(k,v){const r=findSetting_(k);if(r)update_(COG.SHEETS.SETTINGS,r._row,{Value:v});else append_(COG.SHEETS.SETTINGS,{Key:k,Value:v})}
function removeCertificateQrSetting_(){
  try{
    const sh=sheet_(COG.SHEETS.SETTINGS);
    const targets=settingsRows_().filter(r=>norm_(r.Key)==='certificate_qr_api').sort((a,b)=>b._row-a._row);
    targets.forEach(r=>deleteRow_(COG.SHEETS.SETTINGS,r._row));
    return targets.length;
  }catch(e){
    console.log('Certificate QR setting cleanup warning: %s',e);
    return 0;
  }
}
function initSecurity_(){
  const p=PropertiesService.getScriptProperties();
  if(!p.getProperty('SESSION_SECRET'))p.setProperty('SESSION_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if(!p.getProperty('WA_AUTH_HEADER'))p.setProperty('WA_AUTH_HEADER','Authorization');
  if(p.getProperty('WA_AUTH_PREFIX')==null)p.setProperty('WA_AUTH_PREFIX','Bearer ');
  if(!p.getProperty('WA_PAYLOAD_TEMPLATE_JSON'))p.setProperty('WA_PAYLOAD_TEMPLATE_JSON','{"phone":"{{phone}}","message":"{{message}}"}');
  return true;
}
function initSecrets_(){return initSecurity_();}
function requireMaintenance_(){if(PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE')!=='ON')throw new Error('MAINTENANCE_MODE harus ON untuk fungsi setup admin.');}
function createSession_(st,role){
  initSecurity_();
  const now=Date.now(),exp=now+(COG.TTL*1000),sid=Utilities.getUuid(),payload={sid,email:normEmail_(st.Email),studentId:String(st.ID_Siswa||''),role:role||'student',iat:now,exp},b64=enc_(JSON.stringify(payload)),sig=hmac_(b64,PropertiesService.getScriptProperties().getProperty('SESSION_SECRET')),token=b64+'.'+sig,key='sess:'+sha_(token);
  CacheService.getScriptCache().put(key,JSON.stringify({email:payload.email,role:payload.role}),COG.TTL);return{token,exp};
}
function createAdminSession_(admin){
  initSecurity_();
  const now=Date.now(),exp=now+(COG.TTL*1000),sid=Utilities.getUuid(),payload={sid,email:normEmail_(admin.email),adminId:String(admin.id||''),adminName:String(admin.name||''),role:'admin',iat:now,exp},b64=enc_(JSON.stringify(payload)),sig=hmac_(b64,PropertiesService.getScriptProperties().getProperty('SESSION_SECRET')),token=b64+'.'+sig,key='sess:'+sha_(token);
  CacheService.getScriptCache().put(key,JSON.stringify({email:payload.email,role:'admin',adminId:payload.adminId}),COG.TTL);return{token,exp};
}
function parseToken_(token){
  try{
    if(typeof token!=='string')return null;const parts=token.split('.'),b=parts[0],s=parts[1];if(!b||!s)return null;initSecurity_();
    const sec=PropertiesService.getScriptProperties().getProperty('SESSION_SECRET'),p=JSON.parse(dec_(b));
    if(!p.sid||!p.email||!p.role||Date.now()>=Number(p.exp))return null;if(hmac_(b,sec)!==s)return null;
    return{email:normEmail_(p.email),studentId:String(p.studentId||''),adminId:String(p.adminId||''),adminName:String(p.adminName||''),role:String(p.role),exp:Number(p.exp),cacheKey:'sess:'+sha_(token)};
  }catch(e){return null;}
}
function requireSession_(token){return requireStudentSession_(token);}
function requireStudentSession_(token){const p=parseToken_(token);if(!p||p.role!=='student')throw new Error('Sesi siswa tidak valid atau sudah berakhir.');if(!CacheService.getScriptCache().get(p.cacheKey))throw new Error('Sesi siswa tidak ditemukan. Silakan login kembali.');return p;}
function requireAdminSession_(token){const p=parseToken_(token);if(!p||p.role!=='admin')throw new Error('Sesi admin tidak valid atau sudah berakhir.');if(!CacheService.getScriptCache().get(p.cacheKey))throw new Error('Sesi admin tidak ditemukan. Silakan login admin kembali.');return p;}
function invalidateToken_(token){const p=parseToken_(token);if(p)CacheService.getScriptCache().remove(p.cacheKey);}

function studentActiveStatus_(st){return norm_(st?.Status_Aktif)==='nonaktif'?'Nonaktif':'Aktif'}
function termsAcceptedValue_(v){return ['agreed','accepted','yes','true','setuju','1'].includes(norm_(v));}
function termsVersionMatches_(v){
  const a=String(v??'').trim(), b=String(COG.TERMS.VERSION).trim();
  if(a===b)return true;
  const na=Number(a), nb=Number(b);
  return !!a && !!b && Number.isFinite(na) && Number.isFinite(nb) && na===nb;
}
function studentTermsAgreed_(st){return termsAcceptedValue_(st?.Terms_Agreed) && termsVersionMatches_(st?.Terms_Version);}
function ensureStudentTermsSchema_(){const ss=getDb_(true);ensureSheet_(ss,COG.SHEETS.STUDENTS,COG.HEADERS[COG.SHEETS.STUDENTS]);return true;}
function acceptTermsOfService(token,version){
  try{
    const s=requireStudentSession_(token);
    ensureStudentTermsSchema_();
    const st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Data siswa tidak ditemukan.');
    const requested=String(version||COG.TERMS.VERSION).trim()||COG.TERMS.VERSION;
    if(requested!==COG.TERMS.VERSION)return fail_('Versi Terms of Service tidak sesuai. Silakan muat ulang halaman.');
    const at=new Date();
    update_(COG.SHEETS.STUDENTS,st._row,{Terms_Agreed:'Agreed',Terms_Agreed_At:at,Terms_Version:COG.TERMS.VERSION});
    const updated=findRow_(COG.SHEETS.STUDENTS,'Email',s.email)||st;
    return ok_('Terms of Service berhasil disetujui.',{student:safeStudent_(updated),agreedAt:dt_(at),version:COG.TERMS.VERSION});
  }catch(e){return fail_('Persetujuan Terms of Service gagal: '+err_(e));}
}
function normalizeBatchStatus_(v){return norm_(v)==='aktif'?'Aktif':'Nonaktif'}
function managementSchema_(){const ss=getDb_(true);ensureSheet_(ss,COG.SHEETS.BATCHES,COG.HEADERS[COG.SHEETS.BATCHES]);ensureSheet_(ss,COG.SHEETS.STUDENTS,COG.HEADERS[COG.SHEETS.STUDENTS]);return true}
function batchProgress_(st){
  let month=Number(st?.Bulan_Aktif||0)||0,meeting=Number(st?.Pertemuan_Ke||0)||0;
  const batchId=String(st?.ID_Batch||'').trim();
  if(batchId){
    const b=findRow_(COG.SHEETS.BATCHES,'ID_Batch',batchId);
    if(b){
      if(b.Month!==''&&b.Month!=null&&isFinite(Number(b.Month)))month=Number(b.Month);
      if(b.Meeting!==''&&b.Meeting!=null&&isFinite(Number(b.Meeting)))meeting=Number(b.Meeting);
    }
  }
  month=Math.max(0,Math.min(5,Math.round(month)));
  meeting=Math.max(0,Math.min(60,Math.round(meeting)));
  return {month,meeting};
}
function requireActiveStudent_(token){
  const s=requireStudentSession_(token);
  const st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
  if(!st)throw new Error('Data siswa tidak ditemukan.');
  if(studentActiveStatus_(st)!=='Aktif')throw new Error('Akun siswa sedang Nonaktif. Classroom, Assignments, dan Schedule tidak dapat diakses. Silakan hubungi admin.');
  return {session:s,student:st};
}
function progress_(st){const total=60,p=batchProgress_(st),completed=Math.max(0,Math.min(total,p.meeting));return{percentage:Math.round(completed/total*100),completed,total,month:p.month,meeting:p.meeting}}
function materials_(st){const mt=batchProgress_(st).meeting;return rows_(COG.SHEETS.MATERIALS).filter(r=>bool_(r.Status_Aktif)).map(r=>{const cat=String(r.Kategori||'').toUpperCase(),need=Number(r.Syarat_Pertemuan||0),locked=mt<need,u=safeUrl_(r.Link_Akses||'');let viewer=u;if(!locked&&cat==='PDF')viewer=drivePreview_(u)||u;if(!locked&&cat==='VIDEO')viewer=ytEmbed_(u)||u;return{id:String(r.ID_Materi||''),requiredMeeting:need,category:cat,title:String(r.Judul_Materi||''),description:String(r.Deskripsi||''),link:viewer,locked,status:locked?'Locked':'Available'}})}
function assignments_(email){return rows_(COG.SHEETS.TASKS).filter(r=>normEmail_(r.Email_Siswa)===email).sort((a,b)=>date_(a.Deadline)-date_(b.Deadline)).map(r=>({id:String(r.ID_Tugas||''),topic:String(r.Topik_Tugas||''),description:String(r.Deskripsi_Tugas||''),fileUrl:safeUrl_(r.Link_File||''),submissionDate:dt_(r.Tanggal_Submission),status:String(r.Status_Penilaian||'Belum Dinilai'),score:r.Nilai===''||r.Nilai==null?null:Number(r.Nilai),feedback:String(r.Feedback||''),deadline:dt_(r.Deadline),canSubmit:norm_(r.Status_Penilaian)!=='sudah dinilai'}))}
function schedule_(){const n=Date.now();return rows_(COG.SHEETS.SCHEDULE).map(r=>({id:String(r.ID_Sesi||''),title:String(r.Nama_Kegiatan||''),start:dt_(r.Waktu_Mulai),end:time_(r.Waktu_Selesai),startTs:date_(r.Waktu_Mulai),meetLink:safeUrl_(r.Link_Meet||''),reminderStatus:String(r.Status_Reminder_WA||'Belum')})).filter(x=>x.startTs>n-3600000).sort((a,b)=>a.startTs-b.startTs).map(x=>{delete x.startTs;return x})}
function paymentDisplayStatus_(v){
  const n=norm_(v);
  if(['lunas','paid','accepted','approved'].includes(n))return 'Paid';
  if(['menunggu verifikasi','under verification','submitted','under review'].includes(n))return 'Under Verification';
  if(['ditolak','rejected','revision required'].includes(n))return 'Rejected';
  return 'Unpaid';
}

function payments_(email){
  let total=0,paid=0,pending=0;
  const rec=rows_(COG.SHEETS.PAYMENTS)
    .filter(r=>normEmail_(r.Email_Siswa)===email)
    .sort((a,b)=>date_(a.Tanggal_Jatuh_Tempo)-date_(b.Tanggal_Jatuh_Tempo))
    .map(r=>{
      const amount=moneyNum_(r.Nominal_Tagihan),status=paymentDisplayStatus_(r.Status_Payment||'');
      total+=amount;
      if(status==='Paid')paid+=amount;
      if(status==='Under Verification')pending+=amount;
      return {
        id:String(r.ID_Tagihan||''),
        month:String(r.Bulan_Program||''),
        amount,
        dueDate:fmt_(r.Tanggal_Jatuh_Tempo),
        status,
        proofUrl:safeUrl_(r.Link_Bukti_Transfer||''),
        canSubmit:status==='Unpaid'||status==='Rejected'
      };
    });
  return {records:rec,summary:{totalAmount:total,totalPaid:paid,pendingVerification:pending,remaining:Math.max(0,total-paid)}};
}
function reports_(st){
  const email=normEmail_(st.Email);
  const active=Math.max(0,batchProgress_(st).month);
  const aspectRows=rowsOptional_(COG.SHEETS.REPORT_ASPECTS);
  const scoreRows=rowsOptional_(COG.SHEETS.REPORT_SCORES).filter(r=>normEmail_(r.Email_Siswa)===email);
  const pdfRows=rowsOptional_(COG.SHEETS.REPORTS).filter(r=>normEmail_(r.Email_Siswa)===email);
  const aspectMonth={};
  aspectRows.forEach(a=>{
    const n=monthNum_(a.Bulan_Evaluasi);
    if(n>0)aspectMonth[String(a.ID_Aspek||'')]=n;
  });
  const monthSet=new Set();
  // Keep the five-program-month structure visible even when the PDF report sheet is empty.
  for(let i=1;i<=Math.max(5,active);i++)monthSet.add(i);
  aspectRows.forEach(a=>{const n=monthNum_(a.Bulan_Evaluasi);if(n>0)monthSet.add(n)});
  scoreRows.forEach(r=>{const n=aspectMonth[String(r.ID_Aspek||'')];if(n>0)monthSet.add(n)});
  return Array.from(monthSet)
    .filter(n=>n>0&&n<=12)
    .sort((a,b)=>a-b)
    .map(n=>{
      const ml='Month '+n;
      const scoreForMonth=scoreRows.filter(r=>aspectMonth[String(r.ID_Aspek||'')]===n&&r.Nilai!==''&&r.Nilai!=null&&isFinite(Number(r.Nilai))).map(r=>Number(r.Nilai));
      const pdf=pdfRows.find(r=>monthNum_(r.Bulan_Evaluasi)===n);
      return {
        monthNumber:n,
        monthLabel:ml,
        link:safeUrl_(pdf?.Link_PDF_Rapor||''),
        average:scoreForMonth.length?Math.round(scoreForMonth.reduce((a,b)=>a+b,0)/scoreForMonth.length*10)/10:null,
        hasScore:scoreForMonth.length>0
      };
    });
}
function certificate_(st){
  if(!st)return{status:'locked',link:'',message:'Data siswa tidak ditemukan.'};
  const status=norm_(st.Status_Kelulusan);
  if(status!=='lulus')return{status:'locked',link:'',message:'The certificate becomes available once the program is successfully completed.'};
  const rec=findLatestCertificate_(st);
  if(rec && norm_(rec.Status)==='generated' && String(rec.Link_PDF||'').trim()){
    return {
      status:'available',
      link:'',
      certificateId:String(rec.ID_Sertifikat||''),
      certificateNo:String(rec.No_Sertifikat||''),
      issuedAt:fmt_(rec.Tanggal_Diterbitkan),
      message:'Congratulation! Your COGNIORA program has been completed.'
    };
  }
  return {status:'locked',link:'',certificateId:String(rec?.ID_Sertifikat||''),certificateNo:String(rec?.No_Sertifikat||''),message:'Sertifikat belum tersedia di sistem.'};
}

function ensureStudentRootFolder_(st){
  if(!st)throw new Error('Data siswa tidak ditemukan.');

  // Gunakan folder yang sudah tersimpan pada Data_Siswa jika masih valid.
  const storedId=String(st.ID_Folder_Drive||'').trim();
  if(storedId){
    try{
      const existing=DriveApp.getFolderById(storedId);
      ['Assignments','Payment','Reports','Certificate','Profile'].forEach(x=>folder_(existing,x));
      return existing;
    }catch(e){
      // Folder lama tidak dapat diakses/dihapus; buat atau pulihkan folder siswa.
    }
  }

  const id=String(st.ID_Siswa||'').trim();
  const name=String(st.Nama_Lengkap||'Student').trim();
  if(!id)throw new Error('ID siswa tidak tersedia untuk membuat folder Drive.');

  const studentFolder=studentDriveFolder_(id,name);
  try{
    if(st._row)update_(COG.SHEETS.STUDENTS,st._row,{ID_Folder_Drive:studentFolder.getId()});
  }catch(e){
    console.log('ID_Folder_Drive update warning: %s',e);
  }
  return studentFolder;
}

function createStudentFolder_(id,name){return studentDriveFolder_(id,name)}
function folder_(parent,name){const it=parent.getFoldersByName(String(name));return it.hasNext()?it.next():parent.createFolder(String(name))}
function driveFileId_(value){
  const s=String(value||'').trim();
  if(!s)return '';
  const m=s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]+)/i);
  if(m)return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s)?s:'';
}
function studentPhotoDataUrl_(stored){
  const s=String(stored||'').trim();
  if(!s)return '';
  const id=driveFileId_(s);
  if(id){try{return driveFileDataUrl_(id);}catch(e){console.log('Student photo read warning: %s',e);return '';}}
  return safeUrl_(s);
}
function validateProfileImage_(b){
  if(!b||typeof b.getBytes!=='function')throw new Error('Foto belum dipilih.');
  const size=b.getBytes().length;
  if(size<1||size>2*1024*1024)throw new Error('Ukuran foto maksimal 2 MB.');
  const type=String(b.getContentType()||'').toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('Format foto harus JPG, PNG, atau WebP.');
}
function validateBlob_(b){if(!b||typeof b.getBytes!=='function')throw new Error('File belum dipilih.');const size=b.getBytes().length;if(size<1||size>COG.MAX_FILE)throw new Error('Ukuran file maksimal 10 MB.');const ext=safeFile_(b.getName()).split('.').pop().toLowerCase();if(!COG.UPLOAD_EXT.includes(ext))throw new Error('Format file tidak didukung.')}
function scheduleReminders_(){const now=Date.now(),h=now+86400000,st=rows_(COG.SHEETS.SCHEDULE),students=rows_(COG.SHEETS.STUDENTS),cache=CacheService.getScriptCache();st.forEach(x=>{const t=date_(x.Waktu_Mulai);if(t<=now||t>h)return;students.forEach(s=>{const email=normEmail_(s.Email),key='rem:'+sha_(x.ID_Sesi+'|'+email+'|'+fmt_(x.Waktu_Mulai));if(cache.get(key)||!validEmail_(email))return;try{MailApp.sendEmail({to:email,subject:'Reminder Kelas COGNIORA — '+x.Nama_Kegiatan,htmlBody:'<p><b>'+h(x.Nama_Kegiatan)+'</b><br>'+h(dt_(x.Waktu_Mulai))+'</p>'+(x.Link_Meet?'<p><a href="'+h(x.Link_Meet)+'">Join Google Meet</a></p>':'')});}catch(e){}if(s.Nomor_WA){const r=sendWa_(normPhone_(s.Nomor_WA),'Reminder COGNIORA: '+x.Nama_Kegiatan+' pada '+dt_(x.Waktu_Mulai)+(x.Link_Meet?'. Meet: '+x.Link_Meet:''));}cache.put(key,'1',82800)})})}
function syncCalendarCore_(){
  const calId=getConfig_('CALENDAR_ID','');
  if(!calId) throw new Error('CALENDAR_ID belum dikonfigurasi.');
  const cal=CalendarApp.getCalendarById(calId);
  if(!cal) throw new Error('Kalender tidak ditemukan atau tidak dapat diakses.');
  const now=new Date();
  const horizon=new Date(now.getTime()+120*24*60*60*1000);
  const events=cal.getEvents(now,horizon);
  const sh=getDb_().getSheetByName(COG.SHEETS.SCHEDULE);
  const headers=getHeaders_(sh);
  const byId={};
  getObjects_(sh).forEach(r=>{byId[String(r.ID_Sesi||'')]=r._row});
  let added=0, updated=0;
  events.forEach(ev=>{
    const id=String(ev.getId());
    const data={
      ID_Sesi:id,
      Nama_Kegiatan:ev.getTitle(),
      Waktu_Mulai:ev.getStartTime(),
      Waktu_Selesai:ev.getEndTime(),
      Link_Meet:extractMeetLink_(String(ev.getDescription()||'')+' '+String(ev.getLocation()||'')),
      Status_Reminder_WA:byId[id]?'Belum Dikirim':'Belum'
    };
    if(byId[id]){ update_(COG.SHEETS.SCHEDULE,byId[id],data); updated++; }
    else { append_(COG.SHEETS.SCHEDULE,data); added++; }
  });
  return {success:true,message:'Sinkronisasi kalender selesai.',count:events.length,added,updated};
}
function runScheduledCalendarSync(e){
  if(!validTrigger_(e)) return;
  try{ syncCalendarCore_(); }catch(err){ console.error(err); }
}
function validTrigger_(e){if(!e||!e.triggerUid)return false;return ScriptApp.getProjectTriggers().some(t=>String(t.getUniqueId())===String(e.triggerUid))}
function sendWa_(phone,message){const p=PropertiesService.getScriptProperties(),url=p.getProperty('WA_API_URL'),token=p.getProperty('WA_API_TOKEN');if(!url||!token)return fail_('WhatsApp API belum dikonfigurasi.');const tpl=JSON.parse(p.getProperty('WA_PAYLOAD_TEMPLATE_JSON')||'{"phone":"{{phone}}","message":"{{message}}"}');const payload=JSON.parse(JSON.stringify(tpl).replace(/\{\{phone\}\}/g,phone).replace(/\{\{message\}\}/g,message));const headers={};headers[p.getProperty('WA_AUTH_HEADER')||'Authorization']=(p.getProperty('WA_AUTH_PREFIX')??'Bearer ')+token;const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers,payload:JSON.stringify(payload),muteHttpExceptions:true});return res.getResponseCode()>=200&&res.getResponseCode()<300?ok_('WhatsApp berhasil dikirim.'):fail_('Provider WhatsApp menolak request.',{code:res.getResponseCode()})}
function getConfig_(key, fallback){
  const p=PropertiesService.getScriptProperties();
  const prop=p.getProperty(String(key));
  if(prop!==null && prop!=='') return prop;
  const setting=getSettings_()[String(key)];
  return setting!==undefined && setting!=='' ? setting : (fallback===undefined?'':fallback);
}
function getHeaders_(sheet){
  return sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(v=>String(v||'').trim());
}
function getObjects_(sheet){
  return rowsBySheet_(sheet);
}
function rowsBySheet_(sheet){
  const headers=getHeaders_(sheet), lr=sheet.getLastRow(), lc=sheet.getLastColumn();
  if(lr<2)return [];
  return sheet.getRange(2,1,lr-1,lc).getValues().map((r,i)=>{
    const o={_row:i+2};
    headers.forEach((k,j)=>{if(k)o[k]=r[j]});
    return o;
  });
}
function extractMeetLink_(text){
  return meet_(text);
}
function h_(v){
  return h(v);
}
function scheduledReminders_(){
  scheduleReminders_();
}
function norm_(v){return String(v??'').trim().toLowerCase()}
function normEmail_(v){return norm_(v)}
function normPhone_(v){let d=String(v??'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='62'+d.slice(1);return d}
function text_(v,n){return String(v??'').trim().slice(0,n||5000)}
function validEmail_(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail_(v))}
function safeUrl_(v){const u=String(v??'').trim();return /^https?:\/\//i.test(u)?u.slice(0,2000):''}
function safeFile_(v){return String(v||'file').replace(/[\\/:*?"<>|#%{}]/g,'_').slice(0,180)}
function bool_(v){return ['true','1','ya','yes','aktif','active'].includes(norm_(v))}
function date_(v){if(v instanceof Date)return v.getTime();if(!v)return 0;const d=new Date(v);return isNaN(d)?0:d.getTime()}
function fmt_(v){const t=date_(v);return t?Utilities.formatDate(new Date(t),tz_(),'dd/MM/yyyy'):'-'}
function time_(v){const t=date_(v);return t?Utilities.formatDate(new Date(t),tz_(),'HH:mm'):'-'}
function dt_(v){const t=date_(v);return t?Utilities.formatDate(new Date(t),tz_(),'dd/MM/yyyy HH:mm'):'-'}
function tz_(){return Session.getScriptTimeZone()||'Asia/Jakarta'}
function moneyNum_(v){if(typeof v==='number')return isFinite(v)?v:0;return Number(String(v||'').replace(/[^0-9-]/g,''))||0}
function monthNum_(v){const m=String(v??'').match(/\d+/);return m?Number(m[0]):0}
function meet_(v){const m=String(v||'').match(/https?:\/\/meet\.google\.com\/[A-Za-z0-9._?=&/-]+/i);return m?m[0]:''}
function drivePreview_(u){const m=String(u||'').match(/drive\.google\.com\/file\/d\/([^/]+)/i);return m?'https://drive.google.com/file/d/'+m[1]+'/preview':''}
function ytEmbed_(u){let m=String(u||'').match(/[?&]v=([^&#]+)/i),id=m?m[1]:'';if(!id){m=String(u||'').match(/youtu\.be\/([^?&#/]+)/i);if(m)id=m[1]}return id?'https://www.youtube.com/embed/'+encodeURIComponent(id)+'?rel=0':''}
function sha_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>('0'+(b<0?b+256:b).toString(16)).slice(-2)).join('')}
function hmac_(s,key){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(s),String(key),Utilities.Charset.UTF_8)).replace(/=+$/,'')}
function enc_(s){return Utilities.base64EncodeWebSafe(Utilities.newBlob(String(s)).getBytes()).replace(/=+$/,'')}
function dec_(s){let x=String(s).replace(/-/g,'+').replace(/_/g,'/');x+='='.repeat((4-x.length%4)%4);return Utilities.newBlob(Utilities.base64Decode(x)).getDataAsString()}
function h(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function err_(e){return String(e&&e.message||e||'Terjadi kesalahan.').replace(/WA_API_TOKEN|SESSION_SECRET/gi,'[redacted]').slice(0,500)}
function ok_(message,data){return Object.assign({success:true,message:String(message||'')},data===undefined?{}:{data})}
function fail_(message,data){return Object.assign({success:false,message:String(message||'Terjadi kesalahan.')},data===undefined?{}:{data})}


/* ==================== LMS V2: batch, assignments, reports, admin management ==================== */

function createStudentInternal_(p){
  if(!p||!validEmail_(p.email)||!/^[A-Za-z0-9._-]{3,50}$/.test(String(p.id||''))||String(p.name||'').trim().length<2||String(p.pin||'').trim().length<4||String(p.pin||'').trim().length>64){
    throw new Error('Data siswa tidak valid.');
  }

  const email=normEmail_(p.email);
  const password=String(p.pin).trim();
  const id=String(p.id).trim();
  const name=String(p.name).trim();
  const batchId=String(p.batchId||'').trim();

  if(findRow_(COG.SHEETS.STUDENTS,'Email',email))return fail_('Email siswa sudah terdaftar.');
  if(findRow_(COG.SHEETS.STUDENTS,'ID_Siswa',id))return fail_('ID siswa sudah terdaftar.');

  // Drive folder is prepared BEFORE the student row is written.
  // This prevents a "successful" student account from being saved with no folder.
  const folder=createStudentFolder_(id,name);

  try{
    const row=append_(COG.SHEETS.STUDENTS,{
      ID_Siswa:id,
      Nama_Lengkap:name,
      Email:email,
      Password_PIN:password,
      Nomor_WA:normPhone_(p.wa||''),
      Bulan_Aktif:Number(p.activeMonth||1),
      Pertemuan_Ke:Number(p.meeting||0),
      Status_Kelulusan:String(p.status||'Belum Lulus'),
      ID_Folder_Drive:folder.getId(),
      Foto_Profil:safeUrl_(p.photo||''),
      ID_Batch:batchId,
      Status_Aktif:'Aktif',
      Terms_Agreed:'',
      Terms_Agreed_At:'',
      Terms_Version:'',
      Status_Aktif:'Aktif'
    });

    return ok_('Siswa berhasil dibuat.',{
      student:{
        id,name,email,password,
        folderId:folder.getId(),
        folderUrl:folder.getUrl(),
        batchId
      }
    });
  }catch(e){
    // Do not silently leave a brand-new student account without its folder.
    throw new Error('Data siswa gagal disimpan setelah folder Drive dibuat: '+err_(e));
  }
}

function ensureStudentDriveFolder_(st){
  if(!st)throw new Error('Data siswa tidak ditemukan.');

  if(st.ID_Folder_Drive){
    try{
      const existing=DriveApp.getFolderById(String(st.ID_Folder_Drive));
      ['Assignments','Payment','Reports','Certificate','Profile'].forEach(x=>folder_(existing,x));
      return existing;
    }catch(e){
      // Recreate/link a fresh folder below when the old ID is stale.
    }
  }

  const f=studentDriveFolder_(String(st.ID_Siswa||''),String(st.Nama_Lengkap||'Student'));
  if(st._row)update_(COG.SHEETS.STUDENTS,st._row,{ID_Folder_Drive:f.getId()});
  return f;
}

function convertLeadsToStudents(token,emails,batchId){
  let lock=null;
  try{
    requireAdminSession_(token);
    const arr=[...new Set((Array.isArray(emails)?emails:[]).map(normEmail_).filter(validEmail_))];
    if(!arr.length)return fail_('Pilih minimal satu lead.');

    const batch=String(batchId||'').trim();
    lock=LockService.getScriptLock();
    lock.waitLock(15000);

    const results=[];
    arr.forEach(email=>{
      const lead=findRow_(COG.SHEETS.LEADS,'Email',email);
      if(!lead){
        results.push({email,status:'error',message:'Lead tidak ditemukan.'});
        return;
      }

      const leadName=String(lead.Nama||'').trim();
      const existing=findRow_(COG.SHEETS.STUDENTS,'Email',email);

      // Existing account: repair/link its Drive folder before marking the lead converted.
      if(existing){
        try{
          const f=ensureStudentDriveFolder_(existing);
          if(batch)update_(COG.SHEETS.STUDENTS,existing._row,{ID_Batch:batch});
          update_(COG.SHEETS.LEADS,lead._row,{Status:'Converted'});
          results.push({
            email,
            name:leadName,
            status:'skipped',
            message:'Akun siswa sudah ada. Folder Drive diperiksa/dihubungkan.',
            studentId:String(existing.ID_Siswa||''),
            password:'',
            batchId:batch,
            folderId:f.getId(),
            folderUrl:f.getUrl()
          });
        }catch(e){
          results.push({
            email,name:leadName,status:'error',
            message:'Akun siswa sudah ada, tetapi folder Drive gagal dibuat/dihubungkan: '+driveError_(e),
            studentId:String(existing.ID_Siswa||''),
            batchId:batch
          });
        }
        return;
      }

      const id=nextStudentId_();
      const password=generatePassword_(10);

      try{
        const created=createStudentInternal_({
          id,
          name:leadName,
          email,
          pin:password,
          wa:String(lead.Nomor_WA||''),
          activeMonth:1,
          meeting:0,
          status:'Belum Lulus',
          batchId:batch
        });

        if(!created.success){
          results.push({email,name:leadName,status:'error',message:created.message});
          return;
        }

        update_(COG.SHEETS.LEADS,lead._row,{Status:'Converted'});
        const student=created.data&&created.data.student||{};
        results.push({
          email,
          name:leadName,
          status:'converted',
          studentId:id,
          password,
          batchId:batch,
          folderId:String(student.folderId||''),
          folderUrl:String(student.folderUrl||'')
        });
      }catch(e){
        // Lead remains in its previous status when Drive/account creation fails.
        results.push({email,name:leadName,status:'error',message:err_(e)});
      }
    });

    return ok_('Proses conversion selesai.',{results});
  }catch(e){
    return fail_('Conversion lead gagal: '+err_(e));
  }finally{
    if(lock){try{lock.releaseLock();}catch(e){}}
  }
}

function repairStudentDriveFolder(token,email){
  try{
    requireAdminSession_(token);
    const em=normEmail_(email);
    if(!validEmail_(em))return fail_('Email siswa tidak valid.');
    const st=findRow_(COG.SHEETS.STUDENTS,'Email',em);
    if(!st)return fail_('Siswa tidak ditemukan.');
    const f=ensureStudentDriveFolder_(st);
    return ok_('Folder siswa berhasil diperbaiki.',{email:em,studentId:String(st.ID_Siswa||''),folderId:f.getId(),folderUrl:f.getUrl()});
  }catch(e){return fail_('Perbaikan folder siswa gagal: '+err_(e));}
}

function studentActiveStatus_(st){return norm_(st?.Status_Aktif)==='nonaktif'?'Nonaktif':'Aktif'}
function normalizeBatchStatus_(v){return norm_(v)==='aktif'?'Aktif':'Nonaktif'}
function managementSchema_(){const ss=getDb_(true);ensureSheet_(ss,COG.SHEETS.BATCHES,COG.HEADERS[COG.SHEETS.BATCHES]);ensureSheet_(ss,COG.SHEETS.STUDENTS,COG.HEADERS[COG.SHEETS.STUDENTS]);return true}
function batchProgress_(st){
  let month=Number(st?.Bulan_Aktif||0)||0,meeting=Number(st?.Pertemuan_Ke||0)||0;
  const batchId=String(st?.ID_Batch||'').trim();
  if(batchId){
    const b=findRow_(COG.SHEETS.BATCHES,'ID_Batch',batchId);
    if(b){
      if(b.Month!==''&&b.Month!=null&&isFinite(Number(b.Month)))month=Number(b.Month);
      if(b.Meeting!==''&&b.Meeting!=null&&isFinite(Number(b.Meeting)))meeting=Number(b.Meeting);
    }
  }
  month=Math.max(0,Math.min(5,Math.round(month)));
  meeting=Math.max(0,Math.min(60,Math.round(meeting)));
  return {month,meeting};
}
function requireActiveStudent_(token){
  const s=requireStudentSession_(token);
  const st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
  if(!st)throw new Error('Data siswa tidak ditemukan.');
  if(studentActiveStatus_(st)!=='Aktif')throw new Error('Akun siswa sedang Nonaktif. Classroom, Assignments, dan Schedule tidak dapat diakses. Silakan hubungi admin.');
  return {session:s,student:st};
}
function safeStudent_(r){const p=batchProgress_(r);return{id:String(r.ID_Siswa||''),name:String(r.Nama_Lengkap||''),email:normEmail_(r.Email),phone:normPhone_(r.Nomor_WA||''),activeMonth:p.month,meeting:p.meeting,graduationStatus:String(r.Status_Kelulusan||'Belum Lulus'),activeStatus:studentActiveStatus_(r),termsAgreed:studentTermsAgreed_(r),termsVersion:String(r.Terms_Version||''),termsAgreedAt:r.Terms_Agreed_At?dt_(r.Terms_Agreed_At):'',photo:safeUrl_(r.Foto_Profil||''),batchId:String(r.ID_Batch||'')}}

function getAdminOverview(token){
  try{
    requireAdminSession_(token);
    const leads=rows_(COG.SHEETS.LEADS),students=rows_(COG.SHEETS.STUDENTS),payments=rows_(COG.SHEETS.PAYMENTS),tasks=rows_(COG.SHEETS.TASKS),subs=rows_(COG.SHEETS.SUBMISSIONS);
    return ok_('Overview admin dimuat.',{
      leadsTotal:leads.length,
      leadsNew:leads.filter(r=>norm_(r.Status)==='new').length,
      leadsConverted:leads.filter(r=>norm_(r.Status)==='converted').length,
      studentsTotal:students.length,
      studentsActive:students.filter(r=>studentActiveStatus_(r)==='Aktif').length,
      studentsInactive:students.filter(r=>studentActiveStatus_(r)==='Nonaktif').length,
      paymentsPending:payments.filter(r=>paymentDisplayStatus_(r.Status_Payment)==='Under Verification').length,
      activeBatches:rows_(COG.SHEETS.BATCHES).filter(r=>norm_(r.Status)==='aktif').length,
      assignmentsPending:subs.filter(r=>['under assessment','needs revision','sedang dinilai','perlu revisi'].includes(norm_(r.Status_Penilaian))).length,
      tasksTotal:tasks.length
    });
  }catch(e){return fail_('Overview admin gagal dimuat: '+err_(e));}
}

function migrateBatchProgress_(){
  managementSchema_();
  const students=rows_(COG.SHEETS.STUDENTS);
  rows_(COG.SHEETS.BATCHES).forEach(b=>{
    const blankMonth=b.Month===''||b.Month==null;
    const blankMeeting=b.Meeting===''||b.Meeting==null;
    if(!blankMonth&&!blankMeeting)return;
    const members=students.filter(s=>String(s.ID_Batch||'')===String(b.ID_Batch||''));
    let inferredMonth=1,inferredMeeting=0;
    members.forEach(s=>{
      const m=Number(s.Bulan_Aktif||0)||0,mt=Number(s.Pertemuan_Ke||0)||0;
      inferredMonth=Math.max(inferredMonth,Math.max(0,Math.min(5,m)),Math.min(5,Math.ceil(mt/12)));
      inferredMeeting=Math.max(inferredMeeting,Math.max(0,Math.min(60,mt)));
    });
    const maxForMonth=Math.max(12,inferredMonth*12);
    inferredMeeting=Math.min(inferredMeeting,maxForMonth);
    update_(COG.SHEETS.BATCHES,b._row,{Month:blankMonth?inferredMonth:b.Month,Meeting:blankMeeting?inferredMeeting:b.Meeting});
  });
}
function getAdminBatches(token){
  try{
    requireAdminSession_(token);
    migrateBatchProgress_();
    return ok_('Batch dimuat.',rows_(COG.SHEETS.BATCHES).map(r=>({row:r._row,id:String(r.ID_Batch||''),name:String(r.Nama_Batch||''),program:String(r.Program||''),level:String(r.Level||''),start:fmt_(r.Tanggal_Mulai),end:fmt_(r.Tanggal_Selesai),month:Math.max(1,Math.min(5,Number(r.Month||1))),meeting:Math.max(0,Math.min(60,Number(r.Meeting||0))),status:normalizeBatchStatus_(r.Status||'Aktif')})));
  }catch(e){return fail_('Batch gagal dimuat: '+err_(e));}
}
function saveAdminBatch(token,p){
  try{
    requireAdminSession_(token);managementSchema_();
    const id=String(p?.id||id_('BATCH')),name=text_(p?.name,120),program=text_(p?.program,120),level=text_(p?.level,60),month=Math.max(1,Math.min(5,Math.round(Number(p?.month)||1))),meeting=Math.max(0,Math.round(Number(p?.meeting)||0)),status=normalizeBatchStatus_(p?.status||'Aktif');
    if(!name)return fail_('Nama batch wajib diisi.');
    if(!level)return fail_('Level batch wajib diisi.');
    if(meeting>month*12)return fail_('Meeting tidak boleh melebihi '+(month*12)+' untuk Month '+month+'.');
    const row={ID_Batch:id,Nama_Batch:name,Program:program,Level:level,Tanggal_Mulai:p?.start?new Date(p.start):'',Tanggal_Selesai:p?.end?new Date(p.end):'',Month:month,Meeting:meeting,Status:status};
    const existing=findRow_(COG.SHEETS.BATCHES,'ID_Batch',id);if(existing)update_(COG.SHEETS.BATCHES,existing._row,row);else append_(COG.SHEETS.BATCHES,row);
    return ok_('Batch berhasil disimpan.',{id,month,meeting,status});
  }catch(e){return fail_('Gagal menyimpan batch: '+err_(e));}
}
function assignStudentBatch(token,email,batchId){try{requireAdminSession_(token);managementSchema_();const st=findRow_(COG.SHEETS.STUDENTS,'Email',normEmail_(email));if(!st)return fail_('Siswa tidak ditemukan.');update_(COG.SHEETS.STUDENTS,st._row,{ID_Batch:String(batchId||'')});return ok_('Batch siswa diperbarui.');}catch(e){return fail_('Gagal mengubah batch siswa: '+err_(e));}}
function updateStudentActiveStatus(token,email,status){try{requireAdminSession_(token);managementSchema_();const st=findRow_(COG.SHEETS.STUDENTS,'Email',normEmail_(email));if(!st)return fail_('Siswa tidak ditemukan.');const next=norm_(status)==='nonaktif'?'Nonaktif':'Aktif';update_(COG.SHEETS.STUDENTS,st._row,{Status_Aktif:next});return ok_('Status keaktifan siswa diperbarui.',{email:normEmail_(email),status:next});}catch(e){return fail_('Gagal mengubah status keaktifan siswa: '+err_(e));}}
function getAdminStudents(token){try{requireAdminSession_(token);managementSchema_();const batches={};rows_(COG.SHEETS.BATCHES).forEach(r=>batches[String(r.ID_Batch||'')]=String(r.Nama_Batch||r.ID_Batch||''));return ok_('Siswa dimuat.',rows_(COG.SHEETS.STUDENTS).map(r=>({row:r._row,id:String(r.ID_Siswa||''),name:String(r.Nama_Lengkap||''),email:normEmail_(r.Email),phone:normPhone_(r.Nomor_WA||''),batchId:String(r.ID_Batch||''),batchName:batches[String(r.ID_Batch||'')]||'',status:String(r.Status_Kelulusan||''),activeStatus:studentActiveStatus_(r),folderId:String(r.ID_Folder_Drive||'')})));}catch(e){return fail_('Siswa gagal dimuat: '+err_(e));}}

function getAdminMaterials(token){try{requireAdminSession_(token);return ok_('Materi dimuat.',rows_(COG.SHEETS.MATERIALS).map(r=>({row:r._row,id:String(r.ID_Materi||''),batchId:String(r.ID_Batch||'ALL'),meeting:Number(r.Syarat_Pertemuan||0),category:String(r.Kategori||''),title:String(r.Judul_Materi||''),description:String(r.Deskripsi||''),link:safeUrl_(r.Link_Akses||''),active:isActiveValue_(r.Status_Aktif),createdAt:dt_(r.Created_At)})));}catch(e){return fail_('Materi gagal dimuat: '+err_(e));}}
function saveAdminMaterial(token,p){try{requireAdminSession_(token);const row={ID_Materi:String(p?.id||id_('MAT')),ID_Batch:String(p?.batchId||'ALL'),Syarat_Pertemuan:Number(p?.meeting||0),Kategori:text_(p?.category,40)||'PDF',Judul_Materi:text_(p?.title,200),Deskripsi:text_(p?.description,1500),Link_Akses:safeUrl_(p?.link||''),Status_Aktif:p?.active!==false,Created_At:new Date()};if(!row.Judul_Materi)return fail_('Judul materi wajib diisi.');const existing=findRow_(COG.SHEETS.MATERIALS,'ID_Materi',row.ID_Materi);if(existing)update_(COG.SHEETS.MATERIALS,existing._row,row);else append_(COG.SHEETS.MATERIALS,row);return ok_('Materi berhasil disimpan.',{id:row.ID_Materi});}catch(e){return fail_('Gagal menyimpan materi: '+err_(e));}}

function getAdminTasks(token){
  try{
    requireAdminSession_(token);
    return ok_('Tugas dimuat.',rows_(COG.SHEETS.TASKS).filter(r=>r.ID_Tugas&&r.Topik_Tugas).map(r=>({row:r._row,id:String(r.ID_Tugas||''),batchId:String(r.ID_Batch||''),meeting:Number(r.Syarat_Pertemuan||0),topic:String(r.Topik_Tugas||''),description:String(r.Deskripsi_Tugas||''),deadline:dt_(r.Deadline),active:isActiveValue_(r.Status_Aktif)})));
  }catch(e){return fail_('Tugas gagal dimuat: '+err_(e));}
}

function saveAdminTask(token,p){
  try{
    requireAdminSession_(token);
    const batchId=String(p?.batchId||'').trim();
    if(!batchId||norm_(batchId)==='all')return fail_('Batch tugas wajib dipilih. Tugas baru tidak dapat dikirim ke ALL.');
    const batch=findRow_(COG.SHEETS.BATCHES,'ID_Batch',batchId);
    if(!batch)return fail_('Batch yang dipilih tidak ditemukan.');
    const row={ID_Tugas:String(p?.id||id_('TASK')),ID_Batch:batchId,Syarat_Pertemuan:Number(p?.meeting||0),Topik_Tugas:text_(p?.topic,200),Deskripsi_Tugas:text_(p?.description,2000),Deadline:p?.deadline?new Date(p.deadline):'',Status_Aktif:p?.active!==false,Created_At:new Date()};
    if(!row.Topik_Tugas)return fail_('Topik tugas wajib diisi.');
    if(!row.Deadline||isNaN(date_(row.Deadline)))return fail_('Deadline tugas wajib diisi dengan tanggal yang valid.');
    const existing=findRow_(COG.SHEETS.TASKS,'ID_Tugas',row.ID_Tugas);
    if(existing)update_(COG.SHEETS.TASKS,existing._row,row);else append_(COG.SHEETS.TASKS,row);
    return ok_('Assignment saved for the selected batch.',{id:row.ID_Tugas,batchId:row.ID_Batch,batchName:String(batch.Nama_Batch||batchId)});
  }catch(e){return fail_('Gagal menyimpan tugas: '+err_(e));}
}

function getAdminTaskSubmissions(token,taskId){
  try{
    requireAdminSession_(token);
    const task=findRow_(COG.SHEETS.TASKS,'ID_Tugas',taskId);
    if(!task)return fail_('Tugas tidak ditemukan.');
    const students=rows_(COG.SHEETS.STUDENTS).filter(s=>String(s.ID_Batch||'')===String(task.ID_Batch||''));
    const subs=rows_(COG.SHEETS.SUBMISSIONS).filter(s=>String(s.ID_Tugas||'')===String(taskId));
    return ok_('Submission dimuat.',students.map(s=>{
      const sub=subs.find(x=>normEmail_(x.Email_Siswa)===normEmail_(s.Email));
      return{id:String(s.ID_Siswa||''),name:String(s.Nama_Lengkap||''),email:normEmail_(s.Email),submissionId:String(sub?.ID_Submission||''),link:safeUrl_(sub?.Link_File||''),submittedAt:dt_(sub?.Tanggal_Submission),status:taskStatusForSubmission_(sub?.Status_Penilaian||''),score:sub?.Nilai===''||sub?.Nilai==null?null:Number(sub?.Nilai),feedback:String(sub?.Feedback||'')};
    }));
  }catch(e){return fail_('Submission gagal dimuat: '+err_(e));}
}

function getAdminAssignmentReview(token,batchId){
  try{
    requireAdminSession_(token);
    const selectedBatch=String(batchId||'').trim();
    if(!selectedBatch||norm_(selectedBatch)==='all')return fail_('Pilih batch terlebih dahulu.');
    const batch=findRow_(COG.SHEETS.BATCHES,'ID_Batch',selectedBatch);
    if(!batch)return fail_('Batch tidak ditemukan.');
    const students=rows_(COG.SHEETS.STUDENTS).filter(s=>String(s.ID_Batch||'')===selectedBatch).sort((a,b)=>String(a.Nama_Lengkap||'').localeCompare(String(b.Nama_Lengkap||'')));
    const tasks=rows_(COG.SHEETS.TASKS).filter(t=>isActiveValue_(t.Status_Aktif)&&(!t.ID_Batch||String(t.ID_Batch)==='ALL'||String(t.ID_Batch)===selectedBatch)).sort((a,b)=>date_(a.Deadline)-date_(b.Deadline));
    const subs=rows_(COG.SHEETS.SUBMISSIONS).filter(s=>{const st=students.find(x=>normEmail_(x.Email)===normEmail_(s.Email_Siswa));return !!st;});
    const rows=[];
    students.forEach(st=>{
      tasks.forEach(task=>{
        const sub=subs.find(x=>String(x.ID_Tugas||'')===String(task.ID_Tugas||'')&&normEmail_(x.Email_Siswa)===normEmail_(st.Email));
        rows.push({
          studentId:String(st.ID_Siswa||''),
          studentName:String(st.Nama_Lengkap||''),
          email:normEmail_(st.Email),
          taskId:String(task.ID_Tugas||''),
          taskName:String(task.Topik_Tugas||''),
          deadline:dt_(task.Deadline),
          submissionId:String(sub?.ID_Submission||''),
          submittedAt:dt_(sub?.Tanggal_Submission),
          link:safeUrl_(sub?.Link_File||''),
          feedback:String(sub?.Feedback||''),
          status:taskStatusForSubmission_(sub?.Status_Penilaian||''),
          score:sub?.Nilai===''||sub?.Nilai==null?'':Number(sub.Nilai)
        });
      });
    });
    return ok_('Assignment review loaded.',{batchId:selectedBatch,batchName:String(batch.Nama_Batch||selectedBatch),studentsCount:students.length,rows});
  }catch(e){return fail_('Assignment review gagal dimuat: '+err_(e));}
}

function saveSubmissionGrade(token,p){
  try{
    requireAdminSession_(token);
    const submissionId=String(p?.submissionId||'').trim();
    const sub=findRow_(COG.SHEETS.SUBMISSIONS,'ID_Submission',submissionId);
    if(!sub)return fail_('Submission tidak ditemukan.');
    const statusRaw=String(p?.status||'Assessed').trim();
    const allowed=['Under Assessment','Needs Revision','Assessed'];
    if(!allowed.includes(statusRaw))return fail_('Status assessment tidak valid.');
    const score=p?.score===''||p?.score==null?'':Number(p.score);
    if(score!=='' && (!isFinite(score)||score<0||score>100))return fail_('Nilai harus berada pada rentang 0-100.');
    update_(COG.SHEETS.SUBMISSIONS,sub._row,{Nilai:score,Feedback:text_(p?.feedback,2000),Status_Penilaian:statusRaw,Updated_At:new Date()});
    return ok_('Assessment updated.',{status:statusRaw});
  }catch(e){return fail_('Gagal menyimpan penilaian: '+err_(e));}
}

function getAdminPayments(token){
  try{
    requireAdminSession_(token);
    const students={};
    rows_(COG.SHEETS.STUDENTS).forEach(s=>students[normEmail_(s.Email)]={name:String(s.Nama_Lengkap||''),batchId:String(s.ID_Batch||''),studentId:String(s.ID_Siswa||'')});
    const rows=rows_(COG.SHEETS.PAYMENTS).map(p=>{
      const st=students[normEmail_(p.Email_Siswa)]||{};
      return {
        row:p._row,
        id:String(p.ID_Tagihan||''),
        studentName:String(st.name||p.Email_Siswa||''),
        email:normEmail_(p.Email_Siswa),
        batchId:String(st.batchId||''),
        month:String(p.Bulan_Program||''),
        amount:moneyNum_(p.Nominal_Tagihan),
        dueDate:fmt_(p.Tanggal_Jatuh_Tempo),
        status:paymentDisplayStatus_(p.Status_Payment||''),
        proofUrl:safeUrl_(p.Link_Bukti_Transfer||'')
      };
    }).sort((a,b)=>a.studentName.localeCompare(b.studentName)||a.id.localeCompare(b.id));
    return ok_('Payment records loaded.',rows);
  }catch(e){return fail_('Payment records gagal dimuat: '+err_(e));}
}

function reviewPaymentProof(token,paymentId,decision){
  try{
    requireAdminSession_(token);
    const id=String(paymentId||'').trim();
    const row=findRow_(COG.SHEETS.PAYMENTS,'ID_Tagihan',id);
    if(!row)return fail_('Invoice tidak ditemukan.');
    const d=norm_(decision);
    if(d!=='accept'&&d!=='reject')return fail_('Keputusan pembayaran tidak valid.');
    const current=paymentDisplayStatus_(row.Status_Payment||'');
    if(current!=='Under Verification')return fail_('Payment proof is not awaiting verification.');
    const next=d==='accept'?'Lunas':'Ditolak';
    update_(COG.SHEETS.PAYMENTS,row._row,{Status_Payment:next});
    return ok_(d==='accept'?'Payment proof accepted.':'Payment proof rejected.',{status:paymentDisplayStatus_(next)});
  }catch(e){return fail_('Payment review gagal: '+err_(e));}
}

function getAdminSchedule(token){try{requireAdminSession_(token);return ok_('Jadwal dimuat.',rows_(COG.SHEETS.SCHEDULE).map(r=>({row:r._row,id:String(r.ID_Sesi||''),batchId:String(r.ID_Batch||'ALL'),title:String(r.Nama_Kegiatan||''),start:dt_(r.Waktu_Mulai),end:dt_(r.Waktu_Selesai),meetLink:safeUrl_(r.Link_Meet||''),reminder:String(r.Status_Reminder_WA||'Belum')})));}catch(e){return fail_('Jadwal gagal dimuat: '+err_(e));}}
function saveAdminSchedule(token,p){try{requireAdminSession_(token);const row={ID_Sesi:String(p?.id||id_('SES')),ID_Batch:String(p?.batchId||'ALL'),Nama_Kegiatan:text_(p?.title,200),Waktu_Mulai:p?.start?new Date(p.start):'',Waktu_Selesai:p?.end?new Date(p.end):'',Link_Meet:safeUrl_(p?.meetLink||''),Status_Reminder_WA:'Belum'};if(!row.Nama_Kegiatan||!row.Waktu_Mulai)return fail_('Nama kegiatan dan waktu mulai wajib diisi.');const existing=findRow_(COG.SHEETS.SCHEDULE,'ID_Sesi',row.ID_Sesi);if(existing)update_(COG.SHEETS.SCHEDULE,existing._row,row);else append_(COG.SHEETS.SCHEDULE,row);return ok_('Jadwal berhasil disimpan.',{id:row.ID_Sesi});}catch(e){return fail_('Gagal menyimpan jadwal: '+err_(e));}}

function getAdminReportBook(token,batchId,month){try{requireAdminSession_(token);const ml=normalizeMonthLabel_(month),aspects=rows_(COG.SHEETS.REPORT_ASPECTS).filter(r=>norm_(r.Bulan_Evaluasi)===norm_(ml)&&isActiveValue_(r.Status_Aktif)).sort((a,b)=>Number(a.Urutan||0)-Number(b.Urutan||0));const students=rows_(COG.SHEETS.STUDENTS).filter(s=>String(s.ID_Batch||'')===String(batchId||''));const scores=rows_(COG.SHEETS.REPORT_SCORES);return ok_('Buku nilai rapor dimuat.',{month:ml,batchId,aspects:aspects.map(r=>({id:String(r.ID_Aspek||''),name:String(r.Nama_Aspek||''),description:String(r.Deskripsi_Aspek||''),order:Number(r.Urutan||0)})),students:students.map(s=>({id:String(s.ID_Siswa||''),name:String(s.Nama_Lengkap||''),email:normEmail_(s.Email)})),scores:students.flatMap(s=>aspects.map(a=>{const sc=scores.find(x=>String(x.ID_Aspek||'')===String(a.ID_Aspek||'')&&normEmail_(x.Email_Siswa)===normEmail_(s.Email));return{studentId:String(s.ID_Siswa||''),email:normEmail_(s.Email),aspectId:String(a.ID_Aspek||''),score:sc?.Nilai===''||sc?.Nilai==null?'':Number(sc?.Nilai),feedback:String(sc?.Feedback||''),scoreId:String(sc?.ID_Nilai||'')}}))});}catch(e){return fail_('Buku nilai rapor gagal dimuat: '+err_(e));}}
function saveReportAspect(token,p){try{requireAdminSession_(token);const id=String(p?.id||id_('ASP')),row={ID_Aspek:id,Bulan_Evaluasi:normalizeMonthLabel_(p?.month),Nama_Aspek:text_(p?.name,150),Deskripsi_Aspek:text_(p?.description,1000),Urutan:Number(p?.order||1),Status_Aktif:p?.active!==false};if(!row.Nama_Aspek)return fail_('Nama aspek wajib diisi.');const ex=findRow_(COG.SHEETS.REPORT_ASPECTS,'ID_Aspek',id);if(ex)update_(COG.SHEETS.REPORT_ASPECTS,ex._row,row);else append_(COG.SHEETS.REPORT_ASPECTS,row);return ok_('Aspek rapor disimpan.',{id});}catch(e){return fail_('Gagal menyimpan aspek rapor: '+err_(e));}}
function saveReportScores(token,items){try{requireAdminSession_(token);if(!Array.isArray(items)||!items.length)return fail_('Tidak ada nilai yang disimpan.');const now=new Date(),results=[];items.forEach(x=>{if(x.score===''&&!(x.feedback||''))return;const student=findRow_(COG.SHEETS.STUDENTS,'Email',normEmail_(x.email));const aspect=findRow_(COG.SHEETS.REPORT_ASPECTS,'ID_Aspek',x.aspectId);if(!student||!aspect)return;const ex=rows_(COG.SHEETS.REPORT_SCORES).find(r=>String(r.ID_Aspek||'')===String(x.aspectId||'')&&normEmail_(r.Email_Siswa)===normEmail_(x.email));const row={ID_Nilai:String(ex?.ID_Nilai||id_('SCORE')),ID_Aspek:String(x.aspectId),ID_Siswa:String(student.ID_Siswa||''),Email_Siswa:normEmail_(x.email),Nilai:x.score===''?'':Number(x.score),Feedback:text_(x.feedback,2000),Updated_At:now};if(ex)update_(COG.SHEETS.REPORT_SCORES,ex._row,row);else append_(COG.SHEETS.REPORT_SCORES,row);results.push(row.ID_Nilai);});return ok_('Nilai rapor berhasil disimpan.',{saved:results.length});}catch(e){return fail_('Gagal menyimpan nilai rapor: '+err_(e));}}

function getReportMonthsForStudent(token){
  try{
    const s=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Data siswa tidak ditemukan.');
    return ok_('Daftar bulan progres dimuat.',reports_(st));
  }catch(e){return fail_('Bulan progres gagal dimuat: '+err_(e));}
}
function getMonthlyProgress(token,month){
  try{
    const session=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',session.email);
    if(!st)return fail_('Data siswa tidak ditemukan.');
    const ml=normalizeMonthLabel_(month);
    const aspects=rows_(COG.SHEETS.REPORT_ASPECTS)
      .filter(r=>norm_(r.Bulan_Evaluasi)===norm_(ml)&&isActiveValue_(r.Status_Aktif))
      .sort((a,b)=>Number(a.Urutan||0)-Number(b.Urutan||0));
    const studentId=String(st.ID_Siswa||'');
    const scores=rows_(COG.SHEETS.REPORT_SCORES).filter(r=>normEmail_(r.Email_Siswa)===session.email||String(r.ID_Siswa||'')===studentId);
    const items=aspects.map(a=>{
      const sc=scores.find(x=>String(x.ID_Aspek||'')===String(a.ID_Aspek||''));
      const score=sc?.Nilai===''||sc?.Nilai==null||!isFinite(Number(sc?.Nilai))?null:Number(sc?.Nilai);
      return{id:String(a.ID_Aspek||''),name:String(a.Nama_Aspek||''),description:String(a.Deskripsi_Aspek||''),score,feedback:String(sc?.Feedback||'')};
    });
    const nums=items.map(x=>x.score).filter(v=>typeof v==='number'&&!isNaN(v));
    return ok_('Progress bulanan dimuat.',{monthLabel:ml,average:nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*10)/10:null,aspects:items});
  }catch(e){return fail_('Progress bulanan gagal dimuat: '+err_(e));}
}

function assignments_(email){
  const st=findRow_(COG.SHEETS.STUDENTS,'Email',email);
  if(!st)return [];
  const batchId=String(st.ID_Batch||'');
  const tasks=rows_(COG.SHEETS.TASKS)
    .filter(r=>isActiveValue_(r.Status_Aktif)&&(!r.ID_Batch||String(r.ID_Batch)===batchId||String(r.ID_Batch)==='ALL'))
    .sort((a,b)=>date_(a.Deadline)-date_(b.Deadline));
  const subs=rows_(COG.SHEETS.SUBMISSIONS).filter(r=>normEmail_(r.Email_Siswa)===normEmail_(email));
  return tasks.map(t=>{
    const sub=subs.find(x=>String(x.ID_Tugas||'')===String(t.ID_Tugas||''));
    const status=taskStatusForSubmission_(sub?.Status_Penilaian||'');
    return {
      id:String(t.ID_Tugas||''),
      topic:String(t.Topik_Tugas||''),
      description:String(t.Deskripsi_Tugas||''),
      fileUrl:safeUrl_(sub?.Link_File||''),
      submissionDate:dt_(sub?.Tanggal_Submission),
      status,
      score:sub?.Nilai===''||sub?.Nilai==null?null:Number(sub?.Nilai),
      feedback:String(sub?.Feedback||''),
      deadline:dt_(t.Deadline),
      canSubmit:status==='Not Submitted'||status==='Needs Revision'
    };
  });
}

function submitAssignment(token,form){
  try{
    const args=resolveUploadArgs_(token,form),sessionToken=args.token,uploadForm=args.form;
    const access=requireActiveStudent_(sessionToken),s=access.session,st=access.student;
    const taskId=text_(uploadForm&&uploadForm.taskId,100);
    const task=findRow_(COG.SHEETS.TASKS,'ID_Tugas',taskId);
    if(!task)return fail_('Assignment not found.');

    const studentBatch=String(st.ID_Batch||'').trim();
    const taskBatch=String(task.ID_Batch||'').trim();
    if(taskBatch && taskBatch!=='ALL' && taskBatch!==studentBatch)return fail_('This assignment is not assigned to your batch.');

    const existing=rows_(COG.SHEETS.SUBMISSIONS).find(x=>String(x.ID_Tugas||'')===taskId&&normEmail_(x.Email_Siswa)===s.email);
    const existingStatus=taskStatusForSubmission_(existing?.Status_Penilaian||'');
    if(existing && existingStatus==='Under Assessment')return fail_('Assignment is already submitted and under assessment.');
    if(existing && existingStatus==='Assessed')return fail_('Assignment has already been assessed.');

    const blob=uploadForm&&uploadForm.file;
    validateBlob_(blob);
    const root=ensureStudentRootFolder_(st),dir=folder_(root,'Assignments');
    const submittedAt=new Date();
    const name='TASK-'+taskId+'-'+Utilities.formatDate(submittedAt,tz_(),'yyyyMMdd-HHmmss')+'-'+safeFile_(blob.getName());
    const file=dir.createFile(blob.copyBlob().setName(name));
    const jenis=text_(uploadForm&&uploadForm.jenis,50)||'File Submission';
    const catatan=text_(uploadForm&&uploadForm.catatan,1000);
    file.setDescription('COGNIORA assignment submission\nStudent: '+s.email+'\nTask: '+taskId+'\nType: '+jenis+'\nNote: '+catatan);

    const row={
      ID_Submission:String(existing?.ID_Submission||id_('SUB')),
      ID_Tugas:taskId,
      ID_Siswa:String(st.ID_Siswa||''),
      Email_Siswa:s.email,
      Link_File:file.getUrl(),
      Jenis_File:jenis,
      Catatan:catatan,
      Tanggal_Submission:submittedAt,
      Status_Penilaian:'Under Assessment',
      Nilai:'',
      Feedback:existing?.Feedback||'',
      Updated_At:submittedAt
    };
    if(existing)update_(COG.SHEETS.SUBMISSIONS,existing._row,row);
    else append_(COG.SHEETS.SUBMISSIONS,row);

    return ok_('Assignment has been submitted.',{url:file.getUrl(),status:'Under Assessment',submittedAt:dt_(submittedAt)});
  }catch(e){return fail_('Assignment submission failed: '+err_(e));}
}
function materials_(st){const mt=batchProgress_(st).meeting,batchId=String(st.ID_Batch||'');return rows_(COG.SHEETS.MATERIALS).filter(r=>isActiveValue_(r.Status_Aktif)&&(!r.ID_Batch||String(r.ID_Batch)===batchId||String(r.ID_Batch)==='ALL')).map(r=>{const cat=String(r.Kategori||'').toUpperCase(),need=Number(r.Syarat_Pertemuan||0),locked=mt<need,u=safeUrl_(r.Link_Akses||'');let viewer=u;if(!locked&&cat==='PDF')viewer=drivePreview_(u)||u;if(!locked&&cat==='VIDEO')viewer=ytEmbed_(u)||u;return{id:String(r.ID_Materi||''),requiredMeeting:need,category:cat,title:String(r.Judul_Materi||''),description:String(r.Deskripsi||''),link:viewer,locked,status:locked?'Locked':'Available'}})}
function scheduleForStudent_(st){const n=Date.now(),batchId=String(st.ID_Batch||'');return rows_(COG.SHEETS.SCHEDULE).map(r=>({id:String(r.ID_Sesi||''),title:String(r.Nama_Kegiatan||''),start:dt_(r.Waktu_Mulai),end:time_(r.Waktu_Selesai),startTs:date_(r.Waktu_Mulai),meetLink:safeUrl_(r.Link_Meet||''),reminderStatus:String(r.Status_Reminder_WA||'Belum'),batchId:String(r.ID_Batch||'ALL')})).filter(x=>x.startTs>n-3600000&&(x.batchId==='ALL'||x.batchId===batchId)).sort((a,b)=>a.startTs-b.startTs).map(x=>{delete x.startTs;return x;});}
function getSchedule(token){try{const x=requireActiveStudent_(token);return ok_('Jadwal dimuat.',scheduleForStudent_(x.student));}catch(e){return fail_('Jadwal gagal dimuat: '+err_(e));}}
function searchStudentContent(token,query){
  try{
    const access=requireActiveStudent_(token),st=access.student,email=access.session.email;
    const raw=String(query??'').trim();
    if(!raw)return ok_('Pencarian kosong.',{query:'',results:[],total:0});
    const terms=norm_(raw).split(/\s+/).filter(Boolean).slice(0,8);
    const contains=values=>{const hay=values.map(v=>norm_(v)).join(' ');return terms.every(t=>hay.includes(t));};
    const score=(values,title)=>{const titleNorm=norm_(title),valueNorms=values.map(v=>norm_(v));let n=0;terms.forEach(t=>{if(titleNorm.includes(t))n+=4;if(valueNorms.some(v=>v.includes(t)))n+=1;});return n;};
    const results=[];
    materials_(st).forEach(m=>{const values=[m.title,m.description,m.category,m.status,String(m.requiredMeeting||'')];if(contains(values))results.push({type:'material',id:String(m.id||''),title:String(m.title||'Untitled Material'),description:String(m.description||''),meta:'Material • '+String(m.category||'')+' • '+String(m.status||''),locked:!!m.locked,_score:score(values,m.title)});});
    assignments_(email).forEach(a=>{const values=[a.topic,a.description,a.status,a.deadline];if(contains(values))results.push({type:'assignment',id:String(a.id||''),title:String(a.topic||'Untitled Assignment'),description:String(a.description||''),meta:'Assignment • '+String(a.status||''),locked:false,_score:score(values,a.topic)});});
    scheduleForStudent_(st).forEach(x=>{const values=[x.title,x.start,x.end,x.reminderStatus];if(contains(values))results.push({type:'schedule',id:String(x.id||''),title:String(x.title||'Class Schedule'),description:String(x.start||'')+(x.end?' — '+String(x.end):''),meta:'Schedule',locked:false,_score:score(values,x.title)});});
    results.sort((a,b)=>b._score-a._score||a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
    const total=results.length,limited=results.slice(0,12).map(x=>{const y=Object.assign({},x);delete y._score;return y;});
    return ok_('Hasil pencarian dimuat.',{query:raw,results:limited,total});
  }catch(e){return fail_('Pencarian gagal: '+err_(e));}
}

function reports_(st){const active=batchProgress_(st).month,scores=rows_(COG.SHEETS.REPORT_SCORES).filter(r=>normEmail_(r.Email_Siswa)===normEmail_(st.Email)),months=[];for(let i=1;i<=active;i++){const ml='Month '+i;const nums=scores.filter(r=>norm_(r.Bulan_Evaluasi)===norm_(ml)&&r.Nilai!==''&&r.Nilai!=null).map(r=>Number(r.Nilai)).filter(Number.isFinite);months.push({monthNumber:i,monthLabel:ml,average:nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*10)/10:null,hasScore:nums.length>0});}return months;}
function getReports(token){try{const s=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);return st?ok_('Progress rapor dimuat.',reports_(st)):fail_('Data siswa tidak ditemukan.');}catch(e){return fail_('Progress rapor gagal dimuat: '+err_(e));}}
function getDashboardData(token){try{const s=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);if(!st)return fail_('Data siswa tidak ditemukan.');const progress=progress_(st),active=studentActiveStatus_(st)==='Aktif',classes=active?scheduleForStudent_(st):[],tasks=active?assignments_(s.email):[],pay=payments_(s.email),reports=reports_(st),cert=certificate_(st);return ok_('Dashboard berhasil dimuat.',{student:safeStudent_(st),progress,upcomingClasses:classes.slice(0,5),recentAssignments:tasks.slice(0,5),paymentSummary:pay.summary,availableReports:reports,certificate:cert,alumni:{active:cert.status==='available'&&!!getSettings_().LINK_GRUP_ALUMNI,link:safeUrl_(getSettings_().LINK_GRUP_ALUMNI||'')}});}catch(e){return fail_('Dashboard gagal dimuat: '+err_(e));}}


function googleDocsAuthorizationInfo_(){
  try{
    const info=ScriptApp.getAuthorizationInfo(
      ScriptApp.AuthMode.FULL,
      [COG.CERTIFICATE.DOCS_SCOPE]
    );
    const status=info.getAuthorizationStatus();
    return {
      status:String(status||''),
      authorized:status===ScriptApp.AuthorizationStatus.ALREADY_GRANTED,
      authorizationUrl:String(info.getAuthorizationUrl()||''),
      requiredScope:COG.CERTIFICATE.DOCS_SCOPE
    };
  }catch(e){
    return {
      status:'ERROR',
      authorized:false,
      authorizationUrl:'',
      requiredScope:COG.CERTIFICATE.DOCS_SCOPE,
      error:err_(e)
    };
  }
}

function requireGoogleDocsScope_(){
  ScriptApp.requireScopes(
    ScriptApp.AuthMode.FULL,
    [COG.CERTIFICATE.DOCS_SCOPE]
  );
}

function getGoogleDocsAuthorizationInfo(token){
  try{
    requireAdminSession_(token);
    return ok_('Status otorisasi Google Docs dimuat.',googleDocsAuthorizationInfo_());
  }catch(e){return fail_('Status otorisasi Google Docs gagal dimuat: '+err_(e));}
}

function authorizeGoogleDocsAccess(token){
  try{
    requireAdminSession_(token);
    requireGoogleDocsScope_();
    const cfg=getCertificateConfig_();
    if(!cfg.templateId)throw new Error('Google Docs template belum dikonfigurasi.');
    const doc=DocumentApp.openById(cfg.templateId);
    const info=googleDocsAuthorizationInfo_();
    return ok_('Akses Google Docs berhasil diotorisasi.',{
      authorized:true,
      status:info.status,
      authorizationUrl:'',
      templateId:cfg.templateId,
      templateName:doc.getName()
    });
  }catch(e){
    const info=googleDocsAuthorizationInfo_();
    return fail_('Akses Google Docs belum diotorisasi. Gunakan tombol "Authorize Google Docs" untuk memberikan izin, lalu ulangi Save Config.',{
      authorizationUrl:info.authorizationUrl,
      authorizationStatus:info.status,
      requiredScope:info.requiredScope,
      detail:err_(e)
    });
  }
}

function configureCertificateSettings(){
  try{
    requireMaintenance_();
    setupCertificateSchema();
    const cfg=getCertificateConfig_();
    removeLegacyCertificateTemplateSetting_();
    return ok_('Konfigurasi sertifikat Google Docs saat ini.',{
      templateId:cfg.templateId,
      templateVersion:cfg.version,
      numberPrefix:cfg.prefix,
      templateType:'Google Docs'
    });
  }catch(e){return fail_('Konfigurasi sertifikat gagal: '+err_(e));}
}

function saveCertificateTemplateSettings(token,p){
  try{
    requireAdminSession_(token);
    const templateId=text_(p?.templateId,100),
      version=text_(p?.version,40)||COG.CERTIFICATE.DEFAULT_TEMPLATE_VERSION,
      prefix=text_(p?.numberPrefix,80)||COG.CERTIFICATE.DEFAULT_NUMBER_PREFIX;
    if(!/^[A-Za-z0-9_-]{20,}$/.test(templateId))return fail_('Google Docs Template ID tidak valid.');
    try{
      requireGoogleDocsScope_();
      const file=DriveApp.getFileById(templateId);
      const mime=String(file.getMimeType()||'');
      if(mime!=='application/vnd.google-apps.document'){
        return fail_('Template sertifikat harus berupa Google Docs, bukan Spreadsheet/Excel.');
      }
      DocumentApp.openById(templateId).getName();
    }catch(e){
      const info=googleDocsAuthorizationInfo_();
      return fail_('Google Docs Template tidak dapat dibuka: '+err_(e),{
        authorizationUrl:info.authorizationUrl,
        authorizationStatus:info.status,
        requiredScope:info.requiredScope,
        detail:err_(e)
      });
    }
    setSetting_('CERTIFICATE_TEMPLATE_ID',templateId);
    setSetting_('CERTIFICATE_TEMPLATE_VERSION',version);
    setSetting_('CERTIFICATE_NUMBER_PREFIX',prefix);
    removeCertificateQrSetting_();
    return ok_('Konfigurasi Google Docs template sertifikat berhasil disimpan.',{
      templateId,version,numberPrefix:prefix,templateType:'Google Docs'
    });
  }catch(e){return fail_('Gagal menyimpan konfigurasi sertifikat: '+err_(e));}
}

function testCertificateConfiguration(){
  try{
    requireMaintenance_();
    setupCertificateSchema();
    const cfg=getCertificateConfig_();
    let template=false,error='',templateName='',templateUrl='';
    try{
      const file=DriveApp.getFileById(cfg.templateId);
      const mime=String(file.getMimeType()||'');
      if(mime!=='application/vnd.google-apps.document')throw new Error('Template bukan Google Docs.');
      requireGoogleDocsScope_();
      const doc=DocumentApp.openById(cfg.templateId);
      template=true;
      templateName=doc.getName();
      templateUrl=file.getUrl();
    }catch(e){error=err_(e);}
    const root=ensureCognioraRoot_(),certRoot=folder_(root,'Certificates');
    return ok_('Konfigurasi Google Docs sertifikat diperiksa.',{
      template,templateId:cfg.templateId,error,templateName,templateUrl,
      templateType:'Google Docs',
      templateRule:'Template sertifikat menggunakan satu file Google Docs. File hasil generate akan disimpan sebagai Google Docs dan PDF di folder Certificate.',
      certificateRootId:certRoot.getId(),certificateRootUrl:certRoot.getUrl(),
      version:cfg.version,numberPrefix:cfg.prefix
    });
  }catch(e){return fail_('Test konfigurasi sertifikat gagal: '+err_(e));}
}

function documentText_(doc){
  const parts=[];
  try{parts.push(doc.getBody().getText());}catch(e){}
  try{const h=doc.getHeader();if(h)parts.push(h.getText());}catch(e){}
  try{const f=doc.getFooter();if(f)parts.push(f.getText());}catch(e){}
  return parts.join(' | ');
}

function validateCertificateTemplate(token){
  try{
    requireAdminSession_(token);
    const cfg=getCertificateConfig_();
    if(!cfg.templateId)return fail_('Google Docs template sertifikat belum dikonfigurasi.');
    let doc;
    try{
      const file=DriveApp.getFileById(cfg.templateId);
      if(String(file.getMimeType()||'')!=='application/vnd.google-apps.document'){
        return fail_('Template sertifikat harus berupa Google Docs.');
      }
      requireGoogleDocsScope_();
      doc=DocumentApp.openById(cfg.templateId);
    }catch(e){
      return fail_('Google Docs template tidak dapat dibuka: '+err_(e));
    }
    const certText=documentText_(doc);
    const requiredCertificate=[
      '{{No_Sertifikat}}','{{RATA_RATA_BULAN_1}}','{{RATA_RATA_BULAN_2}}','{{RATA_RATA_BULAN_3}}','{{RATA_RATA_BULAN_4}}','{{RATA_RATA_BULAN_5}}',
      '{{Level}}','{{ID_Siswa}}','{{Nama_Batch}}',
      '{{TOPIK_BULAN_1}}','{{TOPIK_BULAN_2}}','{{TOPIK_BULAN_3}}','{{TOPIK_BULAN_4}}','{{TOPIK_BULAN_5}}',
      '{{ID_Batch}}','{{Tanggal_Mulai}}','{{Tanggal_Selesai}}','{{Tanggal_Diterbitkan}}','{{Nama_Lengkap}}','{{Program}}'
    ];
    const missingCertificate=requiredCertificate.filter(x=>!certText.includes(x));
    return missingCertificate.length
      ? fail_('Google Docs template sertifikat belum lengkap.',{missingCertificate})
      : ok_('Google Docs template sertifikat valid.',{
          templateId:cfg.templateId,version:cfg.version,templateType:'Google Docs',
          templateName:doc.getName(),
          note:'Placeholder dapat ditempatkan pada body, tabel, header, atau footer Google Docs.'
        });
  }catch(e){return fail_('Validasi template Google Docs gagal: '+err_(e));}
}

function removeLegacyCertificateTemplateSetting_(){
  try{
    const stored=findSetting_('CERTIFICATE_TEMPLATE_ID');
    if(!stored || !String(stored.Value||'').trim()){
      setSetting_('CERTIFICATE_TEMPLATE_ID',COG.CERTIFICATE.DEFAULT_TEMPLATE_ID);
      return COG.CERTIFICATE.DEFAULT_TEMPLATE_ID;
    }
    const current=String(stored.Value||'').trim();
    if(current===COG.CERTIFICATE.DEFAULT_TEMPLATE_ID)return current;
    try{
      const file=DriveApp.getFileById(current);
      if(String(file.getMimeType()||'')==='application/vnd.google-apps.document')return current;
    }catch(e){}
    setSetting_('CERTIFICATE_TEMPLATE_ID',COG.CERTIFICATE.DEFAULT_TEMPLATE_ID);
    return COG.CERTIFICATE.DEFAULT_TEMPLATE_ID;
  }catch(e){return COG.CERTIFICATE.DEFAULT_TEMPLATE_ID;}
}

function getCertificateConfig_(){
  const s=getSettings_();
  let templateId=String(s.CERTIFICATE_TEMPLATE_ID||'').trim();
  if(!templateId){
    templateId=COG.CERTIFICATE.DEFAULT_TEMPLATE_ID;
    setSetting_('CERTIFICATE_TEMPLATE_ID',templateId);
  }else{
    try{
      const file=DriveApp.getFileById(templateId);
      if(String(file.getMimeType()||'')!=='application/vnd.google-apps.document'){
        templateId=COG.CERTIFICATE.DEFAULT_TEMPLATE_ID;
        setSetting_('CERTIFICATE_TEMPLATE_ID',templateId);
      }
    }catch(e){
      templateId=COG.CERTIFICATE.DEFAULT_TEMPLATE_ID;
      try{setSetting_('CERTIFICATE_TEMPLATE_ID',templateId);}catch(ignore){}
    }
  }
  return {
    templateId,
    version:String(s.CERTIFICATE_TEMPLATE_VERSION||COG.CERTIFICATE.DEFAULT_TEMPLATE_VERSION),
    prefix:String(s.CERTIFICATE_NUMBER_PREFIX||COG.CERTIFICATE.DEFAULT_NUMBER_PREFIX),
    type:'Google Docs'
  };
}

function getAdminCertificateConfig(token){
  try{requireAdminSession_(token);return ok_('Konfigurasi sertifikat dimuat.',getCertificateConfig_());}
  catch(e){return fail_('Konfigurasi sertifikat gagal dimuat: '+err_(e));}
}

function listCertificateRows_(){
  ensureCertificateSupportSheets_();
  return rows_(COG.SHEETS.CERTS);
}

function findLatestCertificate_(st){
  if(!st)return null;
  const sid=String(st.ID_Siswa||'').trim(),bid=String(st.ID_Batch||'').trim(),em=normEmail_(st.Email);
  const list=listCertificateRows_().filter(r=>{
    const rid=String(r.ID_Siswa||'').trim(),rbid=String(r.ID_Batch||'').trim(),rem=normEmail_(r.Email_Siswa);
    if(sid && bid && rid) return rid===sid && rbid===bid;
    if(sid && rid) return rid===sid;
    return rem===em;
  }).sort((a,b)=>date_(b.Updated_At||b.Generated_At||b.Tanggal_Diterbitkan)-date_(a.Updated_At||a.Generated_At||a.Tanggal_Diterbitkan));
  return list[0]||null;
}

function nextCertificateNumber_(prefix,skipLock){
  const p=String(prefix||'COGNIORA-CERT').trim()||'COGNIORA-CERT';
  const year=Utilities.formatDate(new Date(),tz_(),'yyyy');
  const key='CERT_COUNTER_'+sha_(p+'|'+year).slice(0,12);
  let lock=null;
  if(!skipLock){lock=LockService.getScriptLock();lock.waitLock(15000);}
  try{
    const old=findSetting_(key),current=old?Number(old.Value||0):0,next=current+1;
    setSetting_(key,next);
    return p+'-'+year+'-'+String(next).padStart(4,'0');
  }finally{if(lock){try{lock.releaseLock();}catch(e){}}}
}


function certificateEligibleWithContext_(st,context){
  if(!st)return{eligible:false,reason:'Siswa tidak ditemukan.'};
  if(norm_(st.Status_Kelulusan)!=='lulus')return{eligible:false,reason:'Status kelulusan bukan Lulus.'};
  const batch=context.batchMap[String(st.ID_Batch||'')];
  if(!batch)return{eligible:false,reason:'Batch siswa tidak ditemukan.'};
  const level=String(batch.Level||'').trim();
  if(!level)return{eligible:false,reason:'Level batch belum diisi.'};
  const topicRows=context.topics.filter(r=>isActiveValue_(r.Status_Aktif)&&norm_(r.Level)===norm_(level)).sort((a,b)=>Number(a.Urutan||0)-Number(b.Urutan||0)||monthNum_(a.Bulan)-monthNum_(b.Bulan));
  const selected=topicRows.filter(r=>monthNum_(r.Bulan)>0).slice(0,5);
  if(selected.length<5)return{eligible:false,reason:'Topik bulanan untuk level '+level+' belum lengkap (wajib 5 bulan).'};
  const studentScores=context.scores.filter(r=>normEmail_(r.Email_Siswa)===normEmail_(st.Email));
  const monthly=[];
  for(let month=1;month<=5;month++){
    const topic=selected.find(r=>monthNum_(r.Bulan)===month);
    if(!topic)return{eligible:false,reason:'Topik bulan '+month+' belum tersedia.',monthly};
    const aspectRows=context.aspects.filter(a=>isActiveValue_(a.Status_Aktif)&&monthNum_(a.Bulan_Evaluasi)===month);
    const mapped={};aspectRows.forEach(a=>mapped[norm_(a.Nama_Aspek)]=a);
    const wanted=['speaking','listening','reading','writing','grammar'],vals={};
    for(const key of wanted){const a=mapped[key];if(!a)return{eligible:false,reason:'Aspek '+key+' bulan '+month+' belum tersedia.',monthly};const sc=studentScores.find(x=>String(x.ID_Aspek||'')===String(a.ID_Aspek||''));if(sc?.Nilai===''||sc?.Nilai==null||!isFinite(Number(sc.Nilai)))return{eligible:false,reason:'Nilai '+key+' bulan '+month+' belum lengkap.',monthly};vals[key]=Number(sc.Nilai);}
    const average=Math.round((vals.speaking+vals.listening+vals.reading+vals.writing+vals.grammar)/5*10)/10;
    monthly.push({month,topic:String(topic.Topik||''),speaking:vals.speaking,listening:vals.listening,reading:vals.reading,writing:vals.writing,grammar:vals.grammar,average});
  }
  const overall=Math.round(monthly.reduce((a,b)=>a+b.average,0)/monthly.length*10)/10;
  return{eligible:true,monthly,overall,batch};
}

function certificateEligible_(st){
  const batches=rows_(COG.SHEETS.BATCHES),topics=rows_(COG.SHEETS.TOPICS),aspects=rows_(COG.SHEETS.REPORT_ASPECTS),scores=rows_(COG.SHEETS.REPORT_SCORES);
  const batchMap={};batches.forEach(r=>batchMap[String(r.ID_Batch||'')]=r);
  return certificateEligibleWithContext_(st,{batchMap,topics,aspects,scores});
}

function buildCertificateData_(st,certNo,issuedAt){
  const eligibility=certificateEligible_(st);
  if(!eligibility.eligible)throw new Error(eligibility.reason);
  const batch=eligibility.batch;
  const data={
    ID_Siswa:String(st.ID_Siswa||''),Nama_Lengkap:String(st.Nama_Lengkap||''),ID_Batch:String(st.ID_Batch||''),
    Nama_Batch:String(batch.Nama_Batch||''),Program:String(batch.Program||''),Level:String(batch.Level||''),
    Tanggal_Mulai:fmt_(batch.Tanggal_Mulai),Tanggal_Selesai:fmt_(batch.Tanggal_Selesai),Status_Kelulusan:String(st.Status_Kelulusan||''),
    No_Sertifikat:String(certNo||''),Tanggal_Diterbitkan:fmt_(issuedAt),
    ID_Sertifikat:'',Template_Version:getCertificateConfig_().version,Generated_At:dt_(issuedAt),Generated_By:'',
    monthly:eligibility.monthly,OVERALL_AVERAGE:eligibility.overall
  };
  for(let i=1;i<=5;i++){
    const m=eligibility.monthly[i-1];
    data['TOPIK_BULAN_'+i]=m.topic;
    data['RATA_RATA_BULAN_'+i]=m.average;
    data['M'+i+'_SPEAKING']=m.speaking;
    data['M'+i+'_LISTENING']=m.listening;
    data['M'+i+'_READING']=m.reading;
    data['M'+i+'_WRITING']=m.writing;
    data['M'+i+'_GRAMMAR']=m.grammar;
    data['M'+i+'_AVERAGE']=m.average;
  }
  return data;
}

function escapeRegex_(s){
  return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

function replaceContainerTokens_(container,data){
  if(!container || typeof container.replaceText!=='function')return;
  Object.keys(data||{}).forEach(k=>{
    if(k==='monthly')return;
    const token='{{'+k+'}}';
    const value=data[k]===null||data[k]===undefined?'':String(data[k]);
    try{container.replaceText(escapeRegex_(token),value);}catch(e){console.log('Document token warning %s: %s',token,e);}
  });
}

function replaceDocumentTokens_(doc,data){
  replaceContainerTokens_(doc.getBody(),data);
  try{const header=doc.getHeader();if(header)replaceContainerTokens_(header,data);}catch(e){console.log('Document header token warning: %s',err_(e));}
  try{const footer=doc.getFooter();if(footer)replaceContainerTokens_(footer,data);}catch(e){console.log('Document footer token warning: %s',err_(e));}
}

function removeLegacyQrPlaceholder_(doc){
  replaceDocumentTokens_(doc,{'QR_CODE':''});
  return 1;
}

function enforceLandscape_(doc){
  try{
    const body=doc.getBody();
    if(typeof body.getPageWidth==='function' && typeof body.getPageHeight==='function' &&
       typeof body.setPageWidth==='function' && typeof body.setPageHeight==='function'){
      const width=Number(body.getPageWidth()||0),height=Number(body.getPageHeight()||0);
      if(width>0 && height>0 && height>width){
        body.setPageWidth(height);
        body.setPageHeight(width);
      }
    }
  }catch(e){console.log('Landscape page setup warning: %s',err_(e));}
}

function copyCertificateTemplate_(student,data,archiveRoot){
  const cfg=getCertificateConfig_();
  if(!cfg.templateId)throw new Error('Google Docs template sertifikat belum dikonfigurasi.');
  const template=DriveApp.getFileById(cfg.templateId);
  if(String(template.getMimeType()||'')!=='application/vnd.google-apps.document'){
    throw new Error('Template sertifikat harus berupa Google Docs.');
  }
  const revisionStamp=String(data._REVISION_STAMP||'').trim();
  const archiveName='CERT-'+safeFile_(data.No_Sertifikat)+' - '+safeFile_(student.Nama_Lengkap)+(revisionStamp?' - '+revisionStamp:'');
  const copy=template.makeCopy(archiveName,archiveRoot);
  requireGoogleDocsScope_();
  const doc=DocumentApp.openById(copy.getId());
  replaceDocumentTokens_(doc,data);
  removeLegacyQrPlaceholder_(doc);
  enforceLandscape_(doc);
  doc.saveAndClose();
  return {file:copy,doc};
}

function authorizeCertificatePdfExport(){
  try{
    requireGoogleDocsScope_();
    const cfg=getCertificateConfig_();
    const doc=DocumentApp.openById(cfg.templateId);
    const file=DriveApp.getFileById(cfg.templateId);
    return ok_('Google Docs certificate export siap digunakan.',{
      templateId:cfg.templateId,templateName:doc.getName(),templateType:'Google Docs',mimeType:file.getMimeType(),authorized:true
    });
  }catch(e){
    const info=googleDocsAuthorizationInfo_();
    return fail_('Otorisasi Google Docs belum diberikan.',{
      authorizationUrl:info.authorizationUrl,
      authorizationStatus:info.status,
      requiredScope:info.requiredScope,
      detail:err_(e)
    });
  }
}

function exportDocumentAsPdf_(docFile){
  if(!docFile)throw new Error('File Google Docs sertifikat tidak ditemukan.');
  try{
    const blob=docFile.getAs(MimeType.PDF);
    return blob.setContentType('application/pdf');
  }catch(e){throw new Error('Export Google Docs ke PDF gagal: '+err_(e));}
}

function upsertCertificate_(obj){
  const existing=obj.existing;
  if(existing){update_(COG.SHEETS.CERTS,existing._row,obj.row);return obj.row.ID_Sertifikat;}
  append_(COG.SHEETS.CERTS,obj.row);return obj.row.ID_Sertifikat;
}

function writeCertificateScoresSnapshot_(certificateId,studentId,monthly){
  const existing=rows_(COG.SHEETS.CERT_SCORES).filter(r=>String(r.ID_Sertifikat||'')===String(certificateId||''));
  existing.reverse().forEach(r=>deleteRow_(COG.SHEETS.CERT_SCORES,r._row));
  monthly.forEach(m=>append_(COG.SHEETS.CERT_SCORES,{
    ID_Sertifikat_Nilai:id_('CERTSCORE'),ID_Sertifikat:certificateId,ID_Siswa:studentId,Bulan:m.month,Topik:m.topic,
    Speaking:m.speaking,Listening:m.listening,Reading:m.reading,Writing:m.writing,Grammar:m.grammar,Rata_Rata_Bulanan:m.average,Created_At:new Date()
  }));
}

function appendCertificateLog_(entry){
  append_(COG.SHEETS.CERT_LOG,{
    ID_Log:id_('CERTLOG'),ID_Sertifikat:entry.ID_Sertifikat,No_Sertifikat:entry.No_Sertifikat,ID_Siswa:entry.ID_Siswa,
    Email_Siswa:entry.Email_Siswa,Nama_Siswa:entry.Nama_Siswa,ID_Batch:entry.ID_Batch,Action:entry.Action,
    Action_By:entry.Action_By,Action_At:new Date(),Previous_Status:entry.Previous_Status||'',New_Status:entry.New_Status||'',
    Reason:entry.Reason||'',Template_Version:entry.Template_Version||'',Template_Type:entry.Template_Type||'Google Docs',
    File_ID_Document:entry.File_ID_Document||'',Link_Document:entry.Link_Document||'',
    File_ID_Spreadsheet:entry.File_ID_Spreadsheet||'',Link_Spreadsheet:entry.Link_Spreadsheet||'',
    File_ID_PDF:entry.File_ID_PDF||'',Link_PDF:entry.Link_PDF||'',
    Certificate_Data_Snapshot:JSON.stringify(entry.Snapshot||{})
  });
}

function generateCertificateCore_(admin,studentId,options){
  options=options||{};
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const st=findRow_(COG.SHEETS.STUDENTS,'ID_Siswa',String(studentId||''));
    if(!st)throw new Error('Siswa tidak ditemukan.');
    const eligibility=certificateEligible_(st);
    if(!eligibility.eligible)throw new Error(eligibility.reason);
    const existing=findLatestCertificate_(st);
    if(existing && norm_(existing.Status)==='generated' && !options.force){
      return {status:'skipped',studentId:String(st.ID_Siswa||''),name:String(st.Nama_Lengkap||''),certificateId:String(existing.ID_Sertifikat||''),certificateNo:String(existing.No_Sertifikat||''),linkPdf:String(existing.Link_PDF||''),message:'Sertifikat sudah tersedia.'};
    }
    const cfg=getCertificateConfig_();
    const issuedAt=new Date();
    const certId=String(existing?.ID_Sertifikat||id_('CERT'));
    // IMPORTANT: regeneration keeps the original certificate number.
    // Only the generated file revision is new.
    const certNo=String(existing?.No_Sertifikat||nextCertificateNumber_(cfg.prefix,true));
    const data=buildCertificateData_(st,certNo,issuedAt);
    data.ID_Sertifikat=certId;data.Generated_By=String(admin.name||admin.email||'Admin');data.Template_Version=cfg.version;
    if(options.force&&existing){
      data._REVISION_STAMP=Utilities.formatDate(issuedAt,tz_(),'yyyyMMdd-HHmmss');
    }
    const root=ensureCognioraRoot_();
    const archiveRoot=folder_(root,'Certificates');
    const folder=ensureStudentRootFolder_(st);
    const certFolder=folder_(folder,'Certificate');
    const copy=copyCertificateTemplate_(st,data,archiveRoot);
    const pdfBlob=exportDocumentAsPdf_(copy.file);
    const pdfName=certNo+' - '+safeFile_(st.Nama_Lengkap)+(options.force&&existing?' - '+Utilities.formatDate(issuedAt,tz_(),'yyyyMMdd-HHmmss'):'')+'.pdf';
    const pdf=certFolder.createFile(pdfBlob.setName(pdfName));
    pdf.setDescription('COGNIORA Certificate\nCertificate No: '+certNo+'\nStudent: '+st.Email+'\nCertificate ID: '+certId);
    ensureCertificatePdfOnlineAccess_(pdf);
    const row={
      ID_Sertifikat:certId,No_Sertifikat:certNo,ID_Siswa:String(st.ID_Siswa||''),Email_Siswa:normEmail_(st.Email),Nama_Siswa:String(st.Nama_Lengkap||''),
      ID_Batch:String(st.ID_Batch||''),Nama_Batch:String(eligibility.batch.Nama_Batch||''),Program:String(eligibility.batch.Program||''),Level:String(eligibility.batch.Level||''),
      Tanggal_Mulai:eligibility.batch.Tanggal_Mulai||'',Tanggal_Selesai:eligibility.batch.Tanggal_Selesai||'',Tanggal_Diterbitkan:issuedAt,Template_ID:cfg.templateId,
      Template_Version:cfg.version,Template_Type:'Google Docs',
      File_ID_Document:copy.file.getId(),Link_Document:copy.file.getUrl(),
      File_ID_Spreadsheet:'',Link_Spreadsheet:'',File_ID_PDF:pdf.getId(),Link_PDF:pdf.getUrl(),
      Status:'Generated',Generated_At:issuedAt,Generated_By:String(admin.name||admin.email||'Admin'),Updated_At:issuedAt
    };
    upsertCertificate_({existing,row});
    writeCertificateScoresSnapshot_(certId,String(st.ID_Siswa||''),data.monthly);
    appendCertificateLog_({
      ID_Sertifikat:certId,No_Sertifikat:certNo,ID_Siswa:String(st.ID_Siswa||''),Email_Siswa:normEmail_(st.Email),Nama_Siswa:String(st.Nama_Lengkap||''),ID_Batch:String(st.ID_Batch||''),
      Action:existing?'REGENERATED':'GENERATED',Action_By:String(admin.name||admin.email||'Admin'),Previous_Status:String(existing?.Status||''),New_Status:'Generated',Reason:options.reason||'',Template_Version:cfg.version,Template_Type:'Google Docs',
      File_ID_Document:copy.file.getId(),Link_Document:copy.file.getUrl(),File_ID_Spreadsheet:'',Link_Spreadsheet:'',File_ID_PDF:pdf.getId(),Link_PDF:pdf.getUrl(),Snapshot:data
    });
    return {status:existing?'regenerated':'generated',studentId:String(st.ID_Siswa||''),name:String(st.Nama_Lengkap||''),certificateId:certId,certificateNo:certNo,linkPdf:pdf.getUrl(),linkDocument:copy.file.getUrl(),linkSpreadsheet:'',message:existing?'Sertifikat berhasil dibuat ulang.':'Sertifikat berhasil dibuat.'};
  }finally{try{lock.releaseLock();}catch(e){}}
}

function generateCertificate(token,studentId){
  try{
    const s=requireAdminSession_(token);
    const admin={name:s.adminName,email:s.email};
    return ok_('Generate sertifikat diproses.',generateCertificateCore_(admin,studentId,{force:false}));
  }catch(e){return fail_('Generate sertifikat gagal: '+err_(e));}
}

function reissueCertificate(token,certificateId,reason){
  try{
    const s=requireAdminSession_(token);
    const id=String(certificateId||'').trim();
    const r=findRow_(COG.SHEETS.CERTS,'ID_Sertifikat',id);
    if(!r)return fail_('Sertifikat tidak ditemukan.');
    if(norm_(r.Status)!=='revoked')return fail_('Sertifikat belum berstatus Revoked.');

    // Reissue dari certificate yang sudah pernah berhasil dibuat tidak perlu
    // memanggil UrlFetchApp. File PDF dan Google Docs hasil generate sebelumnya
    // cukup diaktifkan kembali sehingga proses tidak tergantung external_request.
    const pdfId=String(r.File_ID_PDF||'').trim();
    const pdfUrl=safeUrl_(r.Link_PDF||'');
    if(!pdfId && !pdfUrl) return fail_('Arsip PDF sertifikat tidak ditemukan. Gunakan Regenerate untuk membuat file sertifikat baru.');

    if(pdfId){
      try{DriveApp.getFileById(pdfId);}catch(e){return fail_('File PDF sertifikat lama tidak dapat diakses. Gunakan Regenerate untuk membuat sertifikat baru.');}
    }

    const previousStatus=String(r.Status||'');
    const now=new Date();
    update_(COG.SHEETS.CERTS,r._row,{Status:'Generated',Updated_At:now});
    appendCertificateLog_({
      ID_Sertifikat:id,No_Sertifikat:String(r.No_Sertifikat||''),ID_Siswa:String(r.ID_Siswa||''),
      Email_Siswa:normEmail_(r.Email_Siswa),Nama_Siswa:String(r.Nama_Siswa||''),ID_Batch:String(r.ID_Batch||''),
      Action:'REISSUED',Action_By:String(s.adminName||s.email),Previous_Status:previousStatus,New_Status:'Generated',
      Reason:text_(reason,500)||'Certificate reissued.',Template_Version:String(r.Template_Version||''),
      File_ID_Document:String(r.File_ID_Document||''),Link_Document:String(r.Link_Document||''),File_ID_Spreadsheet:String(r.File_ID_Spreadsheet||''),Link_Spreadsheet:String(r.Link_Spreadsheet||''),
      File_ID_PDF:pdfId,Link_PDF:String(r.Link_PDF||''),Snapshot:r
    });

    return ok_('Sertifikat berhasil di-reissue.',{
      status:'reissued',certificateId:id,certificateNo:String(r.No_Sertifikat||''),
      linkPdf:pdfUrl,linkDocument:safeUrl_(r.Link_Document||''),linkSpreadsheet:safeUrl_(r.Link_Spreadsheet||''),
      message:'Sertifikat sebelumnya berhasil diaktifkan kembali.'
    });
  }catch(e){return fail_('Reissue sertifikat gagal: '+err_(e));}
}

function regenerateCertificate(token,studentId,reason){
  try{
    const s=requireAdminSession_(token);
    const why=text_(reason,500)||'Regenerate by admin.';
    const st=findRow_(COG.SHEETS.STUDENTS,'ID_Siswa',String(studentId||''));
    if(!st)throw new Error('Siswa tidak ditemukan.');
    const existing=findLatestCertificate_(st);
    // Backward-compatible guard: if an old frontend still calls regenerate
    // for a revoked certificate, reissue it without UrlFetchApp.
    if(existing && norm_(existing.Status)==='revoked'){
      return ok_('Sertifikat berhasil di-reissue.',reissueCertificateCore_({name:s.adminName,email:s.email},existing,why));
    }
    return ok_('Regenerate sertifikat diproses.',generateCertificateCore_({name:s.adminName,email:s.email},studentId,{force:true,reason:why}));
  }catch(e){return fail_('Regenerate sertifikat gagal: '+err_(e));}
}

function reissueCertificateCore_(admin,existing,reason){
  const id=String(existing.ID_Sertifikat||'').trim();
  if(!id)throw new Error('ID sertifikat tidak tersedia.');
  if(norm_(existing.Status)!=='revoked')throw new Error('Sertifikat belum berstatus Revoked.');
  const pdfId=String(existing.File_ID_PDF||'').trim();
  const pdfUrl=safeUrl_(existing.Link_PDF||'');
  if(!pdfId && !pdfUrl)throw new Error('Arsip PDF sertifikat tidak ditemukan. Gunakan Regenerate untuk membuat sertifikat baru.');
  if(pdfId){try{DriveApp.getFileById(pdfId);}catch(e){throw new Error('File PDF sertifikat lama tidak dapat diakses. Gunakan Regenerate untuk membuat sertifikat baru.');}}
  const now=new Date();
  const previousStatus=String(existing.Status||'');
  update_(COG.SHEETS.CERTS,existing._row,{Status:'Generated',Updated_At:now});
  appendCertificateLog_({
    ID_Sertifikat:id,No_Sertifikat:String(existing.No_Sertifikat||''),ID_Siswa:String(existing.ID_Siswa||''),
    Email_Siswa:normEmail_(existing.Email_Siswa),Nama_Siswa:String(existing.Nama_Siswa||''),ID_Batch:String(existing.ID_Batch||''),
    Action:'REISSUED',Action_By:String(admin.name||admin.email||'Admin'),Previous_Status:previousStatus,New_Status:'Generated',
    Reason:reason||'Certificate reissued.',Template_Version:String(existing.Template_Version||''),
    File_ID_Document:String(existing.File_ID_Document||''),Link_Document:String(existing.Link_Document||''),File_ID_Spreadsheet:String(existing.File_ID_Spreadsheet||''),Link_Spreadsheet:String(existing.Link_Spreadsheet||''),
    File_ID_PDF:pdfId,Link_PDF:String(existing.Link_PDF||''),Snapshot:existing
  });
  return {status:'reissued',studentId:String(existing.ID_Siswa||''),name:String(existing.Nama_Siswa||''),certificateId:id,certificateNo:String(existing.No_Sertifikat||''),linkPdf:pdfUrl,linkDocument:safeUrl_(existing.Link_Document||''),linkSpreadsheet:safeUrl_(existing.Link_Spreadsheet||''),message:'Sertifikat berhasil di-reissue.'};
}

function generateCertificatesForBatch(token,batchId){
  try{
    const s=requireAdminSession_(token),bid=String(batchId||'').trim();
    if(!bid)return fail_('Pilih batch.');
    const students=rows_(COG.SHEETS.STUDENTS).filter(r=>String(r.ID_Batch||'')===bid);
    if(!students.length)return fail_('Tidak ada siswa pada batch tersebut.');
    const results=[];
    students.forEach(st=>{
      try{results.push(generateCertificateCore_({name:s.adminName,email:s.email},st.ID_Siswa,{force:false}));}
      catch(e){results.push({status:'error',studentId:String(st.ID_Siswa||''),name:String(st.Nama_Lengkap||''),message:err_(e)});}
    });
    return ok_('Generate batch selesai.',{batchId:bid,total:students.length,success:results.filter(x=>['generated','regenerated','skipped'].includes(x.status)).length,failed:results.filter(x=>x.status==='error').length,results});
  }catch(e){return fail_('Generate batch gagal: '+err_(e));}
}

function revokeCertificate(token,certificateId,reason){
  try{
    const s=requireAdminSession_(token),id=String(certificateId||'').trim(),r=findRow_(COG.SHEETS.CERTS,'ID_Sertifikat',id);
    if(!r)return fail_('Sertifikat tidak ditemukan.');
    if(norm_(r.Status)==='revoked')return fail_('Sertifikat sudah revoked.');
    update_(COG.SHEETS.CERTS,r._row,{Status:'Revoked',Updated_At:new Date()});
    appendCertificateLog_({ID_Sertifikat:id,No_Sertifikat:String(r.No_Sertifikat||''),ID_Siswa:String(r.ID_Siswa||''),Email_Siswa:normEmail_(r.Email_Siswa),Nama_Siswa:String(r.Nama_Siswa||''),ID_Batch:String(r.ID_Batch||''),Action:'REVOKED',Action_By:String(s.adminName||s.email),Previous_Status:String(r.Status||''),New_Status:'Revoked',Reason:text_(reason,500)||'Certificate revoked.',Template_Version:String(r.Template_Version||''),Template_Type:String(r.Template_Type||'Google Docs'),File_ID_Document:String(r.File_ID_Document||''),Link_Document:String(r.Link_Document||''),File_ID_Spreadsheet:String(r.File_ID_Spreadsheet||''),Link_Spreadsheet:String(r.Link_Spreadsheet||''),File_ID_PDF:String(r.File_ID_PDF||''),Link_PDF:String(r.Link_PDF||''),Snapshot:r});
    return ok_('Sertifikat berhasil direvoke.',{certificateId:id,status:'Revoked'});
  }catch(e){return fail_('Revoke sertifikat gagal: '+err_(e));}
}

function getAdminCertificates(token,batchId,status,query){
  try{
    requireAdminSession_(token);
    ensureCertificateSupportSheets_();

    const bid=String(batchId||'').trim(),
      stFilter=norm_(status||''),
      q=norm_(query||'');

    const batchMap={};
    rows_(COG.SHEETS.BATCHES).forEach(r=>batchMap[String(r.ID_Batch||'')]=r);

    const allCerts=listCertificateRows_(),certMap={};
    allCerts.forEach(r=>{
      const key=String(r.ID_Siswa||'')+'|'+String(r.ID_Batch||''),
        prev=certMap[key];
      if(!prev || date_(r.Updated_At||r.Generated_At||r.Tanggal_Diterbitkan)>date_(prev.Updated_At||prev.Generated_At||prev.Tanggal_Diterbitkan))certMap[key]=r;
    });

    const students=rows_(COG.SHEETS.STUDENTS);
    // Report support sheets are read as optional so the Certificate panel can still load
    // and explain why a student is not yet eligible when report data is incomplete.
    const topics=rowsOptional_(COG.SHEETS.TOPICS);
    const aspects=rowsOptional_(COG.SHEETS.REPORT_ASPECTS);
    const scores=rowsOptional_(COG.SHEETS.REPORT_SCORES);
    const context={batchMap,topics,aspects,scores};

    const list=students.map(st=>{
      const b=batchMap[String(st.ID_Batch||'')];
      const c=certMap[String(st.ID_Siswa||'')+'|'+String(st.ID_Batch||'')]||null;
      const eligible=certificateEligibleWithContext_(st,context);
      return {
        studentId:String(st.ID_Siswa||''),
        name:String(st.Nama_Lengkap||''),
        email:normEmail_(st.Email),
        batchId:String(st.ID_Batch||''),
        batchName:String(b?.Nama_Batch||''),
        statusKelulusan:String(st.Status_Kelulusan||''),
        level:String(b?.Level||''),
        eligible:!!eligible.eligible,
        eligibleReason:eligible.reason||'',
        certificateStatus:String(c?.Status||'Not Generated'),
        certificateId:String(c?.ID_Sertifikat||''),
        certificateNo:String(c?.No_Sertifikat||''),
        issuedAt:c?.Tanggal_Diterbitkan?fmt_(c.Tanggal_Diterbitkan):'',
        linkPdf:safeUrl_(c?.Link_PDF||''),
        linkDocument:safeUrl_(c?.Link_Document||''),
        linkSpreadsheet:safeUrl_(c?.Link_Spreadsheet||'')
      };
    }).filter(x=>
      (!bid||x.batchId===bid) &&
      (!stFilter||norm_(x.certificateStatus)===stFilter) &&
      (!q||[x.name,x.email,x.studentId,x.batchName,x.certificateNo].some(v=>norm_(v).includes(q)))
    );

    return ok_('Daftar sertifikat dimuat.',list);
  }catch(e){
    return fail_('Daftar sertifikat gagal dimuat: '+err_(e));
  }
}

function getCertificateDataForStudent_(st,cert){
  const scores=rows_(COG.SHEETS.CERT_SCORES).filter(r=>String(r.ID_Sertifikat||'')===String(cert.ID_Sertifikat||''));
  return scores.map(r=>({month:Number(r.Bulan||0),topic:String(r.Topik||''),average:Number(r.Rata_Rata_Bulanan||0)})).sort((a,b)=>a.month-b.month);
}

function getCertificateStudentData(token){
  try{
    const s=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);if(!st)return fail_('Data siswa tidak ditemukan.');
    const c=findLatestCertificate_(st);
    if(!c||norm_(c.Status)!=='generated')return ok_('Certificate belum tersedia.',{status:'locked'});
    return ok_('Certificate data loaded.',{status:'available',certificate:{certificateNo:String(c.No_Sertifikat||''),issuedAt:fmt_(c.Tanggal_Diterbitkan),program:String(c.Program||''),level:String(c.Level||''),batchName:String(c.Nama_Batch||''),monthly:getCertificateDataForStudent_(st,c),overall:monthlyOverallFromSnapshot_(c)}});
  }catch(e){return fail_('Certificate data gagal dimuat: '+err_(e));}
}

function monthlyOverallFromSnapshot_(cert){
  const rows=getCertificateDataForStudent_(null,cert);
  return rows.length?Math.round(rows.reduce((a,b)=>a+b.average,0)/rows.length*10)/10:null;
}

function ensureCertificatePdfOnlineAccess_(file){
  if(!file)throw new Error('File PDF sertifikat tidak ditemukan.');
  try{
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  }catch(e){
    // Some Workspace domains may forbid public link sharing. In that case
    // keep the existing permission and let the caller report the real cause.
    console.log('Certificate sharing warning: %s',err_(e));
  }
  return file.getUrl();
}

function getCertificatePdf(token){
  try{
    const s=requireStudentSession_(token),st=findRow_(COG.SHEETS.STUDENTS,'Email',s.email);
    if(!st)return fail_('Data siswa tidak ditemukan.');
    const c=findLatestCertificate_(st);
    if(!c||norm_(c.Status)!=='generated'||!c.File_ID_PDF)return fail_('Sertifikat belum tersedia.');
    const file=DriveApp.getFileById(String(c.File_ID_PDF));
    const url=ensureCertificatePdfOnlineAccess_(file);
    return ok_('Link PDF sertifikat dimuat.',{
      name:file.getName(),
      mimeType:'application/pdf',
      url,
      certificateNo:String(c.No_Sertifikat||'')
    });
  }catch(e){return fail_('PDF sertifikat gagal dimuat: '+err_(e));}
}

function verifyCertificatePublic(no){
  try{
    const code=text_(no,120);if(!code)return fail_('Nomor sertifikat kosong.');
    const c=findRow_(COG.SHEETS.CERTS,'No_Sertifikat',code);
    if(!c)return ok_('Sertifikat tidak ditemukan.',{valid:false,status:'NOT_FOUND'});
    const valid=norm_(c.Status)==='generated';
    return ok_('Verifikasi sertifikat selesai.',{valid,status:String(c.Status||'UNKNOWN').toUpperCase(),certificateNo:String(c.No_Sertifikat||''),studentName:String(c.Nama_Siswa||''),program:String(c.Program||''),level:String(c.Level||''),batchName:String(c.Nama_Batch||''),issuedAt:fmt_(c.Tanggal_Diterbitkan)});
  }catch(e){return fail_('Verifikasi gagal: '+err_(e));}
}

function seedBasicCertificateTopics(){
  try{
    requireMaintenance_();
    ensureSheet_(getDb_(true),COG.SHEETS.TOPICS,COG.HEADERS[COG.SHEETS.TOPICS]);
    const basic=[
      ['Month 1','Talking about self'],['Month 2','Real-life interaction'],['Month 3','Dealing with everyday situations'],
      ['Month 4','Moving, traveling and telling past experience'],['Month 5','Communication mastery']
    ];
    const existing=rows_(COG.SHEETS.TOPICS).filter(r=>norm_(r.Level)==='basic');
    basic.forEach((x,i)=>{if(!existing.some(r=>monthNum_(r.Bulan)===i+1))append_(COG.SHEETS.TOPICS,{ID_Topik:id_('TOPIC'),Level:'Basic',Bulan:x[0],Topik:x[1],Deskripsi_Topik:'',Urutan:i+1,Status_Aktif:true});});
    return ok_('Topik Basic untuk sertifikat berhasil diperiksa/diisi.',{count:basic.length});
  }catch(e){return fail_('Seed topik sertifikat gagal: '+err_(e));}
}