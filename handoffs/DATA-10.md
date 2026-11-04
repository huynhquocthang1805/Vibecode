# Handoff — DATA-10 · Lưu trữ phân vùng theo năm + Ghi 2 pha + Web Locks
- **Role:** `data-engineer`   **Người:** Huy · Gemini (Argon)   **Nhánh:** `feat/data-engineer/DATA-10-DATA-11`   **Thời gian:** 2026-11-04 10:45
- **Contracts:** đã đọc `domain.ts` v1 và `docs/13_SCALE_RESILIENCE.md §2` — không đổi chữ ký ✅

## Đã làm
- **Phân vùng lưu trữ theo năm (`partitionCodec.ts`)**:
  - Key manifest: `kpi-dash:v1` trỏ sang các partition theo năm (`kpi-dash:v1:p:<năm>:<gen>`).
  - Sắp xếp dòng theo `(campaignIndex, date)`, delta-encode ngày và RLE cho campaign & source (chỉ 1–2 ký tự/dòng).
  - Tự động nhận diện và tương thích ngược hoàn toàn với định dạng nguyên khối P0 cũ.
- **Chỉ ghi partition bẩn**:
  - Store & Adapter phân tích `rows` và `sum: [r, k, s, o]` theo từng năm.
  - Live mode x60 chỉ chạm năm hiện tại → chỉ mã hoá lại partition năm hiện tại (vài KB), không ghi lại toàn bộ 50.000 dòng.
- **Ghi 2 pha (không bao giờ mất bản tốt)**:
  - Pha 1: Ghi các partition bẩn sang thế hệ mới `:p:<năm>:<gen+1>`. Nếu dính lỗi/quota ở bước này, lập tức huỷ bỏ các key mới, giữ nguyên manifest cũ.
  - Pha 2: Commit manifest trỏ sang thế hệ mới.
  - Pha 3: Dọn dẹp các key partition cũ và các năm bị xoá.
- **Tự kiểm tra khi đọc & Cách ly dữ liệu hỏng**:
  - Kiểm tra đối chiếu `rows` và `sum` của từng partition với manifest.
  - Nếu partition bị hỏng: tự động cô lập sang `kpi-dash:corrupt:<năm>:<ts>`, nạp các năm còn lại bình thường và phát sự kiện `system/health` cảnh báo người dùng (E49).
  - Quét dọn các key mồ côi khi nạp dữ liệu.
- **Web Locks**:
  - Bọc thao tác ghi trong `navigator.locks.request('kpi-dash:write', ...)` đồng bộ an toàn giữa các tab trình duyệt.

## File thay đổi
- `src/lib/data/storage/partitionCodec.ts` (mới)
- `src/lib/data/storage/localStorageAdapter.ts`
- `src/lib/data/storage/partition.test.ts` (mới)

## API / component công khai
```ts
export function createLocalStorageAdapter(key?: string): StorageAdapter;
export function encodePartition(entries: DailyEntry[], epoch: string, campaignIndexMap: Map<string, number>): { payload: PartitionPayload; rows: number; sum: [number, number, number, number] };
export function decodePartition(payload: PartitionPayload, epoch: string, campaigns: Campaign[], savedAt: number): DailyEntry[];
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/storage/` → 12 passed / 0 failed.
- Bất biến đã phủ:
  - Bất biến #8: `decode(encode(s)) ≡ s` (bỏ qua createdAt/updatedAt).
  - Bất biến #9: Ghi 2 pha khi gặp QuotaExceededError luôn giữ nguyên trạng thái trước đó, không sinh trạng thái lai/hỏng.
  - E49: Xoá hoặc hỏng 1 key partition thì vẫn nạp các năm còn lại và báo cáo lỗi chính xác.
  - Hiệu năng: mã hoá 50.000 dòng đạt tốc độ cao (< 30ms).

## Cách dùng cho người nhận
- Tự động hoạt động xuyên suốt qua `useDataStore` và `createLocalStorageAdapter()`.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Trợ lý AI thiết kế codec nén RLE + delta ngày và cơ chế 2-phase commit chống mất dữ liệu khi quota trình duyệt bị chặn.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-10 | Lưu trữ phân vùng theo năm, ghi 2 pha, tự kiểm tra rows/sum và Web Locks | Code + Test | Sửa mock Storage.prototype.setItem khi test quota | src/lib/data/storage/partitionCodec.ts, src/lib/data/storage/localStorageAdapter.ts, src/lib/data/storage/partition.test.ts |
