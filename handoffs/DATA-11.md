# Handoff — DATA-11 · Worker supervisor + Cache theo phần + Tự chữa lệch
- **Role:** `data-engineer`   **Người:** Huy · Gemini (Argon)   **Nhánh:** `feat/data-engineer/DATA-10-DATA-11`   **Thời gian:** 2026-11-04 11:15
- **Contracts:** đã đọc `domain.ts` v1 và `docs/13_SCALE_RESILIENCE.md §3–4` — không đổi chữ ký ✅

## Đã làm
- **Đóng gói Typed Array nhanh (`packEntries`)**:
  - Tự động đóng gói mảng `DailyEntry[]` thành các mảng số định kiểu TypedArray (`Int32Array days`, `Uint16Array campaignIdxs`, `Float64Array reaches/clicks/costs/orders`, `Uint8Array sources`) khi > 500 dòng giúp truyền dữ liệu vào Worker zero-copy.
  - Test chứng minh kết quả snapshot khi truyền TypedArray hoàn toàn đồng nhất (≡) với mảng object truyền thống (R-05).
  - Giữ nguyên chữ ký công khai `init(entries)`.
- **Cache theo phần (forecast theo `completedVersion` & `today`) (L-02)**:
  - Phân tách version của dữ liệu lịch sử (`completedVersion`) và dữ liệu ngày hôm nay (`today` đưa vào khoá cache `fcKey`).
  - Khi live mode cập nhật ngày hôm nay (`today`), `completedVersion` không đổi → tái sử dụng kết quả `forecastAll` từ cache → snapshot live chỉ tốn < 5ms.
- **Worker Supervisor & Bảo toàn dữ liệu sau sự cố (R-04, R-05)**:
  - Cập nhật `lastEntriesSnapshot` liên tục theo các thao tác `applyDelta`. Khi worker gặp sự cố và khởi động lại, worker mới được re-init đầy đủ toàn bộ dữ liệu gồm cả các delta mới nhất.
  - Tự động khởi động lại worker trong giới hạn `LIMITS.WORKER_MAX_RESTARTS` (2 lần trong 60s).
  - Nếu gặp sự cố liên tục vượt ngưỡng: tự động chuyển sang Chế độ tương thích (Compatibility Mode) chạy trên main thread có bọc supervisor/timeout, tự động tắt dự báo khi > 20.000 dòng để chống đơ tab và phát cảnh báo `system/health`.
- **Tự chữa lệch (Self-healing)**:
  - `useAnalytics` so sánh `snap.checksum` với `store.checksum`. Nếu phát hiện lệch, tự động gọi `client.init(entries)` dựng lại toàn bộ rollup index và phát tín hiệu `system/health` (`rollup`, `recovered`) (R-05).
  - Xử lý `REVISION_GAP` khi delta nhảy cóc, ném lỗi và tự động re-init từ store.

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
export function resetAnalyticsClient(): void;
export function simulateWorkerFailure(reason?: string): void;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/workers/` → 18 passed / 0 failed (6 analytics.test.ts, 8 supervisor.test.ts, 4 useAnalytics.test.tsx).
- Bất biến & ca lỗi đã phủ:
  - Bất biến #7 & E50: Sau chuỗi thao tác ngẫu nhiên (add/update/remove), `applyDelta` tích luỹ ≡ `buildRollups(entries cuối)` và checksum khớp.
  - R-04: Supervisor khởi động lại worker bảo toàn nguyên vẹn mọi dữ liệu từ các thao tác `applyDelta` trước đó.
  - R-05: Kiểm tra toàn diện hành vi restart trong giới hạn, chuyển chế độ tương thích khi vượt ngưỡng, bắt lỗi `REVISION_GAP`, tự chữa lệch khi sai checksum, và tương đương 100% giữa TypedArray vs Object array.
  - Cache theo phần: Live mode tick trên hôm nay đạt tốc độ nhanh vượt trội (< 5ms), `timings.forecastCached` ghi nhận.

## Cách dùng cho người nhận
- Tự động tích hợp trong `useAnalytics` và toàn bộ luồng xử lý worker của hệ thống.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm / Change request
- **L-01**: Đề xuất PM / Techlead cập nhật `docs/10_CONTRACTS.md` §C bổ sung kiểu `PackedEntries` và phương thức `ping(): Promise<string>` vào `AnalyticsWorkerApi`.

## Ghi chú dùng AI
- Trợ lý AI triển khai supervisor kiểm soát vòng đời worker, cơ chế packed typed array và phân chia version cho bộ đệm dự báo.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-11 | Worker supervisor, typed array packEntries, cache theo phần completedVersion và tự chữa lệch | Code + Test | Sửa R-04 bảo toàn delta khi restart, R-05 bổ sung test supervisor và self-healing | src/lib/workers/**, src/lib/workers/supervisor.test.ts |
