# Teacher Hub · Sedbergh Vietnam

Trang thông tin cho giáo viên và nhân viên Sedbergh Vietnam, cùng phong cách với
[Centre of Excellence](https://coe-ssv.github.io/). Trang tĩnh, chạy thẳng trên GitHub Pages,
**không cần Apps Script**: thông báo, lịch và sự kiện được đọc trực tiếp từ Google Sheet.

## Các trang

- `index.html` — trang chủ: thông báo, các mốc sắp tới, sự kiện 30 ngày tới, Quick Access.
- `calendar.html` — **School Calendar**: lịch tháng tô màu theo tab Calendar, chọn năm 2026/2027 và tháng bên phải.
- `events.html` — **School Events**: lịch tháng có từng sự kiện (tab Event) và danh sách chi tiết theo ngày bên dưới.

Có thể mở thẳng một tháng: `calendar.html#2027-02`.

## Nội dung lấy từ đâu

| Phần trên trang | Nguồn |
|---|---|
| Today / số ngày đến mốc tiếp theo, **Key dates** | tab `Calendar` (date, title, color, full) |
| **Upcoming events** | tab `Event` (Month, Start Date, End Date, Event, Details) |
| **Announcements** | tab `Announcements` (Date, Title, Content, Tag, Public, Image, *Link*) |
| **Quick Access** | viết thẳng trong `index.html` — mở file, sửa link |

## Kết nối Google Sheet

Trang tải từng tab bằng link xuất CSV của Google (`/export?format=csv&gid=…`), giữ nguyên chữ như trong Sheet.
Điều kiện duy nhất: Sheet để chia sẻ **Anyone with the link** (hiện đã bật).

- `sheetId` và `gids` (mã từng tab) nằm trong `config.js`. Đổi tên tab không sao, nhưng nếu **xoá tab rồi tạo lại**
  thì gid đổi: mở tab đó, copy số sau `gid=` trên thanh địa chỉ và dán vào `config.js`.
- Sửa Sheet xong, tải lại trang là thấy ngay.
- Xem thử với dữ liệu mẫu: thêm `?demo` vào cuối địa chỉ trang.

## Lưu ý về Sheet

- **Quan trọng:** link Sheet đang cho phép **Anyone with the link → Editor**. Mã Sheet nằm công khai trong code trang web,
  nên ai cũng có thể mở và **sửa** Sheet. Nên đổi thành **Viewer**, rồi thêm riêng email các thầy cô cần sửa làm Editor.
- Ai có link đều đọc được toàn bộ Sheet, kể cả dòng `Public = FALSE` (trang web vẫn ẩn những dòng đó).
- **Link của bài viết (tab Announcements):** gắn link vào chữ ở cột **Title** (bôi đen → Insert link) là đủ —
  tiêu đề, ảnh và nút *Read post* trên card sẽ mở link đó. Một ô có thể gắn **nhiều link** (ví dụ dòng tiếng Anh và dòng
  tiếng Việt mỗi dòng một link): mỗi dòng trên card mở đúng link của nó, và card có nút *English* / *Tiếng Việt*.
  Link gắn vào chữ ở cột **Content** thành nút *Open link*. Bài không có link nào thì nút *View full image* mở ảnh ở cột **Image**.
- **Dòng bị ẩn trong Sheet chỉ đọc được 1 link mỗi ô.** CSV làm mất link gắn vào chữ, nên trang đọc link từ hai nơi:
  bản xuất `.xlsx` (đủ mọi dòng nhưng mỗi ô chỉ giữ link đầu tiên) và bản xem HTML (đủ mọi link nhưng bỏ qua dòng bị ẩn).
  Muốn bài cũ hiện đủ link thì đừng ẩn dòng của nó (Unhide rows). Nếu không đọc được thì card vẫn hiện, chỉ thiếu link.
- Ngoài link, CSV chỉ chứa chữ, nên **định dạng trong ô (đậm, màu) và ảnh chèn trong ô không hiện**. Thay vào đó:
  - Ảnh: dán link ảnh vào cột **Image** (link Google Drive cũng được — file phải chia sẻ công khai).
  - Có thể dán URL thẳng vào **Content** (tự thành link bấm được), hoặc thêm cột **Link** (ưu tiên hơn link ở Title).
  - Chèn ảnh trong nội dung: `[img]https://...[/img]`.
- Ngày trong tab Event có thể lẫn DD/MM và MM/DD; trang dùng cột **Month** để đọc đúng (giống code cũ).

## Cấu trúc

```
index.html              nội dung trang (sửa link Quick Access ở đây)
config.js               ID Sheet, tên tab, link CSV, màu/nhãn bộ phận
assets/css/style.css    giao diện (màu, font theo trang COE)
assets/js/hub.js        phần dùng chung: đọc CSV từ Sheet, xử lý ngày
assets/js/home.js       trang chủ
assets/js/calendar.js   trang School Calendar và School Events
assets/img/             logo Sedbergh Vietnam
data/demo/demo.js       dữ liệu mẫu (dùng với ?demo hoặc khi mở file bằng cách bấm đúp)
```

## Bật GitHub Pages

Repo → **Settings → Pages → Build and deployment → Deploy from a branch** → chọn nhánh chứa code
(ví dụ `main`) và thư mục `/ (root)` → **Save**. Trang sẽ có tại `https://ssv-teacher-hub.github.io/`.
