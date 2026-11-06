# FD-11 + DATA-12 — Kiểm thử UI/UX bằng ảnh, nâng giao diện, bộ dữ liệu test

Người làm: Thắng (techlead) · Claude · 2026-11-06 · yêu cầu chủ dự án: "giao diện còn xấu, chưa nhiều chức năng, muốn wow hơn + bộ dữ liệu để test"

## Kiểm thử (Playwright chụp desktop 1440, iPhone 390, sáng/tối, trống/có dữ liệu)
| # | Vấn đề tìm thấy | Sửa |
|---|---|---|
| 1 | Chân thẻ AI hiện nguyên log kỹ thuật: `Chỉ số orders được sửa hướng từ "up"…`, số thô `6.245824010501366%`, chữ 9px | Guardrail viết câu cho người đọc (tên chỉ số VN, tăng/giảm, `6,2%`); UI gói vào "✓ Đã tự động hiệu chỉnh… · xem N chi tiết"; chữ 11px |
| 2 | Dự báo biểu đồ kéo tới cuối quý (gấp đôi phần thực tế), 3 dải tin cậy chồng nhau | Chỉ hiện ½ số ngày đang xem (14–30); dải tin cậy chỉ cho Đơn (Khối lượng) / CPA (Hiệu quả). Nowcast vẫn dùng dự báo đầy đủ |
| 3 | "Theo dõi bất thường" 10 dòng, ngày ISO, số xuống dòng → cột phải rất dài | 4 dòng + "Xem thêm", ngày dd/MM, chip "+65%" so với bình thường, màu theo mức (đỏ nghiêm trọng / vàng cảnh báo) |
| 4 | Thẻ "Bắt đầu thật đơn giản" vẫn hiện khi đã có dữ liệu, nằm cuối cột phải | Thành dải **"Bắt đầu nhanh"** ngay trên KPI, chỉ hiện khi trống: Nhập tay · Dán Excel/CSV · Thử bộ dữ liệu test |
| 5 | Mobile: bộ lọc + điều khiển 4 hàng, đẩy KPI khỏi màn đầu | 2 hàng vuốt ngang, nút ≥ 44 px |
| 6 | Khách: console đỏ `503` mỗi lần mở trang (gọi /api/auth khi chưa bật tài khoản) | `page.tsx` (server) truyền `accountsEnabled` → chưa bật thì không render AccountMenu (docs/14 §1.2 "UI ẩn nút đăng nhập") |
Không phải lỗi (đã kiểm): `~159.355 ₫` trông như số âm do font → đổi "thường khoảng"; `1,900,000` hiểu đúng 1.900.000; đơn > click là cảnh báo theo docs/03.

## DATA-12 — Bộ dữ liệu test (`src/lib/data/samples/scenarios.ts`, tab Dữ liệu → "Bộ dữ liệu test")
8 tình huống, sinh có seed, ngày kết thúc **hôm qua** (dự báo luôn có dữ liệu sát hiện tại), mỗi cái có "Kỳ vọng" để kiểm bằng mắt:
tăng trưởng đều (60) · CPA tăng vọt (45) · quảng cáo bị nhàm (45) · cuối tuần bán chạy (42) · flash sale (40) · 3 chiến dịch × 2 năm (2.190) · 50.000 dòng (chỉ CSV) · file có lỗi 20 dòng (chỉ CSV).
"Dùng ngay" đi qua `importBatch` (validate như nhập thật). "Tải CSV": UTF-8 BOM, tiêu đề tiếng Việt, tiền `1.234.000` — nhập lại bằng Import CSV: growth **60/60**, errors **9 dòng bị từ chối có lý do tiếng Việt** + 1 gộp trùng.

## Test
scenarios.test (12: validate từng dòng, đúng câu chuyện — CPA ×1,6, CTR −30%, cuối tuần < 0,8, flash sale 2 ngày, 50k, CSV khớp tiêu đề, file lỗi) · CampaignChart +1 (cửa sổ dự báo), sửa 1 (1 dải) · AnomalyFeed +1 · DashboardShell +1 (Bắt đầu nhanh) · guardrails sửa 1 (`88,5%`). Tổng 4.206 test, build, E2E 44/44 (6 `test.fail` QA-04 đã biết). Console không lỗi.

## Cần người khác làm
- **Trường**: review phần frontend (CampaignChart, AnomalyFeed, InsightContent, DashboardShell, CSS) — có thể chỉnh thẩm mỹ tiếp qua CR.
- **Hoàng Anh**: review câu cảnh báo guardrail mới.
- **Huy**: DATA-FIX-04 (tên trường tiếng Anh trong lỗi nhập liệu).
- **Nhân**: dùng 8 tình huống cho phiên test vai Marketer (QA-06).

## Log AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-06 | techlead | FD-11, DATA-12 | Chụp & soi giao diện, sửa 6 điểm, bộ sinh 8 tình huống + thư viện trong app | ui+data | Màu chữ thư viện quá nhạt (biến CSS không tồn tại) → ảnh chụp lộ, đổi `.muted`; sed làm hỏng cú pháp 1 dòng test → sửa | DashboardShell, CampaignChart, AnomalyFeed, InsightContent, guardrails, scenarios, SampleGallery |
