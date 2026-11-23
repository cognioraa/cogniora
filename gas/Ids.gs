function makeId_(prefix) {
  var p=String(prefix||"ID").toUpperCase();
  var stamp=Utilities.formatDate(new Date(),getSetting_("TIMEZONE","Asia/Jakarta"),"yyyyMMddHHmmss");
  return p+"-"+stamp+"-"+randomHex_(6);
}

function makeStudentId_() {
  var year=Utilities.formatDate(new Date(),getSetting_("TIMEZONE","Asia/Jakarta"),"yyyy");
  var seq=Number(PropertiesService.getScriptProperties().getProperty("STUDENT_SEQ_"+year)||0)+1;
  PropertiesService.getScriptProperties().setProperty("STUDENT_SEQ_"+year,String(seq));
  return "CGN-STU-"+year+"-"+String(seq).padStart(4,"0");
}

function makeInvoiceNumber_() {
  var year=Utilities.formatDate(new Date(),getSetting_("TIMEZONE","Asia/Jakarta"),"yyyy");
  var seq=Number(PropertiesService.getScriptProperties().getProperty("INVOICE_SEQ_"+year)||0)+1;
  PropertiesService.getScriptProperties().setProperty("INVOICE_SEQ_"+year,String(seq));
  return "CGN-INV-"+year+"-"+String(seq).padStart(6,"0");
}

function makeCertificateNumber_(batch) {
  var year=Utilities.formatDate(new Date(),getSetting_("TIMEZONE","Asia/Jakarta"),"yyyy");
  var seq=Number(PropertiesService.getScriptProperties().getProperty("CERT_SEQ_"+year)||0)+1;
  PropertiesService.getScriptProperties().setProperty("CERT_SEQ_"+year,String(seq));
  return "CGN/CERT/"+year+"/"+String(seq).padStart(4,"0");
}