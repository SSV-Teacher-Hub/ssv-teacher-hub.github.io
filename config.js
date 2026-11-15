/*
 * Teacher Hub · Sedbergh Vietnam — settings
 *
 * Trang đọc thẳng Google Sheet, không cần Apps Script.
 * Sheet cần để chia sẻ "Anyone with the link" (xem README.md).
 */
window.HUB_CONFIG = {
  // ID của Google Sheet (đoạn giữa /d/ và /edit trong link Sheet).
  sheetId: "1RtboirkzLLOoy1D1qf_PBUPkzvMUOzNeVHy1TPCNl6U",

  // Tên các tab trong Sheet.
  tabs: {
    calendar: "Calendar",
    events: "Event",
    announcements: "Announcements"
  },

  // Mã (gid) của từng tab — số sau "gid=" trên thanh địa chỉ khi mở tab đó.
  // Có gid thì trang tải CSV đúng y như chữ trong Sheet (khuyên dùng).
  gids: {
    calendar: "0",
    events: "1889887846",
    announcements: "762820129"
  },

  // (Không bắt buộc) Link CSV lấy từ hộp thoại "Publish to web" cho từng tab.
  // Nếu điền, trang dùng link này thay cho sheetId ở trên.
  csv: {
    calendar: "",
    events: "",
    announcements: ""
  },

  // Múi giờ dùng để tính "hôm nay".
  timeZone: "Asia/Ho_Chi_Minh",

  // Nhãn và màu cho từng bộ phận (cột Details trong tab Event).
  // Màu có sẵn: blue, violet, teal, rose, amber, green, orange, red, slate.
  categories: {
    "AO":                   { label: "AO",                   color: "blue" },
    "SDO":                  { label: "SDO",                  color: "violet" },
    "COUNSELLING":          { label: "Counselling",          color: "teal" },
    "WELL-BEING":           { label: "Well-being",           color: "rose" },
    "PRIMARY":              { label: "Primary",              color: "amber" },
    "SPORTS TEAM":          { label: "Sports Team",          color: "green" },
    "LEARNING DEVELOPMENT": { label: "Learning Development", color: "orange" }
  }
};
