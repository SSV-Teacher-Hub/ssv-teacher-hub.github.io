/* SSV Teacher Hub — fills the landing page with data from the Google Sheet */
(function () {
  "use strict";
  var CFG = window.HUB_CONFIG || {};
  var TZ = CFG.timeZone || "Asia/Ho_Chi_Minh";
  var CACHE_KEY = "ssvhub:data";

  /* ---------- small helpers ---------- */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isIso(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function toDate(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function addDays(iso, n) { var d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function diff(a, b) { return Math.round((toDate(b) - toDate(a)) / 864e5); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var WDL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function wd(iso) { return WD[toDate(iso).getUTCDay()]; }
  function short(iso) { return +iso.slice(8) + " " + MON[+iso.slice(5, 7) - 1]; }
  function longDate(iso) { return WDL[toDate(iso).getUTCDay()] + ", " + +iso.slice(8) + " " + MONTH[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4); }
  function range(a, b) {
    if (!b || a === b) return wd(a) + " " + short(a);
    if (a.slice(0, 7) === b.slice(0, 7)) return +a.slice(8) + "–" + short(b);
    return short(a) + " – " + short(b);
  }
  function todayIso() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  }
  function inDays(n) { return n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n + " days"; }

  var HUES = ["blue", "violet", "teal", "rose", "amber", "green", "orange", "slate"];
  function hueFor(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return HUES[h % HUES.length]; }
  var NAMED = { red: "red", orange: "orange", yellow: "amber", amber: "amber", green: "green", teal: "teal", blue: "blue", purple: "violet", violet: "violet", pink: "rose", rose: "rose", gray: "slate", grey: "slate" };
  function colorClass(c) { return "c-" + (NAMED[String(c || "").toLowerCase()] || "amber"); }

  // Department from the "Details" column: "SDO + Creative" -> "SDO"
  function dept(s) { return String(s || "").split(/\s+[+\-–&]\s+|\s*\/\s*|\s*,\s*/)[0].trim().toUpperCase(); }
  function deptTag(s) {
    var k = dept(s);
    if (!k) return "";
    var c = (CFG.categories || {})[k] || {};
    var label = c.label || k.split(/\s+/).map(function (w) { return w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase(); }).join(" ");
    return '<span class="tag c-' + (c.color || hueFor(k)) + '">' + esc(label) + "</span>";
  }

  // Keep only safe formatting from the sheet's rich text (bold, italic, colour, links, images).
  var OK = { A: 1, SPAN: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, P: 1, DIV: 1, UL: 1, OL: 1, LI: 1, IMG: 1 };
  function cleanHtml(html) {
    var t = document.createElement("template");
    t.innerHTML = String(html || "");
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (el) {
        if (el.nodeType === 3) return;
        if (el.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|SVG)$/i.test(el.tagName)) { el.remove(); return; }
        if (!OK[el.tagName]) { walk(el); el.replaceWith.apply(el, Array.prototype.slice.call(el.childNodes)); return; }
        var href = el.getAttribute("href"), src = el.getAttribute("src"), style = el.getAttribute("style") || "";
        Array.prototype.slice.call(el.attributes).forEach(function (a) { el.removeAttribute(a.name); });
        var css = [];
        style.split(";").forEach(function (d) {
          var m = d.split(":"); if (m.length < 2) return;
          var k = m[0].trim().toLowerCase(), v = m.slice(1).join(":").trim().toLowerCase();
          if (k === "font-weight" && /^(700|bold)$/.test(v)) css.push("font-weight:700");
          else if (k === "font-style" && v === "italic") css.push("font-style:italic");
          else if (k === "text-decoration" && /^(underline|line-through)$/.test(v)) css.push("text-decoration:" + v);
          else if (k === "color" && /^#[0-9a-f]{3,6}$/.test(v)) css.push("--rt-color:" + v);
        });
        if (css.length) el.setAttribute("style", css.join(";"));
        if (el.tagName === "A") {
          if (/^(https?:|mailto:|tel:)/i.test(href || "")) el.setAttribute("href", href);
          el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener");
        }
        if (el.tagName === "IMG") {
          if (!/^https:\/\//i.test(src || "")) { el.remove(); return; }
          el.setAttribute("src", src); el.setAttribute("alt", ""); el.setAttribute("loading", "lazy");
          el.setAttribute("referrerpolicy", "no-referrer"); el.className = "content-img";
        }
        walk(el);
      });
    })(t.content);
    return t.innerHTML;
  }
  function plain(s) { return String(s || "").replace(/\[img\][\s\S]*?\[\/img\]/gi, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim(); }
  function imgUrl(u) {
    u = String(u || "").trim();
    if (!/^https:\/\//i.test(u)) return "";
    var m = /(drive|docs)\.google\.com/i.test(u) && (u.match(/\/d\/([\w-]+)/) || u.match(/[?&]id=([\w-]+)/));
    return m ? "https://lh3.googleusercontent.com/d/" + m[1] : u;
  }

  /* ---------- data ---------- */
  function load() {
    var url = String(CFG.apiUrl || "").trim();
    if (!url) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "data/demo.js";
        s.onload = function () { resolve({ data: window.HUB_DEMO, demo: true }); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    url += (url.indexOf("?") === -1 ? "?" : "&") + "format=json";
    return fetch(url, { redirect: "follow", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error("Bad response");
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: j })); } catch (e) {}
        return { data: j };
      })
      .catch(function (err) {
        var c = null;
        try { c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) {}
        if (c && c.data) return { data: c.data, stale: c.at };
        throw err;
      });
  }

  /* ---------- render ---------- */
  function render(res) {
    var raw = res.data || {}, today = todayIso();

    var events = (raw.events || []).filter(function (e) { return e && isIso(e.date) && e.title; }).map(function (e) {
      return { date: e.date, end: isIso(e.end) && e.end >= e.date ? e.end : e.date, title: String(e.title).trim(), notes: String(e.notes || "").trim(), category: e.category };
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

    // School calendar: one row per day -> group consecutive days into ranges
    var ranges = [];
    (raw.calendar || []).filter(function (c) { return c && isIso(c.date) && c.title; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .forEach(function (c) {
        var last = ranges[ranges.length - 1], title = String(c.title).trim();
        if (last && last.title === title && diff(last.end, c.date) === 1) last.end = c.date;
        else ranges.push({ start: c.date, end: c.date, title: title, color: c.color });
      });
    var upcomingRanges = ranges.filter(function (r) { return r.end >= today; });

    // Hero card
    $("[data-today]").textContent = longDate(today);
    var weekEnd = addDays(today, 6);
    var thisWeek = events.filter(function (e) { return e.end >= today && e.date <= weekEnd; }).length;
    var next = upcomingRanges[0], nextHtml = "";
    if (next) {
      var n = diff(today, next.start);
      nextHtml += n <= 0
        ? '<div class="countdown"><b>Now</b></div>'
        : '<div class="countdown"><b>' + n + "</b><span>" + (n === 1 ? "day" : "days") + " until</span></div>";
      nextHtml += '<div><p class="next-title">' + esc(next.title) + '</p><p class="next-when">' +
        (n <= 0 && next.end !== next.start ? "Until " + wd(next.end) + " " + short(next.end) : range(next.start, next.end)) + "</p></div>";
    }
    nextHtml += '<p class="today-note">' + (thisWeek ? thisWeek + (thisWeek === 1 ? " event" : " events") + " in the next 7 days" : "No events in the next 7 days") + "</p>";
    $("[data-next]").innerHTML = nextHtml;

    // Announcements
    var posts = (raw.announcements || []).filter(function (a) { return a && (a.title || a.content); })
      .sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });
    var newsBox = $("[data-news]");
    if (!posts.length) newsBox.innerHTML = '<p class="empty">No announcements right now.</p>';
    else {
      newsBox.innerHTML = posts.slice(0, 12).map(function (a, i) {
        var date = isIso(String(a.date).slice(0, 10)) ? String(a.date).slice(0, 10) : "";
        var age = date ? diff(date, today) : 99;
        var img = imgUrl(a.image);
        var full = a.contentHtml ? cleanHtml(a.contentHtml) : esc(a.content || "").replace(/\n/g, "<br>");
        var excerpt = plain(a.content);
        var link = /^https?:\/\//i.test(a.link || "") ? a.link : "";
        return '<article class="post' + (age >= 0 && age <= 6 ? " is-new" : "") + '"' + (i >= 3 ? " hidden" : "") + ">" +
          (img ? '<img class="cover" src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "") +
          '<div class="post-body">' +
            '<div class="post-meta">' + (age >= 0 && age <= 6 ? '<span class="new">New</span>' : "") +
              (date ? "<span>" + (age === 0 ? "Today" : age === 1 ? "Yesterday" : short(date) + " " + date.slice(0, 4)) + "</span>" : "") +
              (a.tag ? '<span class="tag plain">' + esc(a.tag) + "</span>" : "") + "</div>" +
            "<h3>" + esc(a.title || "Announcement") + "</h3>" +
            (excerpt ? '<div class="post-text clamp" data-full="' + esc(full) + '">' + esc(excerpt) + "</div>" : "") +
            '<div class="post-actions">' +
              (excerpt && (excerpt.length > 140 || full.indexOf("<img") !== -1 || full.indexOf("<br") !== -1) ? '<button class="linkish" type="button" data-read>Read more</button>' : "") +
              (link ? '<a class="linkish" href="' + esc(link) + '" target="_blank" rel="noopener">Open link ↗</a>' : "") +
            "</div>" +
          "</div></article>";
      }).join("");
      if (posts.length > 3) {
        var moreNews = $("[data-news-more]");
        moreNews.hidden = false;
        moreNews.querySelector("button").onclick = function () {
          newsBox.querySelectorAll(".post[hidden]").forEach(function (p) { p.hidden = false; });
          moreNews.hidden = true;
        };
      }
    }

    // Key dates (school calendar)
    $("[data-keydates]").innerHTML = upcomingRanges.slice(0, 4).map(function (r) {
      var n = diff(today, r.start);
      return '<div class="keydate ' + colorClass(r.color) + '"><span class="in">' + (n <= 0 ? "Happening now" : inDays(n)) + '</span>' +
        '<span class="name">' + esc(r.title) + '</span><span class="when">' + range(r.start, r.end) + "</span></div>";
    }).join("");

    // Upcoming events, grouped by month
    var upcoming = events.filter(function (e) { return e.end >= today && e.date <= addDays(today, 183); });
    var evBox = $("[data-events]");
    if (!upcoming.length) evBox.innerHTML = '<p class="empty">No upcoming events.</p>';
    else {
      var html = "", month = "", LIMIT = 10;
      upcoming.forEach(function (e, i) {
        var shown = e.date < today ? today : e.date;
        var m = shown.slice(0, 7);
        if (m !== month) {
          if (month) html += "</ol></div>";
          html += '<div class="month" data-m="' + m + '"><h3>' + MONTH[+m.slice(5) - 1] + " " + m.slice(0, 4) + "</h3><ol>";
          month = m;
        }
        var when = e.end !== e.date ? range(e.date, e.end) : wd(e.date) + " " + short(e.date);
        var rel = e.date <= today ? (e.end > e.date ? "Ongoing" : "Today") : diff(today, e.date) <= 6 ? inDays(diff(today, e.date)) : "";
        html += '<li class="ev' + (e.date <= today ? " is-today" : "") + '"' + (i >= LIMIT ? " hidden" : "") + ">" +
          '<div class="ev-date">' + esc(when) + (rel ? "<small>" + rel + "</small>" : "") + "</div>" +
          '<div><div class="ev-title">' + esc(e.title) + "</div>" + (e.notes ? '<div class="ev-notes">' + esc(e.notes) + "</div>" : "") + "</div>" +
          deptTag(e.category) + "</li>";
      });
      evBox.innerHTML = html + "</ol></div>";
      hideEmptyMonths(evBox);
      if (upcoming.length > LIMIT) {
        var moreEv = $("[data-events-more]");
        moreEv.hidden = false;
        moreEv.querySelector("button").onclick = function () {
          evBox.querySelectorAll(".ev[hidden]").forEach(function (li) { li.hidden = false; });
          hideEmptyMonths(evBox);
          moreEv.hidden = true;
        };
      }
    }

    // Footer
    var stamp = res.demo ? "Showing sample content — connect the Google Sheet in config.js."
      : res.stale ? "Offline — showing a copy saved " + new Date(res.stale).toLocaleString("en-GB")
      : "Updated from the school calendar sheet.";
    $("[data-updated]").textContent = stamp;
  }

  function hideEmptyMonths(box) {
    box.querySelectorAll(".month").forEach(function (m) { m.hidden = !m.querySelector(".ev:not([hidden])"); });
  }

  // "Read more" toggles the full announcement in place
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-read]");
    if (!btn) return;
    var text = btn.closest(".post").querySelector(".post-text");
    if (!text) return;
    if (text.classList.contains("clamp")) {
      text.dataset.short = text.innerHTML;
      text.innerHTML = text.getAttribute("data-full");
      text.classList.remove("clamp");
      btn.textContent = "Show less";
    } else {
      text.innerHTML = text.dataset.short;
      text.classList.add("clamp");
      btn.textContent = "Read more";
    }
  });

  document.querySelector("[data-year]").textContent = todayIso().slice(0, 4);
  $("[data-today]").textContent = longDate(todayIso());

  load().then(render).catch(function () {
    $("[data-news]").innerHTML = '<p class="empty">Couldn’t load announcements right now. Please try again later.</p>';
    $("[data-events]").innerHTML = '<p class="empty">Couldn’t load the calendar right now.</p>';
    $("[data-next]").innerHTML = "";
  });
})();
