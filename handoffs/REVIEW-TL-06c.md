# REVIEW — TL-06c (PR #29) · APPROVE

Reviewer: techlead (Claude) · 2026-11-05 · nhánh `feat/techlead/TL-06c`

## Vòng 1 — APPROVE

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` | ✅ lint 0 warning · typecheck ✅ · 70 file / **4.056 test pass, 0 fail** |
| `npm run build` | ✅ build thành công, đủ route |
| Đúng hợp đồng (`domain.ts`, docs/10 §E) | ✅ không đổi kiểu public; chỉ thêm `readonly model` public ở provider |
| Test nhánh lỗi / ca biên | ✅ `systemPrompt.test.ts` 6 ca (thiếu AI_MODEL, model chỉ định, stub, model rỗng/không phải string); `route.prompt.test.ts` so khớp system prompt với `buildSystemPrompt()` |
| Handoff + log AI | ✅ `handoffs/TL-06c.md` |
| Ownership | ✅ techlead làm thay ai-engineer, đã ghi rõ trong handoff |
| E2E | ✅ gỡ `test.fail` F5 đúng (AI-08 đã chạy thật); handoff báo 20/20 (không chạy lại ở review này) |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. `AI_TEMPERATURE` chỉ dùng cho lần gọi đầu; lần repair vẫn dùng 0 ở route — comment đã nêu, ổn.
2. `SYSTEM_PROMPT_WITH_EXAMPLES` trong route tính một lần ở module-level — ổn vì prompt tĩnh.
3. Nên thêm `e2e (Playwright · desktop + iPhone 12)` vào required checks của `main` (Thắng làm trong Settings) để tránh lặp lại sự cố PR #28.
4. AI-10 (eval Gemini thật) và bước thử tay G1 trên điện thoại vẫn còn mở — không thuộc PR này.

## Điểm tốt
- Một nguồn duy nhất cho system prompt/temperature/nhãn model giữa route và `eval-ai` → eval đo đúng thứ production gửi.
- Nhãn model giờ là model thật (`gemini-flash-latest@v1.2`) kể cả khi thiếu `AI_MODEL`.
- Handoff rõ ràng, nêu cả việc người khác cần làm.
