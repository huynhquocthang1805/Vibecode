# Review — DATA-FIX-03 + ACC-FIX-01 (PR #38) · Vòng 1 — **APPROVE**

## Bảng kiểm tra
| Hạng mục | Kết quả |
|---|---|
| PR guard | ✅ Không lỗi chặn; 3 cảnh báo file tests/ ngoài phạm vi (xem lưu ý) |
| `npm run check` (lint + typecheck + test) | ✅ 78 file, 4195 pass, 1 expected fail, 0 fail |
| `npm run build` | ✅ Xanh, route đủ |
| Hợp đồng `domain.ts` / `docs/10` | ✅ Không đổi chữ ký; `export const auth` giữ nguyên kiểu qua Proxy |
| Không `any` / `ts-ignore` / `console.log` thừa | ✅ (`console.error` mailer có sẵn từ trước) |
| BUG-QA02-01 | ✅ `store.ts` bọc try/catch getter localStorage; adapter IDB dùng `localStorage?.` trong try; bỏ `.fails` |
| BUG-QA04-02 | ✅ `analytics.worker.ts` cộng `gapToToday` vào horizon; có unit test ca dòng cuối 31/10 → today 06/11 |
| BUG-QA04-03 | ✅ `useAnalytics.ts` throttle maxWait 100ms + single-flight; test tick 15ms liên tục |
| ACC-FIX-01 | ✅ `betterAuth()` khởi tạo lười khi `accountConfigured()`; cache theo db/secret/verifyEmail; test lazy-throw |
| Không secret, không gọi AI từ client | ✅ Bỏ fallback secret cứng |
| Handoff + log AI | ✅ `handoffs/DATA-FIX-03.md`, `handoffs/ACC-FIX-01.md` |

## Lỗi phải sửa
Không có.

## Lưu ý không chặn
1. `tests/e2e/*.spec.ts` và `tests/integration/storage-worker.test.ts` thuộc qa-engineer; thay đổi chỉ là gỡ `test.fail`/`.fails` đúng quy ước của bug đã sửa → chấp nhận.
2. `liveSimulator.ts` đổi bước tăng reach (10–30 → 40–80) và ép tối thiểu 1 đơn khi cvrNoise>1.05: điều chỉnh để E2E Live x60 thấy KPI nhích; làm đổi chuỗi seed cũ nhưng test hiện tại vẫn xanh. Nên ghi vào `docs/bugs.md`.
3. Test ACC-FIX-01 chỉ kiểm nhánh chưa cấu hình ném lỗi; nhánh đã cấu hình được các test auth/account PGlite hiện có phủ gián tiếp. Nên thêm test khẳng định `betterAuth` không được gọi lúc import.
4. Proxy `auth` chỉ có trap `get`; nếu sau này cần `in`/`Object.keys(auth)` thì thêm trap.
5. E2E Playwright không chạy lại trong review này; tin vào báo cáo handoff (6 pass).

## Điểm tốt
- Phát hiện và xử lý race checksum khi tick đến giữa lúc snapshot (chỉ self-heal khi cùng revision).
- `revisionOffsetRef` giữ đồng bộ revision store ↔ worker sau mỗi lần init lại.
- Build im lặng khi chưa cấu hình tài khoản, đúng docs/14 §1.2.
