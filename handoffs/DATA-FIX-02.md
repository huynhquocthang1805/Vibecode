# Handoff — DATA-FIX-02 · Sửa lỗi nowcast rỗng (R-07)
- **Role:** `data-engineer`   **Người:** Huy · Gemini (Argon)   **Nhánh:** `feat/data-engineer/DATA-FIX-02`   **Thời gian:** 2026-11-04 10:00
- **Contracts:** đã đọc `domain.ts` v1 và `docs/10_CONTRACTS.md §D` — không đổi chữ ký ✅

## Đã làm
- **Tính toán Horizon dự báo đủ cho nowcast (R-07)**:
  - Khi snapshot chạy, xác định khoảng ngày của quý hiện tại (`bucketRange(quarterKey, 'quarter')`).
  - Tính số ngày từ `today` tới cuối quý (`daysToQuarterEnd = Math.max(0, daysBetween(q.today, qRange.end) + 1)`).
  - Horizon truyền vào `forecastAll(daily, forecastHorizon)` được lấy là `Math.max(q.horizonDays, daysToQuarterEnd)`, đảm bảo mô hình dự báo sinh đủ các điểm cho tới ngày cuối cùng của quý, loại bỏ triệt để ngoại lệ `NOWCAST_INCOMPLETE_FORECAST` khi tính nowcast quý.
- **Tách độc lập try/catch cho tháng và quý**:
  - Tách việc tạo `nowcast` của tháng và quý thành 2 khối `try/catch` độc lập. Nếu một kỳ thiếu dữ liệu hoặc gặp lỗi, kỳ còn lại vẫn được tính toán và đưa vào `snapshot.nowcasts`.
- **Ghi nhận cảnh báo và lỗi**:
  - Không nuốt lỗi im lặng: trong `catch`, ghi nhận cờ lỗi `timings.nowcastMonthError = 1` hoặc `timings.nowcastQuarterError = 1` và log cảnh báo qua `console.warn`.
- **Gỡ bỏ `it.fails` của test R-07**:
  - Đã chuyển `it.fails` thành `it` trong `tests/integration/pipeline.review.test.ts` (test R-07 "snapshot có nowcast tháng (2026-11) và quý (2026-Q4)"), test chạy thành công 100%.

## File thay đổi
- `src/lib/workers/analytics.worker.ts`
- `src/lib/workers/analytics.test.ts`
- `tests/integration/pipeline.review.test.ts`
- `handoffs/DATA-FIX-02.md`

## API / component công khai
```ts
// Giữ nguyên chữ ký API AnalyticsWorker / createAnalyticsEngine
export function createAnalyticsEngine(): AnalyticsWorkerApi;
```

## Kiểm thử
- Lệnh: `npm run test -- src/lib/workers/ tests/integration/pipeline.review.test.ts` → 10 passed / 0 failed.
- Toàn bộ suite: `npm run check` → 41 test files passed (3779 passed, 0 failed, 8 expected fail BA-03).
- Ca biên đã phủ: Dữ liệu lớn 2 năm (campaign-2y) có đủ nowcast tháng và quý, horizon truyền vào nhỏ hơn khoảng cách tới cuối quý vẫn tự động mở rộng bao phủ.

## Cách dùng cho người nhận
- Component Dashboard / ForecastPanel tự động nhận `snapshot.nowcasts` chứa cả tháng và quý hiện tại để hiển thị phần dự kiến cuối tháng/cuối quý.

## Hạn chế / nợ kỹ thuật
- Không có.

## Cần người khác làm
- Không có.

## Ghi chú dùng AI
- Trợ lý AI phát hiện và tính toán chính xác số ngày cần bù tới cuối quý `qRange.end`, đồng thời cách ly 2 khối try/catch độc lập cho tháng/quý.
- Dòng log (PM chép vào `docs/11_AI_USAGE_LOG.md` lúc merge):

| Thời gian | Role | Task | AI đã làm | Loại | AI sai / đội sửa | File |
|---|---|---|---|---|---|---|
| 2026-11-04 | data-engineer | DATA-FIX-02 | Tính toán horizon bao phủ cuối quý cho nowcast, tách try/catch tháng và quý, gỡ it.fails R-07 | Code + Test | Đảm bảo chỉ gọi nowcast khi có ít nhất 1 dự báo được tạo | src/lib/workers/analytics.worker.ts, src/lib/workers/analytics.test.ts, tests/integration/pipeline.review.test.ts |
