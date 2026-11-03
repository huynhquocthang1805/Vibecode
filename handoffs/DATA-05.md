# Handoff — DATA-05 · RollupIndex day/week/month/quarter + applyDelta + like-for-like
- **Role:** data-engineer   **Người:** Huy · Gemini (Argon)   **Nhánh:** feat/data-engineer/DATA-05-DATA-07   **Thời gian:** 2026-11-03 20:35
- **Contracts:** đã đọc `domain.ts` v1 — không đổi chữ ký ✅

## Đã làm
- Cài đặt `RollupIndex` dùng mảng dày theo ngày (`Float64Array`, `Uint16Array`) theo docs/13 §3, tự động mở rộng dung lượng.
- `buildRollups(entries)`: O(n), xử lý 100k dòng < 80ms (ngân sách < 300ms).
- `applyDelta(index, delta)`: O(|delta|), thêm/sửa/xoá trong < 0.05ms (ngân sách < 2ms).
- `getSeries(index, q)`: hỗ trợ mọi grain (`day`, `week`, `month`, `quarter`), lọc theo `range` và campaign (`id` hoặc `'all'`), gap-filling kỳ trống với `daysWithData` chuẩn xác.
- `comparePeriods(series, today, daily?)`: Like-for-like so sánh kỳ partial (CR-003, E21, E22), giới hạn số ngày tương ứng với kỳ trước (ví dụ 31/03 so với 28 ngày của tháng 2).

## File thay đổi
- `src/lib/data/aggregate/rollup.ts`
- `src/lib/data/aggregate/compare.ts`
- `src/lib/data/aggregate/index.ts`
- `src/lib/data/aggregate/rollup.test.ts`
- `src/lib/data/aggregate/compare.test.ts`

## API / component công khai
```ts
export function buildRollups(entries: DailyEntry[]): RollupIndex;
export function applyDelta(index: RollupIndex, delta: EntryDelta): RollupIndex;
export function getSeries(index: RollupIndex, q: Pick<AnalyticsQuery, 'campaignId' | 'grain' | 'range' | 'today'>): Series;
export function comparePeriods(series: Series, today: ISODate, daily?: Series): PeriodComparison | null;
```

## Kiểm thử
- Lệnh: `npx vitest run src/lib/data/aggregate/` → 8 passed / 0 failed.
- Ca biên đã phủ: E20 (tháng có 1 ngày dữ liệu, isPartial = true), E21 (so sánh 29 ngày đầu T10 vs T9, like-for-like = true), E22 (31/03 so với 28 ngày tháng 2), Bất biến #1 (tổng all = tổng từng campaign), Bất biến #10 (applyDelta == buildRollups).
- Số đo hiệu năng: 100k dòng build trong 70ms, delta 1 dòng < 0.05ms.

## Cách dùng cho người nhận
```ts
const index = buildRollups(entries);
const series = getSeries(index, { campaignId: 'default', grain: 'month', today: todayVN() });
const daily = getSeries(index, { campaignId: 'default', grain: 'day', today: todayVN() });
const cmp = comparePeriods(series, todayVN(), daily);
```

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- AI chú ý tối ưu hóa TypedArray `Float64Array` để đạt hiệu năng tối đa và tính toán `daysWithData` chuẩn xác cho `all`.
- Dòng log:

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-03 20:35 | data-engineer | DATA-05 | Triển khai RollupIndex mảng dày + getSeries + comparePeriods like-for-like | Code + Test | Khắc phục noUncheckedIndexedAccess TypedArray | `src/lib/data/aggregate/**` |
