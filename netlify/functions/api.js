// Netlify function: PIN-protected proxy between the website and your Google Apps Script.
// Environment variables (set in Netlify site settings):
//   JOURNAL_PIN  - the PIN / passphrase you type to open the journal
//   SCRIPT_URL   - the Apps Script web app URL (ends with /exec)
//   SCRIPT_KEY   - the same secret you stored in Apps Script > Script properties

const crypto = require('crypto');

const ACTIONS = new Set(['list', 'add', 'update', 'delete', 'setCapital']);
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function reply(statusCode, obj) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(obj) };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'POST only' });

  const { JOURNAL_PIN, SCRIPT_URL, SCRIPT_KEY } = process.env;
  if (!JOURNAL_PIN || !SCRIPT_URL || !SCRIPT_KEY) {
    return reply(500, { ok: false, error: 'Server is not configured. Set JOURNAL_PIN, SCRIPT_URL and SCRIPT_KEY in Netlify, then redeploy.' });
  }

  const sent = (event.headers && (event.headers['x-journal-pin'] || '')) || '';
  if (!safeEqual(sent, JOURNAL_PIN)) {
    await new Promise((r) => setTimeout(r, 700));
    return reply(401, { ok: false, error: 'Wrong PIN' });
  }

  let req;
  try {
    req = JSON.parse(event.body || '{}');
  } catch (e) {
    return reply(400, { ok: false, error: 'Bad request' });
  }
  if (!ACTIONS.has(req.action)) return reply(400, { ok: false, error: 'Unknown action' });

  const payload = { key: SCRIPT_KEY, action: req.action };
  if (req.trade) payload.trade = req.trade;
  if (req.id) payload.id = req.id;
  if (req.capital != null) payload.capital = req.capital;

  try {
    const r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return reply(502, { ok: false, error: 'Google Sheet backend returned an unexpected response. Check the Apps Script deployment (Who has access: Anyone).' });
    }
    return reply(data.ok ? 200 : 502, data);
  } catch (e) {
    return reply(502, { ok: false, error: 'Could not reach the Google Sheet backend.' });
  }
};
