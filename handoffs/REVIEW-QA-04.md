# Review QA-04 — Tám luồng E2E (PR #33) — **APPROVE**

## Vòng 1
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không có lỗi chặn (13 file, đúng ownership qa-engineer) |
| `npm run check` | ✅ lint + typecheck sạch; Vitest 74 file, 4160 pass + 1 expected fail (BUG-QA02-01, đã biết) |
| `npm run build` | ✅ Build production thành công |
| Hợp đồng / `domain.ts` | ✅ Không đổi chữ ký, không sửa file nguồn của owner khác |
| `any` / `ts-ignore` / `console.log` | ✅ Không có trong tests/e2e |
| Ca lỗi / ca biên | ✅ Validation (click>reach, số âm, ngày tương lai), cảnh báo đơn>click vẫn lưu, CSV 1000 dòng từ chối 10, undo, mobile 375px |
| Không mock store/worker | ✅ Local dùng route AI thật với stub; deploy chỉ intercept AI |
| Handoff + log AI | ✅ `handoffs/QA-04.md` |
| E2E / deploy | ⚠️ Tôi không chạy Playwright và không kiểm tra bản deploy; số liệu 18 pass + 6 expected fail lấy từ `docs/test-report.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
- Ba `test.fail` (BUG-QA04-01/02/03) đúng quy ước "lỗi đã biết vẫn merge": giữ nguyên assertion nghiệp vụ, có mã bug, có `QA_VERIFY_FIXES=1` để xác minh. Owner sửa xong phải bỏ marker.
  - 01: cross-tab chưa có caller `startCrossTabSync` (techlead + data).
  - 02: nowcast quý thiếu khi dữ liệu trễ so với today (data + forecast).
  - 03: Live x60 bị debounce snapshot trì hoãn (data).
- `docs/bugs.md`: dòng trống giữa BUG-QA02-01 và BUG-QA04-01 làm vỡ bảng markdown, nên bỏ dòng trống đó.
- `grain-forecast.spec.ts`: với tab Quý, assertion "Dự kiến cuối tháng" chạy trước `test.fail`. Đây là chủ ý nhưng nên thêm comment.
- 24 passed của Playwright không có nghĩa 24 luồng sản phẩm đều đạt. Handoff và report đã ghi rõ điều này.
- iPhone12 chỉ là emulation trên Chromium, không phải WebKit thật. Gemini thật (G1 thủ công) chưa được chứng minh bằng stub.

## Điểm tốt
- Báo cáo trung thực: tách rõ functional pass và expected failure, không báo coverage khi chưa đo.
- Ngày client cố định (`setFixedTime`), helper xử lý blur trước click nên ổn định.
- Dùng test ID có sẵn, các control khác dùng role/label, không sửa component của owner.
- Tìm được 3 lỗi tích hợp thật và ghi owner, bước tái hiện, spec liên quan.
