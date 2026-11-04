# Handoff — DATA-09 · IndexedDB adapter + tự chuyển khi vượt ngưỡng
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-08-DATA-09   **Thời gian:** 2026-11-04 15:20
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
- **Di chuyển dữ liệu hai chiều (Two-way migration)**:
  - Cung cấp các hàm `migrateStorage(from, to)`, `migrateToIndexedDb(local, idb)`, `migrateToLocalStorage(idb, local)`.
  - Chuyển toàn bộ dữ liệu an toàn và dọn dẹp adapter nguồn cũ để giải phóng dung lượng.
  - Ghi nhận trạng thái adapter đang hoạt động vào localStorage (`kpi-dash:active-storage`) để hydrate đúng adapter sau reload.
- **Tự động chuyển đổi khi vượt ngưỡng (Auto-switch)**:
  - Trong `store.ts`: Khi số dòng dữ liệu vượt quá `LIMITS.LOCAL_STORAGE_SOFT_ROWS` (40.000 dòng) hoặc khi nhận cảnh báo quota `storage/warning`, store tự động gọi `checkAndAutoSwitchAdapter`, di chuyển dữ liệu sang IndexedDB, cập nhật `storage.kind: 'indexedDB'` và phát sự kiện `system/health` xác nhận.
- **Chế độ suy giảm an toàn (Resilience / In-memory fallback)**:
  - Nếu IndexedDB bị chặn (do chế độ ẩn danh hạn chế hoặc môi trường không hỗ trợ), adapter tự động chuyển sang lưu tạm an toàn trong RAM, phát sự kiện `system/health` (`storage`, `degraded`), đảm bảo không ném lỗi unhandled rejection làm trắng trang.

## File thay đổi
- `src/lib/data/storage/indexedDbAdapter.ts`
- `src/lib/data/storage/indexedDbAdapter.test.ts`
- `src/lib/data/storage/index.ts`
- `src/lib/data/store.ts`

## API / component công khai
```ts
// storage/
export function createIndexedDbAdapter(): StorageAdapter;
export function migrateStorage(from: StorageAdapter, to: StorageAdapter): Promise<void>;
export function migrateToIndexedDb(sourceAdapter?: StorageAdapter, targetAdapter?: StorageAdapter): Promise<StorageAdapter>;
export function migrateToLocalStorage(sourceAdapter?: StorageAdapter, targetAdapter?: StorageAdapter): Promise<StorageAdapter>;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/storage/indexedDbAdapter.test.ts` → 7 passed / 0 failed.
- Ca biên đã phủ:
  - Lưu và nạp toàn vẹn `entries`, `campaigns`, `settings` qua IndexedDB.
  - Settings được lưu đồng thời và ưu tiên nạp từ `localStorage`.
  - `clear()` xoá sạch toàn bộ dữ liệu ở cả 2 nơi.
  - Đo lường dung lượng với `usage()`.
  - Di chuyển dữ liệu hai chiều (localStorage -> IndexedDB và IndexedDB -> localStorage).
  - Tự động chuyển đổi sang IndexedDB khi dữ liệu vượt 40.000 dòng.
  - Tự động chuyển đổi khi nhận sự kiện `storage/warning`.
  - Môi trường không có IndexedDB chuyển sang lưu tạm RAM và phát cảnh báo degraded.

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
| 2026-11-04 | data-engineer | DATA-09 | Triển khai IndexedDB adapter thuần, 2-way migration và auto-switch khi vượt 40k dòng | Code + Test | Đảm bảo settings đồng bộ vào localStorage và fallback in-memory an toàn | src/lib/data/storage/indexedDbAdapter.ts, src/lib/data/store.ts |
