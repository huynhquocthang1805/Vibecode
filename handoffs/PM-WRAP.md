# Handoff — PM-WRAP · Kiểm tra deploy (AI + DB) + PM-01..07
- **Role:** pm-release + techlead   **Người:** Thắng · Claude Code   **Nhánh:** feat/techlead/PM-WRAP   **Thời gian:** 2026-11-08
- **Contracts:** không đụng code — chỉ tài liệu + TASKS ✅

## 1. Kiểm tra bản deploy sau khi gắn key AI + database
| Hạng mục | Cách kiểm | Kết quả |
|---|---|---|
| Database / tài khoản | `GET /api/account/profile`, `/api/account/data` · `POST /api/auth/sign-in/email` (email không tồn tại) | ✅ 401 · 401 · 401 `INVALID_EMAIL_OR_PASSWORD` — đã tra DB thật (không còn 503 `NOT_CONFIGURED`) |
| AI Gemini | `POST /api/insights` bằng 4 kịch bản `src/fixtures/ai-eval/*` | 🔴 lần 1: 504 TIMEOUT (16 s); sau đó 502. Sau AI-FIX-03 (#48) message lộ nguyên nhân: **429 RESOURCE_EXHAUSTED** — key/model hết hạn mức. Người dùng vẫn nhận `fallback` rule-based |

**Việc của Thắng để AI thật chạy** (rubric: AI mock tối đa 4/15):
1. Vercel → Project → **Logs** → tìm `[insights] gemini lỗi` — dòng này có thông điệp đầy đủ của Google (model nào, hạn mức nào: theo phút hay theo ngày, `limit: 0` nghĩa là model không có hạn mức miễn phí).
2. Đổi `AI_MODEL` sang model còn hạn mức (vd `gemini-2.5-flash-lite`, nhẹ và nhanh hơn — gỡ luôn lỗi 504 lần đầu) **hoặc** bật billing cho project của key trong Google AI Studio.
3. Redeploy → techlead gọi lại `/api/insights`, chạy AI-10.

## 2. PM-03 · Smoke trên deploy (main `ebe1412` + AI-FIX-03)
`BASE_URL=https://vibecode-three-xi.vercel.app npx playwright test` → **50 passed, 2 failed**. 2 ca hỏng = `account.spec` A1 trên 2 viewport: `apiRequestContext.get: getaddrinfo ENOTFOUND` — request context Node của Playwright trong môi trường cloud không đi qua proxy (trình duyệt đi được). Test A1 tự xử lý cả khi có DB lẫn không, nên trên máy thường/CI sẽ qua. PM-03 để `[~]` tới khi AI thật chạy và smoke lần cuối.

## 3. Tài liệu PM
| Task | File | Nội dung |
|---|---|---|
| PM-01 | `docs/STATUS.md`, `TASKS.md` | Trạng thái 2026-11-08; thêm AI-FIX-03 [x], **DATA-FIX-05** (6 lỗi major QA-08) và **DATA-PERF-01** (QA08-07/08) cho Huy; AI-10/PM-03/PM-05 ghi lý do còn mở |
| PM-02 | `README.md` | Viết lại đầy đủ: 5 tính năng + cách dùng, nâng cao, bộ dữ liệu test, chạy local, biến môi trường, lệnh, sơ đồ kiến trúc, bằng chứng chất lượng, cách đội làm |
| PM-04 | `docs/11_AI_USAGE_LOG.md` | Gom **79 dòng** log từ `handoffs/*.md` (tổng 99), sắp theo ngày; §3 **10 ca AI sai** có cách phát hiện + bài học; §4 5 quyết định không theo AI; §5 12 prompt tiêu biểu |
| PM-05 | `docs/12_DEMO_SCRIPT.md` | Kịch bản 5 phút theo nhãn giao diện thật + dàn ý 8 slide + lệnh smoke trước khi quay. **Còn:** quay video, làm slide (Thắng) |
| PM-06 | `docs/QA_DEFENSE.md` | 24 câu (thêm 12, sửa câu 1 vì giờ có DB tuỳ chọn) |
| PM-07 | `docs/SUBMISSION_CHECKLIST.md` | Checklist theo rubric, mỗi dòng có bằng chứng; mục còn mở ghi người làm |

Mọi nhãn giao diện trong README/kịch bản đã đối chiếu với `src/components` (grep). Các dòng "AI đề xuất" ở docs/11 §4 chỉ giữ những ca có bằng chứng trong log/handoff.

## Cần người khác làm
- **Thắng:** sửa hạn mức Gemini (mục 1) · thử G1 trên điện thoại · video + slide.
- **Hoàng Anh:** AI-10 khi hết 429 · AI-FIX-02.
- **Huy:** DATA-FIX-05 (ưu tiên BUG-QA08-01/02/06: mất dữ liệu khi storage hỏng) · DATA-PERF-01 · DATA-FIX-04.

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-08 | pm-release (Claude) | PM-01..07 | Kiểm deploy AI/DB bằng request thật, gom 79 dòng log từ handoff bằng script, viết README/kịch bản/24 câu phản biện/checklist | Sinh code | Bản nháp STATUS ghi "bug còn mở đều minor" — đối chiếu `it.fails` thấy QA-08 vừa mở 7 lỗi major → sửa + tạo DATA-FIX-05; bỏ 4 dòng "AI đề xuất" không có bằng chứng ở docs/11 §4 | `docs/STATUS.md`, `docs/11_AI_USAGE_LOG.md` |
