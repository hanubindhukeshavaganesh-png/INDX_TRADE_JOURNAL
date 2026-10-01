/**
 * Trade journal backend (Google Apps Script).
 * Bound to YOUR Google Sheet. Stores trades in a "Trades" tab and the
 * starting capital in a "Settings" tab. Only your Netlify function can talk
 * to it, because every request must carry the secret SCRIPT_KEY.
 */

var TRADES = 'Trades';
var SETTINGS = 'Settings';
var HEAD = ['ID', 'Date', 'Time', 'Trade', 'Lots', 'Gross P/L', 'Brokerage', 'Net P/L', 'Created'];

/** Optional: run once from the editor to create the tabs. */
function setup() {
  ensureSheets_();
}

function doGet() {
  return ContentService.createTextOutput('Trade journal backend is running.');
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('SCRIPT_KEY');
    if (!key || req.key !== key) throw new Error('Unauthorized');
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      out = handle_(req);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  var sh = ensureSheets_();
  switch (req.action) {
    case 'list':
      return list_(sh);
    case 'add':
      add_(sh, req.trade);
      return list_(sh);
    case 'update':
      update_(sh, req.id, req.trade);
      return list_(sh);
    case 'delete':
      remove_(sh, req.id);
      return list_(sh);
    case 'setCapital':
      setCapital_(sh, req.capital);
      return list_(sh);
    default:
      throw new Error('Unknown action');
  }
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t = ss.getSheetByName(TRADES);
  if (!t) t = ss.insertSheet(TRADES);
  if (t.getLastRow() === 0) {
    t.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    t.setFrozenRows(1);
    t.getRange('B:C').setNumberFormat('@');
  }
  var s = ss.getSheetByName(SETTINGS);
  if (!s) {
    s = ss.insertSheet(SETTINGS);
    s.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold');
    s.appendRow(['capital', 500000]);
  }
  return { t: t, s: s };
}

function normDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function normTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  return String(v || '').slice(0, 5);
}

function list_(sh) {
  var t = sh.t;
  var n = t.getLastRow() - 1;
  var trades = [];
  if (n > 0) {
    var v = t.getRange(2, 1, n, 7).getValues();
    for (var i = 0; i < v.length; i++) {
      var r = v[i];
      if (!r[0]) continue;
      trades.push({
        id: String(r[0]),
        date: normDate_(r[1]),
        time: normTime_(r[2]),
        trade: String(r[3] || ''),
        lots: Number(r[4]) || 0,
        gross: Number(r[5]) || 0,
        brokerage: Number(r[6]) || 0
      });
    }
  }
  return { ok: true, trades: trades, capital: getCapital_(sh.s) };
}

function clean_(tr) {
  if (!tr) throw new Error('Missing trade');
  var date = String(tr.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  var time = String(tr.time || '');
  if (time && !/^\d{2}:\d{2}$/.test(time)) throw new Error('Invalid time');
  var lots = Number(tr.lots);
  var gross = Number(tr.gross);
  var brk = Number(tr.brokerage || 0);
  if (!isFinite(lots) || lots < 0) throw new Error('Invalid lots');
  if (!isFinite(gross)) throw new Error('Invalid amount');
  if (!isFinite(brk) || brk < 0) throw new Error('Invalid brokerage');
  return { date: date, time: time, trade: String(tr.trade || '').slice(0, 80), lots: lots, gross: gross, brokerage: brk };
}

function writeRow_(t, r, id, c) {
  t.getRange(r, 2, 1, 2).setNumberFormat('@');
  t.getRange(r, 1, 1, 7).setValues([[id, c.date, c.time, c.trade, c.lots, c.gross, c.brokerage]]);
  t.getRange(r, 8).setFormula('=F' + r + '-G' + r);
}

function add_(sh, tr) {
  var c = clean_(tr);
  var t = sh.t;
  var r = t.getLastRow() + 1;
  var id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  writeRow_(t, r, id, c);
  t.getRange(r, 9).setValue(new Date());
}

function findRow_(t, id) {
  var n = t.getLastRow() - 1;
  if (n < 1) return -1;
  var ids = t.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function update_(sh, id, tr) {
  var c = clean_(tr);
  var r = findRow_(sh.t, id);
  if (r < 0) throw new Error('Trade not found');
  writeRow_(sh.t, r, String(id), c);
}

function remove_(sh, id) {
  var r = findRow_(sh.t, id);
  if (r < 0) throw new Error('Trade not found');
  sh.t.deleteRow(r);
}

function getCapital_(s) {
  var n = s.getLastRow();
  if (n < 2) return 500000;
  var v = s.getRange(2, 1, n - 1, 2).getValues();
  for (var i = 0; i < v.length; i++) {
    if (v[i][0] === 'capital') return Number(v[i][1]) || 500000;
  }
  return 500000;
}

function setCapital_(sh, cap) {
  var c = Number(cap);
  if (!isFinite(c) || c <= 0) throw new Error('Invalid capital');
  var s = sh.s;
  var n = s.getLastRow();
  if (n >= 2) {
    var v = s.getRange(2, 1, n - 1, 2).getValues();
    for (var i = 0; i < v.length; i++) {
      if (v[i][0] === 'capital') {
        s.getRange(i + 2, 2).setValue(c);
        return;
      }
    }
  }
  s.appendRow(['capital', c]);
}
