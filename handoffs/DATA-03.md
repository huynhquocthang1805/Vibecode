# Handoff — DATA-03 · StorageAdapter localStorage + codec cột + migrate + quota/corrupt
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-01-DATA-04-FC-01   **Thời gian:** 2026-11-02 09:01
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- `codec.ts`: Triển khai `encodeState` và `decodeState` theo định dạng columnar (docs/02 §2). Không lưu cột `id` và `t` (dựng lại `id = `${campaignId}|${date}`` và ngày tính theo delta days từ epoch).
- Nén 50.000 dòng xuống còn ~2.6MB (< 3.5MB theo nghiệm thu).
- `migrate.ts`: Hỗ trợ migrate từ v0 prototype (dạng mảng) sang `PersistedState` v1.
- `localStorageAdapter.ts`: Adapter localStorage có cơ chế backup key (khi < 1MB, lưu mỗi 5 lần), cách ly chuỗi JSON hỏng vào `kpi-dash:corrupt:<ts>`, bắt `QuotaExceededError` hoặc localStorage bị chặn để fallback sang in-memory và phát event `storage/warning` + `system/health`.
- `bus.ts`: Event bus hoàn chỉnh cho các domain event.

## File thay đổi
- `src/lib/data/storage/codec.ts`
- `src/lib/data/storage/migrate.ts`
- `src/lib/data/storage/localStorageAdapter.ts`
- `src/lib/data/storage/storage.test.ts`
- `src/lib/data/realtime/bus.ts`

## API / component công khai
```ts
export function createLocalStorageAdapter(key?: string): StorageAdapter;
export function encodeState(s: PersistedState): string;
export function decodeState(raw: string): PersistedState;
export function migrate(raw: unknown): PersistedState;
```

## Kiểm thử
- Lệnh: `npm run test -- src/lib/data/storage/storage.test.ts` → 5 passed / 0 failed.
- Ca biên đã phủ: Codec roundtrip, 50k rows size limit, migration v0 -> v1, corrupt handling, quota fallback.

