# Review FD + FI (Trường) — techlead · 2026-11-04

PR #7 `feat/frontend-dashboard/FD-01-MVP` đã merge (bot APPROVE). Techlead rà lại bằng **chạy app production thật trên Chromium**, nhập số liệu qua form như marketer — điều bot không làm được.

## 1. Kịch bản marketer (production build, localhost)
| Bước | Kết quả |
|---|---|
| Trang trống | ✅ "0 dòng", hướng dẫn bắt đầu, không lỗi render |
| F1 Nhập 3 dòng qua form (Thêm dòng ×2 → điền → Lưu 3 dòng) | ✅ lưu, "3 dòng"; **reload vẫn còn** (localStorage) |
| Validation inline click > reach | ✅ "Số click không thể lớn hơn reach" ngay dưới ô |
| F3 KPI (31.000 reach · 680 click · 3,7tr · 28 đơn) | ✅ CTR 2,19% · CPC 5.441 ₫ · CPA 132.143 ₫ — **khớp tính tay, đúng tỉ số của tổng** · ❌ R-01 (giá trị ↔ delta lệch kỳ) |
| F2 Biểu đồ Reach / Chi phí / Đơn | ✅ ECharts (renderer SVG) đủ 3 series, 2 trục, 29–31/10; có `lttb`, `progressive`, `dataZoom`, tắt animation > 2000 điểm |
| F4 AI | ✅ card hiện nhãn **"Dự phòng"** + gợi ý khi không có key (502 kèm fallback) · ❌ R-02 (gọi AI lúc trang trống → 400) · ❌ R-03 (mỗi lần gửi 2 request trùng) |
| F5 Xuất báo cáo | ⏳ dialog Ngắn/Đầy đủ, Sao chép, Tải .txt mở được; báo "Tạo báo cáo chưa sẵn sàng" vì **AI-08 (Thắng 2) chưa có** — xử lý êm, không crash |
| 375px | ✅ không tràn ngang |
| Màu tốt/xấu | ✅ theo `higherIsBetter` (CPA/CPC ▲ = xấu, cost trung tính) |

## 2. Lỗi (test chạy được: `tests/integration/fd-review.review.test.tsx`, đánh `it.fails`)
| Mã | Mức | Owner | Lỗi | Cách sửa |
|---|---|---|---|---|
| R-01 | **Trung bình** | Trường (FD-02) | `KpiCards` hiện **tổng cả khoảng ngày** (`totals`) nhưng delta là **kỳ cuối vs kỳ trước** (`comparison`). "Đơn hàng 28 ▼ 50%": 28 = 3 ngày, −50% = 31/10 vs 30/10. Ngay fixture mẫu: "692 · 0%" (692 = 30 ngày, 0% = 01/11 vs 31/10). Marketer hiểu sai. | Giá trị chính = `comparison.current` (khớp delta); dòng phụ "Tổng kỳ đã chọn: …" = `totals`. Không có comparison → hiện `totals` + "— Chưa có so sánh". |
| R-02 | **Cao** | Hoàng Anh (AI-06) + Trường (FD-05) | Mở trang **chưa có dữ liệu** → `useInsights` tự POST `/api/insights` với `range:{from:"",to:""}` → **400 BAD_REQUEST** (thấy thật trong trình duyệt). Vi phạm E26 (< 3 ngày không gọi). | AI-06: trong effect, bỏ qua khi `!snap.trend?.dataQuality.sufficient` (refresh tay cũng chặn). FD-05: truyền `null` cho hook khi `!enough`. |
| R-03 | Trung bình | Hoàng Anh (AI-06) | `DashboardPage` (cho nút xuất) và `AiInsightCard` cùng gọi `useInsights(snapshot)` → **2 request trùng** cách nhau 2 ms mỗi lần phân tích → dùng gấp đôi hạn mức 10 req/phút, hết quota Gemini nhanh gấp đôi. | Gộp request đang bay theo `cacheKey` ở mức module (Map<key, Promise>) + chia sẻ kết quả giữa các instance. |
| R-04 | Thấp | Hoàng Anh (AI-06) | Effect phụ thuộc **object** `snap`: caller truyền object mới mỗi render → gọi liên tục (đo: 60 request / 50 ms). App hiện an toàn vì snapshot ổn định, nhưng giống hệt lỗi vòng lặp R-01 của PR #4. | Khoá effect theo `cacheKey` + `revision` thay vì object. |
| R-05 | Thấp | Trường | Hard-code tên **"Minh Trường" / "MT"** ở sidebar + topbar của sản phẩm. | Bỏ, hoặc hiện tên chiến dịch đang chọn. |
| R-06 | Thấp (P1, TL-07) | Trường | **JS tải lần đầu 297 KB gzip** > ngân sách 250 KB (docs/01 §5). `reviewFixture.json` nằm trong chunk đầu (~30 KB gzip) dù chỉ dùng khi bấm "Xem giao diện mẫu". ECharts 377 KB đã lazy ✅. | `import()` fixture khi bật preview; renderer `canvas` khi > ~1.000 điểm (SVG chậm với dữ liệu lớn). |

## 3. Lưu ý không chặn
- `DashboardShell` làm nhiều hơn "chỉ bố cục" (bộ lọc chiến dịch, khoảng ngày, preview, bắt lỗi toàn cục) — chấp nhận, giữ đúng props slot.
- `dashboard.css` 1.273 dòng CSS riêng song song Tailwind — nên dọn dần, không thêm.
- AI gửi `campaignName: "all"` khi xem tất cả chiến dịch → nên đổi thành "Tất cả chiến dịch" (AI-07/TL-06).
- Ảnh chụp ~2 MB trong `handoffs/FD-01-MVP/screens/` — ok làm bằng chứng, đừng thêm nhiều.

## 4. Điểm tốt
Giao diện chạy được end-to-end với store/worker thật ngay lần đầu; validation inline, xác nhận thao tác phá huỷ, trạng thái rỗng/lỗi/tải đủ; nhãn "Dự phòng" trung thực; preview tách bạch dữ liệu thật; 31 test component + bằng chứng build/check/ảnh.
