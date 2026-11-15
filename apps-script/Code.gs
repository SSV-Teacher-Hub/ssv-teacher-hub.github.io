/**
 * SSV Teacher Hub — Apps Script backend
 *
 * Hai chế độ:
 *   1) .../exec                 -> trang HTML cũ (Index.html), giữ nguyên như trước.
 *   2) .../exec?format=json     -> dữ liệu JSON cho trang landing trên GitHub Pages
 *                                  (lịch, sự kiện, thông báo — đọc từ 3 tab sẵn có).
 *
 * Sau khi dán file này: Deploy > Manage deployments > (bút chì) Edit > Version: New version > Deploy.
 * "Who has access" phải là "Anyone" thì GitHub Pages mới đọc được JSON.
 */

var SPREADSHEET_ID = "1RtboirkzLLOoy1D1qf_PBUPkzvMUOzNeVHy1TPCNl6U";
var CACHE_TTL = 300; // 5 phút

// ===== Tên các tab trong bảng tính (đúng như trong Sheet của bạn) =====
var CALENDAR_TAB  = "Calendar";       // Lịch năm học  -> School Calendar (mỗi ngày 1 dòng)
var EVENTS_TAB    = "Event";          // Sự kiện       -> Event Calendar
var ANN_TAB       = "Announcements";  // Thông báo     -> Announcements

// Tháng bắt đầu năm học (7 = July). Dùng để tính "năm học" cho nút 2026/2027.
var ACADEMIC_START_MONTH = 7;

// Cỡ chữ mặc định của Google Sheets (pt). Chữ 10pt trong sheet = cỡ chuẩn của trang.
// Đặt 12 trong sheet -> trang hiện to gấp 1.2 lần, đặt 8 -> nhỏ còn 0.8 lần.
var BASE_FONT_PT = 10;

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  // Mở web app kèm ?nocache=1 để thấy thay đổi trong Sheet ngay, không chờ 5 phút.
  if (params.nocache || params.refresh) {
    try { clearCache(); } catch (eC) { Logger.log("clearCache: " + eC); }
  }

  // ===== Chế độ JSON cho trang GitHub Pages =====
  if (String(params.format || "").toLowerCase() === "json" || params.api) {
    return jsonOutput_(buildPayload_(), params.callback);
  }

  // Ngày hôm nay theo múi giờ BẢNG TÍNH (không dùng Session — dễ lệch ngày).
  var now = new Date();
  var curYear, curMonth;
  try {
    var tz0 = SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone();
    curYear  = Number(Utilities.formatDate(now, tz0, "yyyy"));
    curMonth = Number(Utilities.formatDate(now, tz0, "M"));
  } catch (e0) {
    curYear  = now.getFullYear();
    curMonth = now.getMonth() + 1;
  }

  var year  = Number(params.year)  || curYear;   // mở đúng tháng hiện tại
  var month = Number(params.month) || curMonth;
  var baseYear = (curMonth >= ACADEMIC_START_MONTH) ? curYear : curYear - 1;

  var calendar = [], events = [], announcements = [];
  try { calendar      = loadCalendarFromSheet_(); }      catch (a) { Logger.log("calendar: " + a); }
  try { events        = loadEventsFromSheet_(); }        catch (b) { Logger.log("events: " + b); }
  try { announcements = loadAnnouncementsFromSheet_(); } catch (c) { Logger.log("ann: " + c); }

  var t = HtmlService.createTemplateFromFile("Index");
  t.data = {
    year: year, month: month, baseYear: baseYear,
    calendar: calendar, events: events, announcements: announcements
  };

  return t.evaluate()
    .setTitle("Teacher Hub")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ===== JSON API =====
