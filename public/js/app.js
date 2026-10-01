/* Shared helpers: API calls, PIN prompt, formatting, grouping and stats. */
window.TJ = (function () {
  var pad = function (n) { return String(n).padStart(2, '0'); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowTime() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function abs(n) { return Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function money(n) { return (n < 0 ? '−' : '') + '₹' + abs(n); }
  function signed(n) { return (n < 0 ? '−' : '+') + '₹' + abs(n); }
  function pct(n) { return (n < 0 ? '−' : n > 0 ? '+' : '') + Math.abs(n).toFixed(2) + '%'; }
  function cls(n) { return n < 0 ? 'neg' : n > 0 ? 'pos' : ''; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function net(t) { return r2(t.gross - t.brokerage); }  // brokerage always reduces profit / deepens loss
  function ofCap(n, cap) { return cap > 0 ? (n / cap) * 100 : 0; }

  function monthLabel(key) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  function niceDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function shortDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* Group trades by date -> sorted newest first */
  function groupByDay(trades) {
    var m = {};
    trades.forEach(function (t) {
      var d = m[t.date] || (m[t.date] = { date: t.date, trades: [], lots: 0, gross: 0, brk: 0, net: 0 });
      d.trades.push(t);
      d.lots += t.lots;
      d.gross += t.gross;
      d.brk += t.brokerage;
      d.net += net(t);
    });
    var out = Object.keys(m).map(function (k) {
      var d = m[k];
      d.gross = r2(d.gross); d.brk = r2(d.brk); d.net = r2(d.net);
      d.trades.sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
      return d;
    });
    out.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return out;
  }

  function stats(trades) {
    var s = { net: 0, count: trades.length, wins: 0, losses: 0 };
    trades.forEach(function (t) {
      var n = net(t);
      s.net += n;
      if (n > 0) s.wins++; else if (n < 0) s.losses++;
    });
    s.net = r2(s.net);
    return s;
  }

  function toast(msg, isErr) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.className = ''; }, 2600);
  }

  var pinWait = null;
  function askPin(msg) {
    if (pinWait) return pinWait;
    pinWait = new Promise(function (resolve) {
      var o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = '<form class="pinbox card"><h3>Enter your PIN</h3><p class="muted" style="margin:0;font-size:13px">' +
        esc(msg || 'This journal is private.') + '</p><input type="password" autocomplete="current-password" aria-label="PIN"><button class="btn primary">Unlock</button></form>';
      document.body.appendChild(o);
      var inp = o.querySelector('input');
      o.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!inp.value) return;
        localStorage.setItem('tj_pin', inp.value);
        o.remove();
        pinWait = null;
        resolve();
      });
      setTimeout(function () { inp.focus(); }, 50);
    });
    return pinWait;
  }

  /* ---------- Local preview mode ----------
     When the pages are opened straight from an IDE (file:// or Live Server) there is no /api
     function behind them. ONLY on localhost / file:// we then fall back to sample data kept in
     this browser, so you can look around. On your real Netlify address this never happens. */
  var demo = false;
  function isLocalHost() {
    var h = location.hostname;
    return location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '[::1]' || h === '';
  }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function seedDemo() {
    var names = ['NIFTY 24500 CE', 'BANKNIFTY 52000 PE', 'NIFTY 24400 PE', 'FINNIFTY 23500 CE'];
    var pat = [1850, 3200, -1400, 2250, 4100, -2300, 1600, 2900, -800, 3500, 1200, -1950, 2700, 5200, -1100, 2100, 1700, -2600, 900, 1500, 3100, -2080];
    var now = new Date(), trades = [], n = 0;
    for (var back = 45; back >= 0; back--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back), dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      var lots = (n % 4) + 1, brk = lots * 80, netv = pat[n % pat.length];
      n++;
      trades.push({ id: 'demo' + n, date: ymd(d), time: '09:' + pad(15 + (n * 7) % 40), trade: names[n % 4], lots: lots, gross: netv + brk, brokerage: brk });
    }
    return { trades: trades, capital: 500000 };
  }
  function demoLoad() {
    try { var raw = localStorage.getItem('tj_demo_data'); if (raw) return JSON.parse(raw); } catch (e) {}
    var d = seedDemo();
    try { localStorage.setItem('tj_demo_data', JSON.stringify(d)); } catch (e) {}
    return d;
  }
  function demoClean(t) {
    t = t || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || ''))) throw new Error('Invalid date');
    return { date: t.date, time: String(t.time || ''), trade: String(t.trade || '').slice(0, 80), lots: Number(t.lots) || 0, gross: Number(t.gross) || 0, brokerage: Number(t.brokerage) || 0 };
  }
  function demoApi(action, data) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try {
          var d = demoLoad(); data = data || {};
          function idx(id) { for (var i = 0; i < d.trades.length; i++) if (d.trades[i].id === id) return i; return -1; }
          if (action === 'add') {
            var t = demoClean(data.trade);
            t.id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            d.trades.push(t);
          } else if (action === 'update') {
            var i = idx(data.id); if (i < 0) throw new Error('Trade not found');
            var c = demoClean(data.trade); c.id = data.id; d.trades[i] = c;
          } else if (action === 'delete') {
            var j = idx(data.id); if (j < 0) throw new Error('Trade not found');
            d.trades.splice(j, 1);
          } else if (action === 'setCapital') {
            var cap = Number(data.capital); if (!(cap > 0)) throw new Error('Invalid capital');
            d.capital = cap;
          }
          if (action !== 'list') localStorage.setItem('tj_demo_data', JSON.stringify(d));
          resolve({ ok: true, trades: d.trades.slice(), capital: d.capital });
        } catch (e) { reject(e); }
      }, 80);
    });
  }
  function showDemoBanner() {
    if (document.getElementById('demoBanner')) return;
    var b = document.createElement('div');
    b.id = 'demoBanner'; b.className = 'demo';
    b.innerHTML = '<div class="wrap"><b>Preview mode.</b> No backend found here, so this shows sample data stored only in this browser, not your Google Sheet. ' +
      '<button class="link" type="button" id="demoReset">Reset sample data</button></div>';
    var h = document.querySelector('header');
    if (h) h.insertAdjacentElement('afterend', b); else document.body.prepend(b);
    document.getElementById('demoReset').onclick = function () {
      try { localStorage.removeItem('tj_demo_data'); } catch (e) {}
      location.reload();
    };
  }
  async function api(action, data, retry) {
    if (demo) return demoApi(action, data);
    try {
      return await realApi(action, data, retry);
    } catch (e) {
      if (e && e.noBackend && isLocalHost()) { demo = true; showDemoBanner(); return demoApi(action, data); }
      if (e && e.noBackend) e.message = 'Cannot reach /api. Check that the Netlify function deployed (see README, Troubleshooting).';
      throw e;
    }
  }

  async function realApi(action, data, retry) {
    var res;
    try {
      res = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-journal-pin': localStorage.getItem('tj_pin') || '' },
        body: JSON.stringify(Object.assign({ action: action }, data || {}))
      });
    } catch (e) {
      var ne = new Error('Network error. Check your connection.'); ne.noBackend = true; throw ne;
    }
    if (res.status === 401) {
      await askPin(retry ? 'Wrong PIN. Try again.' : '');
      return realApi(action, data, true);
    }
    if (res.status === 404 || res.status === 405 || res.status === 501) {
      var nb = new Error('API not found'); nb.noBackend = true; throw nb;
    }
    var j;
    try { j = await res.json(); } catch (e) { throw new Error('Unexpected server response (status ' + res.status + ')'); }
    if (!j.ok) throw new Error(j.error || 'Request failed');
    return j;
  }

  return {
    esc: esc, todayStr: todayStr, nowTime: nowTime, money: money, signed: signed, pct: pct, cls: cls,
    net: net, ofCap: ofCap, r2: r2, monthLabel: monthLabel, niceDate: niceDate, shortDate: shortDate,
    groupByDay: groupByDay, stats: stats, toast: toast, api: api
  };
})();
