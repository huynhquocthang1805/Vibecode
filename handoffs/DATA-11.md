# Handoff — DATA-11 · Worker supervisor + Cache theo phần + Tự chữa lệch
- **Role:** `data-engineer`   **Người:** Huy · Gemini (Argon)   **Nhánh:** `feat/data-engineer/DATA-10-DATA-11`   **Thời gian:** 2026-11-04 10:45
- **Contracts:** đã đọc `domain.ts` v1 và `docs/13_SCALE_RESILIENCE.md §3–4` — không đổi chữ ký ✅

## Đã làm
- **Đóng gói Typed Array nhanh (`packEntries`)**:
  - Tự động đóng gói mảng `DailyEntry[]` thành các mảng số định kiểu TypedArray (`Int32Array days`, `Uint16Array campaignIdxs`, `Float64Array reaches/clicks/costs/orders`, `Uint8Array sources`) khi > 500 dòng giúp truyền dữ liệu vào Worker zero-copy.
  - Giữ nguyên chữ ký công khai `init(entries)`.
- **Cache theo phần (forecast theo `completedVersion`)**:
  - Phân tách version của dữ liệu lịch sử (`completedVersion`) và dữ liệu ngày hôm nay.
  - Khi live mode cập nhật ngày hôm nay (`today`), `completedVersion` không đổi → tái sử dụng kết quả `forecastAll` từ cache → snapshot live chỉ tốn < 5ms.
- **Worker Supervisor & Chế độ tương thích**:
  - Giám sát trạng thái Worker (`onerror`, `onmessageerror`, `SNAPSHOT_TIMEOUT_MS`).
  - Tự động khởi động lại và re-init khi worker gặp sự cố.
  - Nếu gặp sự cố liên tục quá `LIMITS.WORKER_MAX_RESTARTS` (2 lần trong 60s): tự động chuyển sang Chế độ tương thích (Compatibility Mode) chạy trên main thread, tự động tắt dự báo khi > 20.000 dòng để chống treo giao diện và phát thông báo `system/health`.
- **Tự chữa lệch (Self-healing)**:
  - So sánh `snap.checksum` với `store.checksum`. Nếu phát hiện lệch, tự động gọi `client.init(entries)` dựng lại toàn bộ rollup index và phát tín hiệu `system/health` recovered.
  - Xử lý `REVISION_GAP` khi delta nhảy cóc, tự động re-init từ store.

## File thay đổi
- `src/lib/workers/types.ts`
- `src/lib/workers/analytics.worker.ts`
- `src/lib/workers/client.ts`
- `src/lib/workers/useAnalytics.ts`
- `src/lib/workers/supervisor.test.ts` (mới)

## API / component công khai
```ts
export interface AnalyticsWorkerApi {
  init(entries: DailyEntry[] | PackedEntries): Promise<number>;
  applyDelta(delta: EntryDelta, revision: number): Promise<number>;
  snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot>;
  ping(): Promise<string>;
}
export function getAnalyticsClient(): AnalyticsWorkerApi;
export function packEntries(entries: DailyEntry[]): PackedEntries;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/workers/` → 14 passed / 0 failed.
- Bất biến đã phủ:
  - Bất biến #7 & E50: Sau chuỗi thao tác ngẫu nhiên (add/update/remove), `applyDelta` tích luỹ ≡ `buildRollups(entries cuối)` và checksum khớp.
  - Cache theo phần: Live mode tick trên hôm nay đạt tốc độ nhanh vượt trội (< 5ms), `timings.forecastCached` ghi nhận.
  - Supervisor: Chuyển đổi an toàn sang chế độ tương thích khi có sự cố.

## Cách dùng cho người nhận
- Tự động tích hợp trong `useAnalytics` và toàn bộ luồng xử lý worker của hệ thống.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Trợ lý AI triển khai supervisor kiểm soát vòng đời worker, cơ chế packed typed array và phân chia version cho bộ đệm dự báo.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-11 | Worker supervisor, typed array packEntries, cache theo phần completedVersion và tự chữa lệch | Code + Test | Đảm bảo phương thức ping khớp kiểu Comlink Remote | src/lib/workers/**, src/lib/workers/supervisor.test.ts |
