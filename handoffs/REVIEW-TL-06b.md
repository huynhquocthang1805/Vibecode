# REVIEW — TL-06b (PR #27) · Verdict: ✅ APPROVE

## Vòng 1 · techlead (Claude)

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn |
| `npm run check` (lint + typecheck + test) | ✅ lint 0 warning · typecheck sạch · **67 file, 4.012/4.012 test pass** |
| `npm run build` | ✅ thành công, 9 route. Còn log `BetterAuthError: default secret` + cảnh báo baseURL — lỗi có sẵn trên `main`, đã có task ACC-FIX-01 (Huy), không do PR này |
| Hợp đồng (`domain.ts`, docs/10) | ✅ không đổi chữ ký/kiểu; chỉ sửa nội bộ route, provider, trang ghép |
| Ownership | ✅ `route.ts`, `gemini.ts` (ai-engineer) do techlead sửa, đã khai trong handoff và nhờ Hoàng Anh review (AI-10); `DashboardPage.tsx` thuộc techlead |
| Test ca lỗi/ca biên | ✅ `route.prompt.test.ts` 4 ca: system = prompt + few-shot (không TODO) · user escape `</data>`/`<script>` (E28) · nhãn model `AI_MODEL@PROMPT_VERSION` + đúng 3 gợi ý · Gemini mặc định khi `AI_MODEL` thiếu hoặc rỗng |
| Handoff + log AI | ✅ `handoffs/TL-06b.md` đủ bảng lỗi, việc giao người khác, log AI |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
1. `modelName: process.env.AI_MODEL || provider.name`: khi `AI_MODEL` thiếu, nhãn là `gemini@v…` thay vì `gemini-flash-latest@v…` (nhãn chưa phản ánh model mặc định thật). Nên dùng chung hằng mặc định với `gemini.ts` ở AI-10.
2. Bundle đầu 256.139 B vẫn > 250 KB (~6 KB). Đã ghi ở FD-10, chờ CR dùng `zod/mini` hoặc tách `Toaster`.
3. `eval:ai` 8/8 chỉ chạy bằng mock; cần AI-10 mới có bằng chứng Gemini thật. Thắng cần đặt `AI_API_KEY` và `AI_MODEL` trên Vercel.
4. Bỏ đường dự phòng `JSON.stringify(req)` dựa vào việc `buildUserPrompt` không ném. Nếu BA sửa hàm này theo hướng có thể ném, lỗi sẽ thành 500 từ route (có `try` bao ngoài nên chưa kiểm tra) — nên có test khi đổi.
5. Gate G1 vẫn còn AI-08 (Thắng 2).

### Điểm tốt
- Sửa gốc lỗ prompt injection (đường dự phòng JSON thô không escape) thay vì vá triệu chứng.
- Few-shot được ghi rõ "chỉ minh hoạ, không dùng số của ví dụ" — chống model chép số.
- Chia nhỏ bundle bằng `dynamic()` có skeleton giữ chỗ, không xô layout; E2E 20/20 và nhanh hơn (47,7 → 35,6 s).
- Handoff trung thực: nêu rõ eval mock chưa phải bằng chứng Gemini thật và phép đo bundle lần đầu sai.
