# ACC-08 — Xác nhận đăng ký bằng mã 6 số gửi qua Gmail (+ ACC-FIX-03 origin Vercel)

Người làm: Thắng (techlead) · Claude · 2026-11-06 · nhánh `feat/techlead/ACC-FIX-03` · yêu cầu chủ dự án: "đăng ký sẽ có Gmail gửi token về xác nhận, dán vào"

## Đã làm
**ACC-08** (docs/14 §8)
- `lib/server/mailer.ts`: gửi SMTP bằng `nodemailer` 10.1.7 (ghim bản > 2 tuần), mặc định Gmail 465; thư tiếng Việt (tiêu đề có mã, hạn 10 phút, không có link); `describeMailError` gợi ý sửa (EAUTH → Mật khẩu ứng dụng…). Bật khi có `SMTP_USER` + `SMTP_PASS`.
- `lib/server/auth.ts`: plugin `emailOTP` (6 số, 10 phút, 5 lần sai, `storeOTP: 'hashed'`, gửi khi đăng ký), `requireEmailVerification`, gửi lại khi đăng nhập chưa xác nhận, `autoSignInAfterVerification`. Thiếu SMTP → tắt hết, hành vi cũ.
- `lib/auth-client.ts`: `emailOTPClient()`.
- `AuthDialog`: bước "Xác nhận email" (ô 6 số chỉ nhận số, `inputMode=numeric`, `autocomplete=one-time-code`, ≥ 44 px), Gửi lại mã (đếm 60 s), Đổi email, nhắc kiểm tra Spam; `authErrors` thêm 4 mã lỗi tiếng Việt.
**ACC-FIX-03**: `authTrustedOrigins()` — đăng ký từ địa chỉ deploy Vercel (vd `vibecode-cbcr1e01c-…vercel.app`) hết 403 "Invalid origin"; chỉ thêm đúng host của project, không wildcard.

## Test
- `emailOtp.test.ts` — better-auth thật trên PGlite, transport giả: đăng ký không có phiên + thư có mã · đăng nhập chưa xác nhận 403 + mã mới · sai mã 400 · đúng mã 200 có phiên · sau đó đăng nhập bình thường, không gửi thêm.
- `AuthDialog.otp.test.tsx` 5 ca · `mailer.test.ts` 4 ca · `accountConfig.test.ts` +3 ca origin.
- Server thật: origin deploy 200, origin app lạ 403 `INVALID_ORIGIN`; SMTP không tới được → log `[mailer]…`, không crash.
- Không gửi được thư thật từ môi trường cloud (không có mật khẩu ứng dụng, không ra SMTP) → **Thắng thử thật sau khi đặt biến**.

## Bật trên Vercel (Thắng)
1. Gmail `quocthanghuynh180504@gmail.com` → https://myaccount.google.com/security → bật **Xác minh 2 bước** → https://myaccount.google.com/apppasswords → tạo mật khẩu ứng dụng tên "KPI Mini" → copy 16 ký tự.
2. Vercel → Settings → Environment Variables (Production + Preview): `SMTP_USER` = `quocthanghuynh180504@gmail.com` · `SMTP_PASS` = 16 ký tự vừa tạo (bật **Sensitive**).
3. Redeploy → đăng ký bằng email thật → nhận thư "xxxxxx là mã xác nhận đăng ký KPI Mini" → dán mã. Không có thư → xem Spam; Vercel → Logs lọc `[mailer]`.

## Cần người khác làm
- **Huy**: review (file của data-engineer). **Trường**: có thể chỉnh giao diện bước nhập mã qua CR.

## Log AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-06 | techlead (phần data-engineer) | ACC-08, ACC-FIX-03 | emailOTP + Gmail SMTP, bước nhập mã, test PGlite; trusted origins Vercel | feature | Phát hiện better-auth nuốt lỗi gửi thư → thêm log gợi ý + nhắc Spam; selector test trùng tên nút → sửa test | auth.ts, mailer.ts, AuthDialog.tsx, accountConfig.ts |
