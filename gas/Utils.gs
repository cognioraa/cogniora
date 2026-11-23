function apiError_(code,message,details) {
  var e = new Error(message || code);
  e.name = code || "SERVER_ERROR";
  e.details = details || null;
  return e;
}

function require_(condition,code,message,details) {
  if(!condition) throw apiError_(code,message,details);
  return condition;
}

function now_() {
  return Utilities.formatDate(new Date(), getSetting_("TIMEZONE","Asia/Jakarta"), "yyyy-MM-dd HH:mm:ss");
}

function today_() {
  return Utilities.formatDate(new Date(), getSetting_("TIMEZONE","Asia/Jakarta"), "yyyy-MM-dd");
}

function formatDateTime_(d) {
  return Utilities.formatDate(d, getSetting_("TIMEZONE","Asia/Jakarta"), "yyyy-MM-dd HH:mm:ss");
}

function normalizeEmail_(email) { return String(email || "").trim().toLowerCase(); }

function validEmail_(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail_(email)); }

function toNumber_(value,fallback) {
  if(value === "" || value === null || value === undefined) return Number(fallback || 0);
  var n=Number(value);
  return isFinite(n) ? n : Number(fallback || 0);
}

function bool_(v) { return v===true || String(v).toLowerCase()==="true" || String(v)==="1"; }

function clamp_(n,min,max) { return Math.max(min,Math.min(max,n)); }

function parseDateValue_(v) {
  if(v instanceof Date && !isNaN(v.getTime())) return new Date(v.getTime());
  var s=String(v||"").trim();
  if(!s) return null;
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  var d=new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toClientDate_(v) {
  var d=parseDateValue_(v);
  return d ? Utilities.formatDate(d,getSetting_("TIMEZONE","Asia/Jakarta"),"yyyy-MM-dd") : "";
}

function formatIndonesianLongDate_(v) {
  var d=parseDateValue_(v); if(!d) return "";
  var months=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return "Jambi, " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function randomHex_(bytes) {
  var data=Utilities.newBlob(Utilities.getUuid()).getBytes();
  var raw="";
  while(raw.length<bytes){
    data=data.concat(Utilities.getUuid().split("").map(function(c){return c.charCodeAt(0);}));
    raw=Utilities.base64EncodeWebSafe(data).replace(/[^a-zA-Z0-9]/g,"");
  }
  return raw.substring(0,bytes);
}

function randomPassword_() {
  var chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  var out="";
  for(var i=0;i<12;i++) out+=chars.charAt(Math.floor(Math.random()*chars.length));
  return out;
}

function sha256Hex_(text) {
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function(b){var v=b<0?b+256:b; return ("0"+v.toString(16)).slice(-2);}).join("");
}

function escapeRegex_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }

function safeJson_(obj) {
  return JSON.parse(JSON.stringify(obj,function(key,value){
    if(value instanceof Date) return formatDateTime_(value);
    return value;
  }));
}

function predicateFromAverage_(n) {
  n=Number(n||0);
  if(n>=90) return "Excellent";
  if(n>=80) return "Very Good";
  if(n>=70) return "Good";
  return "Satisfactory";
}

function ageHours_(timestamp) {
  var d=parseDateValue_(timestamp);
  if(!d) return 999999;
  return (Date.now()-d.getTime())/3600000;
}

function currentBillingMonth_() {
  return Utilities.formatDate(new Date(),getSetting_("TIMEZONE","Asia/Jakarta"),"yyyy-MM");
}

function monthLabel_(n) { return "Month " + Number(n); }

// ===================== V35 helpers =====================
// Google Sheets sering mengubah teks "2026-10" menjadi tanggal. Fungsi ini selalu mengembalikan "yyyy-MM".
function billingMonthKey_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    var tz = getSetting_("TIMEZONE", "Asia/Jakarta");
    try { tz = getSpreadsheet_().getSpreadsheetTimeZone() || tz; } catch (e) {}
    return Utilities.formatDate(v, tz, "yyyy-MM");
  }
  var s = String(v == null ? "" : v).trim();
  if (!s) return "";
  var m = s.match(/^(\d{4})-(\d{1,2})(?:$|[-T\s])/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2);
  var d = parseDateValue_(s);
  return d ? Utilities.formatDate(d, getSetting_("TIMEZONE", "Asia/Jakarta"), "yyyy-MM") : s;
}

// Link Google Meet tanpa "https://" dianggap relatif oleh browser (jadi terbuka di domain googleusercontent).
function normalizeMeetUrl_(value) {
  var s = String(value == null ? "" : value).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return "https:" + s;
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(s)) return "https://meet.google.com/" + s.toLowerCase();
  return "https://" + s.replace(/^\/+/, "");
}
