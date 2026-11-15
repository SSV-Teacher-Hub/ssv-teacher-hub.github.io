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

  // Button labels: one link -> the default label; an English + a Vietnamese link -> "English" / "Tiếng Việt";
  // otherwise the words the link is attached to.
  var VI = /[ăâđêôơưàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;
  function linkLabels(list, single) {
    if (list.length === 1) return [{ href: list[0].href, label: single }];
    var langs = list.map(function (l) { return VI.test(l.text) ? "Tiếng Việt" : "English"; });
    var distinct = langs.filter(function (x, k) { return langs.indexOf(x) === k; }).length === langs.length;
    return list.map(function (l, k) {
      var words = l.text.length > 30 ? l.text.slice(0, 28).trim() + "…" : l.text;
      return { href: l.href, label: distinct ? langs[k] : words || single };
    });
  }

  var ANN = { per: 3, page: 1, pages: 1 };
  function renderAnnouncements(list) {
    var box = $("[data-announcements]");
    if (!list.length) { box.innerHTML = '<p class="notice">No announcements right now.</p>'; return; }
    box.innerHTML = list.map(function (a, i) {
      var age = a.date ? diff(a.date, TODAY) : 99, isNew = age >= 0 && age <= 6;
      var summary = plain(a.content), long = summary.length > 180 || /\[img\]|\n/.test(a.content);
      var tl = String(a.title || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      var heading = tl[0] || "Announcement";
      var links = a.links || [], contentLinks = a.contentLinks || [], used = [];
      // each title line opens the link attached to its words (one link over the whole cell -> just the heading)
      function lineLink(line) {
        for (var k = 0; k < links.length; k++) {
          var t = links[k].text;
          if (used.indexOf(k) === -1 && (!t || t.indexOf(line) !== -1 || line.indexOf(t) !== -1)) { used.push(k); return links[k].href; }
        }
        return "";
      }
      function linked(text, href) { return href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(text) + "</a>" : esc(text); }
      var headingHtml = linked(heading, lineLink(heading));
      var subtitle = tl.slice(1).map(function (line) { return linked(line, links.length > 1 ? lineLink(line) : ""); }).join(" · ");
      var open = (links[0] || contentLinks[0] || {}).href || a.imageLink;
      var ext = function (href, label) { return '<a class="text-link" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + "</a>"; };
      return '<article class="ann"' + (i >= ANN.per ? " hidden" : "") + ">" +
        '<div class="ann-top"><span>' + esc(a.tag || "Announcement") + (isNew ? ' <span class="ann-new">New</span>' : "") + "</span>" +
          (a.date ? '<time datetime="' + a.date + '">' + (age === 0 ? "Today" : age === 1 ? "Yesterday" : dShort(a.date) + " " + a.date.slice(0, 4)) + "</time>" : "") + "</div>" +
        (a.image ? (open ? '<a class="cover-link" href="' + esc(open) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(heading) + '">' : "") +
          '<img class="cover" src="' + esc(a.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' + (open ? "</a>" : "") : "") +
        '<div class="ann-body"><h3>' + headingHtml + "</h3>" +
          (subtitle ? '<p class="ann-sub">' + subtitle + "</p>" : "") +
          (summary ? '<div class="ann-text clamp" data-full="' + esc(richText(a.content)) + '">' + esc(summary) + "</div>" : "") +
          (long || open ? '<div class="ann-actions">' +
            (long ? '<button class="text-link ann-read" type="button" data-read>Show more</button>' : "") +
            linkLabels(links, "Read post").map(function (l) { return ext(l.href, l.label); }).join("") +
            linkLabels(contentLinks, "Open link").map(function (l) { return ext(l.href, l.label); }).join("") +
            (!links.length && !contentLinks.length && a.imageLink ? ext(a.imageLink, "View full image") : "") + "</div>" : "") +
        "</div></article>";
    }).join("");
    // a Drive picture that isn't shared publicly would show as a broken image: hide it instead
    box.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () { (img.closest(".cover-link") || img).remove(); });
    });
    ANN.page = 1;
    ANN.pages = Math.ceil(list.length / ANN.per);
    drawPager();
  }

  // Page numbers to show: all of them when there are few, otherwise 1 … 4 5 6 … 12
  function pageNumbers(cur, total) {
    if (total <= 7) return Array.from({ length: total }, function (_, i) { return i + 1; });
    var from = Math.max(2, Math.min(cur - 1, total - 4)), to = Math.min(total - 1, Math.max(cur + 1, 5));
    if (from === 3) from = 2;              // never hide a single page behind "…"
    if (to === total - 2) to = total - 1;
    var out = [1];
    if (from > 2) out.push(0);
    for (var n = from; n <= to; n++) out.push(n);
    if (to < total - 1) out.push(0);
    out.push(total);
    return out;
  }
  var CHEV = { prev: "M10 3 5 8l5 5", next: "m6 3 5 5-5 5" };
  function pagerArrow(dir, target, off) {
    return '<button class="pager-btn pager-arrow" type="button" data-ann-dir="' + dir + '" data-ann-page="' + target + '"' +
      ' aria-label="' + (dir === "prev" ? "Previous page" : "Next page") + '"' + (off ? " disabled" : "") + ">" +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + CHEV[dir] + '"/></svg></button>';
  }
  function drawPager() {
    var nav = $("[data-ann-pager]"), p = ANN.page, t = ANN.pages;
    nav.hidden = t <= 1;
    if (t <= 1) return;
    nav.innerHTML = pagerArrow("prev", p - 1, p === 1) +
      pageNumbers(p, t).map(function (n) {
        return n === 0 ? '<span class="pager-gap" aria-hidden="true">…</span>'
          : '<button class="pager-btn" type="button" data-ann-page="' + n + '" aria-label="Page ' + n + '"' + (n === p ? ' aria-current="page"' : "") + ">" + n + "</button>";
      }).join("") +
      pagerArrow("next", p + 1, p === t);
  }
  function goToPage(n, dir) {
    ANN.page = Math.min(Math.max(1, n), ANN.pages);
    var box = $("[data-announcements]");
    box.querySelectorAll(".ann").forEach(function (el, i) { el.hidden = Math.floor(i / ANN.per) + 1 !== ANN.page; });
    drawPager();
    var nav = $("[data-ann-pager]");
    var focus = (dir && nav.querySelector('[data-ann-dir="' + dir + '"]:not([disabled])')) || nav.querySelector("[aria-current]");
    if (focus) focus.focus({ preventScroll: true });
    if (box.getBoundingClientRect().top < 0) $("#announcements").scrollIntoView({ block: "start" });
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
    var pg = e.target.closest("[data-ann-page]");
    if (pg) {
      if (!pg.disabled && !pg.hasAttribute("aria-current")) goToPage(+pg.getAttribute("data-ann-page"), pg.getAttribute("data-ann-dir"));
      return;
    }
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
        text.innerHTML = text.dataset.short; text.classList.add("clamp"); read.textContent = "Show more";
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
    Promise.all([load("announcements"), H.loadCellLinks("announcements")])
      .then(function (x) { renderAnnouncements(readAnnouncements(x[0], x[1])); })
      .catch(function () { fail("announcements", "[data-announcements]", "Couldn’t load announcements right now."); })
  ]).then(function () { H.setSource(failed.length > 0); });

})();
