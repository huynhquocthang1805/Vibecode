# DATA-HOTFIX-01 — Reload mất dữ liệu vừa nhập (CI e2e đỏ)

Người làm: Thắng (techlead) · hotfix P0 trên file của Huy (data-engineer) · 2026-11-04

## Triệu chứng
- CI `e2e` đỏ từ sau PR #11 (DATA-10/11): `g1-smoke` **F1 + F3** — nhập 3 dòng → reload → `0 dòng`.
  iPhone 12 hỏng gần như mọi lần, desktop thỉnh thoảng (PR #13 CI hỏng cả 2, PR #15 run 69 hỏng iPhone).
- Đây là lỗi thật, không phải test flaky: **người dùng lưu xong rồi reload/đóng tab trong ~300 ms là mất dữ liệu** (vi phạm P0 F1/F3).

## Nguyên nhân
`localStorageAdapter.save()` chạy trong `navigator.locks.request(...)` (DATA-10, ghi 2 pha + web locks).
Callback của lock chạy ở task sau, nên khi trang đang đóng:
1. listener `pagehide` của store gọi `save()` → lock chưa kịp cấp → trang bị huỷ → không ghi;
2. nếu debounce 300 ms đã bắn, `save()` đang **chờ lock** và `persistTimer = null` → `pagehide` không ghi lại.

## Sửa (`src/lib/data/storage/localStorageAdapter.ts`)
- `pagehide` (capture, chạy trước listener của store) → `setUnloading(true)`:
  chạy ngay, đồng bộ các thao tác đang xếp hàng chờ lock; lời gọi mới trong lúc unload bỏ qua lock.
  Được vì thân hàm trong lock không có `await` → `fn()` ghi xong localStorage trong lời gọi.
- Mỗi thao tác chỉ chạy 1 lần (lock cấp muộn khi quay lại từ bfcache không ghi lại). `pageshow` → dùng lock lại.
- Không đổi chữ ký / hợp đồng. Ghi 2 pha vẫn bảo vệ manifest nếu tab khác ghi cùng lúc.

## Test
- `partition.test.ts` +3 ca HOTFIX-01: unload ghi đồng bộ (lock không bao giờ cấp) · save đang chờ lock → pagehide ghi, không ghi 2 lần · pageshow dùng lại lock.
  Ca 1 **đỏ trên code cũ**, xanh sau khi sửa.
- `npm run lint && npm run typecheck && npm run test` xanh (48 file, 3825 test) · `npm run build` xanh.
- E2E F1+F3 lặp 20 lần × 2 thiết bị: **40/40** (trước khi sửa: iPhone hỏng 100%) · cả bộ e2e ×2: 28/28.

## Cần người khác làm
- **Huy**: review lại; adapter IndexedDB (`indexedDbAdapter.ts`) có cùng rủi ro lúc unload (transaction IDB là bất đồng bộ) — nên giữ bản sao localStorage cuối hoặc ghi sớm hơn (task riêng nếu cần).

## Log AI
- Claude (techlead): đọc log CI run 41810547774/41801216753, tái hiện local (iPhone 12), tìm nguyên nhân lock bất đồng bộ lúc unload, viết test hồi quy + sửa.
