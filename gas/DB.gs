function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw apiError_("DATABASE_ERROR", "Spreadsheet is not configured. Run setupCogniora first.");
}

function getSheet_(name) {
  var sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw apiError_("DATABASE_ERROR", "Sheet not found: " + name);
  return sh;
}

function ensureSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    var currentColCount = sh.getLastColumn();
    var existing = sh.getRange(1,1,1,currentColCount).getValues()[0]
      .map(function(x){return String(x == null ? "" : x).trim();});
    var prefixOk = existing.length <= headers.length;
    for (var i=0;i<existing.length;i++) { if(existing[i] !== headers[i]) { prefixOk=false; break; } }
    if (prefixOk && existing.length < headers.length) {
      var missing = headers.slice(existing.length);
      sh.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
    } else if (!prefixOk || existing.length > headers.length) {
      throw apiError_("DATABASE_SCHEMA_MISMATCH",
        "Sheet " + name + " header mismatch. Expected: " + headers.join(" | "));
    }
  }
  sh.setFrozenRows(1);
  try {
    var textCols = (typeof COGNIORA_TEXT_COLUMNS !== "undefined" && COGNIORA_TEXT_COLUMNS[name]) || [];
    textCols.forEach(function(col){
      var ci = headers.indexOf(col);
      if (ci >= 0 && sh.getMaxRows() > 1) sh.getRange(2, ci + 1, sh.getMaxRows() - 1, 1).setNumberFormat("@");
    });
  } catch (fmtErr) {}
  return sh;
}

function ensureAllSheets_() {
  Object.keys(COGNIORA_SCHEMA).forEach(function(name){ ensureSheet_(name, COGNIORA_SCHEMA[name]); });
}

// V40: cache baca per-eksekusi (hanya aktif di dalam withReadCache_). Dibatalkan otomatis saat ada penulisan ke sheet tsb.
var __cogniMemo_ = null;
function withReadCache_(fn) {
  var prev = __cogniMemo_;
  __cogniMemo_ = prev || {};
  try { return fn(); } finally { __cogniMemo_ = prev; }
}
function memoDrop_(sheetName) { if (__cogniMemo_) delete __cogniMemo_[sheetName]; }

function sheetToObjects_(sheetName) {
  if (__cogniMemo_ && __cogniMemo_[sheetName]) return __cogniMemo_[sheetName];
  var rows = sheetToObjectsRaw_(sheetName);
  if (__cogniMemo_) __cogniMemo_[sheetName] = rows;
  return rows;
}

function sheetToObjectsRaw_(sheetName) {
  var sh = getSheet_(sheetName);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){return String(h);});
  var values = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  var norm = (typeof COGNIORA_NORMALIZE_COLUMNS !== "undefined" && COGNIORA_NORMALIZE_COLUMNS[sheetName]) || {};
  return values.filter(function(row){ return row.some(function(v){ return v !== "" && v !== null; }); })
    .map(function(row){
      var o = {};
      headers.forEach(function(h,i){ o[h] = row[i] === null ? "" : (norm[h] ? normalizeCellByKind_(row[i], norm[h]) : row[i]); });
      return o;
    });
}

var __cogniSsTz_ = null;
function spreadsheetTz_() {
  if (!__cogniSsTz_) {
    try { __cogniSsTz_ = getSpreadsheet_().getSpreadsheetTimeZone(); } catch (e) {}
    __cogniSsTz_ = __cogniSsTz_ || "Asia/Jakarta";
  }
  return __cogniSsTz_;
}

function normalizeCellByKind_(v, kind) {
  if (!(v instanceof Date) || isNaN(v.getTime())) return v;
  if (kind === "date") return Utilities.formatDate(v, spreadsheetTz_(), "yyyy-MM-dd");
  if (kind === "time") return Utilities.formatDate(v, spreadsheetTz_(), "HH:mm");
  if (kind === "month") return Utilities.formatDate(v, spreadsheetTz_(), "yyyy-MM");
  if (kind === "datetime") return Utilities.formatDate(v, spreadsheetTz_(), "yyyy-MM-dd HH:mm:ss");
  return v;
}

