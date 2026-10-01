(function () {
  var T = window.TJ;
  var $ = function (id) { return document.getElementById(id); };
  var S = { trades: [], capital: 500000 };

  function filtered() {
    var m = $('fm').value, q = $('fq').value.trim().toLowerCase();
    return S.trades.filter(function (t) {
      return (!m || t.date.slice(0, 7) === m) && (!q || (t.trade || '').toLowerCase().indexOf(q) >= 0);
    });
  }

  function stat(label, value, klass, sub) {
    return '<div class="card stat"><div class="l">' + label + '</div><div class="v ' + (klass || '') + '">' + value + '</div>' +
      (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  }

  function render() {
    var list = filtered(), st = T.stats(list), days = T.groupByDay(list);
    var p = T.ofCap(st.net, S.capital);
    $('sum').innerHTML =
      stat('Net profit / loss', T.signed(st.net), T.cls(st.net), 'after brokerage') +
      stat('Profit %', T.pct(p), T.cls(p), 'on starting capital') +
      stat('Trades', st.count, '', days.length + ' trading day' + (days.length === 1 ? '' : 's') + ' · ' + st.wins + ' wins · ' + st.losses + ' losses');

    if (!days.length) {
      $('tbl').innerHTML = '<div class="empty">No trades here yet. Add your first one from the Dashboard.</div>';
      return;
    }
    var h = '<table><thead><tr><th>Date</th><th>Time</th><th>Trade took</th><th class="r">Lots</th><th class="r">Profit / loss</th>' +
      '<th class="r">Brokerage</th><th class="r">Net</th><th class="r">Day %</th></tr></thead><tbody>';
    days.forEach(function (d) {
      var dp = T.ofCap(d.net, S.capital);
      h += '<tr class="day"><td>' + T.shortDate(d.date) + '</td><td></td><td class="muted" style="font-weight:400">' + d.trades.length + ' trade' + (d.trades.length === 1 ? '' : 's') +
        '</td><td class="r">' + d.lots + '</td><td class="r ' + T.cls(d.gross) + '">' + T.signed(d.gross) +
        '</td><td class="r">' + (d.brk ? '−' + T.money(d.brk) : '₹0') + '</td><td class="r ' + T.cls(d.net) + '">' + T.signed(d.net) +
        '</td><td class="r ' + T.cls(d.net) + '">' + T.pct(dp) + '</td></tr>';
      d.trades.forEach(function (t) {
        var n = T.net(t);
        h += '<tr class="trade"><td class="d"><a class="ed" href="index.html?date=' + t.date + '&edit=' + encodeURIComponent(t.id) + '">Edit</a></td><td>' + T.esc(t.time || '—') +
          '</td><td>' + T.esc(t.trade || 'Trade') + '</td><td class="r">' + t.lots + '</td><td class="r ' + T.cls(t.gross) + '">' + T.signed(t.gross) +
          '</td><td class="r">' + (t.brokerage ? '−' + T.money(t.brokerage) : '₹0') + '</td><td class="r ' + T.cls(n) + '">' + T.signed(n) + '</td><td></td></tr>';
      });
    });
    $('tbl').innerHTML = h + '</tbody></table>';
  }

  function fillMonths() {
    var seen = {};
    S.trades.forEach(function (t) { seen[t.date.slice(0, 7)] = 1; });
    var keys = Object.keys(seen).sort().reverse();
    $('fm').innerHTML = '<option value="">All months</option>' + keys.map(function (k) {
      return '<option value="' + k + '">' + T.monthLabel(k) + '</option>';
    }).join('');
    if (keys.length) $('fm').value = keys[0];
  }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCsv() {
    var rows = [['Date', 'Time', 'Trade', 'Lots', 'Gross P/L', 'Brokerage', 'Net P/L']];
    filtered().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).forEach(function (t) {
      rows.push([t.date, t.time, t.trade, t.lots, t.gross, t.brokerage, T.net(t)]);
    });
    var blob = new Blob([rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trade-journal.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  async function load() {
    try {
      var j = await T.api('list');
      S.trades = j.trades; S.capital = j.capital;
    } catch (err) {
      $('tbl').innerHTML = '<div class="empty">Could not load your data: ' + T.esc(err.message) + ' <button class="link" type="button" onclick="location.reload()">Retry</button></div>';
      return;
    }
    fillMonths();
    render();
  }

  $('fm').addEventListener('change', render);
  $('fq').addEventListener('input', render);
  $('csv').addEventListener('click', exportCsv);
  load();
})();
