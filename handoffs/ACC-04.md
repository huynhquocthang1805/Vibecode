# Handoff — ACC-04 · Đồng bộ dữ liệu: /api/account/data (revision, 409), không gian localStorage theo user, chuyển dữ liệu khách (A9, A10)
- **Role:** data-engineer   **Người:** Huy · Gemini Argon   **Nhánh:** feat/data-engineer/ACC-03-ACC-06   **Thời gian:** 2026-11-04 18:35
- **Contracts:** đã đọc `domain.ts` v1.0.0 — không đổi chữ ký ✅

## Đã làm
- **API Đồng bộ Cloud (`/api/account/data`)**:
  - `GET`: Yêu cầu phiên đăng nhập. Trả về `204 No Content` nếu người dùng chưa có snapshot đám mây; trả `{ meta: CloudSnapshotMeta, state: PersistedState }` nếu đã có dữ liệu.
  - `PUT`: Nhận `{ baseRevision: number, state: PersistedState }`.
    - Kiểm tra giới hạn payload snapshot ≤ 4 MB (trả `413 Payload Too Large` nếu vượt).
    - Giải mã và kiểm tra tính toàn vẹn của state bằng `decodeState` từ domain layer (trả `400 Bad Request` nếu dữ liệu dị dạng).
    - Kiểm tra xung đột phiên bản: so sánh `baseRevision` của client với `currentRevision` trong DB. Nếu lệch, lập tức trả về `409 Conflict` kèm thông tin snapshot hiện tại của cloud để client giải quyết xung đột (A9).
    - Khi hợp lệ: ghi vào bảng `user_data` với `revision = currentRevision + 1`, lưu `rows` và `bytes` phục vụ telemetry/thống kê.
- **Không gian localStorage theo người dùng (`src/lib/data/storage/userStorage.ts`)**:
  - Tách không gian lưu trữ: khách dùng key mặc định `kpi-dash:v1:storage:manifest`, người dùng đã đăng nhập dùng key `kpi-dash:v1:u:<userId>:manifest` (docs/14 §4).
  - Chuyển giao dữ liệu từ khách (Guest Migration): hàm `migrateGuestDataToUser(userId)` sao chép an toàn dữ liệu từ vùng lưu trữ khách sang tài khoản người dùng khi đăng ký/đăng nhập lần đầu, có cờ `guestMigrated` chống sao chép lặp lại.
  - Dọn dẹp lưu trữ người dùng khi đăng xuất (`clearUserStorage(userId)`).

## File thay đổi
- `src/app/api/account/data/route.ts`
- `src/lib/data/storage/userStorage.ts`
- `src/lib/data/storage/userStorage.test.ts`
- `handoffs/ACC-04.md`

## API / component công khai
```ts
// GET /api/account/data -> 204 No Content | { meta: CloudSnapshotMeta, state: PersistedState }
// PUT /api/account/data -> Body: { baseRevision: number, state: PersistedState } -> 409 CONFLICT | CloudSnapshotMeta

export function getUserStorageKey(userId?: string | null): string;
export function migrateGuestDataToUser(userId: string): boolean;
export function clearUserStorage(userId: string): void;
```

## Kiểm thử
- Lệnh:
  - `npx vitest run src/app/api/account/account.test.ts` → 6 passed
  - `npx vitest run src/lib/data/storage/userStorage.test.ts` → 3 passed
- Ca kiểm thử:
  - A9: Máy 1 đẩy rev 1, Máy 2 dùng baseRevision 0 bị 409 CONFLICT; sau đó chấp nhận baseRevision 1 và đẩy tiếp thành công.
  - A10: State hỏng trả 400; payload > 4 MB trả 413, DB được giữ nguyên.
  - Phân vùng key theo user và di chuyển dữ liệu khách sang vùng user độc lập.

## Cách dùng cho người nhận
- Tích hợp với `useAccount` để tự động debounce đồng bộ thay đổi lên cloud khi có kết nối mạng và session hợp lệ.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 18:35 | data-engineer | ACC-04 | API sync dữ liệu cloud có kiểm soát revision 409, storage isolation theo user | feat | Không có | src/app/api/account/data/route.ts, src/lib/data/storage/userStorage.ts |
