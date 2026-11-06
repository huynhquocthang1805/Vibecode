# REVIEW QA-06 — Phiên Marketer, retest, báo cáo QA · Verdict: APPROVE

## Vòng 1

| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn |
| Ownership | ✅ Chỉ `tests/e2e/marketer-session.ts`, `docs/bugs.md`, `docs/test-report.md`, `docs/perf-report.md`, `handoffs/QA-06.md` (đều của qa-engineer) |
| `npm run check` | ✅ lint 0 warning, typecheck sạch; vitest 80 file pass, 4214 pass + 1 expected fail (BUG-QA03-01) / 4215 |
| `npm run build` | ✅ xanh |
| Không đổi contract / mã nguồn sản phẩm / package.json | ✅ |
| Không `any`, `ts-ignore`, `console.log` | ✅ (script dùng `process.stdout.write`) |
| Xử lý lỗi / ca biên của script | ✅ mỗi bước bọc try/catch, `finally` dừng trace + ghi `result.json` + đóng browser, `exitCode=1` khi có lỗi; có ca nhập sai (click > reach) rồi sửa |
| Không secret, không gửi ra ngoài | ✅ AI stub, composer local, không gửi Zalo |
| Số liệu báo cáo nhất quán | ✅ 80 file/4214+1 khớp kết quả chạy thật; bug register khớp test-report |
| Handoff + log AI | ✅ `handoffs/QA-06.md` |

### Lỗi phải sửa
Không có.

### Lưu ý không chặn
- Báo cáo trung thực: giữ nguyên 124 pass + 17 fail (lỗi harness CRLF), trace/ảnh 45 phút gốc đã mất — đã nêu rõ, không giả là artifact mới.
- `marketer-session.ts` không chạy trong `npm run test`/CI (cần server + trình duyệt) — đúng ý, chỉ là công cụ QA thủ công.
- Coverage cần `@vitest/coverage-v8@5.0.5` chưa có trong devDependencies; techlead cân nhắc thêm (CR) nếu muốn tái lập trên CI.
- Còn mở (không thuộc PR này): BUG-QA04-01 cross-tab, BUG-QA03-01 spec 413, BUG-QA05-01–03 ngân sách hiệu năng; G1 bằng AI thật trên điện thoại do Thắng nghiệm thu. Phiên tự động không thay usability người thật / iOS WebKit.
- Chuỗi chữ trong handoff mất khoảng trắng giữa số và đơn vị (VD "45phút41.65giây") — nên chỉnh cho dễ đọc.

### Điểm tốt
- Retest xác nhận 3 bug đã sửa (QA02-01, QA04-02, QA04-03) có bằng chứng local + deploy.
- Phân biệt rõ expected failure với functional pass; không tô hồng kết quả.
- Sửa nguyên nhân gốc artifact bị dọn (lưu ngoài output Playwright, `QA_ARTIFACT_DIR`).
- Coverage lib 90.69% lines, nêu rõ branches 76.22% chưa đạt, provider thật chưa được kiểm.
