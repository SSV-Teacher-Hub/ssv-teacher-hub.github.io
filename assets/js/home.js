/* Teacher Hub · home page */
(function () {
  "use strict";
  var H = window.Hub, CFG = H.CFG, TODAY = H.TODAY, MONTHS = H.MONTHS;
  var $ = H.$, esc = H.esc, addDays = H.addDays, diff = H.diff, wd = H.wd, dShort = H.dShort, dLong = H.dLong, range = H.range, rel = H.rel;
  var load = H.load, readCalendar = H.readCalendar, readEvents = H.readEvents, readAnnouncements = H.readAnnouncements;
  var richText = H.richText, plain = H.plain, deptLabel = H.deptLabel, NAMED = H.NAMED;

  /* ---------------- rendering ---------------- */
  function renderGlanceNext(ranges) {
    var box = $("[data-glance-next]");
    var next = ranges.filter(function (r) { return r.end >= TODAY; })[0];
    if (!next) { box.innerHTML = '<span class="glance-big">—</span><span class="glance-text"><small>Next on the school calendar</small><strong>Nothing scheduled</strong></span>'; return; }
    var n = diff(TODAY, next.start);
    box.innerHTML = n <= 0
      ? '<span class="glance-big">Now</span><span class="glance-text"><small>On the school calendar</small><strong>' + esc(next.title) + "</strong><em>" + (next.end !== next.start ? "Until " + wd(next.end) + " " + dShort(next.end) : "Today") + "</em></span>"
      : '<span class="glance-big">' + n + '</span><span class="glance-text"><small>' + (n === 1 ? "Day" : "Days") + " until</small><strong>" + esc(next.title) + "</strong><em>" + range(next.start, next.end) + "</em></span>";
  }
  function renderGlanceWeek(events) {
    var end = addDays(TODAY, 6);
    var n = events.filter(function (e) { return e.end >= TODAY && e.date <= end; }).length;
    $("[data-glance-week]").innerHTML = '<span class="glance-big">' + n + '</span><span class="glance-text"><small>Coming up</small><strong>' +
      (n === 1 ? "Event" : "Events") + " in the next 7 days</strong><em>" + dShort(TODAY) + " – " + dShort(end) + "</em></span>";
  }

  function renderAnnouncements(list) {
    var box = $("[data-announcements]");
    if (!list.length) { box.innerHTML = '<p class="notice">No announcements right now.</p>'; return; }
    box.innerHTML = list.slice(0, 12).map(function (a, i) {
      var age = a.date ? diff(a.date, TODAY) : 99, isNew = age >= 0 && age <= 6;
      var summary = plain(a.content), long = summary.length > 180 || /\[img\]|\n/.test(a.content);
      var tl = String(a.title || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      var heading = tl[0] || "Announcement", subtitle = tl.slice(1).join(" · ");
      var open = a.link || a.imageLink;
      return '<article class="ann"' + (i >= 3 ? " hidden" : "") + ">" +
        '<div class="ann-top"><span>' + esc(a.tag || "Announcement") + (isNew ? ' <span class="ann-new">New</span>' : "") + "</span>" +
          (a.date ? '<time datetime="' + a.date + '">' + (age === 0 ? "Today" : age === 1 ? "Yesterday" : dShort(a.date) + " " + a.date.slice(0, 4)) + "</time>" : "") + "</div>" +
        (a.image ? (open ? '<a class="cover-link" href="' + esc(open) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(heading) + '">' : "") +
          '<img class="cover" src="' + esc(a.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' + (open ? "</a>" : "") : "") +
        '<div class="ann-body"><h3>' + esc(heading) + "</h3>" + (subtitle ? '<p class="ann-sub">' + esc(subtitle) + "</p>" : "") +
          (summary ? '<div class="ann-text clamp" data-full="' + esc(richText(a.content)) + '">' + esc(summary) + "</div>" : "") +
          (long || open ? '<div class="ann-actions">' +
            (long ? '<button class="button" type="button" data-read>Read more</button>' : "") +
            (a.link ? '<a class="text-link" href="' + esc(a.link) + '" target="_blank" rel="noopener">Open link</a>'
              : a.imageLink ? '<a class="text-link" href="' + esc(a.imageLink) + '" target="_blank" rel="noopener">View full image</a>' : "") + "</div>" : "") +
        "</div></article>";
    }).join("");
    // a Drive picture that isn't shared publicly would show as a broken image: hide it instead
    box.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () { (img.closest(".cover-link") || img).remove(); });
    });
    var more = $("[data-ann-more]");
    if (list.length > 3) {
      more.hidden = false;
      more.querySelector("button").onclick = function () {
        box.querySelectorAll(".ann[hidden]").forEach(function (el) { el.hidden = false; });
        more.hidden = true;
      };
    }
  }

  function renderKeyDates(ranges) {
    var box = $("[data-keydates]");
    var up = ranges.filter(function (r) { return r.end >= TODAY; }).slice(0, 4);
    if (!up.length) { box.outerHTML = '<p class="notice">No upcoming dates on the school calendar.</p>'; return; }
    box.innerHTML = up.map(function (r) {
      var n = diff(TODAY, r.start);
      return '<div class="keydate" style="--kd:var(--c-' + (NAMED[String(r.color).replace(/\d+$/, "")] || "amber") + ')"><span class="swatch"></span>' +
        '<span class="when-rel">' + (n <= 0 ? "Happening now" : rel(n)) + "</span>" +
        '<span class="name">' + esc(r.title) + '</span><span class="dates">' + range(r.start, r.end) + "</span></div>";
    }).join("");
  }

  var EV = { days: [], tab: "soon", expanded: false };
  function renderEvents(events) {
    var horizon = addDays(TODAY, 183);
    var map = {};
    events.forEach(function (e) {
      if (e.end < TODAY || e.date > horizon) return;
      var key = e.date < TODAY ? TODAY : e.date;
      (map[key] = map[key] || []).push(e);
    });
    EV.days = Object.keys(map).sort().map(function (d) { return { date: d, items: map[d] }; });
    var months = [];
    EV.days.forEach(function (d) { var m = d.date.slice(0, 7); if (months.indexOf(m) === -1) months.push(m); });
    var tabs = [{ id: "soon", label: "Next 30 days" }].concat(months.slice(0, 4).map(function (m) { return { id: m, label: MONTHS[+m.slice(5) - 1] }; }));
    $("[data-ev-tabs]").innerHTML = tabs.map(function (t) {
      return '<button class="tab" type="button" role="tab" data-tab="' + t.id + '" aria-selected="' + (t.id === EV.tab) + '">' + esc(t.label) + "</button>";
    }).join("");
    drawEvents();
  }
  function drawEvents() {
    var box = $("[data-events]"), more = $("[data-ev-more]");
    var days = EV.tab === "soon"
      ? EV.days.filter(function (d) { return d.date <= addDays(TODAY, 30); })
      : EV.days.filter(function (d) { return d.date.slice(0, 7) === EV.tab; });
    if (!days.length) { box.innerHTML = '<p class="notice">No events in this period.</p>'; more.hidden = true; return; }
    var LIMIT = 6, cut = !EV.expanded && days.length > LIMIT;
    box.innerHTML = (cut ? days.slice(0, LIMIT) : days).map(function (d) {
      var n = diff(TODAY, d.date);
      return '<article class="ev-day' + (n === 0 ? " is-today" : "") + '">' +
        '<div class="ev-day-head"><p class="eyebrow">' + wd(d.date, true) + "</p><h3>" + +d.date.slice(8) + " " + MONTHS[+d.date.slice(5, 7) - 1] + "</h3>" +
          (rel(n) ? '<span class="rel">' + rel(n) + "</span>" : "") + "</div>" +
        '<div class="ev-items">' + d.items.map(function (e) {
          var sub = e.end !== e.date ? (e.date < TODAY ? "Until " + wd(e.end) + " " + dShort(e.end) : range(e.date, e.end) + " · " + (diff(e.date, e.end) + 1) + " days") : "";
          var row = '<span class="ev-title">' + esc(e.title) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + deptLabel(e.category);
          return e.notes
            ? '<details class="ev-item"><summary>' + row + '<span class="chev" aria-hidden="true"></span></summary><p class="ev-notes">' + esc(e.notes) + "</p></details>"
            : '<div class="ev-item"><div class="ev-row">' + row + '<span class="chev-spacer"></span></div></div>';
        }).join("") + "</div></article>";
    }).join("");
    more.hidden = !cut;
    more.querySelector("button").onclick = function () { EV.expanded = true; drawEvents(); };
  }

  /* ---------------- interactions ---------------- */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-tab]");
    if (tab) {
      EV.tab = tab.getAttribute("data-tab"); EV.expanded = false;
      document.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b === tab)); });
      drawEvents();
      return;
    }
    var read = e.target.closest("[data-read]");
    if (read) {
      var text = read.closest(".ann").querySelector(".ann-text");
      if (text.classList.contains("clamp")) {
        text.dataset.short = text.innerHTML; text.innerHTML = text.getAttribute("data-full"); text.classList.remove("clamp"); read.textContent = "Show less";
      } else {
        text.innerHTML = text.dataset.short; text.classList.add("clamp"); read.textContent = "Read more";
      }
    }
  });

  /* ---------------- go ---------------- */
  $("[data-today]").textContent = dLong(TODAY);

  var failed = [];
  function fail(key, sel, msg) { failed.push(key); var el = $(sel); if (el) el.innerHTML = '<p class="notice">' + msg + "</p>"; }

  Promise.all([
    load("calendar").then(function (t) { var r = readCalendar(t); renderKeyDates(r); renderGlanceNext(r); })
      .catch(function () { fail("calendar", "[data-keydates]", "Couldn’t load the school calendar right now."); $("[data-glance-next]").hidden = true; }),
    load("events").then(function (t) { var ev = readEvents(t); renderEvents(ev); renderGlanceWeek(ev); })
      .catch(function () { fail("events", "[data-events]", "Couldn’t load upcoming events right now."); $("[data-glance-week]").hidden = true; }),
    load("announcements").then(function (t) { renderAnnouncements(readAnnouncements(t)); })
      .catch(function () { fail("announcements", "[data-announcements]", "Couldn’t load announcements right now."); })
  ]).then(function () { H.setSource(failed.length > 0); });

})();
