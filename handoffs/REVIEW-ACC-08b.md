# Review ACC-08b — PR #37 · Verdict: ✅ APPROVE

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ không có lỗi chặn (4 file, role techlead, task ACC-08b) |
| `npm run check` | ✅ lint sạch · typecheck sạch · Vitest 78 file, **4191 pass**, 0 fail (2 expected-fail có sẵn) |
| `npm run build` | ✅ thành công |
| Hợp đồng `domain.ts` / `10_CONTRACTS.md` | ✅ không đổi |
| Không `any`, `ts-ignore`, `console.log` | ✅ |
| Xử lý lỗi | ✅ `handleResend` bọc `try/catch`, lỗi mạng hiện qua `mapAuthError`, không còn rejection chưa bắt |
| Test nhánh lỗi | ✅ test mới: `sendVerificationOtp` reject `TypeError('Failed to fetch')` → có `role=alert`, đúng tham số gọi; dùng fake timers có `finally` khôi phục |
| UI | ✅ thêm dòng nhắc "Gửi lại mã" cho email đăng ký trước chưa xác nhận |
| Ownership | ⚠️ `AuthDialog.tsx` thuộc data-engineer (Huy), techlead sửa — đã ghi trong handoff, chấp nhận được |
| Handoff | ✅ `handoffs/ACC-08.md` cập nhật mục "Sửa sau review PR #36" |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. Test dùng vòng lặp 61 lần tua 1 giây để chờ đếm ngược — hơi chậm/nhạy; có thể gọn hơn bằng một lần `advanceTimersByTimeAsync(60_000)` nếu React cho phép.
2. Bước "đăng ký lại email chưa xác nhận" mới chỉ là dòng nhắc, chưa có test riêng cho nội dung nhắc (rủi ro thấp).
3. Chưa thử gửi thư thật; Thắng thử thủ công sau khi đặt `SMTP_USER/SMTP_PASS` trên Vercel.

## Điểm tốt
- Sửa đúng và gọn hai lưu ý không chặn của review PR #36, có test cho nhánh lỗi mạng.
- Phạm vi nhỏ, không đụng hợp đồng hay logic server.
