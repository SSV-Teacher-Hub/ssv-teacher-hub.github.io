/* Teacher Hub · Sedbergh Vietnam
 * Reads the school Google Sheet directly (published CSV) — no Apps Script.
 * Tabs: Calendar (date | title | color | full), Event (Month | Start Date | End Date | Event | Details),
 *       Announcements (Date | Title | Content | Tag | Public | Image [| Link]).
 */
(function () {
  "use strict";
  var CFG = window.HUB_CONFIG || {};
  var TZ = CFG.timeZone || "Asia/Ho_Chi_Minh";
  var DEMO = /[?&]demo\b/.test(location.search) || CFG.demo === true;
  var TABS = Object.assign({ calendar: "Calendar", events: "Event", announcements: "Announcements" }, CFG.tabs || {});

  /* ---------------- helpers ---------------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function pad(n) { n = +n; return (n < 10 ? "0" : "") + n; }
  function isIso(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function toDate(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function addDays(iso, n) { var d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function diff(a, b) { return Math.round((toDate(b) - toDate(a)) / 864e5); }
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function mon(iso) { return MONTHS[+iso.slice(5, 7) - 1].slice(0, 3); }
  function wd(iso, long) { var d = DAYS[toDate(iso).getUTCDay()]; return long ? d : d.slice(0, 3); }
  function dShort(iso) { return +iso.slice(8) + " " + mon(iso); }
  function dLong(iso) { return wd(iso, true) + ", " + +iso.slice(8) + " " + MONTHS[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4); }
  function range(a, b) {
    if (!b || a === b) return wd(a) + " " + dShort(a);
    if (a.slice(0, 7) === b.slice(0, 7)) return +a.slice(8) + "–" + dShort(b);
    return dShort(a) + " – " + dShort(b);
  }
  function rel(n) { return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 1 ? "In " + n + " days" : ""; }
  function today() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  }
  function truthy(v) { return /^(true|yes|y|x|1|✓|✔|có)$/i.test(String(v || "").trim()); }

  /* ---------------- CSV ---------------- */
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i = 0, c;
    text = String(text || "").replace(/^﻿/, "");
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
        f += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ",") { row.push(f); f = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; i++; continue; }
      f += c; i++;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  // -> { rows: [...], col: function(keywords) -> index }
  function sheet(text) {
    var all = parseCSV(text).filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
    var head = (all[0] || []).map(function (h) { return h.trim().toLowerCase(); });
    return {
      rows: all.slice(1),
      col: function (keys) {
        for (var k = 0; k < keys.length; k++) { var i = head.indexOf(keys[k]); if (i !== -1) return i; }
        for (var k2 = 0; k2 < keys.length; k2++) for (var j = 0; j < head.length; j++) if (head[j] && head[j].indexOf(keys[k2]) !== -1) return j;
        return -1;
      }
    };
  }
  function cell(row, i) { return i === -1 || row[i] == null ? "" : String(row[i]).trim(); }

  /* ---------------- dates from the sheet ----------------
     Cells can be "2026-11-16", "16/11/2026", "11/16/2026" (mixed!), or "16 November 2026".
     For the Event tab the Month column tells us which reading is right. */
  function monthHint(s) {
    s = String(s || "").toLowerCase();
    for (var i = 0; i < 12; i++) {
      if (s.indexOf(MONTHS[i].toLowerCase()) !== -1 || new RegExp("\\b" + MONTHS[i].slice(0, 3).toLowerCase() + "\\b").test(s)) {
        var y = s.match(/(20\d\d)/);
        return { m: i + 1, y: y ? +y[1] : null };
      }
    }
    return null;
  }
  function candidates(s) {
    var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (!m) return null;
    var a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
    var out = [];
    function add(d, mo) { if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) { var iso = y + "-" + pad(mo) + "-" + pad(d); if (out.indexOf(iso) === -1) out.push(iso); } }
    add(a, b); add(b, a); // DD/MM first (Vietnam), then MM/DD
    return out;
  }
  function parseDate(raw, hint, startIso) {
    var s = String(raw || "").trim();
    if (!s) return null;
    var iso = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (iso) return iso[1] + "-" + pad(iso[2]) + "-" + pad(iso[3]);
    var c = candidates(s);
    if (c && c.length) {
      if (c.length === 1) return c[0];
      if (startIso) { // end date: earliest reading on/after the start
        var after = c.filter(function (x) { return x >= startIso; }).sort();
        return after.length ? after[0] : c.sort()[c.length - 1];
      }
      if (hint) {
        for (var i = 0; i < c.length; i++) if (+c[i].slice(5, 7) === hint.m && (!hint.y || +c[i].slice(0, 4) === hint.y)) return c[i];
        for (var j = 0; j < c.length; j++) if (+c[j].slice(5, 7) === hint.m) return c[j];
      }
      return c[0];
    }
    var t = s.match(/^(?:[A-Za-z]+,?\s+)?(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/) || null;
    if (t) { var h = monthHint(t[2]); if (h) return t[3] + "-" + pad(h.m) + "-" + pad(t[1]); }
    t = s.match(/^(?:[A-Za-z]+,?\s+)?([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (t) { var h2 = monthHint(t[1]); if (h2) return t[3] + "-" + pad(h2.m) + "-" + pad(t[2]); }
    return null;
  }

  /* ---------------- text from the sheet -> safe HTML ---------------- */
  function imgUrl(u) {
    u = String(u || "").trim();
    if (!/^https:\/\//i.test(u)) return "";
    var m = /(drive|docs)\.google\.com/i.test(u) && (u.match(/\/d\/([\w-]+)/) || u.match(/[?&]id=([\w-]+)/));
    return m ? "https://lh3.googleusercontent.com/d/" + m[1] : u;
  }
  function richText(s) {
    var out = esc(s);
    // [img]link[/img] -> picture
    out = out.replace(/\[img\]\s*(https:\/\/[^\s\[]+)\s*\[\/img\]/gi, function (_, u) {
      return '<img src="' + esc(imgUrl(u.replace(/&amp;/g, "&"))) + '" alt="" loading="lazy" referrerpolicy="no-referrer">';
    });
    // bare links -> clickable (pictures for image links)
    out = out.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, function (_, pre, u) {
      var clean = u.replace(/[.,;:!?)\]]+$/, ""), tail = u.slice(clean.length);
      if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(clean)) return pre + '<img src="' + clean + '" alt="" loading="lazy" referrerpolicy="no-referrer">' + tail;
      return pre + '<a href="' + clean + '" target="_blank" rel="noopener">' + clean + "</a>" + tail;
    });
    return out.replace(/\n/g, "<br>");
  }
  function plain(s) { return String(s || "").replace(/\[img\][\s\S]*?\[\/img\]/gi, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim(); }

  /* ---------------- colours ---------------- */
  var NAMED = { red: "red", orange: "orange", yellow: "amber", amber: "amber", gold: "amber", green: "green", teal: "teal", blue: "blue", purple: "violet", violet: "violet", pink: "rose", rose: "rose", gray: "slate", grey: "slate" };
  var HUES = ["blue", "violet", "teal", "rose", "amber", "green", "orange", "slate"];
  function hueOf(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return HUES[h % HUES.length]; }
  function deptKey(s) { return String(s || "").split(/\s+[+\-–&]\s+|\s*\/\s*|\s*,\s*/)[0].trim().toUpperCase(); }
  function deptLabel(s) {
    var k = deptKey(s);
    if (!k) return "";
    var c = (CFG.categories || {})[k] || {};
    var color = c.color || hueOf(k);
    return '<span class="dept" style="--dc:var(--c-' + esc(color) + ')">' + esc(c.label || k) + "</span>";
  }

  /* ---------------- loading ---------------- */
  var FILE = location.protocol === "file:";
  var demoUsed = false;
  function demoText(key) {
    demoUsed = true;
    if (window.HUB_DEMO_CSV) return Promise.resolve(window.HUB_DEMO_CSV[key]);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "data/demo/demo.js";
      s.onload = function () { window.HUB_DEMO_CSV ? resolve(window.HUB_DEMO_CSV[key]) : reject(new Error("no demo data")); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function urlFor(key) {
    var direct = (CFG.csv || {})[key];
    if (direct) return direct;
    var gid = (CFG.gids || {})[key];
    if (gid != null && String(gid) !== "") {
      return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.sheetId || "") + "/export?format=csv&gid=" + encodeURIComponent(gid);
    }
    return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.sheetId || "") +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(TABS[key]);
  }
  var offline = false;
  function load(key) {
    var store = "ssvhub:csv:" + key;
    if (DEMO) return demoText(key);
    return fetch(urlFor(key), { credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (t) {
        if (/^\s*</.test(t)) throw new Error("Not CSV — is the sheet published?");
        try { localStorage.setItem(store, t); } catch (e) {}
        return t;
      })
      .catch(function (err) {
        var saved = null;
        try { saved = localStorage.getItem(store); } catch (e) {}
        if (saved) { offline = true; return saved; }
        if (FILE) return demoText(key); // opened by double-click: show the sample data instead of errors
        throw err;
      });
  }

  /* ---------------- shaping ---------------- */
  function readCalendar(text) {
    var t = sheet(text);
    var iDate = t.col(["date", "ngày", "ngay", "day"]), iTitle = t.col(["title", "event", "tên", "name"]),
        iColor = t.col(["color", "colour", "màu", "mau"]);
    var days = [];
    t.rows.forEach(function (r) {
      var d = parseDate(cell(r, iDate)), title = cell(r, iTitle).split("\n")[0].trim();
      if (d && title) days.push({ date: d, title: title, color: cell(r, iColor).toLowerCase() });
    });
    days.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var ranges = [];
    days.forEach(function (d) {
      var last = ranges[ranges.length - 1];
      if (last && last.title === d.title && diff(last.end, d.date) === 1) last.end = d.date;
      else ranges.push({ start: d.date, end: d.date, title: d.title, color: d.color });
    });
    return ranges;
  }
  function readEvents(text) {
    var t = sheet(text);
    var iMonth = t.col(["month", "tháng", "thang"]), iStart = t.col(["start date", "start", "from", "ngày bắt đầu"]),
        iEnd = t.col(["end date", "end", "to", "ngày kết thúc"]), iTitle = t.col(["event", "title", "activity", "tên sự kiện"]),
        iCat = t.col(["details", "detail", "category", "department", "type"]);
    if (iStart === -1) iStart = t.col(["date", "ngày"]);
    var out = [], lastHint = null;
    t.rows.forEach(function (r) {
      var hint = monthHint(cell(r, iMonth)) || lastHint;
      if (hint) lastHint = hint;
      var start = parseDate(cell(r, iStart), hint);
      var lines = cell(r, iTitle).split("\n");
      var title = lines[0].replace(/\s+/g, " ").trim();
      if (!start || !title) return;
      var end = parseDate(cell(r, iEnd), hint, start);
      if (!end || end < start) end = start;
      out.push({
        date: start, end: end, title: title, category: cell(r, iCat),
        notes: lines.slice(1).map(function (s) { return s.replace(/[ \t]+/g, " ").trim(); }).filter(Boolean).join("\n")
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function readAnnouncements(text) {
    var t = sheet(text);
    var iDate = t.col(["date", "ngày"]), iTitle = t.col(["title", "tiêu đề"]), iContent = t.col(["content", "nội dung", "body"]),
        iTag = t.col(["tag", "category"]), iPublic = t.col(["public", "show", "hiện"]), iImage = t.col(["image", "ảnh", "picture"]),
        iLink = t.col(["link", "url"]);
    var out = [];
    t.rows.forEach(function (r) {
      var title = cell(r, iTitle), content = cell(r, iContent);
      if (!title && !content) return;
      if (iPublic !== -1 && !truthy(cell(r, iPublic))) return;
      var link = cell(r, iLink);
      if (!link && /^https?:\/\/\S+$/.test(title)) { link = title; }
      out.push({
        date: parseDate(cell(r, iDate)) || "", title: title, content: content, tag: cell(r, iTag),
        image: imgUrl(cell(r, iImage)), imageLink: /^https?:\/\//i.test(cell(r, iImage)) ? cell(r, iImage) : "",
        link: /^https?:\/\//i.test(link) ? link : ""
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  /* ---------------- rendering ---------------- */
  var TODAY = today();

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
  var toggle = $(".menu-toggle"), nav = $("#site-nav");
  toggle.addEventListener("click", function () {
    var open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  /* ---------------- go ---------------- */
  $("[data-today]").textContent = dLong(TODAY);
  $("[data-year]").textContent = TODAY.slice(0, 4);

  var failed = [];
  function fail(key, sel, msg) { failed.push(key); var el = $(sel); if (el) el.innerHTML = '<p class="notice">' + msg + "</p>"; }

  Promise.all([
    load("calendar").then(function (t) { var r = readCalendar(t); renderKeyDates(r); renderGlanceNext(r); })
      .catch(function () { fail("calendar", "[data-keydates]", "Couldn’t load the school calendar right now."); $("[data-glance-next]").hidden = true; }),
    load("events").then(function (t) { var ev = readEvents(t); renderEvents(ev); renderGlanceWeek(ev); })
      .catch(function () { fail("events", "[data-events]", "Couldn’t load upcoming events right now."); $("[data-glance-week]").hidden = true; }),
    load("announcements").then(function (t) { renderAnnouncements(readAnnouncements(t)); })
      .catch(function () { fail("announcements", "[data-announcements]", "Couldn’t load announcements right now."); })
  ]).then(function () {
    $("[data-source]").textContent = demoUsed ? "Sample data (demo mode)"
      : failed.length ? "Some content couldn’t be loaded"
      : offline ? "Offline — showing the last saved copy"
      : "Live from the school calendar sheet";
  });

  // test hook (used by the local checks only)
  window.__hub = { parseCSV: parseCSV, parseDate: parseDate, readEvents: readEvents, readCalendar: readCalendar, readAnnouncements: readAnnouncements };
})();