// Mỗi phần đọc riêng: một tab lỗi không làm mất các tab khác.
function buildPayload_() {
  var tz = "Asia/Ho_Chi_Minh";
  try { tz = SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone(); } catch (e0) {}

  var now = new Date();
  var curYear  = Number(Utilities.formatDate(now, tz, "yyyy"));
  var curMonth = Number(Utilities.formatDate(now, tz, "M"));

  var out = {
    ok: true,
    meta: {
      generatedAt: now.getTime(),   // mốc thời gian (ms), trang tự hiển thị "cập nhật x phút trước"
      timeZone: tz,
      today: Utilities.formatDate(now, tz, "yyyy-MM-dd"),
      baseYear: (curMonth >= ACADEMIC_START_MONTH) ? curYear : curYear - 1,
      academicStartMonth: ACADEMIC_START_MONTH
    },
    calendar: [], events: [], announcements: [],
    errors: []
  };

  var parts = [
    ["calendar",      loadCalendarFromSheet_],
    ["events",        loadEventsFromSheet_],
    ["announcements", loadAnnouncementsFromSheet_]
  ];
  for (var i = 0; i < parts.length; i++) {
    try { out[parts[i][0]] = parts[i][1]() || []; }
    catch (err) {
      Logger.log(parts[i][0] + ": " + err);
      out.errors.push(parts[i][0] + ": " + String(err && err.message || err));
    }
  }
  return out;
}

function jsonOutput_(obj, callback) {
  var body = JSON.stringify(obj);
  // JSONP (dự phòng): chỉ nhận tên hàm hợp lệ để tránh chèn mã.
  if (callback && /^[A-Za-z_$][\w$.]{0,63}$/.test(String(callback))) {
    return ContentService.createTextOutput(callback + "(" + body + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// Một ô cache tối đa 100KB. Vượt quá thì cache.put báo lỗi -> trước đây làm mất cả danh sách.
// Giờ chỉ bỏ qua cache, dữ liệu vẫn trả về bình thường.
function cachePut_(key, value) {
  try { CacheService.getScriptCache().put(key, value, CACHE_TTL); }
  catch (e) { Logger.log("cache.put(" + key + ") bỏ qua: " + e); }
}

// ===== School Calendar: tab Calendar (date/title/color/full) =====
function loadCalendarFromSheet_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("calendar_v2");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var tz = ss.getSpreadsheetTimeZone();
  var sh = getSheet_(ss, [CALENDAR_TAB, "Calendar", "School Calendar", "Lịch", "Lich"]);
  if (!sh) { Logger.log("Không thấy tab lịch. Tab hiện có: " + listTabNames_(ss)); return []; }

  var cols = detectColsForSheet_(sh, tz);
  if (!cols) return [];
  var out = readEventsFrom_(sh, cols, tz);
  cachePut_("calendar_v2", JSON.stringify(out));
  return out;
}

// ===== School Events: tab Event =====
// Cột thật: Month | Start Date | End Date | Event | Details
// Ngày lưu dạng chữ, LẪN LỘN DD/MM và MM/DD (ví dụ "08/10/2026" là 10 August).
// Cột Month chính là chìa khoá để biết tháng đúng.
// Ô Event nhiều dòng: dòng đầu = tên sự kiện, các dòng sau = ghi chú (notes).
function loadEventsFromSheet_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("events_v4");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var tz = ss.getSpreadsheetTimeZone();
  var sh = getSheet_(ss, [EVENTS_TAB, "Event", "Events", "Sự kiện", "Su kien"]);
  if (!sh) { Logger.log("Không thấy tab Event. Tab hiện có: " + listTabNames_(ss)); return []; }

  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  var header = values[0];
  var iMonth = findColByKeywords_(header, ["month", "tháng", "thang"]);
  var iStart = findColByKeywords_(header, ["start date", "start", "from", "ngày bắt đầu"]);
  var iEnd   = findColByKeywords_(header, ["end date", "end", "to", "ngày kết thúc"]);
  var iTitle = findColByKeywords_(header, ["event", "title", "tên sự kiện", "activity"]);
  var iCat   = findColByKeywords_(header, ["details", "detail", "category", "type", "phân loại"]);

  if (iStart === -1) iStart = findColByKeywords_(header, ["date", "ngày"]);
  if (iStart === -1 || iTitle === -1) {
    Logger.log("Tab Event thiếu cột ngày hoặc cột tên. Tiêu đề: " + JSON.stringify(header));
    return [];
  }

  var out = [];
  var lastHint = null;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];

    var hint = (iMonth !== -1) ? parseMonthHint_(row[iMonth]) : null;
    if (hint) lastHint = hint; else hint = lastHint;   // dòng bỏ trống cột Month thì dùng lại tháng trên

    var start = resolveEventDate_(row[iStart], hint, null, tz);
    if (!start) continue;

    var raw = String(row[iTitle] == null ? "" : row[iTitle]);
    var lines = raw.split(/\r?\n/);
    var title = lines[0].replace(/\s+/g, " ").trim();
    if (!title) continue;
    var notes = lines.slice(1)
      .map(function (s) { return s.replace(/[ \t]+/g, " ").trim(); })
      .filter(function (s) { return s; })
      .join("\n");

    var end = (iEnd !== -1) ? resolveEventDate_(row[iEnd], hint, start, tz) : null;
    if (!end || end < start) end = start;

    out.push({
      date: start,
      end: end,
      title: title,
      notes: notes,
      category: (iCat !== -1) ? String(row[iCat] || "").trim() : "",
      color: "",
      full: false
    });
  }

  out.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

  cachePut_("events_v4", JSON.stringify(out));
  return out;
}

