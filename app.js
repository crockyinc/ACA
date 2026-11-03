(function () {
  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/1siSzGXndcN7wYAtTlKQb7n5qqlqqZvxbesrXk_2vGpw/export?format=csv";

  var input = document.getElementById("state-input");
  var searchBtn = document.getElementById("search-btn");
  var clearBtn = document.getElementById("clear-btn");
  var refreshBtn = document.getElementById("refresh-btn");
  var status = document.getElementById("status");
  var statusMeta = document.getElementById("status-meta");
  var tbody = document.getElementById("results-body");
  var banner = document.getElementById("verified-banner");
  var verifiedSub = document.getElementById("verified-sub");
  var verifiedCode = document.getElementById("verified-code");

  var data = window.STATE_DATA || [];

  function parseCSV(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function normalizeRows(csvRows) {
    return csvRows
      .filter(function (r) { return r.length >= 10 && r[3] && r[3].trim() !== "" && r[3] !== "States"; })
      .map(function (r) { return r.slice(0, 10); });
  }

  function loadLiveData() {
    status.textContent = "Initializing State Database… You can start typing — the search runs as soon as it is ready.";
    status.classList.remove("hidden");
    return fetch(SHEET_CSV_URL)
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var rows = normalizeRows(parseCSV(text));
        if (rows.length) {
          data = rows;
          statusMeta.textContent = "Updated: " + new Date().toLocaleString() + " · Records: " + data.length;
        }
      })
      .catch(function () {})
      .then(function () {
        if (!statusMeta.textContent) {
          statusMeta.textContent = "Updated: " + new Date().toLocaleString() + " · Records: " + data.length;
        }
        status.classList.add("hidden");
        render();
      });
  }

  function matches(row, q) {
    if (!q) return false; // only show output while a state is being searched
    return row[3].toUpperCase().indexOf(q) === 0; // lookup value: States
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function tile(label, icon, value, big, singleLine) {
    var t = el("div", "tile");
    var l = el("div", "tile-label");
    l.appendChild(el("span", null, icon));
    l.appendChild(el("span", null, label));
    t.appendChild(l);
    t.appendChild(el("div", "tile-value" + (big ? " big" : "") + (singleLine ? " single" : ""), value || "—"));
    return t;
  }

  function instructionsTile(value) {
    var t = el("div", "tile tile-instructions");
    var l = el("div", "tile-label");
    l.appendChild(el("span", null, "📋"));
    l.appendChild(el("span", null, "INSTRUCTIONS"));
    t.appendChild(l);
    var v = el("div", "tile-value");
    var lines = (value || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) {
      v.textContent = "—";
    } else if (lines.length === 1) {
      v.textContent = lines[0];
    } else {
      var ul = el("ul", "bullet-list");
      lines.forEach(function (line) {
        ul.appendChild(el("li", null, line));
      });
      v.appendChild(ul);
    }
    t.appendChild(v);
    return t;
  }

  function render() {
    var q = input.value.trim().toUpperCase();
    var results = data.filter(function (r) { return matches(r, q); });
    tbody.innerHTML = "";

    if (!q) {
      banner.classList.add("hidden");
      tbody.appendChild(el("p", "empty-msg", "Type a state to see results"));
      return;
    }
    if (!results.length) {
      banner.classList.add("hidden");
      tbody.appendChild(el("p", "empty-msg", "No states match \"" + input.value.trim() + "\""));
      return;
    }

    verifiedSub.textContent = "\"" + q + "\" is good to go on \"" + results.length + "\" client" + (results.length > 1 ? "s" : "");
    verifiedCode.textContent = q;
    banner.classList.remove("hidden");

    results.forEach(function (r, i) {
      var card = el("article", "card");

      var top = el("div", "card-top");
      top.appendChild(el("div", "card-icon", "🏢"));
      var tw = el("div", "card-title-wrap");
      tw.appendChild(el("div", "card-kicker", "GOOD TO GO ON · " + (i + 1) + " OF " + results.length));
      tw.appendChild(el("div", "card-title", r[0] + (r[1] ? " — " + r[1] : "")));
      top.appendChild(tw);
      top.appendChild(el("span", "badge-covered", "✔ Covered"));
      card.appendChild(top);

      var grid = el("div", "card-grid");
      grid.appendChild(tile("STATE", "🗺", r[3], true));
      grid.appendChild(tile("AGE LIMIT", "🎂", r[4]));
      grid.appendChild(tile("ANNUAL INCOME", "💰", r[5]));
      var timingsTile = tile("TIMINGS", "🕐", r[2], false, true);
      timingsTile.classList.add("tile-wide");
      grid.appendChild(timingsTile);
      grid.appendChild(tile("BRANCH CODE", "🏷", r[9]));
      card.appendChild(grid);

      // FORM LINK box — data from the sheet's "Form Link" column
      var fb = el("div", "transfer-box form-box");
      fb.appendChild(el("div", "t-icon blue", "📄"));
      var fw = el("div", "t-fw");
      fw.appendChild(el("div", "transfer-label blue-label", "FORM LINK"));
      if (/^https?:\/\//i.test(r[6] || "")) {
        var a = el("a", "transfer-link blue-link", r[6]);
        a.href = r[6];
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        fw.appendChild(a);
      } else {
        fw.appendChild(el("div", "transfer-plain blue-plain", r[6] || "—"));
      }
      fb.appendChild(fw);
      card.appendChild(fb);

      // TRANSFER TO box — data from the sheet's "Line" column
      var tb = el("div", "transfer-box");
      tb.appendChild(el("div", "t-icon", "📞"));
      var tbw = el("div", "t-fw");
      tbw.appendChild(el("div", "transfer-label", "TRANSFER TO"));
      tbw.appendChild(el("div", "transfer-plain", r[0] || "—"));
      tb.appendChild(tbw);
      card.appendChild(tb);

      var grid2 = el("div", "card-grid");
      grid2.appendChild(tile("CREDENTIALS", "🔑", r[7]));
      grid2.appendChild(tile("INSTRUCTIONS", "📋", r[8]));
      card.appendChild(grid2);

      tbody.appendChild(card);
    });
  }

  /* ---- Live clocks ---- */
  var US_ZONES = [
    ["Pacific (PST/PDT)", "PST", "America/Los_Angeles"],
    ["Mountain (MST/MDT)", "MST", "America/Denver"],
    ["Central (CST/CDT)", "CST", "America/Chicago"],
    ["Eastern (EST/EDT)", "EST", "America/New_York"]
  ];
  var usWrap = document.getElementById("tz-us");
  var usRows = US_ZONES.map(function (z) {
    var row = el("div", "tz-row");
    var top = el("div", "tz-row-top");
    top.appendChild(el("span", null, z[0]));
    top.appendChild(el("span", "tz-row-badge", z[1]));
    row.appendChild(top);
    row.appendChild(el("div", "tz-row-time", "--:--:--"));
    row.appendChild(el("div", "tz-row-date", ""));
    usWrap.appendChild(row);
    return { zone: z[2], time: row.children[1], date: row.children[2] };
  });

  function fmt(d) {
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(h) + ":" + p(m) + ":" + p(s) + " " + ampm;
  }
  function fmtDate(d) {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function tick() {
    var now = new Date();
    var pkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
    document.getElementById("tz-pkt").textContent = fmt(pkt);
    document.getElementById("tz-pkt-date").textContent = fmtDate(pkt);
    usRows.forEach(function (r) {
      var d = new Date(now.toLocaleString("en-US", { timeZone: r.zone }));
      r.time.textContent = fmt(d);
      r.date.textContent = fmtDate(d);
    });
  }
  tick();
  setInterval(tick, 1000);

  /* ---- Events ---- */
  input.addEventListener("input", render);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); render(); }
    if (e.key === "Escape") { input.value = ""; render(); }
  });
  searchBtn.addEventListener("click", render);
  clearBtn.addEventListener("click", function () { input.value = ""; render(); input.focus(); });
  refreshBtn.addEventListener("click", loadLiveData);

  loadLiveData();
})();
