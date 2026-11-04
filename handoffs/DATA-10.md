# Handoff — DATA-10 · Lưu trữ phân vùng theo năm + Ghi 2 pha + Web Locks
- **Role:** `data-engineer`   **Người:** Huy · Gemini (Argon)   **Nhánh:** `feat/data-engineer/DATA-10-DATA-11`   **Thời gian:** 2026-11-04 11:15
- **Contracts:** đã đọc `domain.ts` v1 và `docs/13_SCALE_RESILIENCE.md §2` — không đổi chữ ký ✅

## Đã làm
- **Phân vùng lưu trữ theo năm (`partitionCodec.ts`)**:
  - Key manifest: `kpi-dash:v1` trỏ sang các partition theo năm (`${key}:p:<năm>:<gen>`).
  - Sắp xếp dòng theo `(campaignIndex, date)`, delta-encode ngày và RLE cho campaign & source (chỉ 1–2 ký tự/dòng).
  - Tự động nhận diện và tương thích ngược hoàn toàn với định dạng nguyên khối P0 cũ.
- **Xác định partition bẩn bằng hash nội dung FNV-1a (R-02)**:
  - Bổ sung `hash?: number` (FNV-1a 32-bit hash) vào `PartitionMeta`.
  - So sánh kết hợp `rows`, 4 tổng và `hash` nội dung payload. Nhờ đó, việc hoán đổi số liệu, đổi ngày trong năm, đổi `campaignId` hay `source` mà tổng không đổi vẫn được phát hiện bẩn chính xác 100% và lưu trữ đầy đủ.
- **Ghi 2 pha an toàn & Quota handling không làm sập ứng dụng (R-01)**:
  - Pha 1: Ghi các partition bẩn sang thế hệ mới `:p:<năm>:<gen+1>`.
  - Pha 2: Commit manifest trỏ sang thế hệ mới.
  - Pha 3: Dọn dẹp các key partition cũ và các năm bị xoá.
  - Xử lý Quota / chặn ghi: Nếu gặp `QuotaExceededError` ở pha 1/2, adapter tự động rollback các key mới, chuyển sang lưu giữ toàn bộ dữ liệu trong `inMemoryStore`, phát `system/health` (`storage`, `degraded`), và giải quyết **resolve** (không throw ra ngoài làm unhandled rejection). Thêm lưới an toàn `.catch` tại `store.ts`.
- **Dọn rác mồ côi an toàn không race với tab khác (R-03, L-04)**:
  - Partition prefix được suy ra động từ `key`: `${key}:p:`.
  - Quá trình dọn rác bọc trong `navigator.locks.request('kpi-dash:write', ...)`.
  - Chỉ dọn các key có `gen < manifest.parts[year].gen` (thế hệ cũ), không bao giờ xoá nhầm key thế hệ mới đang được tab khác ghi dở.
- **Tự kiểm tra khi đọc & Cách ly dữ liệu hỏng**:
  - Kiểm tra đối chiếu `rows` và `sum` của từng partition với manifest.
  - Nếu partition bị hỏng: tự động cô lập sang `kpi-dash:corrupt:<năm>:<ts>`, nạp các năm còn lại bình thường và phát sự kiện `system/health` cảnh báo người dùng (E49).
- **Web Locks**:
  - Bọc thao tác ghi trong `navigator.locks.request('kpi-dash:write', ...)` đồng bộ an toàn giữa các tab trình duyệt.

## File thay đổi
- `src/lib/data/storage/partitionCodec.ts` (mới)
- `src/lib/data/storage/localStorageAdapter.ts`
- `src/lib/data/storage/partition.test.ts` (mới)
- `src/lib/data/store.ts`

## API / component công khai
```ts
export function createLocalStorageAdapter(key?: string): StorageAdapter;
export function encodePartition(entries: DailyEntry[], epoch: string, campaignIndexMap: Map<string, number>): { payload: PartitionPayload; rows: number; sum: [number, number, number, number] };
export function decodePartition(payload: PartitionPayload, epoch: string, campaigns: Campaign[], savedAt: number): DailyEntry[];
export function computePayloadHash(str: string): number;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/storage/` → 14 passed / 0 failed (5 storage.test.ts, 9 partition.test.ts).
- Bất biến & ca lỗi đã phủ:
  - Bất biến #8: `decode(encode(s)) ≡ s` (bỏ qua createdAt/updatedAt).
  - Bất biến #9 & R-01: Ghi 2 pha khi gặp QuotaExceededError lưu an toàn trong RAM, không throw unhandled rejection, không làm mất dữ liệu.
  - R-02: Đổi ngày, đổi campaignId hoặc hoán đổi số liệu giữ nguyên tổng vẫn được phát hiện và lưu thành công.
  - R-03: Tab A ghi partition gen mới chưa commit không bị lệnh load() dọn rác của Tab B xoá nhầm.
  - E49: Xoá hoặc hỏng 1 key partition thì vẫn nạp các năm còn lại và báo cáo lỗi chính xác.
  - Hiệu năng: mã hoá 50.000 dòng đạt tốc độ cao (< 30ms).

## Cách dùng cho người nhận
- Tự động hoạt động xuyên suốt qua `useDataStore` và `createLocalStorageAdapter()`.

## Hạn chế / nợ kỹ thuật
- `createdAt` và `updatedAt` của từng dòng không lưu riêng trên đĩa để tiết kiệm ~40% dung lượng; khi decode sẽ nhận giá trị `savedAt` của manifest (L-05, đúng đặc tả docs/13 §2).
- Key `:backup` cũ đã được thay thế hoàn toàn bằng cơ chế thế hệ `gen` và ghi 2 pha an toàn hơn.

## Cần người khác làm / Change request
- **L-01**: Đề xuất PM / Techlead cập nhật `docs/10_CONTRACTS.md` bổ sung trường `hash?: number` trong `PartitionMeta` để chuẩn hoá cấu trúc manifest.
- **L-03**: Nhánh phục hồi khẩn cấp khi manifest hỏng sẽ gán tạm `campaignId: 'default'` và thông báo người dùng kiểm tra lại tên chiến dịch.

## Ghi chú dùng AI
- Trợ lý AI thiết kế codec nén RLE + delta ngày, cơ chế 2-phase commit chống mất dữ liệu khi quota trình duyệt bị chặn, và thuật toán băm FNV-1a để nhận diện partition bẩn.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-10 | Lưu trữ phân vùng theo năm, ghi 2 pha, tự kiểm tra rows/sum và Web Locks | Code + Test | Sửa R-01 không reject khi quota, R-02 phát hiện bẩn bằng hash, R-03 dọn rác an toàn | src/lib/data/storage/**, src/lib/data/store.ts |
