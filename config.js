/*
 * SSV Teacher Hub — settings
 */
window.HUB_CONFIG = {
  // URL web app Apps Script (kết thúc bằng /exec).
  // Để trống = trang hiện nội dung mẫu.
  apiUrl: "",

  // Múi giờ dùng để tính "hôm nay".
  timeZone: "Asia/Ho_Chi_Minh",

  // Nhãn và màu cho từng bộ phận (cột Details trong tab Event).
  // Màu có sẵn: red, orange, amber, green, teal, blue, violet, rose, slate.
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
