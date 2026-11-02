# Handoff — DATA-04 · Zustand store CRUD + duplicate policy + undo + loadMock
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-01-DATA-04-FC-01   **Thời gian:** 2026-11-02 09:02
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- Triển khai toàn bộ Zustand store với `subscribeWithSelector`.
- Tra cứu O(1) qua Map khi thêm/sửa entry; cập nhật checksum O(|delta|).
- Hỗ trợ đầy đủ duplicate policies: `ask` (trả conflicts), `overwrite`, `sum`, `skip`.
- `undoLast()` cho phép hoàn tác trong vòng `LIMITS.UNDO_TTL_MS` (10s).
- `removeEntries()` trả về danh sách đã xoá để UI xử lý hoàn tác.
- Tự động debounce lưu storage adapter với `PERSIST_DEBOUNCE_MS` và `PERSIST_MAX_WAIT_MS` (chống đói ghi); ghi ngay khi `pagehide`.
- Nạp mock data (`loadMock`), xuất/nhập sao lưu (`exportBackup`, `importBackup`).

## File thay đổi
- `src/lib/data/store.ts`
- `src/lib/data/store.test.ts`

## API / component công khai
```ts
export const useDataStore: UseBoundStore<StoreApi<DataState>>;
```

## Kiểm thử
- Lệnh: `npm run test -- src/lib/data/store.test.ts` → 5 passed / 0 failed.
- Ca biên đã phủ: duplicate policy (ask/overwrite/sum/skip), updateEntry, removeEntries, undoLast, loadMock.

