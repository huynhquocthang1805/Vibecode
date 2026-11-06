# REVIEW QA-07 — Kiểm tra bảo mật nhanh · Verdict: APPROVE

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| Ownership | ✅ Chỉ `tests/integration/**`, `tests/e2e/**`, `docs/08`, `handoffs/QA-07.md` (đều của qa-engineer) |
| `npm run check` | ✅ lint + typecheck sạch; vitest 80 file pass, 4214 pass + 1 expected fail (BUG-QA03-01, đã ghi) / 4215 |
| `npm run build` | ✅ xanh |
| Không đổi contract / mã nguồn sản phẩm | ✅ |
| Không `any`, `ts-ignore`, `console.log` | ✅ (script dùng `process.stdout.write`) |
| Test có ca lỗi/ca biên | ✅ 413 với Content-Length khai đúng/thiếu/khai thiếu; 429 sau 10 request, IP khác, hồi phục sau 60s |
| Không secret | ✅ Dùng canary giả, không đọc `.env*` |
| Handoff + log AI | ✅ `handoffs/QA-07.md` |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
- Rate limit chỉ kiểm tra trong cùng process, không chứng minh giới hạn phân tán trên Vercel (handoff đã nêu).
- `security.spec.ts` dùng `waitForTimeout(750)` chờ debounce lưu; có thể flaky trên máy chậm — nên thay bằng chờ điều kiện nếu có dấu hiệu lưu.
- `security-bundle.ts` không có đuôi `.test` nên không chạy trong `npm run test`; cân nhắc nối vào CI sau.
- HTTP 413 thiếu fallback vẫn là BUG-QA03-01, cần ai-engineer/techlead quyết định.

### Điểm tốt
- Kiểm thử qua route thật với provider giả, xác nhận provider không bị gọi khi 413.
- Ca "khai thiếu Content-Length" bắt đúng kiểu né giới hạn.
- Quét bundle an toàn bằng canary giả; tài liệu tái lập rõ trong docs/08.