var MONTH_NAMES_ = ["january", "february", "march", "april", "may", "june",
                    "july", "august", "september", "october", "november", "december"];

// "September 2026" -> { y: 2026, m: 9 }
function parseMonthHint_(val) {
  if (val instanceof Date && !isNaN(val)) {
    return { y: val.getFullYear(), m: val.getMonth() + 1 };
  }
  var s = String(val == null ? "" : val).trim().toLowerCase();
  if (!s) return null;

  var m = null;
  for (var i = 0; i < 12; i++) {
    if (s.indexOf(MONTH_NAMES_[i]) !== -1) { m = i + 1; break; }
  }
  if (!m) return null;

  var y = null;
  var my = s.match(/(20\d\d)/);
  if (my) y = Number(my[1]);

  return { y: y, m: m };
}

// Hai cách đọc có thể có của chuỗi kiểu "08/10/2026": DD/MM và MM/DD.
function dateCandidates_(s) {
  var m = String(s == null ? "" : s).trim().match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (!m) return null;

  var a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
  if (y < 100) y += 2000;

  var out = [], seen = {};
  function add(day, mon) {
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return;
    var iso = y + "-" + pad2_(mon) + "-" + pad2_(day);
    if (!seen[iso]) { seen[iso] = 1; out.push(iso); }
  }
  add(a, b);   // DD/MM
  add(b, a);   // MM/DD
  return out;
}

// startIso != null nghĩa là đang đọc End Date -> chọn ngày gần ngày bắt đầu nhất.
function resolveEventDate_(val, hint, startIso, tz) {
  if (val instanceof Date && !isNaN(val)) {
    return Utilities.formatDate(val, tz, "yyyy-MM-dd");
  }

  var s = String(val == null ? "" : val).trim();
  if (!s) return null;

  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return iso[1] + "-" + pad2_(iso[2]) + "-" + pad2_(iso[3]);

  var cands = dateCandidates_(s);
  if (!cands || !cands.length) {
    var d = new Date(s);
    return isNaN(d) ? null : Utilities.formatDate(d, tz, "yyyy-MM-dd");
  }
  if (cands.length === 1) return cands[0];

  // End Date: lấy ngày sớm nhất mà vẫn >= ngày bắt đầu.
  if (startIso) {
    var after = [];
    for (var i = 0; i < cands.length; i++) if (cands[i] >= startIso) after.push(cands[i]);
    if (after.length) { after.sort(); return after[0]; }
    cands.sort();
    return cands[cands.length - 1];
  }

  // Start Date: chọn cách đọc khớp với cột Month.
  if (hint && hint.m) {
    for (var j = 0; j < cands.length; j++) {
      if (Number(cands[j].slice(5, 7)) === hint.m &&
          (!hint.y || Number(cands[j].slice(0, 4)) === hint.y)) return cands[j];
    }
    for (var k = 0; k < cands.length; k++) {
      if (Number(cands[k].slice(5, 7)) === hint.m) return cands[k];
    }
  }

  return cands[0];   // không có gợi ý -> mặc định DD/MM
}

