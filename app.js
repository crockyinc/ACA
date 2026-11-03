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
    if (q.length < 2) return false; // results only appear once 2+ characters are typed
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
      tbody.appendChild(el("p", "empty-msg", "Type a 2-letter state code (e.g. AZ) to see results"));
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

  /* ---- Live clocks ----
   * Every clock is derived from ONE instant (Date.now()) and an explicit IANA
   * zone via Intl.DateTimeFormat.formatToParts().
   * Do NOT re-parse toLocaleString() output: it drops the zone, inherits the
   * device timezone during parsing, and yields NaN in locales with non-Latin
   * digits (ar-SA, fa-IR, ...).
   */
  var PKT_ZONE = { tz: "Asia/Karachi", badge: "PKT" };
  var US_ZONES = [
    ["Pacific", "America/Los_Angeles"],
    ["Mountain", "America/Denver"],
    ["Central", "America/Chicago"],
    ["Eastern", "America/New_York"]
  ];

  function zoneParts(date, tz) {
    var out = {};
    try {
      new Intl.DateTimeFormat("en-US-u-nu-latn", {
        timeZone: tz,
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZoneName: "short"
      }).formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    } catch (e) { /* very old browsers: leave blank, UI shows placeholders */ }
    return out;
  }

  function clockText(date, tz) {
    var p = zoneParts(date, tz);
    if (!p.hour) return "--:--:--";
    return p.hour + ":" + p.minute + ":" + p.second + " " + (p.dayPeriod || "");
  }
  function dateText(date, tz) {
    var p = zoneParts(date, tz);
    if (!p.weekday) return "";
    return p.weekday + ", " + p.month + " " + p.day + ", " + p.year;
  }
  /* Zone label: "PST"/"PDT" in the US (DST-aware), "GMT+5" for Pakistan. */
  function zoneAbbrev(date, tz) {
    return zoneParts(date, tz).timeZoneName || "";
  }

  var usWrap = document.getElementById("tz-us");
  var usRows = US_ZONES.map(function (z) {
    var row = el("div", "tz-row");
    var top = el("div", "tz-row-top");
    top.appendChild(el("span", null, z[0]));
    var badge = el("span", "tz-row-badge", "—");
    top.appendChild(badge);
    row.appendChild(top);
    var time = el("div", "tz-row-time", "--:--:--");
    var date = el("div", "tz-row-date", "");
    row.appendChild(time);
    row.appendChild(date);
    usWrap.appendChild(row);
    return { tz: z[1], time: time, date: date, badge: badge };
  });

  var pktTimeEl = document.getElementById("tz-pkt");
  var pktDateEl = document.getElementById("tz-pkt-date");
  var pktOffsetEl = document.getElementById("tz-pkt-offset");
  var skewEl = document.getElementById("clock-skew");

  function tick() {
    var now = new Date();
    pktTimeEl.textContent = clockText(now, PKT_ZONE.tz);
    pktDateEl.textContent = dateText(now, PKT_ZONE.tz);
    if (pktOffsetEl) pktOffsetEl.textContent = zoneAbbrev(now, PKT_ZONE.tz);
    usRows.forEach(function (r) {
      r.time.textContent = clockText(now, r.tz);
      r.date.textContent = dateText(now, r.tz);
      r.badge.textContent = zoneAbbrev(now, r.tz);
    });
  }
  tick();
  setInterval(tick, 1000);

  /* ---- Clock-drift guard ----
   * All times above come from THIS device's clock, so a machine that is an hour
   * fast shows an hour-fast Pakistan time. Compare against the server's `Date`
   * header (same-origin, so readable) and warn when the device has drifted.
   */
  function skewWarning(seconds) {
    if (!skewEl) return;
    var mins = Math.round(Math.abs(seconds) / 60);
    var dir = seconds > 0 ? "ahead of" : "behind";
    var big = Math.abs(seconds) >= 3600
      ? (Math.abs(seconds) / 3600).toFixed(1) + " hours"
      : mins + " min";
    skewEl.textContent = "⚠ This device's clock is about " + big + " " + dir +
      " the server. Every timezone below is derived from the device clock, so all times may be off by that much. Fix the system clock / time zone.";
    skewEl.classList.remove("hidden");
  }

  function checkClockSkew() {
    if (!window.fetch || !skewEl) return;
    fetch(location.pathname || "/", { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        var header = res.headers.get("Date");
        if (!header) return;
        var server = Date.parse(header);
        if (isNaN(server)) return;
        var skew = Math.round((Date.now() - server) / 1000);
        if (Math.abs(skew) > 90) skewWarning(skew);
      })
      .catch(function () { /* header unreadable or offline: stay quiet */ });
  }
  checkClockSkew();

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
