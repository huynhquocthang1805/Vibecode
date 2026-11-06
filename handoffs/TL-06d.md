# TL-06d — Đồng bộ nhiều tab (BUG-QA04-01)

Người làm: Thắng (techlead) · Claude · 2026-11-06 · nhánh `feat/techlead/TL-06d-FC-10`

## Lỗi
QA-04: nhập 1 dòng ở tab A → tab B vẫn 0 dòng. `startCrossTabSync()` (DATA-08) chỉ được export, không có nơi gọi.
Sau khi nối, lộ thêm lỗi thứ 2: tab B nhận dữ liệu nhưng **không lưu**; tab A lưu sau debounce 300 ms → reload B trong khoảng đó thì mất (e2e 5/6 lần đỏ).

## Sửa
- `src/app/DashboardPage.tsx`: `useEffect(() => startCrossTabSync(), [])` — bật khi mount, dọn khi unmount.
- `src/lib/data/store.ts` `applyRemoteDelta`: gọi `schedulePersist` → tab nhận cũng lưu; reload thì `pagehide` flush đồng bộ (DATA-HOTFIX-01). Web Locks tuần tự hoá 2 tab; partition cùng hash không ghi lại.
- `tests/e2e/crosstab.spec.ts`: bỏ `test.fail`. `docs/bugs.md`: BUG-QA04-01 → Fixed, chờ QA retest.

## Test
`remotePersist.test.ts` (đỏ khi bỏ dòng sửa, xanh khi có) · crosstab.spec **10/10** (5 lần × desktop/iPhone; trước 1/6) · E2E 46/46, không còn `test.fail` nào trong e2e.

## Cần người khác làm
- **Huy**: review dòng `schedulePersist` trong `applyRemoteDelta` (file data-engineer).
- **Nhân**: retest BUG-QA04-01 trên bản deploy, đóng bug.

## Log AI
| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-06 | techlead | TL-06d | Nối cross-tab, phát hiện race lưu ở tab nhận qua e2e lặp, sửa + test | fix | Bản đầu chỉ nối sync → e2e lặp lộ race reload; thêm persist ở tab nhận | DashboardPage.tsx, store.ts |
