# Handoff — DATA-09 · IndexedDB adapter + tự chuyển khi vượt ngưỡng
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-08-DATA-09   **Thời gian:** 2026-11-04 15:35
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- **IndexedDB Adapter thuần (`indexedDbAdapter.ts`)**:
  - Triển khai `createIndexedDbAdapter` tuân thủ interface `StorageAdapter` (kind: `'indexedDB'`).
  - Sử dụng API IndexedDB thuần của trình duyệt, không thêm bất kỳ thư viện ngoài nào (0 dependencies).
  - Khởi tạo Database `'kpi-dash-db'` (version 1) gồm 2 object store:
    - `'entries'`: keyPath `'id'`, indexes theo `'date'` và `'campaignId'`.
    - `'meta'`: keyPath `'key'`, lưu trữ `'campaigns'`, `'settings'`, và `'version'`.
  - Triển khai đầy đủ các phương thức: `load()`, `save()`, `clear()`, `usage()`.
- **Cấu hình (settings) vẫn lưu ở localStorage**:
  - Tuân thủ quy tắc kiến trúc (docs/13 §7, data-engineer.md §76): Khi `save()`, `settings` đồng thời được ghi vào localStorage qua key `kpi-dash:v1:settings` để tab mới có thể đọc ngay cấu hình và render giao diện trong 0ms.
  - Khi `load()`, ưu tiên đọc `settings` từ localStorage trước khi fallback vào IndexedDB meta store.
  - Khi `clear()`, dọn sạch cả trong IndexedDB lẫn localStorage.
- **Di chuyển dữ liệu hai chiều (Two-way migration) & Sửa R-01**:
  - Cung cấp các hàm `migrateStorage(from, to)`, `migrateToIndexedDb(local, idb)`, `migrateToLocalStorage(idb, local)`.
  - **Sửa R-01 (Chống mất dữ liệu khi IndexedDB không khả dụng)**:
    - Trước khi dọn dẹp adapter nguồn (`from.clear()`), `migrateStorage` bắt buộc phải xác minh việc ghi bền vững bằng cách gọi `to.load()` và kiểm tra adapter đích có bị suy giảm sang in-memory không (`isDegraded()`).
    - Nếu môi trường không hỗ trợ IndexedDB hoặc việc ghi vào IndexedDB bị lỗi: ném exception ngay lập tức, **tuyệt đối KHÔNG gọi `from.clear()`** và **KHÔNG đặt `ACTIVE_STORAGE_TYPE_KEY = 'indexedDB'`**.
    - Store giữ nguyên `storageAdapter` là `localStorage` và `storage.kind` vẫn là `'localStorage'`. Dữ liệu trên localStorage được bảo toàn 100%.
- **Tự động chuyển đổi khi vượt ngưỡng (Auto-switch) & Sửa R-02**:
  - Trong `store.ts`: Khi số dòng dữ liệu vượt quá `LIMITS.LOCAL_STORAGE_SOFT_ROWS` (40.000 dòng) hoặc khi nhận cảnh báo quota `storage/warning`, store tự động gọi `checkAndAutoSwitchAdapter`.
  - **Sửa R-02 (Chống race condition với debounce persist)**:
    - Khi bắt đầu chuyển đổi (`isMigrating = true`), lập tức huỷ bỏ timer debounce persist đang chờ (`clearTimeout(persistTimer)`).
    - Nếu có bất kỳ thao tác `addEntries` nào diễn ra trong lúc đang di chuyển (`await migrateToIndexedDb`), persist sẽ được hoãn lại và đánh dấu cờ `needsPersistAfterMigration = true`.
    - Ngay sau khi swap adapter thành công sang IndexedDB trong khối `finally`, nếu `needsPersistAfterMigration === true` thì tự động kích hoạt `schedulePersist` để ghi toàn bộ số liệu mới nhất vào adapter mới, ngăn chặn hoàn toàn việc mất dữ liệu do race condition.
- **Lưu ý không chặn**:
  - Thay thế toàn bộ `console.warn` trong `store.ts` bằng `bus.emit({ type: 'system/health', ... })` theo đúng chuẩn docs/13.

## File thay đổi
- `src/lib/data/storage/indexedDbAdapter.ts`
- `src/lib/data/storage/indexedDbAdapter.test.ts`
- `src/lib/data/storage/index.ts`
- `src/lib/data/store.ts`

## API / component công khai
```ts
// storage/
export function createIndexedDbAdapter(opts?: { strict?: boolean }): StorageAdapter;
export function migrateStorage(from: StorageAdapter, to: StorageAdapter): Promise<void>;
export function migrateToIndexedDb(sourceAdapter?: StorageAdapter, targetAdapter?: StorageAdapter): Promise<StorageAdapter>;
export function migrateToLocalStorage(sourceAdapter?: StorageAdapter, targetAdapter?: StorageAdapter): Promise<StorageAdapter>;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/storage/indexedDbAdapter.test.ts` → 9 passed / 0 failed.
- Ca biên đã phủ:
  - Lưu và nạp toàn vẹn `entries`, `campaigns`, `settings` qua IndexedDB.
  - Settings được lưu đồng thời và ưu tiên nạp từ `localStorage`.
  - `clear()` xoá sạch toàn bộ dữ liệu ở cả 2 nơi.
  - Đo lường dung lượng với `usage()`.
  - Di chuyển dữ liệu hai chiều (localStorage -> IndexedDB và IndexedDB -> localStorage).
  - Tự động chuyển đổi sang IndexedDB khi dữ liệu vượt 40.000 dòng.
  - Tự động chuyển đổi khi nhận sự kiện `storage/warning`.
  - Môi trường không có IndexedDB chuyển sang lưu tạm RAM và phát cảnh báo degraded.
  - **Test R-01**: IndexedDB không khả dụng khi migrate → localStorage còn nguyên 100% dữ liệu, không đổi `ACTIVE_STORAGE_TYPE_KEY`, `storage.kind` giữ nguyên `'localStorage'`.
  - **Test R-02**: Gọi `addEntries` ngay trong lúc migrate đang chạy → không ghi race vào adapter cũ, tự động persist đầy đủ vào adapter mới sau khi swap.

## Cách dùng cho người nhận
- Dùng trực tiếp hoặc qua store:
  ```ts
  import { createIndexedDbAdapter, migrateToIndexedDb } from '@/lib/data/storage';

  // Chuyển đổi thủ công nếu người dùng bấm "Bật lưu nâng cao" trên UI
  await migrateToIndexedDb();
  ```

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Trường (`frontend-dashboard` - FD-09): Hiển thị loại lưu trữ hiện tại (`storage.kind`) trên Đồng hồ dung lượng và banner suy giảm khi nhận cảnh báo `system/health`.

## Ghi chú dùng AI
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-09 | Triển khai IndexedDB adapter thuần, 2-way migration, auto-switch, sửa R-01 xác minh trước khi clear và R-02 chống race persist | Code + Test | Xác minh persistent storage trước khi xoá nguồn cũ và hoãn persist trong lúc migrate | src/lib/data/storage/indexedDbAdapter.ts, src/lib/data/store.ts |
