function getLoginUrl_() {
  // URL login diprioritaskan dari Script Properties agar tidak terekspos di repository.
  var propsUrl=""; try { propsUrl=PropertiesService.getScriptProperties().getProperty("COGNIORA_LOGIN_URL")||""; } catch(e) {}
  var url=String(propsUrl||COGNIORA_LOGIN_URL||"").trim();
  if(url) return url;
  var configured=getSetting_("LOGIN_URL","");
  if(configured) return configured;
  return "";
}

// V43: semua email memakai satu format rapi. Label dan titik dua SELALU sejajar:
//  - HTML : tabel 3 kolom (label | : | nilai) -> sejajar di semua aplikasi email
//  - Teks : label diberi spasi sampai sama panjang (cadangan untuk email plain-text)
function escHtml_(v) {
  return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// blocks: string | {p:[baris,...]} | {rows:[[label,nilai,{mono:true,link:true}],...]} | {url:"https://..."} | {sig:[baris,...]}
function composeEmail_(greeting,blocks) {
  var text=[greeting,""], html=['<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222">','<p style="margin:0 0 12px">'+escHtml_(greeting)+'</p>'];
  blocks.forEach(function(b){
    if(typeof b==="string") b={p:[b]};
    if(b.p) {
      text.push(b.p.join("\n"),"");
      html.push('<p style="margin:0 0 12px">'+b.p.map(escHtml_).join("<br>")+'</p>');
    } else if(b.rows) {
      var w=0; b.rows.forEach(function(r){ w=Math.max(w,String(r[0]).length); });
      b.rows.forEach(function(r){ text.push(String(r[0])+new Array(w-String(r[0]).length+1).join(" ")+" : "+r[1]); });
      text.push("");
      html.push('<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222">'+b.rows.map(function(r){
        var o=r[2]||{}, val=o.link?'<a href="'+escHtml_(r[1])+'" style="color:#4f46e5">'+escHtml_(r[1])+'</a>':(o.mono?'<span style="font-family:Consolas,Menlo,monospace;font-weight:bold;letter-spacing:.5px">'+escHtml_(r[1])+'</span>':escHtml_(r[1]));
        return '<tr><td style="padding:2px 0;white-space:nowrap;vertical-align:top">'+escHtml_(r[0])+'</td><td style="padding:2px 10px;vertical-align:top">:</td><td style="padding:2px 0;vertical-align:top">'+val+'</td></tr>';
      }).join("")+'</table>');
    } else if(b.url) {
      text.push(b.url,"");
      html.push('<p style="margin:0 0 12px"><a href="'+escHtml_(b.url)+'" style="color:#4f46e5">'+escHtml_(b.url)+'</a></p>');
    } else if(b.sig) {
      text.push(b.sig.join("\n"));
      html.push('<p style="margin:16px 0 0;color:#555">'+b.sig.map(escHtml_).join("<br>")+'</p>');
    }
  });
  html.push("</div>");
  return {text:text.join("\n").replace(/\n+$/,""),html:html.join("")};
}

function sendCogniEmail_(to,subject,greeting,blocks) {
  var m=composeEmail_(greeting,blocks);
  MailApp.sendEmail({to:to,subject:subject,body:m.text,htmlBody:m.html,name:"COGNIORA"});
}

var COGNIORA_SIGNATURE = ["COGNIORA","Learning, Progress, and Growth."];

function sendWelcomeEmail_(student,temporaryPassword) {
  var to=student.Email;
  require_(validEmail_(to),"VALIDATION_ERROR","Student email is invalid.");
  sendCogniEmail_(to,"Welcome to COGNIORA — Your Student Account","Hello "+student.Nama_Lengkap+",",[
    {p:["Welcome to COGNIORA.","Your student account has been created."]},
    {rows:[["Student ID",student.ID_Siswa],["Email",to],["Temporary Password",temporaryPassword,{mono:true}],["Login",getLoginUrl_(),{link:true}]]},
    "For your security, you will be required to change your password after your first login.",
    "Please keep your login credentials private.",
    {sig:COGNIORA_SIGNATURE}
  ]);
}

function sendResetEmail_(student,rawToken) {
  var base=getLoginUrl_(), sep=base.indexOf("?")>=0?"&":"?"; var link=base+sep+"page=reset-password&token="+encodeURIComponent(rawToken);
  sendCogniEmail_(student.Email,"COGNIORA — Reset your password","Hello "+student.Nama_Lengkap+",",[
    "We received a request to reset your COGNIORA password.",
    "Reset your password here:",
    {url:link},
    "This link expires in 60 minutes and can only be used once.",
    "If you did not request this, you can ignore this email.",
    {sig:["COGNIORA"]}
  ]);
}

function sendCertificateEmail_(student,cert) {
  if(!student || !student.Email || !cert || !cert.File_URL) return;
  sendCogniEmail_(student.Email,"COGNIORA — Certificate Available","Hello "+student.Nama_Lengkap+",",[
    "Congratulations! Your COGNIORA certificate is now available.",
    {rows:[["Certificate No",cert.No_Sertifikat],["Verification Code",cert.Verification_Code,{mono:true}],["Version",cert.Version],["Certificate File",cert.File_URL,{link:true}]]},
    {sig:["COGNIORA"]}
  ]);
}

function sendTemporaryPasswordEmail_(student,temporaryPassword) {
  var to=student.Email;
  require_(validEmail_(to),"VALIDATION_ERROR","Student email is invalid.");
  sendCogniEmail_(to,"COGNIORA — Your Temporary Password","Hello "+student.Nama_Lengkap+",",[
    "We received a request to reset your COGNIORA password.",
    {rows:[["Student ID",student.ID_Siswa],["Email",to],["Temporary Password",temporaryPassword,{mono:true}],["Login",getLoginUrl_(),{link:true}]]},
    {p:["You will be asked to change this password right after you log in.","If you did not request this, please contact COGNIORA support immediately."]},
    {sig:COGNIORA_SIGNATURE}
  ]);
}

// V38: email invoice otomatis setelah invoice digenerate admin.
function formatRupiah_(n) {
  var v=Math.round(Number(n||0)), s=String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g,".");
  return (v<0?"-":"")+"Rp "+s;
}

