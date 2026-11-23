/** COGNIORA V2 — filtered export center (XLSX, PDF, CSV). Owner only. */
function exportFolder_() {
  var reportId=getSetting_("REPORTS_ROOT_FOLDER_ID","");
  if(reportId){try{return DriveApp.getFolderById(reportId);}catch(e){}}
  var rootId=getSetting_("ROOT_DRIVE_FOLDER_ID","");
  require_(rootId,"DRIVE_ERROR","Cogniora Drive root is not configured. Run setupCogniora().");
  var root=DriveApp.getFolderById(rootId), it=root.getFoldersByName("Reports"), folder=it.hasNext()?it.next():root.createFolder("Reports");
  setSetting_("REPORTS_ROOT_FOLDER_ID",folder.getId(),"Cogniora report exports root","TEXT","SYSTEM");
  return folder;
}

function reportDateInRange_(value, filters) {
  var v=toClientDate_(value)||String(value||"").substring(0,10);
  if(filters.from && v<String(filters.from))return false;
  if(filters.to && v>String(filters.to))return false;
  return true;
}

function buildCognioraReport_(type, filters) {
  filters=filters||{};
  var rows=[], title="", columns=[];
  if(type==="students"){
    title="Student Enrollment Report";columns=["Student ID","Student Name","Email","WhatsApp","Program","Batch","Level","Package","Enrollment Status","Start Date","End Date"];
    var pmap={},bmap={},pkgmap={},smap={};sheetToObjects_("Data_Program").forEach(function(x){pmap[x.ID_Program]=x;});sheetToObjects_("Data_Batch").forEach(function(x){bmap[x.ID_Batch]=x;});sheetToObjects_("Data_Package").forEach(function(x){pkgmap[x.ID_Package]=x;});sheetToObjects_("Data_Siswa").forEach(function(x){smap[x.ID_Siswa]=x;});
    sheetToObjects_("Data_Enrollment").forEach(function(e){var s=smap[e.ID_Siswa]||{},b=bmap[e.ID_Batch]||{},p=pmap[b.ID_Program]||{},pkg=pkgmap[e.ID_Package]||{};if(filters.batch_id&&e.ID_Batch!==filters.batch_id)return;if(filters.program_id&&b.ID_Program!==filters.program_id)return;if(filters.student_id&&e.ID_Siswa!==filters.student_id)return;if(filters.status&&e.Status!==filters.status)return;rows.push([e.ID_Siswa,s.Nama_Lengkap||"",s.Email||"",s.Nomor_WA||"",p.Nama_Program||"",b.Nama_Batch||"",b.Level||"",pkg.Nama_Paket||"",e.Status,toClientDate_(e.Tanggal_Mulai),toClientDate_(e.Tanggal_Selesai)]);});
  } else if(type==="attendance"){
    title="Attendance Report";columns=["Date","Session","Batch","Student","Status","Note","Recorded By"];
    var sch={};sheetToObjects_("Data_Schedule").forEach(function(x){sch[x.ID_Schedule]=x;});
    sheetToObjects_("Student_Attendance").forEach(function(a){var s=sch[a.ID_Schedule]||{},e=findOne_("Data_Enrollment","ID_Enrollment",a.ID_Enrollment),st=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch);if(filters.batch_id&&(!e||e.ID_Batch!==filters.batch_id))return;if(filters.student_id&&(!e||e.ID_Siswa!==filters.student_id))return;if(!reportDateInRange_(toClientDate_(s.Tanggal),filters))return;rows.push([toClientDate_(s.Tanggal),s.Judul||"",b&&b.Nama_Batch||"",st&&st.Nama_Lengkap||"",a.Status,a.Note||"",a.Recorded_By||""]);});
  } else if(type==="lesson_reports"){
    title="Lesson Report";columns=["Date","Session","Batch","Tutor ID","Topic","Learning Objective","Activities","Vocabulary","Competency","Student Performance","Challenges","Follow Up"];
    var schedules={};sheetToObjects_("Data_Schedule").forEach(function(x){schedules[x.ID_Schedule]=x;});
    sheetToObjects_("Data_Lesson_Report").forEach(function(x){var s=schedules[x.ID_Schedule]||{},b=findOne_("Data_Batch","ID_Batch",x.ID_Batch);if(filters.batch_id&&x.ID_Batch!==filters.batch_id)return;if(!reportDateInRange_(toClientDate_(s.Tanggal),filters))return;rows.push([toClientDate_(s.Tanggal),s.Judul||"",b&&b.Nama_Batch||"",x.Tutor_ID,x.Topic,x.Learning_Objective,x.Activities,x.Vocabulary,x.Competency,x.Student_Performance,x.Challenges,x.Follow_Up]);});
  } else if(type==="skill_progress"){
    title="Student Skill Progress";columns=["Date","Student ID","Student","Program","Batch","Skill","Score","Max Score","Percentage","Feedback","Assessed By"];
    sheetToObjects_("Student_Skill_Assessments").forEach(function(x){var e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch),p=b&&findOne_("Data_Program","ID_Program",b.ID_Program);if(filters.student_id&&(!e||e.ID_Siswa!==filters.student_id))return;if(filters.batch_id&&(!e||e.ID_Batch!==filters.batch_id))return;if(filters.enrollment_id&&x.ID_Enrollment!==filters.enrollment_id)return;if(filters.skill&&x.Skill!==String(filters.skill).toUpperCase())return;if(!reportDateInRange_(toClientDate_(x.Assessment_Date),filters))return;rows.push([toClientDate_(x.Assessment_Date),e&&e.ID_Siswa||"",s&&s.Nama_Lengkap||"",p&&p.Nama_Program||"",b&&b.Nama_Batch||"",x.Skill,x.Score,x.Max_Score,Number(x.Max_Score?x.Score/x.Max_Score*100:0).toFixed(2),x.Feedback,x.Assessed_By]);});
  } else if(type==="package_balances"){
    title="Package Credit Balances";columns=["Student ID","Student","Enrollment ID","Program","Batch","Package","Credit Balance","Package Status"];
    sheetToObjects_("Data_Enrollment").forEach(function(e){var s=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=findOne_("Data_Batch","ID_Batch",e.ID_Batch),p=b&&findOne_("Data_Program","ID_Program",b.ID_Program),pkg=findOne_("Data_Package","ID_Package",e.ID_Package);if(filters.student_id&&e.ID_Siswa!==filters.student_id)return;if(filters.batch_id&&e.ID_Batch!==filters.batch_id)return;rows.push([e.ID_Siswa,s&&s.Nama_Lengkap||"",e.ID_Enrollment,p&&p.Nama_Program||"",b&&b.Nama_Batch||"",pkg&&pkg.Nama_Paket||"",packageCreditBalance_(e.ID_Enrollment),e.Status]);});
  } else if(type==="assessment_results"){
    title="Assessment Results";columns=["Assessment","Type","Student ID","Student","Batch","Attempt","Status","Score","Submitted At"];
    sheetToObjects_("Assessment_Attempts").forEach(function(a){var asm=findOne_("Data_Assessment","ID_Assessment",a.ID_Assessment),s=findOne_("Data_Siswa","ID_Siswa",a.ID_Siswa),e=findOne_("Data_Enrollment","ID_Enrollment",a.ID_Enrollment),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch);if(filters.assessment_id&&a.ID_Assessment!==filters.assessment_id)return;if(filters.student_id&&a.ID_Siswa!==filters.student_id)return;if(filters.batch_id&&(!e||e.ID_Batch!==filters.batch_id))return;rows.push([asm&&asm.Title||"",asm&&asm.Assessment_Type||"",a.ID_Siswa,s&&s.Nama_Lengkap||"",b&&b.Nama_Batch||"",a.Attempt_No,a.Status,a.Score,a.Submitted_At]);});
  } else if(type==="payments"){
    title="Payment Report";columns=["Submitted At","Invoice Number","Student","Program","Batch","Invoice Amount","Payment Amount","Payment Method","Payment Status"];
    sheetToObjects_("Data_Payment").forEach(function(x){var inv=findOne_("Data_Invoice","ID_Invoice",x.ID_Invoice),e=findOne_("Data_Enrollment","ID_Enrollment",x.ID_Enrollment),s=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch),p=b&&findOne_("Data_Program","ID_Program",b.ID_Program);if(filters.student_id&&(!e||e.ID_Siswa!==filters.student_id))return;if(filters.batch_id&&(!e||e.ID_Batch!==filters.batch_id))return;if(!reportDateInRange_(x.Submitted_At,filters))return;rows.push([formatDateTime_(parseDateValue_(x.Submitted_At)||new Date()),inv&&inv.Invoice_Number||"",s&&s.Nama_Lengkap||"",p&&p.Nama_Program||"",b&&b.Nama_Batch||"",Number(inv&&inv.Nominal||0),Number(x.Nominal||0),x.Payment_Method,x.Status]);});
  } else if(type==="expenses"){
    title="Operating Expenses";columns=["Date","Category","Description","Amount","Payment Method","Created By"];
    sheetToObjects_("Data_Expenses").forEach(function(x){if(!reportDateInRange_(x.Expense_Date,filters))return;rows.push([toClientDate_(x.Expense_Date),x.Category,x.Description,Number(x.Amount||0),x.Payment_Method,x.Created_By]);});
  } else if(type==="package_credits"){
    title="Package Credit Report";columns=["Student ID","Student","Enrollment ID","Program","Batch","Package","Credits Purchased","Credits Used","Adjustments/Refunds","Balance"];
    var led={};sheetToObjects_("Package_Credit_Ledger").forEach(function(l){if(!reportDateInRange_(l.Created_At,filters))return;var k=l.ID_Enrollment;led[k]=led[k]||{p:0,u:0,a:0};var c=Number(l.Credit_Change||0),t=String(l.Transaction_Type);if(t==="PURCHASE")led[k].p+=c;else if(t==="USAGE"||t==="USAGE_REVERSAL")led[k].u+=c;else led[k].a+=c;});
    sheetToObjects_("Data_Enrollment").forEach(function(e){var s=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=findOne_("Data_Batch","ID_Batch",e.ID_Batch),p=b&&findOne_("Data_Program","ID_Program",b.ID_Program),pkg=findOne_("Data_Package","ID_Package",e.ID_Package);if(filters.student_id&&e.ID_Siswa!==filters.student_id)return;if(filters.batch_id&&e.ID_Batch!==filters.batch_id)return;var x=led[e.ID_Enrollment]||{p:0,u:0,a:0};rows.push([e.ID_Siswa,s&&s.Nama_Lengkap||"",e.ID_Enrollment,p&&p.Nama_Program||"",b&&b.Nama_Batch||"",pkg&&pkg.Nama_Paket||"",x.p,Math.abs(x.u),x.a,x.p+x.u+x.a]);});
  } else if(type==="assignments"){
    title="Assignment Report";columns=["Student ID","Student","Batch","Assignment","Due Date","Status","Score","Last Submitted","Revisions"];
    var subs={};sheetToObjects_("Assignment_Submissions").forEach(function(x){var cur=subs[x.ID_Student_Assignment];if(!cur||Number(x.Attempt_No)>Number(cur.Attempt_No))subs[x.ID_Student_Assignment]=x;});
    sheetToObjects_("Student_Assignment").forEach(function(sa){var e=findOne_("Data_Enrollment","ID_Enrollment",sa.ID_Enrollment),ba=findOne_("Batch_Assignment","ID_Batch_Assignment",sa.ID_Batch_Assignment),a=ba&&findOne_("Data_Assignment","ID_Assignment",ba.ID_Assignment),st=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch);if(filters.student_id&&(!e||e.ID_Siswa!==filters.student_id))return;if(filters.batch_id&&(!e||e.ID_Batch!==filters.batch_id))return;var due=a&&toClientDate_(a.Due_Date)||"";if(due&&!reportDateInRange_(due,filters))return;var last=subs[sa.ID_Student_Assignment];rows.push([e&&e.ID_Siswa||"",st&&st.Nama_Lengkap||"",b&&b.Nama_Batch||"",a&&a.Judul||"",due,sa.Status,sa.Score,last?formatDateTime_(parseDateValue_(last.Submitted_At)||new Date()):"",Number(sa.Revision_Count||0)]);});
  } else if(type==="material_completion"){
    title="Material Completion Report";columns=["Student ID","Student","Batch","Material","Required","Status","Completed At"];
    var prog={};sheetToObjects_("Student_Material_Progress").forEach(function(p){prog[p.ID_Enrollment+"|"+p.ID_Batch_Material]=p;});
    var mats={};sheetToObjects_("Data_Material").forEach(function(m){mats[m.ID_Material]=m;});
    var bms=sheetToObjects_("Batch_Materials").filter(function(x){return String(x.Status||"ACTIVE")==="ACTIVE";});
    sheetToObjects_("Data_Enrollment").forEach(function(e){if(e.Status==="CANCELLED")return;if(filters.student_id&&e.ID_Siswa!==filters.student_id)return;if(filters.batch_id&&e.ID_Batch!==filters.batch_id)return;var st=findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=findOne_("Data_Batch","ID_Batch",e.ID_Batch);bms.filter(function(bm){return bm.ID_Batch===e.ID_Batch;}).forEach(function(bm){var p=prog[e.ID_Enrollment+"|"+bm.ID_Batch_Material],m=mats[bm.ID_Material]||{};rows.push([e.ID_Siswa,st&&st.Nama_Lengkap||"",b&&b.Nama_Batch||"",m.Judul||bm.ID_Material,bool_(bm.Required)?"Yes":"No",p?p.Status:"NOT_STARTED",p&&p.Completed_At?formatDateTime_(parseDateValue_(p.Completed_At)||new Date()):""]);});});
  } else if(type==="tutor_activity"){
    title="Tutor Activity Report";columns=["Tutor ID","Tutor","Assigned Groups","Lesson Reports","Attendance Records","Assignments Reviewed","Assessments Created"];
    var asg=sheetToObjects_("Batch_Tutor_Assignment"),lrs=sheetToObjects_("Data_Lesson_Report"),att=sheetToObjects_("Student_Attendance"),sas=sheetToObjects_("Student_Assignment"),asm=sheetToObjects_("Data_Assessment");
    sheetToObjects_("Data_Admin").filter(function(a){return a.Role==="TUTOR";}).forEach(function(a){rows.push([a.ID_Admin,a.Nama,asg.filter(function(x){return x.ID_Admin===a.ID_Admin&&x.Status==="ACTIVE";}).length,lrs.filter(function(x){return x.Tutor_ID===a.ID_Admin&&reportDateInRange_(x.Created_At,filters);}).length,att.filter(function(x){return x.Recorded_By===a.ID_Admin&&reportDateInRange_(x.Recorded_At,filters);}).length,sas.filter(function(x){return x.Reviewed_By===a.ID_Admin&&reportDateInRange_(x.Reviewed_At,filters);}).length,asm.filter(function(x){return x.Created_By===a.ID_Admin&&reportDateInRange_(x.Created_At,filters);}).length]);});
  } else if(type==="invoices"){
    title="Invoice and Receivable Report";columns=["Invoice Number","Student","Batch","Billing Month","Due Date","Invoice Amount","Paid (approved)","Outstanding","Status"];
    var pays=sheetToObjects_("Data_Payment");
    sheetToObjects_("Data_Invoice").forEach(function(inv){var e=findOne_("Data_Enrollment","ID_Enrollment",inv.ID_Enrollment),st=e&&findOne_("Data_Siswa","ID_Siswa",e.ID_Siswa),b=e&&findOne_("Data_Batch","ID_Batch",e.ID_Batch);if(filters.student_id&&(!e||e.ID_Siswa!==filters.student_id))return;if(filters.batch_id&&(!e||e.ID_Batch!==filters.batch_id))return;if(!reportDateInRange_(inv.Due_Date,filters))return;var paid=pays.filter(function(p){return p.ID_Invoice===inv.ID_Invoice&&p.Status==="APPROVED";}).reduce(function(n,p){return n+Number(p.Nominal||0);},0),nominal=Number(inv.Nominal||0),cancelled=inv.Status==="CANCELLED";rows.push([inv.Invoice_Number,st&&st.Nama_Lengkap||"",b&&b.Nama_Batch||"",billingMonthKey_(inv.Billing_Month),toClientDate_(inv.Due_Date),nominal,paid,cancelled?0:Math.max(0,nominal-paid),inv.Status]);});
  } else if(type==="financial_summary"){
    title="Financial Summary";columns=["Metric","Amount"];
    var from=String(filters.from||"0000-01-01"),to=String(filters.to||"9999-12-31"),received=0,expense=0,receivable=0;
    sheetToObjects_("Data_Payment").forEach(function(x){if(x.Status==="APPROVED"&&reportDateInRange_(x.Approved_At||x.Submitted_At,{from:from,to:to}))received+=Number(x.Nominal||0);});
    sheetToObjects_("Data_Expenses").forEach(function(x){if(reportDateInRange_(x.Expense_Date,{from:from,to:to}))expense+=Number(x.Amount||0);});
    sheetToObjects_("Data_Invoice").forEach(function(x){if(["UNPAID","PENDING","OVERDUE"].indexOf(String(x.Status))>=0)receivable+=Number(x.Nominal||0);});
    rows=[["Cash received (approved payments)",received],["Operating expenses",expense],["Net cash movement",received-expense],["Outstanding receivables (piutang, unpaid invoices)",receivable]];
  } else throw apiError_("VALIDATION_ERROR","Unsupported report type.");
  rows.sort(function(a,b){return String(a[0]||"").localeCompare(String(b[0]||""));});
  return {title:title,columns:columns,rows:rows,generated_at:now_()};
}

