# 12 — Kịch bản demo (~5 phút) + dàn ý slide

Owner: `pm-release`. Cập nhật 2026-11-08 theo bản deploy hiện tại.
Quay trên https://vibecode-three-xi.vercel.app, **cửa sổ ẩn danh** (dữ liệu sạch), màn 1280px + 1 đoạn trên điện thoại thật.

## A. Kịch bản quay
| Phút | Nội dung | Thao tác (đúng nhãn trên giao diện) | Ăn điểm |
|---|---|---|---|
| 0:00–0:20 | Vấn đề | "Marketer không rành Excel vẫn cần đọc CTR/CPA mỗi ngày và báo cáo sếp" — trang đầu có khối **Bắt đầu nhanh** | — |
| 0:20–1:10 | F1 nhập liệu | Tab **Nhập tay**: nhập 3 ngày · cố nhập click > reach → bị chặn có lời nhắc tiếng Việt · tab **Dán Excel**: dán 7 dòng · trùng ngày → chọn **Cộng dồn** · F5 → dữ liệu còn | Chức năng, kiểm thử |
| 1:10–1:40 | F2 + F3 | Thẻ KPI CTR/CPC/CPA có ▲▼ so kỳ trước; rê chuột xem công thức; biểu đồ reach/chi phí/đơn | Chức năng |
| 1:40–2:20 | Dữ liệu lớn | **Quản lý dữ liệu → Bộ dữ liệu test → Dữ liệu lớn 50.000 dòng → Dùng ngay** → UI không đơ; chuyển **Ngày → Tuần → Tháng → Quý**; kéo zoom biểu đồ | Kỹ thuật |
| 2:20–2:55 | Dự báo | Nạp **3 chiến dịch × 2 năm**: dải dự báo + khoảng tin cậy, "Dự kiến cuối tháng / cuối quý", nhãn mô hình + sai số backtest | Kỹ thuật |
| 2:55–3:30 | Realtime | Chọn tốc độ **×60** → bật **Live mô phỏng** → KPI hôm nay + nowcast nhảy theo, cảnh báo bất thường hiện ra; mở tab 2 cùng trang → nhập ở tab 1 thấy ngay ở tab 2 | Kỹ thuật |
| 3:30–4:15 | F4 AI | Nạp **CPA tăng vọt** → bấm **Phân tích** → headline + 3 gợi ý cụ thể nhắc đúng CPA; chỉ nhãn model `gemini-…@v…` và "đã đối chiếu số liệu" | Tích hợp AI |
| 4:15–4:40 | F5 báo cáo | Xuất báo cáo → mẫu **Ngắn** → **Sao chép** → dán vào Zalo/Notepad | Chức năng |
| 4:40–5:00 | Mobile + kết | Điện thoại: nhập 1 dòng, xem dashboard 375px · nhắc link, repo, 9 vai agent trong `.claude/agents/`, nhật ký AI | UI, bàn giao, vibe coding |

**Chuẩn bị trước:** chạy smoke ở mục C; Gemini còn quota (nếu thẻ AI hiện **Dự phòng** thì nói đúng tính năng: "khi AI lỗi, người dùng vẫn có 3 gợi ý"); quay dự phòng từng đoạn; tắt thông báo máy.

## B. Dàn ý slide (8 slide)
1. **Tiêu đề** — KPI Mini · Đề 7 · 5 người · link deploy + QR.
2. **Vấn đề & người dùng** — marketer nhỏ, không rành Excel, cần đọc CTR/CPC/CPA và báo cáo hằng ngày.
3. **5 tính năng P0** — ảnh chụp từng tính năng (dùng `docs/screens/`).
4. **Kiến trúc** — sơ đồ trong README: store → worker (rollup tăng dần, dự báo) → dashboard; `/api/insights` → Gemini → guardrail → fallback.
5. **Dữ liệu lớn & realtime** — số đo `docs/perf-report.md` (100k rollup 89 ms, 200k IndexedDB 2,4 s), Live, đồng bộ tab.
6. **AI đáng tin** — đúng 3 gợi ý, đối chiếu số, chống injection, fallback; kết quả `docs/ai-eval-report.md`.
7. **Cách đội làm với AI** — 3 hệ AI, ownership, hợp đồng đóng băng, PR guard + bot review; 2–3 ca AI sai nổi bật (`docs/11` §3).
8. **Kiểm thử & kết** — ≈ 4.260 unit/integration test, e2e desktop + iPhone, lỗi còn mở trung thực (`docs/bugs.md`); cảm ơn + hỏi đáp (`docs/QA_DEFENSE.md`).

## C. Smoke trước khi quay (5 phút)
```bash
BASE_URL=https://vibecode-three-xi.vercel.app PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test tests/e2e/g1-smoke.spec.ts --trace off
```
Rồi thử tay trên điện thoại: nhập 3 ngày → Phân tích → Xuất báo cáo → Sao chép → dán Zalo.
