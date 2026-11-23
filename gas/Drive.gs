function getOrCreateFolder_(parentId,name) {
  var parent=DriveApp.getFolderById(parentId);
  var it=parent.getFoldersByName(name);
  return it.hasNext()?it.next():parent.createFolder(name);
}

function ensureRootDriveStructure_() {
  var settingsRoot=getSetting_("ROOT_DRIVE_FOLDER_ID","");
  var root;
  if(settingsRoot){
    try { root=DriveApp.getFolderById(settingsRoot); } catch(e) { root=null; }
  }
  if(!root){
    var folders=DriveApp.getFoldersByName("COGNIORA");
    root=folders.hasNext()?folders.next():DriveApp.createFolder("COGNIORA");
    setSetting_("ROOT_DRIVE_FOLDER_ID",root.getId(),"Cogniora root Drive folder","TEXT","SYSTEM");
  }
  var students=getOrCreateFolder_(root.getId(),"Students");
  var materials=getOrCreateFolder_(root.getId(),"Materials");
  var certificates=getOrCreateFolder_(root.getId(),"Certificates");
  var system=getOrCreateFolder_(root.getId(),"System");
  var reports=getOrCreateFolder_(root.getId(),"Reports");
  setSetting_("REPORTS_ROOT_FOLDER_ID",reports.getId(),"Cogniora report exports root","TEXT","SYSTEM");
  setSetting_("STUDENT_ROOT_FOLDER_ID",students.getId(),"Student folders root","TEXT","SYSTEM");
  setSetting_("MATERIAL_ROOT_FOLDER_ID",materials.getId(),"Materials root","TEXT","SYSTEM");
  setSetting_("CERTIFICATE_ROOT_FOLDER_ID",certificates.getId(),"Certificates root","TEXT","SYSTEM");
  setSetting_("SYSTEM_ROOT_FOLDER_ID",system.getId(),"System root","TEXT","SYSTEM");
  return {root_id:root.getId(),students_id:students.getId(),materials_id:materials.getId(),certificates_id:certificates.getId(),system_id:system.getId(),reports_id:reports.getId()};
}

function createStudentFolder_(studentId,name) {
  var rootId=getSetting_("STUDENT_ROOT_FOLDER_ID","");
  require_(rootId,"DRIVE_ERROR","Student root folder is not configured.");
  var root=DriveApp.getFolderById(rootId);
  var folder=root.createFolder(studentId+"_"+String(name||"Student").replace(/[\\/:*?"<>|]/g," ").trim());
  var assignments=folder.createFolder("Assignments");
  var payments=folder.createFolder("Payments");
  var certificates=folder.createFolder("Certificates");
  var profile=folder.createFolder("Profile");
  return {folder_id:folder.getId(),assignments_id:assignments.getId(),payments_id:payments.getId(),certificates_id:certificates.getId(),profile_id:profile.getId()};
}

function studentSubfolderId_(studentFolderId,name) {
  var folder=DriveApp.getFolderById(studentFolderId);
  return getOrCreateFolder_(folder.getId(),name).getId();
}

function saveBlobToStudentFolder_(student,blob,subfolderName,fileName) {
  require_(blob,"FILE_INVALID","No file received.");
  require_(blob.getBytes().length<=Number(getSetting_("MAX_UPLOAD_BYTES","10485760")),"FILE_TOO_LARGE","File is too large.");
  var folderId=studentSubfolderId_(student.Student_Folder_ID,subfolderName);
  var file=DriveApp.getFolderById(folderId).createFile(blob.setName(fileName || ("upload_"+Date.now())));
  return file;
}

function shareFileWithStudent_(fileId,email) {
  try {
    if(email) DriveApp.getFileById(fileId).addViewer(email);
  } catch(e) {}
}

function getDriveImageDataUrl_(fileId) {
  if(!fileId) return "";
  var file=DriveApp.getFileById(String(fileId)), blob=file.getBlob();
  var bytes=blob.getBytes();
  require_(bytes.length<=Number(getSetting_("MAX_PUBLIC_IMAGE_BYTES","2097152")),"FILE_TOO_LARGE","Image exceeds the configured 2 MB limit. Please compress it.");
  return "data:"+blob.getContentType()+";base64,"+Utilities.base64Encode(bytes);
}

function getDriveImageDataUrlSafe_(fileId) {
  try { return getDriveImageDataUrl_(fileId); } catch(e) { return ""; }
}


function getProtectedDriveDataUrl_(fileId, maxBytes) {
  var id=String(fileId||"").trim();
  require_(id,"FILE_INVALID","File ID is required.");
  var file=DriveApp.getFileById(id), blob=file.getBlob(), bytes=blob.getBytes();
  var limit=Number(maxBytes||Number(getSetting_("MAX_PROTECTED_FILE_BYTES","8388608")));
  require_(bytes.length<=limit,"FILE_TOO_LARGE","This file is too large for in-app preview.");
  return "data:"+blob.getContentType()+";base64,"+Utilities.base64Encode(bytes);
}

function getDriveThumbnailDataUrlSafe_(fileId) {
  try {
    var id=String(fileId||"").trim(); if(!id) return "";
    var file=DriveApp.getFileById(id), thumb=file.getThumbnail();
    if(!thumb) return "";
    var bytes=thumb.getBytes();
    if(bytes.length>524288) return "";
    return "data:"+thumb.getContentType()+";base64,"+Utilities.base64Encode(bytes);
  } catch(e) { return ""; }
}
