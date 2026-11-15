/* Teacher Hub · Sedbergh Vietnam — shared code for every page
 * Reads the school Google Sheet directly (CSV export) — no Apps Script.
 * Links attached to words in Announcements cells come from the tab's .xlsx export (see loadCellLinks).
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
  // -> { rows: [...], head: [...], col: function(keywords) -> index }; each row keeps its sheet row number in row.n
  function sheet(text) {
    var all = parseCSV(text).map(function (r, i) { r.n = i + 1; return r; })
      .filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
    var head = (all[0] || []).map(function (h) { return h.trim().toLowerCase(); });
    return {
      rows: all.slice(1),
      head: head,
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

  /* ---------------- links attached to words in a cell ----------------
     The CSV export keeps only the text of a cell, so links added with Insert → Link are lost. Two other views keep them:
     - the .xlsx export: every row, but only ONE link per cell (a cell with an English and a Vietnamese link keeps the first);
     - the HTML view: EVERY link in a cell, but only for rows that aren't hidden in the Sheet.
     We read both and use the HTML links where we have them.
     -> { sheetRowNumber: { text: { header: cell text }, links: { header: [{ text, href }] } } } — {} if anything fails. */
  function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), files = {}, e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("not a zip file");
    for (var i = 0, p = dv.getUint32(e + 16, true), n = dv.getUint16(e + 10, true); i < n; i++) {
      var nameLen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true), size = dv.getUint32(p + 20, true);
      var start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      files[new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen))] = { method: dv.getUint16(p + 10, true), data: u8.slice(start, start + size) };
      p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    return {
      names: Object.keys(files),
      read: function (name) {
        var f = files[name];
        if (!f) return Promise.resolve("");
        if (f.method === 0) return Promise.resolve(new TextDecoder().decode(f.data));
        return new Response(new Blob([f.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      }
    };
  }
  function tags(node, t) { return Array.prototype.slice.call(node.getElementsByTagName(t)); }
  // .xlsx -> { head: { A: "date", … }, text: { B12: "cell text" }, links: { B12: [{ text, href }] } }
  function readXlsx(buf) {
    var zip = unzip(buf), ws = zip.names.filter(function (x) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(x); })[0] || "";
    return Promise.all([zip.read(ws), zip.read(ws.replace("worksheets/", "worksheets/_rels/") + ".rels"), zip.read("xl/sharedStrings.xml")]).then(function (x) {
      function xml(s) { return new DOMParser().parseFromString(s || "<x/>", "application/xml"); }
      function texts(node) { return tags(node, "t").map(function (t) { return t.textContent; }).join(""); }
      var strings = tags(xml(x[2]), "si").map(texts), targets = {}, doc = xml(x[0]), out = { head: {}, text: {}, links: {} };
      tags(xml(x[1]), "Relationship").forEach(function (r) { targets[r.getAttribute("Id")] = r.getAttribute("Target"); });
      tags(doc, "c").forEach(function (c) {
        var v = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0];
        out.text[c.getAttribute("r")] = c.getAttribute("t") === "s" && v ? strings[+v.textContent] || "" : is ? texts(is) : v ? v.textContent : "";
      });
      Object.keys(out.text).forEach(function (ref) { var m = ref.match(/^([A-Z]+)1$/); if (m) out.head[m[1]] = out.text[ref].trim().toLowerCase(); });
      tags(doc, "hyperlink").forEach(function (h) {
        var ref = h.getAttribute("ref") || "", target = targets[h.getAttribute("r:id")] || "", loc = h.getAttribute("location");
        if (/^[A-Z]+\d+$/.test(ref) && /^https?:\/\//i.test(target)) out.links[ref] = [{ text: out.text[ref] || "", href: target + (loc ? "#" + loc : "") }];
      });
      return out;
    });
  }
  // HTML view -> { B313: [{ text, href }, …] } for the rows it shows
  function readHtmlView(html) {
    var doc = new DOMParser().parseFromString(html, "text/html"), out = {};
    var letters = Array.prototype.slice.call(doc.querySelectorAll("thead th")).map(function (th) { return th.textContent.trim(); });
    Array.prototype.forEach.call(doc.querySelectorAll("tbody tr"), function (tr) {
      var th = tr.querySelector("th"), n = th ? th.textContent.trim() : "", col = 1;
      if (!/^\d+$/.test(n)) return;
      Array.prototype.forEach.call(tr.querySelectorAll("td"), function (td) {
        var links = Array.prototype.map.call(td.querySelectorAll("a[href]"), function (a) {
          var href = a.getAttribute("href");
          try { var u = new URL(href); if (/(^|\.)google\.com$/.test(u.hostname) && u.pathname === "/url") href = u.searchParams.get("q") || href; } catch (e) {}
          return { text: a.textContent, href: href };
        }).filter(function (l) { return /^https?:\/\//i.test(l.href); });
        if (links.length && letters[col]) out[letters[col] + n] = links;
        col += td.colSpan || 1;
      });
    });
    return out;
  }
  function loadCellLinks(key) {
    var gid = (CFG.gids || {})[key];
    if (DEMO || FILE || (CFG.csv || {})[key] || gid == null || String(gid) === "" || typeof DecompressionStream === "undefined") return Promise.resolve({});
    var base = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.sheetId || ""), g = encodeURIComponent(gid);
    function get(url, as) { return fetch(url, { credentials: "omit" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r[as](); }); }
    var xlsx = get(base + "/export?format=xlsx&gid=" + g, "arrayBuffer").then(readXlsx);
    var html = get(base + "/htmlview/sheet?headers=true&gid=" + g, "text").then(readHtmlView).catch(function () { return {}; });
    var work = Promise.all([xlsx, html]).then(function (x) {
      var book = x[0], all = Object.assign({}, book.links, x[1]), out = {};
      Object.keys(all).forEach(function (ref) {
        var m = ref.match(/^([A-Z]+)(\d+)$/), row = out[m[2]];
        if (!row) {
          row = out[m[2]] = { text: {}, links: {} };
          Object.keys(book.head).forEach(function (L) { row.text[book.head[L]] = book.text[L + m[2]] || ""; });
        }
        row.links[book.head[m[1]] || m[1]] = all[ref];
      });
      return out;
    });
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve({}); }, 6000); });
    return Promise.race([work, timeout]).catch(function () { return {}; });
  }

  /* ---------------- shaping ---------------- */
  // one entry per day: { date, title, color, full }
  function readCalendarDays(text) {
    var t = sheet(text);
    var iDate = t.col(["date", "ngày", "ngay", "day"]), iTitle = t.col(["title", "event", "tên", "name"]),
        iColor = t.col(["color", "colour", "màu", "mau"]), iFull = t.col(["full", "all day", "cả ngày"]);
    var days = [];
    t.rows.forEach(function (r) {
      var d = parseDate(cell(r, iDate)), title = cell(r, iTitle).split("\n")[0].trim();
      if (d && title) days.push({ date: d, title: title, color: cell(r, iColor).toLowerCase(), full: truthy(cell(r, iFull)) });
    });
    return days.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  // consecutive days with the same title -> { start, end, title, color }
  function readCalendar(text) {
    var days = readCalendarDays(text);
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
  function readAnnouncements(text, cellLinks) {
    var t = sheet(text);
    var iDate = t.col(["date", "ngày"]), iTitle = t.col(["title", "tiêu đề"]), iContent = t.col(["content", "nội dung", "body"]),
        iTag = t.col(["tag", "category"]), iPublic = t.col(["public", "show", "hiện"]), iImage = t.col(["image", "ảnh", "picture"]),
        iLink = t.col(["link", "url"]);
    function squash(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
    function isUrl(s) { return /^https?:\/\//i.test(s || ""); }
    var out = [];
    t.rows.forEach(function (r) {
      var title = cell(r, iTitle), content = cell(r, iContent);
      if (!title && !content) return;
      if (iPublic !== -1 && !truthy(cell(r, iPublic))) return;
      // links attached to the words of Title / Content (only when the exported row really is this row)
      var x = (cellLinks || {})[r.n], titleKey = t.head[iTitle], contentKey = t.head[iContent];
      if (x && squash(x.text[titleKey]) !== squash(title)) x = null;
      var seen = {};
      function clean(list) {
        return (list || []).filter(function (l) { var ok = isUrl(l.href) && !seen[l.href]; seen[l.href] = true; return ok; })
          .map(function (l) { return { text: squash(l.text), href: l.href }; });
      }
      var links = clean(isUrl(cell(r, iLink)) ? [{ text: "", href: cell(r, iLink) }] : x && x.links[titleKey]);
      if (!links.length && /^https?:\/\/\S+$/.test(title)) links = clean([{ text: "", href: title }]);
      out.push({
        date: parseDate(cell(r, iDate)) || "", title: title, content: content, tag: cell(r, iTag),
        image: imgUrl(cell(r, iImage)), imageLink: isUrl(cell(r, iImage)) ? cell(r, iImage) : "",
        links: links, contentLinks: clean(x && x.links[contentKey])
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }


  /* ---------------- page chrome (menu, footer) ---------------- */
  var TODAY = today();
  function initChrome() {
    var toggle = $(".menu-toggle"), nav = $("#site-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = !nav.classList.contains("open");
        nav.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
      });
    }
    var y = $("[data-year]"); if (y) y.textContent = TODAY.slice(0, 4);
  }
  function setSource(failed) {
    var el = $("[data-source]");
    if (!el) return;
    el.textContent = demoUsed ? "Sample data (demo mode)"
      : failed ? "Some content couldn’t be loaded"
      : offline ? "Offline — showing the last saved copy"
      : "Live from the school calendar sheet";
  }
  // Colours used in the Calendar tab ("green", "pink", "blue1", or a #hex value)
  function calColor(c) {
    c = String(c || "").trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(c)) return { cls: "", style: "--day:" + c + ";--day-ink:#fff" };
    var key = { red: "red", orange: "orange", yellow: "yellow", amber: "yellow", gold: "yellow", green: "green", teal: "teal",
      blue: "blue", blue1: "blue1", blue2: "blue1", lightblue: "blue1", purple: "purple", violet: "purple", pink: "pink", rose: "pink",
      gray: "gray", grey: "gray", brown: "brown" }[c] || ({ red: "red", blue: "blue", green: "green" })[c.replace(/\d+$/, "")] || "gold";
    return { cls: "day-" + key, style: "" };
  }
  function deptColor(s) { var k = deptKey(s), c = (CFG.categories || {})[k] || {}; return c.color || hueOf(k); }

  initChrome();

  window.Hub = {
    CFG: CFG, TODAY: TODAY, MONTHS: MONTHS, DAYS: DAYS,
    $: $, esc: esc, pad: pad, toDate: toDate, addDays: addDays, diff: diff, wd: wd, dShort: dShort, dLong: dLong, range: range, rel: rel,
    load: load, setSource: setSource, parseCSV: parseCSV, parseDate: parseDate,
    readCalendarDays: readCalendarDays, readCalendar: readCalendar, readEvents: readEvents, readAnnouncements: readAnnouncements, loadCellLinks: loadCellLinks,
    richText: richText, plain: plain, imgUrl: imgUrl, NAMED: NAMED,
    deptKey: deptKey, deptLabel: deptLabel, deptColor: deptColor, calColor: calColor
  };
})();
