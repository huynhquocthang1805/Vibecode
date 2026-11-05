# TL-06b — Rà soát tích hợp sau BA-03 (AI thật + bundle)

Người làm: Thắng (techlead) · Claude · 2026-11-05 · nhánh `feat/techlead/TL-06b`

## Rà soát main (8845ec2)
lint/typecheck ✅ · 4.008 test ✅ (0 `it.fails`) · build ✅ · E2E 20/20 (còn `test.fail` F5 = AI-08) · stub còn lại: AI-08.

## Lỗi tìm thấy & đã sửa
| # | Lỗi | File | Sửa |
|---|---|---|---|
| 1 | Route không gửi `FEW_SHOT` cho model (docs/05 §4) | `app/api/insights/route.ts` | Nối ví dụ vào cuối system prompt, ghi rõ "chỉ minh hoạ, không dùng số của ví dụ" |
| 2 | `buildUserPrompt` lỗi → gửi `JSON.stringify(req)` thô (không escape `</data>` → mở lại E28) | như trên | Bỏ đường dự phòng (hàm BA-03 pure, không ném) |
| 3 | Nhãn model viết cứng `<provider>@v1.0` | như trên | `${AI_MODEL}@${PROMPT_VERSION}` (docs/05 §5) |
| 4 | Gemini mặc định `gemini-1.5-flash` (dòng đã ngừng) → thiếu `AI_MODEL` là AI thật luôn lỗi | `lib/ai/provider/gemini.ts` | `gemini-flash-latest` (khớp `.env.example`); `AI_MODEL=""` cũng dùng mặc định |
| 5 | Bundle đầu 276.754 B > 250 KB — better-auth nằm trong bundle đầu dù khách không dùng (review PR #23 giao techlead) | `app/DashboardPage.tsx` | `dynamic()` cho AccountMenu, EntryTable, DataManager, ForecastPanel, AnomalyFeed → **256.139 B** gzip modern (brotli 217 KiB) |

Không sửa nội dung prompt (BA-03) → không tăng `PROMPT_VERSION`. `npm run eval:ai` (mock, không có key) 8/8 — **chưa phải bằng chứng Gemini thật** → AI-10.

## Test
`route.prompt.test.ts` 4 ca: system = prompt + few-shot, không TODO · user escape `</data>`/`<script>` · `model = gemini-flash-latest@v1.2`, đúng 3 gợi ý · Gemini mặc định. Toàn bộ: 4.012 test ✅, E2E 20/20 (nhanh hơn 47,7 s → 35,6 s).

## Cần người khác làm
- **Thắng 2 — AI-08** (chặn G1).
- **Hoàng Anh — AI-10**: eval Gemini thật; review phần đổi ở route/gemini.ts.
- **Huy — ACC-FIX-01**: `betterAuth()` khởi tạo lười.
- **Trường — FD-10**: còn ~6 KB; đề xuất CR: validation phía client dùng `zod/mini` (Huy) hoặc tách `Toaster`.
- **Thắng**: đặt `AI_API_KEY`, `AI_MODEL=gemini-flash-latest` trên Vercel (Production).

## Log AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-05 | techlead | TL-06b | Quét main, tìm 5 lỗi tích hợp, sửa + test, đo bundle 3 vòng | review+fix | Đo bundle lần đầu tính cả polyfill `noModule` (38 KB) → đo lại chỉ script modern | route.ts, gemini.ts, DashboardPage.tsx |