// ===== Announcements: tab Announcements =====
// Cột: Date | Title | Content | Tag | Public | Image
// Link của bài CHỈ lấy từ cột Title: link gắn trong ô -> =HYPERLINK(...) -> ô Title là URL.
// Không lấy link từ cột Content.
function loadAnnouncementsFromSheet_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("announcements_v9");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = getSheet_(ss, [ANN_TAB, "Announcements", "Announcement", "Thông báo", "Thong bao"]);
  if (!sh) return [];

  var tz = ss.getSpreadsheetTimeZone();
  var rng = sh.getDataRange();
  var values = rng.getValues();

  // Hai bảng phụ để lấy URL ẩn trong ô. Nếu API lỗi thì bỏ qua, không làm sập trang.
  var formulas = null, rich = null;
  try { formulas = rng.getFormulas(); }        catch (eF) { Logger.log("getFormulas: " + eF); }
  try { rich = rng.getRichTextValues(); }      catch (eR) { Logger.log("getRichTextValues: " + eR); }

  // Cỡ chữ/màu đặt cho CẢ Ô bằng thanh công cụ không nằm trong rich text run,
  // nên phải đọc riêng rồi dùng làm giá trị mặc định.
  var fontSizes = null, fontColors = null;
  try { fontSizes  = rng.getFontSizes(); }  catch (eS) { Logger.log("getFontSizes: " + eS); }
  try { fontColors = rng.getFontColors(); } catch (eK) { Logger.log("getFontColors: " + eK); }

  var result = [];

  for (var i = 1; i < values.length; i++) {
    var date = values[i][0], title = values[i][1], content = values[i][2];
    var tag = values[i][3], isPublic = values[i][4], image = values[i][5];

    if (!date && !title) continue;
    if (isPublic !== true && String(isPublic).toUpperCase() !== "TRUE") continue;

    var dateStr = (date instanceof Date)
      ? Utilities.formatDate(date, tz, "yyyy-MM-dd")
      : String(date || "");

    var titleLink = extractCellUrl_(
      rich ? rich[i][1] : null,
      formulas ? formulas[i][1] : "",
      title
    );

    var imageUrl = cellImageUrl_(image);

    // Giữ nguyên định dạng của ô: xuống dòng, cỡ chữ, màu, in đậm/nghiêng, link.
    var titleHtml   = richToHtml_(rich ? rich[i][1] : null, title,
                                  fontSizes ? fontSizes[i][1] : null,
                                  fontColors ? fontColors[i][1] : null);
    var contentHtml = contentImages_(
                        richToHtml_(rich ? rich[i][2] : null, content,
                                    fontSizes ? fontSizes[i][2] : null,
                                    fontColors ? fontColors[i][2] : null));

    result.push({
      date: dateStr,
      title: title || "",
      titleHtml: titleHtml,
      content: content || "",
      contentHtml: contentHtml,
      tag: tag || "",
      image: imageUrl,
      link: titleLink || ""
    });
  }

  result.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  cachePut_("announcements_v9", JSON.stringify(result));
  return result;
}

// Ô Image có thể là: đường dẫn dạng chữ, hoặc ảnh chèn thẳng vào ô
// (Chèn > Hình ảnh > Hình ảnh trong ô). Trả về URL dùng được cho thẻ <img>.
function cellImageUrl_(val) {
  if (val && typeof val === "object") {
    try { if (typeof val.getContentUrl === "function") return val.getContentUrl() || ""; }
    catch (e1) { /* bỏ qua */ }
    try { if (typeof val.getUrl === "function") return val.getUrl() || ""; }
    catch (e2) { /* bỏ qua */ }
    return "";
  }
  return String(val == null ? "" : val).trim();
}

/* ===== Chuyển nội dung ô Google Sheets thành HTML, giữ định dạng ===== */

// Link Drive -> link ảnh hiển thị được.
function toImgSrc_(url) {
  var s = String(url || "").trim();
  var m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? ("https://lh3.googleusercontent.com/d/" + m[1]) : s;
}

