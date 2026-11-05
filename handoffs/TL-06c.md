# TL-06c — Sau AI-08: E2E main hết đỏ + eval đo đúng production (làm thay phần ai-engineer)

Người làm: Thắng (techlead) · Claude · 2026-11-05 · nhánh `feat/techlead/TL-06c`

## Quét main (9fd7d46)
lint/typecheck ✅ · 69 file · 4.050 test ✅ · build ✅ · không còn stub. **E2E đỏ 2 ca**: F5 "Expected to fail, but passed" — AI-08 đã chạy nhưng `test.fail` chưa gỡ. PR #28 vẫn merge vì e2e không nằm trong required checks.

## Đã sửa
| # | Lỗi | Sửa |
|---|---|---|
| 1 | E2E F5 đỏ trên main | Gỡ `test.fail` (`tests/e2e/g1-smoke.spec.ts`) → F5 là test thường: **20/20** |
| 2 | `eval-ai` gửi `SYSTEM_PROMPT_VI` **không có few-shot**, `temperature 0.2` — khác production (TL-06b) → AI-10 sẽ đo sai bản đang chạy | `src/lib/ai/systemPrompt.ts`: `buildSystemPrompt()` + `AI_TEMPERATURE` dùng chung cho route và `scripts/eval-ai.ts` |
| 3 | Nhãn model = `AI_MODEL \|\| provider.name` → thiếu `AI_MODEL` hiện `gemini@v1.2` (lưu ý #1 review PR #27) | `modelLabel(provider)` đọc `provider.model` (Gemini/OpenAI để `model` public readonly) → `gemini-flash-latest@v1.2` |

Đã kiểm tra lưu ý cũ: R-05 `useInsights` (kết quả cũ ghi đè key mới) — Hoàng Anh đã sửa + 3 test ở vòng 2 AI-FIX-01 ✅.

## Test
`systemPrompt.test.ts` 6 ca (đủ few-shot, deterministic, temperature, nhãn mặc định Gemini/OpenAI, model chỉ định, stub/rỗng) · `route.prompt.test.ts` system === `buildSystemPrompt()` · `npm run eval:ai` (mock) 8/8 · E2E 20/20 · build ✅.

## Cần người khác làm
- **AI-10 (Hoàng Anh hoặc Thắng)** — runner đã sẵn sàng, chỉ thiếu key: `AI_API_KEY=… AI_MODEL=gemini-flash-latest npm run eval:ai` → commit `docs/ai-eval-report.md` (bản thật, không còn cảnh báo mock).
- **Thắng**: GitHub → Settings → Branches → rule `main` → thêm required check `e2e (Playwright · desktop + iPhone 12)`; bước thử tay G1 (handoffs/GATE-G1.md lần 3).

## Log AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-05 | techlead (làm phần ai-engineer) | TL-06c | Quét main sau AI-08, phát hiện E2E đỏ + eval lệch production, tách module prompt dùng chung | review+fix | — | systemPrompt.ts, route.ts, eval-ai.ts, g1-smoke.spec.ts |
