(function () {
  var T = window.TJ;
  var $ = function (id) { return document.getElementById(id); };
  var S = { trades: [], capital: 500000, month: T.todayStr().slice(0, 7), sel: T.todayStr(), editId: null, kind: 'p' };

  function monthOf(d) { return d.slice(0, 7); }
  function inMonth(t) { return monthOf(t.date) === S.month; }

  function stat(label, value, klass, sub) {
    return '<div class="card stat"><div class="l">' + label + '</div><div class="v ' + (klass || '') + '">' + value + '</div>' +
      (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  }

  function renderTop() {
    var st = T.stats(S.trades);
    var p = T.ofCap(st.net, S.capital);
    $('top').innerHTML =
      stat('Gross profit', T.signed(st.net), T.cls(st.net), 'after brokerage') +
      stat('Profit %', T.pct(p), T.cls(p), 'on starting capital') +
      stat('Total trades', st.count, '', 'all time');
    $('cap').textContent = T.money(S.capital);
  }

  function renderMonth() {
    $('mlabel').textContent = T.monthLabel(S.month);
    var st = T.stats(S.trades.filter(inMonth));
    var p = T.ofCap(st.net, S.capital);
    $('mbar').innerHTML =
      stat('Profit', T.signed(st.net), T.cls(st.net)) +
      stat('Profit %', T.pct(p), T.cls(p)) +
      stat('Trades', st.count) +
      stat('Wins', st.wins, 'pos') +
      stat('Losses', st.losses, 'neg');
  }

  function compact(n) {
    var a = Math.abs(n);
    return (n < 0 ? '−' : '+') + (a >= 1000 ? (a / 1000).toFixed(1) + 'k' : Math.round(a));
  }

  function renderCal() {
    var p = S.month.split('-'), y = +p[0], m = +p[1];
    var dim = new Date(y, m, 0).getDate();
    var off = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    var days = T.groupByDay(S.trades.filter(inMonth)), by = {}, mx = 1;
    days.forEach(function (d) { by[d.date] = d; mx = Math.max(mx, Math.abs(d.net)); });
    var today = T.todayStr();
    var h = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<div class="dow">' + x + '</div>'; }).join('');
    for (var i = 0; i < off; i++) h += '<div class="cell blank"></div>';
    for (var d = 1; d <= dim; d++) {
      var ds = S.month + '-' + String(d).padStart(2, '0');
      var day = by[ds], we = ((off + d - 1) % 7) >= 5, style = '', amt = '';
      if (day && day.net !== 0) {
        var pc = Math.round(20 + 55 * Math.abs(day.net) / mx);
        style = ' style="background:color-mix(in srgb,var(' + (day.net > 0 ? '--green' : '--red') + ') ' + pc + '%,transparent)"';
      }
      if (day) amt = compact(day.net);
      h += '<button type="button" class="cell' + (we ? ' we' : '') + (ds === today ? ' today' : '') + (ds === S.sel ? ' sel' : '') +
        '" data-d="' + ds + '"' + style + '><div class="n">' + d + '</div><div class="a">' + amt + '</div></button>';
    }
    $('cal').innerHTML = h;
  }

  function kv(l, v, c, tot) {
    return '<div class="kv' + (tot ? ' tot' : '') + '"><span class="muted">' + l + '</span><span class="' + (c || '') + '">' + v + '</span></div>';
  }

  function renderPanel() {
    var dayTrades = S.trades.filter(function (t) { return t.date === S.sel; });
    var day = T.groupByDay(dayTrades)[0];
    var editing = S.editId ? S.trades.filter(function (t) { return t.id === S.editId; })[0] : null;
    var h = '<h3>' + T.niceDate(S.sel) + '</h3>';
    if (day) {
      var dp = T.ofCap(day.net, S.capital);
      h += '<div style="margin-top:6px">' +
        kv('Trades', day.trades.length) + kv('Lots', day.lots) +
        kv('Gross P/L', T.signed(day.gross), T.cls(day.gross)) +
        kv('Brokerage', day.brk ? '−' + T.money(day.brk) : '₹0') +
        kv('Net day P/L', T.signed(day.net) + ' (' + T.pct(dp) + ')', T.cls(day.net), true) + '</div>';
      h += '<div class="tl">' + day.trades.map(function (t) {
        var n = T.net(t);
        return '<div class="tr"><span class="t">' + T.esc(t.time || '—') + '</span><span class="nm">' + T.esc(t.trade || 'Trade') + ' · ' + t.lots + ' lot' + (t.lots === 1 ? '' : 's') +
          '</span><b class="' + T.cls(n) + '">' + T.signed(n) + '</b>' +
          '<button class="btn sm" type="button" data-edit="' + T.esc(t.id) + '">Edit</button>' +
          '<button class="btn sm danger" type="button" data-del="' + T.esc(t.id) + '">Del</button></div>';
      }).join('') + '</div>';
    } else {
      h += '<p class="muted" style="margin:8px 0 0;font-size:13px">No trades on this day yet.</p>';
    }

    var v = editing ? {
      date: editing.date, time: editing.time, trade: editing.trade, lots: editing.lots,
      amt: Math.abs(editing.gross), brk: editing.brokerage
    } : { date: S.sel, time: S.sel === T.todayStr() ? T.nowTime() : '', trade: '', lots: '', amt: '', brk: '' };
    S.kind = editing ? (editing.gross < 0 ? 'l' : 'p') : S.kind;

    h += '<h4>' + (editing ? 'Edit trade' : 'Add trade') + '</h4>' +
      '<form class="f" id="tf" autocomplete="off">' +
      '<label class="fld">Date<input type="date" id="f_date" value="' + v.date + '" required></label>' +
      '<label class="fld">Time<input type="time" id="f_time" value="' + v.time + '"></label>' +
      '<label class="fld full">Trade (optional)<input type="text" id="f_trade" maxlength="80" placeholder="NIFTY 24500 CE" value="' + T.esc(v.trade) + '"></label>' +
      '<label class="fld">Lots<input type="number" id="f_lots" min="0" step="any" inputmode="decimal" placeholder="3" value="' + v.lots + '"></label>' +
      '<div class="fld">Result<div class="seg" id="seg">' +
        '<label class="p' + (S.kind === 'p' ? ' on' : '') + '" data-k="p">Profit</label>' +
        '<label class="l' + (S.kind === 'l' ? ' on' : '') + '" data-k="l">Loss</label></div></div>' +
      '<label class="fld">Amount (₹)<input type="number" id="f_amt" min="0" step="any" inputmode="decimal" placeholder="2800" value="' + v.amt + '"></label>' +
      '<label class="fld">Brokerage (₹)<input type="number" id="f_brk" min="0" step="any" inputmode="decimal" placeholder="240" value="' + v.brk + '"></label>' +
      '<div class="prev" style="grid-column:1/-1"><span class="muted">Net for this trade</span><b id="prevNet">—</b></div>' +
      '<div class="hint" style="grid-column:1/-1">Brokerage is deducted from a profit and added to a loss.</div>' +
      '<div class="acts"><button class="btn primary" type="submit" id="saveBtn">' + (editing ? 'Update trade' : 'Save trade') + '</button>' +
      (editing ? '<button class="btn" type="button" id="cancelEdit">Cancel</button>' : '') + '</div></form>';
    $('panel').innerHTML = h;
    updatePreview();
  }

  function formGross() {
    var a = Number($('f_amt').value) || 0;
    return S.kind === 'l' ? -a : a;
  }
  function updatePreview() {
    var el = $('prevNet');
    if (!el) return;
    var n = T.r2(formGross() - (Number($('f_brk').value) || 0));
    el.textContent = T.signed(n);
    el.className = T.cls(n);
  }

  async function save(e) {
    e.preventDefault();
    var c = {
      date: $('f_date').value, time: $('f_time').value, trade: $('f_trade').value.trim(),
      lots: Number($('f_lots').value || 0), gross: formGross(), brokerage: Number($('f_brk').value || 0)
    };
    if (!c.date) return T.toast('Pick a date', true);
    if ($('f_amt').value === '') return T.toast('Enter the profit or loss amount', true);
    var btn = $('saveBtn'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      var j = await T.api(S.editId ? 'update' : 'add', S.editId ? { id: S.editId, trade: c } : { trade: c });
      S.trades = j.trades; S.capital = j.capital;
      S.sel = c.date; S.month = monthOf(c.date); S.editId = null; S.kind = 'p';
      render();
      T.toast('Saved');
    } catch (err) {
      T.toast(err.message, true);
      btn.disabled = false; btn.textContent = label;
    }
  }

  async function del(id) {
    if (!confirm('Delete this trade?')) return;
    try {
      var j = await T.api('delete', { id: id });
      S.trades = j.trades; S.capital = j.capital;
      if (S.editId === id) S.editId = null;
      render();
      T.toast('Deleted');
    } catch (err) { T.toast(err.message, true); }
  }

  function pickDefaultDay() {
    var today = T.todayStr();
    if (monthOf(today) === S.month) return today;
    var days = T.groupByDay(S.trades.filter(inMonth));
    return days.length ? days[0].date : S.month + '-01';
  }
  function shiftMonth(delta) {
    var p = S.month.split('-'), d = new Date(+p[0], +p[1] - 1 + delta, 1);
    S.month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    S.sel = pickDefaultDay(); S.editId = null;
    render();
  }

  function render() { renderTop(); renderMonth(); renderCal(); renderPanel(); }

  function bind() {
    $('prev').onclick = function () { shiftMonth(-1); };
    $('next').onclick = function () { shiftMonth(1); };
    $('todayBtn').onclick = function () { S.month = monthOf(T.todayStr()); S.sel = T.todayStr(); S.editId = null; render(); };
    $('cal').addEventListener('click', function (e) {
      var b = e.target.closest('[data-d]');
      if (!b) return;
      S.sel = b.getAttribute('data-d'); S.editId = null; renderCal(); renderPanel();
    });
    $('editCap').onclick = async function () {
      var v = prompt('Starting capital (₹) used for profit %:', String(S.capital));
      if (v === null) return;
      var n = Number(String(v).replace(/,/g, ''));
      if (!(n > 0)) return T.toast('Enter a valid amount', true);
      try { var j = await T.api('setCapital', { capital: n }); S.trades = j.trades; S.capital = j.capital; render(); T.toast('Capital updated'); }
      catch (err) { T.toast(err.message, true); }
    };
    var panel = $('panel');
    panel.addEventListener('submit', function (e) { if (e.target.id === 'tf') save(e); });
    panel.addEventListener('input', function (e) { if (e.target.id === 'f_amt' || e.target.id === 'f_brk') updatePreview(); });
    panel.addEventListener('click', function (e) {
      var seg = e.target.closest('[data-k]');
      if (seg) {
        S.kind = seg.getAttribute('data-k');
        var ls = $('seg').children;
        for (var i = 0; i < ls.length; i++) ls[i].classList.toggle('on', ls[i].getAttribute('data-k') === S.kind);
        updatePreview();
        return;
      }
      var ed = e.target.closest('[data-edit]');
      if (ed) { S.editId = ed.getAttribute('data-edit'); renderPanel(); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) { del(dl.getAttribute('data-del')); return; }
      if (e.target.id === 'cancelEdit') { S.editId = null; S.kind = 'p'; renderPanel(); }
    });
  }

  async function load() {
    $('top').innerHTML = '<div class="card loading" style="grid-column:1/-1">Loading your journal…</div>';
    try {
      var j = await T.api('list');
      S.trades = j.trades; S.capital = j.capital;
    } catch (err) {
      $('top').innerHTML = '<div class="card" style="grid-column:1/-1">Could not load your data: ' + T.esc(err.message) +
        ' <button class="link" type="button" onclick="location.reload()">Retry</button></div>';
      return;
    }
    var q = new URLSearchParams(location.search), qd = q.get('date'), qe = q.get('edit');
    if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) { S.sel = qd; S.month = monthOf(qd); }
    if (qe && S.trades.some(function (t) { return t.id === qe; })) S.editId = qe;
    render();
  }

  bind();
  load();
})();