function isImageLink_(url) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(String(url || ""));
}

/**
 * Cho phép chèn ảnh vào cột Content:
 *   - viết  [img]link[/img]  trên một dòng riêng
 *   - hoặc dán thẳng link ảnh kết thúc bằng .jpg .png .gif .webp
 * Cả hai đều thành thẻ <img> thay vì link chữ.
 */
function contentImages_(html) {
  var out = String(html || "");

  // [img]...[/img] — link bên trong có thể đã bị bọc thành thẻ <a>
  out = out.replace(/\[img\]\s*(?:<a[^>]*href="([^"]+)"[^>]*>.*?<\/a>|([^<\[\s]+))\s*\[\/img\]/gi,
    function (all, hrefUrl, plainUrl) {
      var u = hrefUrl || plainUrl || "";
      return u ? '<img class="content-img" src="' + toImgSrc_(u) + '" alt="" referrerpolicy="no-referrer" loading="lazy" />' : "";
    });

  // link ảnh trần đã thành <a> -> đổi sang <img>
  out = out.replace(/<a[^>]*href="([^"]+)"[^>]*>[^<]*<\/a>/gi, function (all, u) {
    return isImageLink_(u)
      ? '<img class="content-img" src="' + toImgSrc_(u) + '" alt="" referrerpolicy="no-referrer" loading="lazy" />'
      : all;
  });

  return out;
}

function escapeHtml_(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Biến URL trần trong chuỗi ĐÃ escape thành thẻ <a>.
function linkifyEscaped_(s) {
  return String(s || "").replace(/(https?:\/\/[^\s<]+)/g, function (url) {
    var clean = url.replace(/[.,;:!?)\]]+$/, "");
    return '<a class="rt-link" href="' + clean + '" target="_blank" rel="noopener noreferrer" '
         + 'onclick="event.stopPropagation();">' + clean + '</a>' + url.slice(clean.length);
  });
}

function nl2br_(s) {
  return String(s || "").replace(/\r\n|\r|\n/g, "<br>");
}

// Lọc mã màu: bỏ đen mặc định và màu quá nhạt (đọc không nổi trên nền kem).
function hexColor_(hex) {
  if (!hex) return "";
  hex = String(hex).slice(0, 7);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "";
  if (hex.toLowerCase() === "#000000") return "";

  var r = parseInt(hex.substr(1, 2), 16);
  var g = parseInt(hex.substr(3, 2), 16);
  var b = parseInt(hex.substr(5, 2), 16);
  var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.72) return "";
  return hex;
}

