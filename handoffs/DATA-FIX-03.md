# Handoff — DATA-FIX-03 · Sửa BUG-QA02-01, BUG-QA04-02, BUG-QA04-03
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-FIX-03-ACC-FIX-01   **Thời gian:** 2026-11-06 23:15
- **Contracts:** đã đọc `domain.ts` & `docs/10_CONTRACTS.md` — không đổi chữ ký ✅

## Đã làm
- **Sửa BUG-QA02-01 (Store crash khi getter `window.localStorage` ném `SecurityError`)**:
  - Bọc truy cập `window.localStorage?.getItem(ACTIVE_STORAGE_TYPE_KEY)` trong khối `try / catch` lúc khởi tạo module `src/lib/data/store.ts`.
  - Đồng thời bọc toàn bộ truy cập `window.localStorage` trong `src/lib/data/storage/indexedDbAdapter.ts` vào bên trong `try / catch` để không ném `SecurityError` trước khi vào khối `try`.
  - Bỏ `.fails` ở test `BUG-QA02-01` trong `tests/integration/storage-worker.test.ts`.
- **Sửa BUG-QA04-02 (Thiếu nowcast cuối quý khi dòng cuối cách `today` một khoảng trống)**:
  - Trong `src/lib/workers/analytics.worker.ts`: tính `gapToToday = Math.max(0, daysBetween(lastCompletedDate, q.today))` và cộng bù vào `forecastHorizon = Math.max(q.horizonDays, daysToQuarterEnd) + gapToToday` vì `forecastAll(daily, horizon)` bắt đầu dự báo từ `addDays(lastCompletedDate, 1)`.
  - Bổ sung unit test `DATA-FIX-03 · BUG-QA04-02` trong `src/lib/workers/analytics.test.ts` và gỡ `test.fail` trong `tests/e2e/grain-forecast.spec.ts`.
- **Sửa BUG-QA04-03 (Live x60: debounce snapshot 50ms bị reset liên tục bởi tick ~16ms)**:
  - Trong `src/lib/workers/useAnalytics.ts`: bổ sung cơ chế throttle/`maxWait` (`SNAPSHOT_DEBOUNCE_MS = 50`, `SNAPSHOT_MAX_WAIT_MS = 100`) kết hợp single-flight (`inFlight` + `pendingAfterFlight`) để không huỷ kết quả snapshot đang bay khi có tick mới và đảm bảo UI cập nhật đều đặn tối đa mỗi 100ms.
  - Chỉ đối chiếu checksum self-healing khi `store.getState().revision === revBefore` để tránh tự heal nhầm khi có tick mới chèn vào lúc chờ worker.
  - Điều chỉnh bước tăng mỗi tick trong `src/lib/data/realtime/liveSimulator.ts` (giữ nguyên thứ tự gọi PRNG để bảo toàn tính tất định của seed) giúp KPI hôm nay và nowcast phản hồi tức thì ở tốc độ x60.
  - Bổ sung unit test `DATA-FIX-03 · BUG-QA04-03` trong `src/lib/workers/useAnalytics.test.tsx` và gỡ `test.fail` trong `tests/e2e/live.spec.ts`.

## File thay đổi
- `src/lib/data/store.ts`
- `src/lib/data/storage/indexedDbAdapter.ts`
- `src/lib/data/realtime/liveSimulator.ts`
- `src/lib/workers/analytics.worker.ts`
- `src/lib/workers/analytics.test.ts`
- `src/lib/workers/useAnalytics.ts`
- `src/lib/workers/useAnalytics.test.tsx`
- `tests/integration/storage-worker.test.ts`
- `tests/e2e/grain-forecast.spec.ts`
- `tests/e2e/live.spec.ts`

## API / component công khai
- Không đổi chữ ký bất kỳ hàm hay hook nào.

## Kiểm thử
- `npx vitest run tests/integration/storage-worker.test.ts` → 8 passed / 0 failed.
- `npx vitest run src/lib/workers/analytics.test.ts src/lib/workers/useAnalytics.test.tsx` → 12 passed / 0 failed.
- `npx playwright test tests/e2e/grain-forecast.spec.ts tests/e2e/live.spec.ts` → 6 passed / 0 failed (cả desktop & mobile).

## Cách dùng cho người nhận
- Chạy `npm run check` và bộ E2E Playwright bình thường (không cần `QA_VERIFY_FIXES=1` cho BUG-QA02-01, BUG-QA04-02, BUG-QA04-03).

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Techlead / PM: Review, cập nhật trạng thái trong `docs/bugs.md` và merge PR.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-06 23:15 | data-engineer | DATA-FIX-03 | Sửa BUG-QA02-01 (localStorage SecurityError), BUG-QA04-02 (forecastHorizon bù gapToToday), BUG-QA04-03 (useAnalytics throttle/maxWait + single-flight) | Sửa lỗi + test | Phát hiện thêm race condition khi đối chiếu checksum lúc tick mới đến giữa chừng snapshot -> chỉ đối chiếu khi cùng revision | `src/lib/data/store.ts`, `src/lib/workers/analytics.worker.ts`, `src/lib/workers/useAnalytics.ts` |

