// Minimal Google Apps Script runtime mock for exercising Cogniora backend logic.
// Key fidelity point: Sheets auto-converts date-like strings to Date objects (unless the cell is text-formatted).
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const TZ_OFFSET_MIN = 7 * 60; // Asia/Jakarta

function pad(n, l = 2) { return String(n).padStart(l, '0'); }
function wall(date) { return new Date(date.getTime() + TZ_OFFSET_MIN * 60000); } // shift so getUTC* gives Jakarta wall time
function formatDate(date, tz, fmt) {
  const w = wall(date);
  return fmt.replace(/yyyy/g, w.getUTCFullYear()).replace(/MM/g, pad(w.getUTCMonth() + 1))
    .replace(/dd/g, pad(w.getUTCDate())).replace(/HH/g, pad(w.getUTCHours()))
    .replace(/mm/g, pad(w.getUTCMinutes())).replace(/ss/g, pad(w.getUTCSeconds()));
}
function jakartaDate(y, mo, d, h = 0, mi = 0, s = 0) { return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - TZ_OFFSET_MIN * 60000); }

// Emulates "user entered" parsing performed by Sheets for setValues/appendRow.
function sheetsParse(v) {
  if (typeof v !== 'string') return v;
  let m;
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return jakartaDate(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/))) return jakartaDate(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0));
  if ((m = v.match(/^(\d{4})-(\d{2})$/))) return jakartaDate(+m[1], +m[2], 1);
  if ((m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/))) return jakartaDate(1899, 12, 30, +m[1], +m[2], +(m[3] || 0));
  if (/^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim() !== '') return Number(v);
  if (v === 'TRUE' || v === 'true') return true;
  if (v === 'FALSE' || v === 'false') return false;
  return v;
}

class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.data[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); }
    return out;
  }
  setValues(vals) {
    for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals[i].length; j++) this.sh._set(this.r + i, this.c + j, vals[i][j]);
    return this;
  }
  setValue(v) { this.sh._set(this.r, this.c, v); return this; }
  setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.fmt[(this.r + i) + ':' + (this.c + j)] = f; return this; }
  setFontWeight() { return this; } setFontSize() { return this; } setBackground() { return this; } setFontColor() { return this; }
  setVerticalAlignment() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.data = []; this.fmt = {}; this.maxRows = 1000; }
  _set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    const row = this.data[r - 1]; while (row.length < c) row.push('');
    const isText = this.fmt[r + ':' + c] === '@' || this.fmt['col:' + c] === '@';
    row[c - 1] = isText ? (v === null || v === undefined ? '' : String(v)) : sheetsParse(v);
  }
  getLastRow() { let last = 0; this.data.forEach((row, i) => { if (row.some(v => v !== '' && v !== null && v !== undefined)) last = i + 1; }); return last; }
  getLastColumn() { let m = 0; this.data.forEach(r => { m = Math.max(m, r.length); }); return m; }
  getMaxRows() { return Math.max(this.maxRows, this.data.length); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, j) => this._set(r, j + 1, v)); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows() {} setName(n) { this.name = n; }
}
class Spreadsheet {
  constructor() { this.sheets = {}; this.id = 'SS-MOCK'; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
  getId() { return this.id; }
  getSpreadsheetTimeZone() { return 'Asia/Jakarta'; }
}

function makeBlob(bytes, mime, name) {
  return { getBytes: () => bytes, getContentType: () => mime, getName: () => name, setName(n) { name = n; return this; } };
}

function createEnv(opts = {}) {
  const ss = new Spreadsheet();
  const props = {}, cacheStore = {};
  let nowOverride = opts.now || null;
  const sandbox = {
    console, Math, JSON, Date,
    Number, String, Array, Object, RegExp, Boolean, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Error,
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss, flush() {}, create() { throw new Error('SpreadsheetApp.create not mocked'); }, getUi() { throw new Error('UI'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cacheStore ? cacheStore[k] : null), put: (k, v) => { cacheStore[k] = String(v); }, remove: k => { delete cacheStore[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate,
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, text) => Array.from(crypto.createHash('sha256').update(String(text), 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      base64EncodeWebSafe: arr => Buffer.from(arr.map(b => (b + 256) % 256)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Decode: s => Array.from(Buffer.from(s, 'base64')).map(b => b > 127 ? b - 256 : b),
      newBlob: (data, mime, name) => { const bytes = typeof data === 'string' ? Array.from(Buffer.from(data, 'utf8')).map(b => b > 127 ? b - 256 : b) : data; return makeBlob(bytes, mime, name); },
    },
    Logger: { log() {} },
    MailApp: { sendEmail() {} },
    Session: { getActiveUser: () => ({ getEmail: () => 'owner@test' }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/x/exec' }), getOAuthToken: () => 'tok' },
    ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    HtmlService: {},
  };
  const ctx = vm.createContext(sandbox);
  const dir = path.join(__dirname, '..', 'gas');
  const files = (opts.dir ? fs.readdirSync(opts.dir) : fs.readdirSync(dir)).filter(f => f.endsWith('.gs')).sort();
  const base = opts.dir || dir;
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, { filename: f });
  props['SPREADSHEET_ID'] = 'SS-MOCK'; props['GAS_API_KEY'] = 'KEY';
  vm.runInContext('ensureAllSheets_(); ensureDefaultSettings_(); ensureDefaultLevels_();', ctx);
  return { ctx, ss, props, setNow: d => { nowOverride = d; }, run: code => vm.runInContext(code, ctx), call: (fn, ...args) => { ctx.__a = args; return vm.runInContext(fn + '(...__a)', ctx); } };
}
module.exports = { createEnv, jakartaDate, formatDate, sheetsParse };