function csvCell_(value) {
  var s=String(value===null||value===undefined?"":value);
  // Prevent spreadsheet formula injection when a CSV is opened in Excel/Sheets.
  if(/^[\s]*[=+@\-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}

function makeReportBlob_(report, format, fileName) {
  format=String(format||"XLSX").toUpperCase();
  if(format==="CSV"){
    var lines=[report.columns].concat(report.rows).map(function(r){return r.map(csvCell_).join(",");});
    return Utilities.newBlob("\uFEFF"+lines.join("\r\n"),"text/csv",fileName);
  }
  var temp=SpreadsheetApp.create("TEMP_COGNIORA_REPORT_"+Date.now());
  var sh=temp.getSheets()[0];sh.setName("Report");
  sh.getRange(1,1).setValue(report.title).setFontWeight("bold").setFontSize(16);
  sh.getRange(2,1).setValue("Generated: "+report.generated_at);
  sh.getRange(4,1,1,report.columns.length).setValues([report.columns]).setFontWeight("bold").setBackground("#28336B").setFontColor("#FFFFFF");
  if(report.rows.length)sh.getRange(5,1,report.rows.length,report.columns.length).setValues(report.rows);
  sh.setFrozenRows(4);sh.autoResizeColumns(1,report.columns.length);
  sh.getDataRange().setVerticalAlignment("middle");
  SpreadsheetApp.flush();
  var tempFile=DriveApp.getFileById(temp.getId()), blob;
  if(format==="PDF")blob=tempFile.getAs(MimeType.PDF).setName(fileName);
  else if(format==="XLSX") {
    var exportUrl="https://docs.google.com/spreadsheets/d/"+encodeURIComponent(temp.getId())+"/export?format=xlsx";
    var response=UrlFetchApp.fetch(exportUrl,{method:"get",headers:{Authorization:"Bearer "+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    require_(response.getResponseCode()===200,"EXPORT_FAILED","Google Sheets gagal mengekspor file XLSX. Coba format CSV atau jalankan ulang.");
    blob=response.getBlob().setName(fileName);
  } else {tempFile.setTrashed(true);throw apiError_("VALIDATION_ERROR","Format must be XLSX, PDF or CSV.");}
  tempFile.setTrashed(true);
  return blob;
}

function adminGenerateReport_(token,data) {
  var ctx=getAuthContext_(token,"ADMIN");assertOwner_(ctx);
  var type=String(data.report_type||""), format=String(data.format||"XLSX").toUpperCase(), filters=data.filters||{};
  require_(["XLSX","PDF","CSV"].indexOf(format)>=0,"VALIDATION_ERROR","Invalid report format.");
  var report=buildCognioraReport_(type,filters), safeTitle=report.title.replace(/[^A-Za-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
  var stamp=Utilities.formatDate(new Date(),getSetting_("TIMEZONE","Asia/Jakarta"),"yyyyMMdd_HHmmss");
  var extension=format==="XLSX"?"xlsx":format.toLowerCase(), fileName="COGNIORA_"+safeTitle+"_"+stamp+"."+extension;
  var blob=makeReportBlob_(report,format,fileName), folder=exportFolder_(), file=folder.createFile(blob);
  var log={ID_Export:makeId_("EXP"),Report_Type:type,Filters_JSON:JSON.stringify(filters),File_ID:file.getId(),File_Name:file.getName(),Format:format,Generated_By:ctx.userId,Generated_At:now_(),Status:"SUCCESS"};
  appendObject_("Data_Export_Log",log);audit_(ctx,"GENERATE_REPORT","Data_Export_Log",log.ID_Export,type+" "+format,"SUCCESS");
  return {id:log.ID_Export,file_id:file.getId(),file_name:file.getName(),format:format,download_url:"https://drive.google.com/uc?export=download&id="+encodeURIComponent(file.getId()),view_url:file.getUrl(),row_count:report.rows.length};
}

function adminExportHistory_(token) {
  var ctx=getAuthContext_(token,"ADMIN");assertOwner_(ctx);
  return sheetToObjects_("Data_Export_Log").sort(function(a,b){return String(b.Generated_At).localeCompare(String(a.Generated_At));}).slice(0,50).map(function(x){return {id:x.ID_Export,type:x.Report_Type,file_name:x.File_Name,format:x.Format,generated_at:x.Generated_At,status:x.Status,view_url:x.File_ID?"https://drive.google.com/file/d/"+x.File_ID+"/view":""};});
}