// Màu chữ của một đoạn; trả "" nếu không đặt màu, là màu theme,
// là màu đen mặc định, hoặc màu quá nhạt.
function runColor_(textStyle) {
  var hex = "";
  try {
    var co = textStyle.getForegroundColorObject();
    if (co && co.getColorType && String(co.getColorType()) === "RGB") {
      hex = co.asRgbColor().asHexString();
    }
  } catch (e1) { /* bỏ qua */ }
  if (!hex) {
    try {
      var c = textStyle.getForegroundColor();
      if (c && /^#[0-9a-f]{6}$/i.test(c)) hex = c;
    } catch (e2) { /* bỏ qua */ }
  }
  return hexColor_(hex);
}

/**
 * RichTextValue -> HTML.
 * Cỡ chữ được quy về tỉ lệ (em) so với đoạn chữ to nhất trong ô,
 * nên giữ đúng tương quan lớn/nhỏ mà không phá bố cục trang.
 */
function richToHtml_(rt, plain, cellSize, cellColor) {
  var wrap = function (inner) {
    var c = [];
    if (cellSize) {
      var rr = cellSize / BASE_FONT_PT;
      if (rr < 0.55) rr = 0.55;
      if (rr > 2.2) rr = 2.2;
      if (rr !== 1) c.push("font-size:" + (Math.round(rr * 100) / 100) + "em");
    }
    var cc = hexColor_(cellColor);
    if (cc) c.push("color:" + cc);
    return c.length ? '<span style="' + c.join(";") + '">' + inner + '</span>' : inner;
  };

  var fallback = wrap(linkifyEscaped_(nl2br_(escapeHtml_(plain))));
  if (!rt) return fallback;

  var runs;
  try { runs = rt.getRuns(); } catch (e) { return fallback; }
  if (!runs || !runs.length) return fallback;

  var html = "";

  for (var i = 0; i < runs.length; i++) {
    var run = runs[i];
    var text = run.getText();
    if (text === "") continue;

    var st = null;
    try { st = run.getTextStyle(); } catch (es) { st = null; }

    var css = [];
    var url = "";
    try { url = run.getLinkUrl() || ""; } catch (eu) { url = ""; }

    if (st) {
      try {
        var size = st.getFontSize() || cellSize;   // đoạn không đặt riêng -> lấy cỡ của cả ô
        if (size && size !== BASE_FONT_PT) {
          var ratio = size / BASE_FONT_PT;
          if (ratio < 0.55) ratio = 0.55;
          if (ratio > 2.2) ratio = 2.2;
          css.push("font-size:" + (Math.round(ratio * 100) / 100) + "em");
        }
      } catch (e1) { /* bỏ qua */ }

      var col = runColor_(st) || hexColor_(cellColor);
      if (col) css.push("color:" + col);

      try { if (st.isBold())          css.push("font-weight:700"); } catch (e2) {}
      try { if (st.isItalic())        css.push("font-style:italic"); } catch (e3) {}
      try { if (st.isUnderline() && !url) css.push("text-decoration:underline"); } catch (e4) {}
      try { if (st.isStrikethrough()) css.push("text-decoration:line-through"); } catch (e5) {}
    }

    var inner = nl2br_(escapeHtml_(text));
    if (!url) inner = linkifyEscaped_(inner);   // bắt cả URL gõ trần

    var piece = inner;
    if (css.length) piece = '<span style="' + css.join(";") + '">' + piece + '</span>';
    if (url) {
      piece = '<a class="rt-link" href="' + escapeHtml_(url) + '" target="_blank" rel="noopener noreferrer" '
            + 'onclick="event.stopPropagation();">' + piece + '</a>';
    }
    html += piece;
  }

  return html || fallback;
}

// Lấy URL ẩn trong một ô: link rich text -> =HYPERLINK("url","label") -> ô chỉ chứa URL.
function extractCellUrl_(richValue, formula, textValue) {
  if (richValue) {
    try {
      var whole = richValue.getLinkUrl();
      if (whole) return whole;
      var runs = richValue.getRuns();
      for (var r = 0; r < runs.length; r++) {
        var u = runs[r].getLinkUrl();
        if (u) return u;
      }
    } catch (e) { /* ô không hỗ trợ rich text -> bỏ qua */ }
  }

  var f = String(formula || "");
  if (f) {
    var m = f.match(/HYPERLINK\s*\(\s*["']([^"']+)["']/i);
    if (m) return m[1];
  }

  var t = String(textValue == null ? "" : textValue).trim();
  if (/^https?:\/\/\S+$/i.test(t)) return t;

  return "";
}

// ===== Nhận diện cột (dùng chung cho tab Calendar & Event) =====
function normHeader_(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

function findColByKeywords_(header, keywords) {
  for (var i = 0; i < header.length; i++) {
    var h = normHeader_(header[i]);
    if (!h) continue;
    for (var k = 0; k < keywords.length; k++) {
      if (h.indexOf(keywords[k]) !== -1) return i;
    }
  }
  return -1;
}

function guessDateCol_(values, tz) {
  var cols = (values[0] || []).length, bestCol = -1, bestHits = 0;
  var sample = Math.min(values.length, 15);
  for (var c = 0; c < cols; c++) {
    var hits = 0;
    for (var r = 1; r < sample; r++) if (normalizeToISODate_(values[r][c], tz)) hits++;
    if (hits > bestHits) { bestHits = hits; bestCol = c; }
  }
  return bestHits >= 2 ? bestCol : -1;
}

function detectColsForSheet_(sheet, tz) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  var header = values[0];

  var dateCol  = findColByKeywords_(header, ["date", "ngày", "ngay", "day", "thời gian", "thoi gian", "start"]);
  var titleCol = findColByKeywords_(header, ["event", "title", "tên", "ten", "sự kiện", "su kien",
                                             "name", "activity", "hoạt động", "hoat dong", "nội dung", "noi dung"]);
  var colorCol = findColByKeywords_(header, ["color", "colour", "màu", "mau"]);
  var fullCol  = findColByKeywords_(header, ["full", "all day", "all-day", "cả ngày", "ca ngay", "fullday"]);
  var catCol   = findColByKeywords_(header, ["details", "detail", "category", "categor", "department",
                                             "audience", "đối tượng", "doi tuong", "loại", "loai", "type",
                                             "nhóm", "nhom", "phòng", "phong"]);

  if (dateCol === -1) dateCol = guessDateCol_(values, tz);
  if (dateCol === -1) return null;

  if (titleCol === -1 || titleCol === dateCol) {
    titleCol = -1;
    for (var c = 0; c < header.length; c++) { if (c !== dateCol) { titleCol = c; break; } }
  }
  if (titleCol === -1) return null;

  if (catCol === dateCol || catCol === titleCol) catCol = -1;

  return { date: dateCol, title: titleCol, color: colorCol, full: fullCol, category: catCol };
}

function readEventsFrom_(sheet, cols, tz) {
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var iso = normalizeToISODate_(row[cols.date], tz);
    if (!iso) continue;

    var raw = String(row[cols.title] == null ? "" : row[cols.title]);
    var title = raw.split(/\r?\n/)[0].trim();   // dòng đầu = tiêu đề
    if (!title) continue;

    var color = (cols.color !== -1) ? String(row[cols.color] || "").trim().toLowerCase() : "";
    var fullRaw = (cols.full !== -1) ? row[cols.full] : "";
    var full = (fullRaw === true) || String(fullRaw || "").trim().toLowerCase() === "yes";
    var category = (cols.category != null && cols.category !== -1)
      ? String(row[cols.category] || "").trim() : "";

    out.push({ date: iso, title: title, color: color || "red", full: full, category: category });
  }
  return out;
}

// ===== Tiện ích =====
function getSheet_(ss, candidates) {
  var sheets = ss.getSheets();
  for (var c = 0; c < candidates.length; c++) {
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getName().toLowerCase() === String(candidates[c]).toLowerCase()) return sheets[s];
    }
  }
  return null;
}

