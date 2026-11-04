# REVIEW — ACC-01 + ACC-02 (PR #17) — Vòng 1 — **APPROVE**

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không lỗi chặn |
| `npm run check` | ✅ lint + typecheck sạch; vitest 50 file, 3831 pass, 11 expected fail, 0 fail |
| `npm run build` | ✅ xanh, đủ route `/api/auth/[...all]`, `/api/account/*` |
| Ownership | ✅ chỉ file của data-engineer (`lib/server/**`, `drizzle/**`, `app/api/auth/**`, `lib/auth-client.ts`) + handoff |
| Hợp đồng (§I) | ✅ `auth`, `requireUser`, `authClient`, `getDb` đúng chữ ký; 503 `NOT_CONFIGURED` khi thiếu cấu hình |
| Không `any`/`ts-ignore`/`console.log`, không secret | ✅ |
| Test ca lỗi/biên | ✅ A1 (thiếu cấu hình), A3 (mk ngắn, email sai, trùng, sai mk không lộ email), A4 (429 lần 11), A5 (đăng xuất → 401), A11 cascade |
| Handoff + log AI | ✅ `handoffs/ACC-01.md`, `ACC-02.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- R-01 (Thấp) `src/lib/server/auth.ts:18`: secret dự phòng cứng khi thiếu `BETTER_AUTH_SECRET`. Hiện an toàn vì mọi route chặn bằng `accountConfigured()`, nhưng nên bỏ fallback (hoặc chỉ dùng khi không phải production) ở task sau.
- R-02 (Thấp) `rateLimit.storage: 'memory'` trên Vercel serverless chỉ giới hạn theo từng instance; `x-forwarded-for` có thể bị giả. Chấp nhận cho quy mô đồ án; cân nhắc `storage: 'database'` nếu cần chặt hơn.
- R-03 (Thấp) A3 yêu cầu lỗi tiếng Việt: better-auth trả thông điệp tiếng Anh; ACC-05 (UI) cần ánh xạ mã lỗi sang tiếng Việt.
- `auth` gọi `getDb()` ngay khi import; ổn vì `getDb()` lười + fallback PGlite memory khi build.
- Neon: `ensureMigrated()` không làm gì — migration phải chạy bằng `npm run db:migrate` (ACC-07).

## Điểm tốt
- Harness PGlite chạy được toàn bộ luồng auth thật, không cần DB ngoài.
- Thông điệp lỗi đăng nhập không lộ email tồn tại; cascade xoá user được test.
- Build không cần DB, đúng nguyên tắc "tài khoản chỉ là phần thêm".
