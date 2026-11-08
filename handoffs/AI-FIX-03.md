# Handoff — AI-FIX-03 · Chẩn đoán lỗi Gemini trên deploy (key qua header, mã lỗi + gợi ý)
- **Role:** ai-engineer (techlead làm thay theo yêu cầu chủ dự án)   **Người:** Thắng · Claude Code   **Nhánh:** feat/techlead/AI-FIX-03   **Thời gian:** 2026-11-08
- **Contracts:** không đổi `InsightError` (chỉ nội dung `message`), không đổi chữ ký provider ✅

## Bối cảnh
Thắng đã gắn `AI_API_KEY` trên Vercel. Gọi thử `POST /api/insights` trên https://vibecode-three-xi.vercel.app bằng 4 kịch bản eval:
- Lần 1: **504 TIMEOUT** sau 16 s (lần gọi đầu 15 s + retry hết ngân sách 20 s).
- 3 lần sau: **502 PROVIDER_ERROR** trong 1–4 s, message chung chung "Lỗi phản hồi từ nhà cung cấp AI hoặc chưa có API key" → không biết là key sai, hết quota (429), model sai (404) hay quá tải (503). Route không ghi log nên Vercel Logs cũng không có gì.

## Đã làm
- `provider/gemini.ts`: key gửi qua header `x-goog-api-key` thay vì `?key=` trên URL (URL hay bị ghi log/proxy). Lỗi upstream rút gọn thành `mã HTTP + error.status + error.message` của Google (≤ 200 ký tự, không chứa key).
- `provider/errors.ts` (mới): `providerHint(detail)` → gợi ý tiếng Việt theo mã: thiếu key / 429 hết hạn mức / 400 key sai / 403 / 404 model / 5xx quá tải.
- `app/api/insights/route.ts`: khi lỗi provider → `console.error('[insights] gemini lỗi: …')` (xem được ở Vercel → Logs) và `message` kèm gợi ý, ví dụ "Lỗi phản hồi từ nhà cung cấp AI (429) — hết hạn mức gọi của key/model…". Người dùng vẫn nhận `fallback` như cũ.

## Kiểm thử
- `src/lib/ai/provider/provider.test.ts` +4 test: key không có trong URL, có trong header · 429 → message đúng mã/trạng thái + gợi ý · bảng gợi ý 6 nhánh · body không phải JSON bị cắt.
- `src/lib/ai` + `tests/integration/insights-api` + `security-api`: 119 passed + 1 expected fail (BUG-QA03-01).

## Cần người khác làm
- Sau khi merge + Vercel deploy xong: techlead gọi lại `/api/insights` trên deploy, đọc mã lỗi thật rồi sửa tiếp (key/quota/model/timeout).

## Ghi chú dùng AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-08 | ai-engineer (techlead làm) | AI-FIX-03 | Gọi thử API AI trên deploy, phát hiện lỗi bị nuốt mất nguyên nhân; thêm mã lỗi + gợi ý + log server, chuyển key sang header | AI sai → sửa | Bản gốc của AI ghi key vào query string và trả message chung chung cho mọi lỗi | `gemini.ts`, `route.ts`, `errors.ts` |
