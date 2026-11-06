# REVIEW — ACC-08 + ACC-FIX-03 (PR #36) — Vòng 1: **APPROVE**

Người review: techlead (Claude) · 2026-11-06 · Nhánh `feat/techlead/ACC-08-ACC-FIX-03`

## Bảng kiểm tra
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (16 file, role techlead, task ACC-08, ACC-FIX-03) |
| `npm run check` | ✅ lint sạch · typecheck sạch · Vitest 78 file, **4190 pass**, 0 fail (2 expected-fail có sẵn) |
| `npm run build` | ✅ thành công, không còn lỗi/cảnh báo auth khi thiếu cấu hình |
| Hợp đồng `domain.ts` / `10_CONTRACTS.md` | ✅ không đổi chữ ký; `authClient`/`auth`/`requireUser` giữ nguyên tên |
| Không `any`, `ts-ignore`, `console.log` | ✅ chỉ có `console.error('[mailer] …')` có chủ đích, không ghi mã/mật khẩu |
| Bảo mật | ✅ OTP băm (`storeOTP: 'hashed'`), 6 số/10 phút/5 lần sai; SMTP chỉ ở server; không secret trong repo (`.env.example` chỉ để trống `SMTP_PASS`); trusted origins đúng host Vercel, không wildcard |
| Local-first (docs/14 §1.2) | ✅ thiếu `SMTP_USER/SMTP_PASS` → plugin và `requireEmailVerification` tắt, đăng ký như cũ; khách vẫn dùng đủ P0 |
| Test nhánh lỗi/ca biên | ✅ OTP sai 400 · đăng nhập chưa xác nhận 403 + mã mới · không phiên trước khi xác nhận · env hỏng/rỗng/wildcard · lỗi SMTP · SMTP tắt (token có) |
| UI | ✅ trạng thái tải/lỗi/thông tin, nút ≥ 44 px, `inputMode=numeric`, `one-time-code`, đếm ngược gửi lại |
| Ownership | ⚠️ file `data-engineer` (Huy) do techlead sửa — đã ghi rõ trong handoff và nhờ Huy review (chấp nhận được) |
| Handoff + log AI | ✅ `handoffs/ACC-08.md` (có phần ACC-FIX-03) |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. `AuthDialog.tsx` `handleResend`: không có `try/catch` quanh `sendVerificationOtp` — mạng đứt sẽ thành promise rejection chưa bắt, nên nên bọc và hiện `mapAuthError`.
2. Đăng ký lại cùng email khi tài khoản chưa xác nhận sẽ gặp "đã tồn tại": nên gợi người dùng dùng Đăng nhập để nhận mã mới (hiện nút "← Đổi email" chỉ quay lại form đăng ký).
3. Handoff ghi nhánh `feat/techlead/ACC-FIX-03`, thực tế là `feat/techlead/ACC-08-ACC-FIX-03` — chỉ là chữ.
4. Chưa gửi thư thật được trong môi trường CI: Thắng cần thử thủ công sau khi đặt `SMTP_USER/SMTP_PASS` trên Vercel (đã nêu trong handoff).
5. `nodemailer` ghim chính xác `10.1.7` (có lockfile + integrity) — tốt; xin techlead duyệt thêm thư viện đã thoả vì chính techlead là tác giả PR.
6. `auth.ts` vẫn khởi tạo `betterAuth()` lúc import (ACC-FIX-01 đang mở, không thuộc PR này).

## Điểm tốt
- Test tích hợp chạy better-auth thật trên PGlite với transport giả, đi hết luồng đăng ký → 403 → sai mã → đúng mã → đăng nhập thường.
- Phát hiện better-auth nuốt lỗi gửi thư nên đã thêm log chẩn đoán có gợi ý tiếng Việt (`describeMailError`) mà không lộ bí mật.
- `authTrustedOrigins` là hàm thuần, dễ test, tránh wildcard `*.vercel.app`.
- Thư không chứa link (giảm nguy cơ bị coi là phishing), nội dung tiếng Việt, có hạn dùng.