function invoiceMonthLabel_(key) {
  var names=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"], m=String(key||"").split("-");
  return (m.length>=2 && names[Number(m[1])-1]) ? names[Number(m[1])-1]+" "+m[0] : String(key||"");
}

function sendInvoiceEmail_(student,enrollment,invoice) {
  var to=student&&student.Email;
  require_(validEmail_(to),"VALIDATION_ERROR","Student email is invalid.");
  var batch=findOne_("Data_Batch","ID_Batch",enrollment.ID_Batch);
  var accounts=(typeof getPaymentAccounts_==="function"?getPaymentAccounts_():[]).filter(function(a){return a.number;});
  var monthLabel=invoiceMonthLabel_(billingMonthKey_(invoice.Billing_Month));
  var rows=[["Invoice Number",invoice.Invoice_Number],["Batch",batch?batch.Nama_Batch:"-"],["Billing Month",monthLabel],["Due Date",toClientDate_(invoice.Due_Date)]];
  if(Number(invoice.Diskon_Persen||0)>0) {
    rows.push(["Original Price",formatRupiah_(invoice.Harga_Asli)]);
    rows.push(["Referral Discount","-"+formatRupiah_(invoice.Potongan_Nominal)+" ("+invoice.Kode_Referral+", "+invoice.Diskon_Persen+"%)"]);
  }
  rows.push(["Amount to Pay",formatRupiah_(invoice.Nominal)]);
  var blocks=["Your COGNIORA invoice is ready.",{rows:rows}];
  if(accounts.length) {
    blocks.push("Payment methods:");
    blocks.push({rows:accounts.map(function(a){return [a.bank,a.number+(a.holder?" a.n. "+a.holder:"")];})});
  }
  blocks.push("After transferring, log in and upload your payment proof on the Payment page:",{url:getLoginUrl_()},{sig:COGNIORA_SIGNATURE});
  sendCogniEmail_(to,"COGNIORA Invoice "+invoice.Invoice_Number+" — "+monthLabel,"Hello "+student.Nama_Lengkap+",",blocks);
}