function listTabNames_(ss) {
  return ss.getSheets().map(function (s) { return s.getName(); }).join(", ");
}

function pad2_(n) { n = Number(n); return (n < 10 ? "0" : "") + n; }

function normalizeToISODate_(dateVal, tz) {
  // 1) Ô là Date thật -> format theo múi giờ bảng tính (đúng cho MỌI ngày).
  if (dateVal instanceof Date && !isNaN(dateVal)) {
    return Utilities.formatDate(dateVal, tz, "yyyy-MM-dd");
  }

  var s = String(dateVal == null ? "" : dateVal).trim();
  if (!s) return null;

  // 2) Đã là ISO yyyy-mm-dd
  var mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mIso) return mIso[1] + "-" + pad2_(mIso[2]) + "-" + pad2_(mIso[3]);

  // 3) Chuỗi số kiểu d/m/y, d-m-y, d.m.y (VN mặc định DD/MM).
  //    ĐÂY LÀ CHỖ CHỮA BUG NGÀY >= 13 bị bỏ mất.
  var m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (m) {
    var a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    var day, mon;
    if (a > 12 && b <= 12)      { day = a; mon = b; }   // rõ ràng DD/MM
    else if (b > 12 && a <= 12) { day = b; mon = a; }   // rõ ràng MM/DD
    else                        { day = a; mon = b; }   // cả hai <= 12 -> mặc định DD/MM (VN)
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return y + "-" + pad2_(mon) + "-" + pad2_(day);
    }
    return null;
  }

  // 4) Cuối cùng mới nhờ JS (tên tháng tiếng Anh, v.v.)
  var d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, tz, "yyyy-MM-dd");
  return null;
}

