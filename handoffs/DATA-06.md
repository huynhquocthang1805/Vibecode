# Handoff — DATA-06 · Analytics Worker (Comlink) + useAnalytics + fallback main thread
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-05-DATA-07   **Thời gian:** 2026-11-03 20:35
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- `analytics.worker.ts`: Chạy trong Web Worker với Comlink, lưu giữ `RollupIndex`, cung cấp API `init`, `applyDelta`, `snapshot`.
- `snapshot(q)`: Tính toán tuần tự `series`, `daily`, `comparePeriods`, `totals`, `trend` (qua `analyzeTrend`), `forecasts` (an toàn bọc try/catch khi chưa có FC-04), `nowcasts`, `anomalies`, kèm bản ghi `timings` chi tiết.
- `client.ts`: Singleton client kết nối Worker qua Comlink, hỗ trợ fallback mượt mà sang in-memory main thread engine khi chạy trên môi trường SSR, Vitest, hoặc khi Worker gặp lỗi.
- `useAnalytics.ts`: React hook kết nối Zustand store, tự hủy kết quả cũ theo revision (latest-wins), debounce 50ms khi có delta liên tiếp, tự động chữa lệch (self-healing) nếu `snapshot.checksum` lệch so với store.
- Bắt lỗi `REVISION_GAP` khi `applyDelta` không liên tục.

## File thay đổi
- `src/lib/workers/analytics.worker.ts`
- `src/lib/workers/client.ts`
- `src/lib/workers/useAnalytics.ts`
- `src/lib/workers/analytics.test.ts`

## API / component công khai
```ts
export interface AnalyticsWorkerApi {
  init(entries: DailyEntry[]): Promise<number>;
  applyDelta(delta: EntryDelta, revision: number): Promise<number>;
  snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot>;
}
export function getAnalyticsClient(): AnalyticsWorkerApi;
export function useAnalytics(q: AnalyticsQuery): { data: AnalyticsSnapshot | null; loading: boolean; error: Error | null };
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/workers/` → 5 passed / 0 failed.
- Ca biên đã phủ: init + snapshot, applyDelta revision check, REVISION_GAP reject, forecastStatus stale (> 14 ngày cũ - E43), forecastStatus insufficient (< 7 ngày).

## Cách dùng cho người nhận
```ts
const { data, loading, error } = useAnalytics({
  campaignId: 'default',
  grain: 'day',
  horizonDays: 30,
  today: todayVN(),
});
```

## Hạn chế / nợ kỹ thuật
- `forecastAll` và `nowcast` trả mảng rỗng cho đến khi Thắng 2 hoàn thành FC-02..06.

## Cần người khác làm
- forecast-engineer (Thắng 2): Triển khai FC-02..06 trong `src/lib/analytics/`.

## Ghi chú dùng AI
- Dòng log:

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-03 20:35 | data-engineer | DATA-06 | Analytics worker Comlink + fallback client + hook useAnalytics self-healing | Code + Test | Đảm bảo hook không throw khi render | `src/lib/workers/**` |

