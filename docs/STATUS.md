# STATUS — 2026-11-03

Owner: pm-release (Thắng + Claude). Mục tiêu duy nhất hiện tại: **Gate G1 — 5 tính năng P0 chạy xuyên suốt**. P1/P2 tạm dừng.

## Tiến độ P0 tới G1: 12 / 36 task (33%)
| Người | Xong | Còn lại (P0) | Trạng thái |
|---|---|---|---|
| Thắng + Claude | TL-01..04 | TL-05 (review liên tục), TL-06 (ghép + G1), PM-01 | 🟢 |
| Huy · Gemini | DATA-01..04, DATA-FIX-01, FC-01 | **DATA-05-lite**, DATA-04b | 🟢 nhanh, chất lượng tốt |
| Nhân · ChatGPT | BA-01, BA-05; BA-03 *đặc tả* | **BA-03 code** (đã có 9 test chờ sẵn), BA-02, BA-04, QA-01 | 🟡 đặc tả rất kỹ nhưng chưa ra code — cần chuyển sang viết code |
| Hoàng Anh · Gemini | — | AI-01..08 (8 task) | 🔴 **chưa có nhánh nào** |
| Trường · ChatGPT | — | FD-01/02/03/05/06, FI-01/02/05 (8 task) | 🔴 **chưa có nhánh nào** |

## Đã merge 2026-11-03
- **BA-03 đặc tả** (Nhân) — `docs/BA-03.md`; techlead tạo 9 test nghiệm thu (`ba03-prompt.review.test.ts`), chốt RISK-01..06, CR-004 thêm `InsightRequest.forecastConfidence?`.

## Đã merge 2026-11-02
- **DATA-01..04 + FC-01** (Huy) — 71/71 ca fixture BA-01; review tìm 5 lỗi R-01..R-05.
- **DATA-FIX-01** (Huy) — sửa đủ R-01..R-05 + hydrate tăng revision. Kiểm: 5 múi giờ, tuần ISO khớp Python 7.670/7.670 ngày, 1.000 chuỗi thao tác store ngẫu nhiên.
- **BA-05** (Nhân) — `gen:mock` tái lập fixture trùng từng byte; `demo-30d` có diễn biến rõ cho AI (CTR 2,78% → 1,59%, CPA ×2 cuối kỳ).
- Toàn repo: **3.000+ test xanh**, build xanh, CI xanh.

## Đường găng tới G1
```
DATA-05-lite (Huy) ──┬─► FD-02 thẻ KPI, FD-03 biểu đồ (Trường) ──┐
                     └─► AI-07 payload → AI-02 route → AI-06 hook (Hoàng Anh) ─► FD-05 card AI ─┤─► TL-06 ghép ─► G1
BA-03 prompt (Nhân) ─► AI-03 provider, AI-04 guardrail ──────────────────────────────────────┤
BA-04 mẫu báo cáo (Nhân) ─► AI-08 buildReport ─► FD-06 nút xuất ──────────────────────────────┘
FI-01 form, FI-02 bảng (Trường) — store thật đã sẵn sàng, làm được NGAY
```

## Rủi ro
1. 🔴 **Hoàng Anh và Trường chưa push gì** — 16/24 task P0 còn lại nằm ở 2 người này. Cần hỏi ngay tình hình; nếu bị chặn → chia bớt sang cửa sổ AI thứ 2 (luồng 5, 7 trong kế hoạch song song) hoặc Claude nhận.
2. 🟡 Chưa có link Vercel preview (G1 cần).
3. 🟡 Nhân/Huy push nhánh nhưng không mở PR → nhờ mở PR để lưu vết review trên GitHub.

## Quyết định cần chủ dự án
- Có chuyển một phần việc của Trường (FI-01/02/05) hoặc Hoàng Anh (AI-08) sang người khác/Claude không, nếu đến tối nay 2 bạn vẫn chưa có nhánh?