// ===== Cache / debug =====
function clearCache() {
  CacheService.getScriptCache().removeAll([
    "calendar_v2",
    "events_v2", "events_v3", "events_v4",
    "announcements_v2", "announcements_v3", "announcements_v7", "announcements_v8", "announcements_v9"
  ]);
  Logger.log("Cache cleared.");
}

function onEdit(e) {
  // Đơn giản & an toàn: xoá toàn bộ cache khi có bất kỳ chỉnh sửa nào.
  clearCache();
}

function debugAll() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  clearCache();
  Logger.log("Tab hiện có: " + listTabNames_(ss));
  Logger.log("Calendar đọc được: " + loadCalendarFromSheet_().length + " dòng");
  var ev = loadEventsFromSheet_();
  Logger.log("Event đọc được: " + ev.length + " sự kiện");
  for (var k = 0; k < Math.min(ev.length, 5); k++) Logger.log("  " + JSON.stringify(ev[k]));

  var ann = loadAnnouncementsFromSheet_();
  Logger.log("Announcements đọc được: " + ann.length);
  var withLink = 0;
  for (var i = 0; i < ann.length; i++) if (ann[i].link) withLink++;
  Logger.log("Bài có link ở tiêu đề: " + withLink);
  if (ann.length) Logger.log("Bài mới nhất: " + JSON.stringify(ann[0]));

  var json = JSON.stringify(buildPayload_());
  Logger.log("Kích thước JSON gửi cho trang: " + Math.round(json.length / 1024) + " KB");
}

/**
 * Soi thẳng một dòng trong tab Announcements, bỏ qua cache.
 * Sửa ngày ở dòng đầu rồi bấm Run, xem Execution log.
 */
function debugRow() {
  var WANT_DATE = "2026-09-07";   // <-- đổi thành ngày của bài cần kiểm tra

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = getSheet_(ss, [ANN_TAB, "Announcements"]);
  var tz = ss.getSpreadsheetTimeZone();
  var rng = sh.getDataRange();
  var values = rng.getValues();
  var rich = rng.getRichTextValues();
  var sizes = rng.getFontSizes();
  var colors = rng.getFontColors();

  for (var i = 1; i < values.length; i++) {
    var d = values[i][0];
    var ds = (d instanceof Date) ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : String(d || "");
    if (ds !== WANT_DATE) continue;

    Logger.log("=== Dòng sheet số " + (i + 1) + " | ngày " + ds + " ===");
    Logger.log("Public: " + values[i][4] + "   (phải là TRUE thì bài mới lên web)");

    Logger.log("--- Ô IMAGE ---");
    var img = values[i][5];
    Logger.log("Kiểu dữ liệu: " + (typeof img) + (img && typeof img === "object" ? " (ảnh chèn trong ô)" : ""));
    Logger.log("Giá trị thô: " + img);
    Logger.log("URL dùng cho web: " + cellImageUrl_(img));

    Logger.log("--- Ô TITLE ---");
    Logger.log("Cỡ chữ của cả ô: " + sizes[i][1] + " pt   | màu của cả ô: " + colors[i][1]);
    var runs = rich[i][1] ? rich[i][1].getRuns() : [];
    for (var r = 0; r < runs.length; r++) {
      var st = runs[r].getTextStyle();
      Logger.log("  đoạn " + (r + 1) + ": cỡ=" + st.getFontSize() +
                 " | đậm=" + st.isBold() +
                 " | link=" + runs[r].getLinkUrl() +
                 " | chữ=" + JSON.stringify(runs[r].getText().slice(0, 40)));
    }
    Logger.log("HTML tiêu đề gửi ra web:");
    Logger.log(richToHtml_(rich[i][1], values[i][1], sizes[i][1], colors[i][1]));

    Logger.log("--- Ô CONTENT ---");
    Logger.log("Cỡ chữ của cả ô: " + sizes[i][2] + " pt");
    Logger.log(richToHtml_(rich[i][2], values[i][2], sizes[i][2], colors[i][2]));
    return;
  }
  Logger.log("Không tìm thấy dòng nào có ngày " + WANT_DATE);
}