function appendObject_(sheetName,obj) {
  memoDrop_(sheetName);
  var sh = getSheet_(sheetName);
  var headers = COGNIORA_SCHEMA[sheetName];
  var row = headers.map(function(h){ return obj[h] === undefined || obj[h] === null ? "" : obj[h]; });
  var textCols = (typeof COGNIORA_TEXT_COLUMNS !== "undefined" && COGNIORA_TEXT_COLUMNS[sheetName]) || [];
  if (textCols.length && sheetName === "Data_Invoice") {
    // Tulis sebagai teks murni supaya "2026-10" tidak dikonversi menjadi tanggal.
    var target = sh.getLastRow() + 1;
    textCols.forEach(function(col){
      var ci = headers.indexOf(col);
      if (ci >= 0) sh.getRange(target, ci + 1).setNumberFormat("@");
    });
    sh.getRange(target, 1, 1, headers.length).setValues([row]);
    return obj;
  }
  sh.appendRow(row);
  return obj;
}

function updateObject_(sheetName,idField,id,obj) {
  memoDrop_(sheetName);
  var sh = getSheet_(sheetName);
  var headers = COGNIORA_SCHEMA[sheetName];
  var idx = headers.indexOf(idField);
  if (idx < 0) throw apiError_("DATABASE_ERROR","ID field not found: "+idField);
  var lastRow=sh.getLastRow();
  if(lastRow<2) throw apiError_("NOT_FOUND","Record not found.");
  var ids=sh.getRange(2,idx+1,lastRow-1,1).getValues();
  for(var i=0;i<ids.length;i++){
    if(String(ids[i][0])===String(id)){
      var current=sh.getRange(i+2,1,1,headers.length).getValues()[0];
      headers.forEach(function(h,j){
        if(obj[h] !== undefined) current[j]=obj[h];
      });
      sh.getRange(i+2,1,1,headers.length).setValues([current]);
      return objectFromRow_(headers,current);
    }
  }
  throw apiError_("NOT_FOUND","Record not found.");
}

function deleteById_(sheetName,idField,id) {
  memoDrop_(sheetName);
  var sh=getSheet_(sheetName), headers=COGNIORA_SCHEMA[sheetName];
  var idx=headers.indexOf(idField), lastRow=sh.getLastRow();
  if(lastRow<2) throw apiError_("NOT_FOUND","Record not found.");
  var ids=sh.getRange(2,idx+1,lastRow-1,1).getValues();
  for(var i=ids.length-1;i>=0;i--) if(String(ids[i][0])===String(id)){ sh.deleteRow(i+2); return true; }
  throw apiError_("NOT_FOUND","Record not found.");
}

function findOne_(sheetName,field,value) {
  var rows=sheetToObjects_(sheetName);
  for(var i=0;i<rows.length;i++) if(String(rows[i][field])===String(value)) return rows[i];
  return null;
}

function findMany_(sheetName,field,value) {
  return sheetToObjects_(sheetName).filter(function(r){return String(r[field])===String(value);});
}

function objectFromRow_(headers,row) {
  var o={}; headers.forEach(function(h,i){o[h]=row[i]===null?"":row[i];}); return o;
}

function setSetting_(key,value,description,dataType,updatedBy) {
  var existing=findOne_("Data_Settings","Setting_Key",key), now=now_();
  var obj={Setting_Key:key,Setting_Value:String(value),Description:description||"",Data_Type:dataType||"TEXT",Updated_At:now,Updated_By:updatedBy||""};
  if(existing) return updateObject_("Data_Settings","Setting_Key",key,obj);
  return appendObject_("Data_Settings",obj);
}

function getSetting_(key, fallback) {
  var r=findOne_("Data_Settings","Setting_Key",key);
  if(!r) return fallback;
  return r.Setting_Value === "" || r.Setting_Value === null ? fallback : r.Setting_Value;
}