/* Teacher Hub · School Calendar (calendar.html) and School Events (events.html)
 * Month grid like the old Teacher Hub: pick a year and a month on the right.
 * calendar.html -> tab "Calendar" (one row per day: date | title | color | full)
 * events.html   -> tab "Event"    (Month | Start Date | End Date | Event | Details)
 */
(function () {
  "use strict";
  var H = window.Hub, $ = H.$, esc = H.esc, MONTHS = H.MONTHS, TODAY = H.TODAY;
  var PAGE = document.body.getAttribute("data-page"); // "calendar" | "events"
  var START = +(H.CFG.academicStartMonth || 7);
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  var state = { ym: fromHash() || TODAY.slice(0, 7) };
  var calByDate = {}, ranges = [], evByDate = {}, events = [];
  var ready = false;

  function fromHash() { var m = location.hash.match(/^#(\d{4})-(\d{2})$/); return m && +m[2] >= 1 && +m[2] <= 12 ? m[1] + "-" + m[2] : null; }
  function ymAdd(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + H.pad(m + 1);
  }
  function acYear(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m >= START ? y : y - 1; }
  function lastDay(ym) { return H.addDays(ymAdd(ym, 1) + "-01", -1); }
  function weeks(ym) {
    var first = ym + "-01", offset = (H.toDate(first).getUTCDay() + 6) % 7;
    var start = H.addDays(first, -offset), end = lastDay(ym), out = [];
    for (var d = start; d <= end || out.length % 7; d = H.addDays(d, 1)) out.push(d);
    return out;
  }

  /* ---------------- side panel: years + months ---------------- */
  function renderSide() {
    var y = +state.ym.slice(0, 4), m = +state.ym.slice(5, 7), ay = acYear(state.ym);
    var years = [ay, ay + 1];
    $("[data-years]").innerHTML = years.map(function (yr) {
      return '<button type="button" data-year-btn="' + yr + '" aria-pressed="' + (yr === y) + '">' + yr + "</button>";
    }).join("");
    $("[data-ay-pill]").textContent = "Academic year " + ay + "/" + (ay + 1);
    var ayLabel = $("[data-ay]"); if (ayLabel) ayLabel.textContent = ay + "/" + (ay + 1);
    var todayYm = TODAY.slice(0, 7);
    $("[data-months]").innerHTML = MONTHS.map(function (name, i) {
      var ym = y + "-" + H.pad(i + 1);
      return '<button type="button" data-month-btn="' + ym + '" aria-pressed="' + (i + 1 === m) + '"' + (ym === todayYm ? ' class="is-now"' : "") + ">" + name + "</button>";
    }).join("");
    $("[data-cal-title]").textContent = MONTHS[m - 1] + " " + y;
  }

  /* ---------------- grid ---------------- */
  function renderGrid() {
    var days = weeks(state.ym), head = WEEKDAYS.map(function (d, i) {
      return '<div class="cal-dow' + (i === 6 ? " is-sun" : "") + '" role="columnheader">' + d + "</div>";
    }).join("");
    var cells = days.map(function (d) {
      var out = d.slice(0, 7) !== state.ym, dow = (H.toDate(d).getUTCDay() + 6) % 7;
      var c = calByDate[d], cls = "cal-cell", style = "", inner = '<span class="num">' + +d.slice(8) + "</span>";
      if (out) cls += " is-out";
      if (dow === 6) cls += " is-sun";
      if (d === TODAY) cls += " is-today";
      if (c) {
        var col = H.calColor(c.color);
        cls += " " + col.cls + (c.full && PAGE === "calendar" ? " is-full" : " is-part");
        style = col.style;
        if (PAGE === "calendar") inner += '<span class="label">' + esc(c.title) + "</span>";
      }
      if (PAGE === "events") {
        // events longer than a week only get a chip on their first day and on Mondays (less clutter)
        var list = (evByDate[d] || []).filter(function (e) {
          return H.diff(e.date, e.end) < 7 || d === e.date || dow === 0 || d === state.ym + "-01";
        });
        if (c) inner += '<span class="holiday">' + esc(c.title) + "</span>";
        inner += list.slice(0, 3).map(function (e) {
          return '<button type="button" class="chip" data-goto="' + d + '" style="--dc:var(--c-' + H.deptColor(e.category) + ')" title="' + esc(e.title) + '">' + esc(e.title) + "</button>";
        }).join("");
        if (list.length > 3) inner += '<button type="button" class="chip-more" data-goto="' + d + '">+' + (list.length - 3) + " more</button>";
        if (list.length) inner += '<span class="dots" aria-hidden="true">' + list.slice(0, 4).map(function (e) { return '<i style="--dc:var(--c-' + H.deptColor(e.category) + ')"></i>'; }).join("") + "</span>";
        if (list.length && !out) { cls += " has-events"; }
      }
      var label = H.dLong(d) + (c ? ", " + c.title : "") + (PAGE === "events" && evByDate[d] ? ", " + evByDate[d].length + " event" + (evByDate[d].length > 1 ? "s" : "") : "");
      var clickable = PAGE === "events" && evByDate[d] && !out; // whole cell opens the day (handy on phones)
      return '<div class="' + cls + '"' + (style ? ' style="' + style + '"' : "") + (clickable ? ' data-goto="' + d + '"' : "") +
        ' role="gridcell" aria-label="' + esc(label) + '">' + inner + "</div>";
    }).join("");
    $("[data-cal-grid]").innerHTML = head + cells;
  }

  /* ---------------- list under / beside the grid ---------------- */
  function renderList() {
    var first = state.ym + "-01", last = lastDay(state.ym), box = $("[data-month-list]");
    if (PAGE === "calendar") {
      var inMonth = ranges.filter(function (r) { return r.end >= first && r.start <= last; });
      box.innerHTML = inMonth.length ? inMonth.map(function (r) {
        var col = H.calColor(r.color);
        return '<li class="' + col.cls + '"' + (col.style ? ' style="' + col.style + '"' : "") + '><span class="sw"></span><span><strong>' + esc(r.title) + "</strong><small>" + H.range(r.start, r.end) + "</small></span></li>";
      }).join("") : '<li class="empty">Nothing on the school calendar this month.</li>';
      return;
    }
    // events page: day cards
    var byDay = {};
    events.forEach(function (e) {
      if (e.end < first || e.date > last) return;
      var key = e.date < first ? first : e.date;
      (byDay[key] = byDay[key] || []).push(e);
    });
    var keys = Object.keys(byDay).sort();
    $("[data-list-title]").textContent = "Events in " + MONTHS[+state.ym.slice(5, 7) - 1] + " " + state.ym.slice(0, 4);
    box.innerHTML = keys.length ? keys.map(function (d) {
      var n = H.diff(TODAY, d);
      return '<article class="ev-day' + (d === TODAY ? " is-today" : "") + '" id="d-' + d + '">' +
        '<div class="ev-day-head"><p class="eyebrow">' + H.wd(d, true) + "</p><h3>" + +d.slice(8) + " " + MONTHS[+d.slice(5, 7) - 1] + "</h3>" +
          (H.rel(n) ? '<span class="rel">' + H.rel(n) + "</span>" : "") + "</div>" +
        '<div class="ev-items">' + byDay[d].map(function (e) {
          var sub = e.end !== e.date ? (e.date < first ? "Continues until " + H.wd(e.end) + " " + H.dShort(e.end) : H.range(e.date, e.end) + " · " + (H.diff(e.date, e.end) + 1) + " days") : "";
          var row = '<span class="ev-title">' + esc(e.title) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + H.deptLabel(e.category);
          return e.notes
            ? '<details class="ev-item"><summary>' + row + '<span class="chev" aria-hidden="true"></span></summary><p class="ev-notes">' + esc(e.notes) + "</p></details>"
            : '<div class="ev-item"><div class="ev-row">' + row + '<span class="chev-spacer"></span></div></div>';
        }).join("") + "</div></article>";
    }).join("") : '<p class="notice">No events this month.</p>';
  }

  function render() {
    renderSide();
    if (!ready) return;
    renderGrid();
    renderList();
  }
  function go(ym) {
    state.ym = ym;
    try { history.replaceState(null, "", "#" + ym); } catch (e) { location.hash = ym; }
    render();
  }

  /* ---------------- interactions ---------------- */
  document.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-cal-prev]"))) return go(ymAdd(state.ym, -1));
    if ((t = e.target.closest("[data-cal-next]"))) return go(ymAdd(state.ym, 1));
    if ((t = e.target.closest("[data-cal-today]"))) return go(TODAY.slice(0, 7));
    if ((t = e.target.closest("[data-month-btn]"))) return go(t.getAttribute("data-month-btn"));
    if ((t = e.target.closest("[data-year-btn]"))) return go(t.getAttribute("data-year-btn") + state.ym.slice(4));
    if ((t = e.target.closest("[data-goto]"))) {
      var card = document.getElementById("d-" + t.getAttribute("data-goto"));
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
        card.classList.add("flash");
        setTimeout(function () { card.classList.remove("flash"); }, 1400);
      }
    }
  });
  window.addEventListener("hashchange", function () { var ym = fromHash(); if (ym && ym !== state.ym) { state.ym = ym; render(); } });
  document.addEventListener("keydown", function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") go(ymAdd(state.ym, -1));
    if (e.key === "ArrowRight") go(ymAdd(state.ym, 1));
  });

  /* ---------------- data ---------------- */
  render();
  var jobs = [
    H.load("calendar").then(function (t) {
      H.readCalendarDays(t).forEach(function (d) { if (!calByDate[d.date]) calByDate[d.date] = d; });
      ranges = H.readCalendar(t);
    })
  ];
  if (PAGE === "events") jobs.push(H.load("events").then(function (t) {
    events = H.readEvents(t);
    events.forEach(function (e) {
      var n = Math.min(H.diff(e.date, e.end), 120);
      for (var i = 0; i <= n; i++) { var d = H.addDays(e.date, i); (evByDate[d] = evByDate[d] || []).push(e); }
    });
  }));
  function renderLegend() {
    var box = $("[data-legend]");
    if (!box) return;
    var seen = {}, items = [];
    events.forEach(function (e) {
      var k = H.deptKey(e.category);
      if (!k || seen[k]) return;
      seen[k] = 1;
      var c = (H.CFG.categories || {})[k] || {};
      items.push('<li><i style="--dc:var(--c-' + H.deptColor(e.category) + ')"></i>' + esc(c.label || k) + "</li>");
    });
    if (items.length) box.insertAdjacentHTML("beforeend", "<ul>" + items.join("") + "</ul>");
  }
  var failed = false;
  Promise.all(jobs.map(function (j) { return j.catch(function () { failed = true; }); })).then(function () {
    ready = true;
    render();
    renderLegend();
    if (failed) {
      var msg = '<p class="notice">Couldn’t load ' + (PAGE === "events" ? "the events" : "the school calendar") + " right now. Please try again later.</p>";
      if (PAGE === "events" && !events.length) $("[data-month-list]").innerHTML = msg;
      if (PAGE === "calendar" && !ranges.length) $("[data-cal-grid]").insertAdjacentHTML("afterend", msg);
    }
    H.setSource(failed);
  });
})();
