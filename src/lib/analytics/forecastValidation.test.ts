import { describe, expect, it } from 'vitest';

import campaignFixture from '@/fixtures/campaign-2y.json';
import { buildRollups, getSeries } from '@/lib/data/aggregate';
import { addDays } from '@/lib/domain/dates';
import type { DailyEntry } from '@/types/domain';

import { forecastAll } from './forecast';
import { validateForecasts } from './forecastValidation';
import { nowcast } from './nowcast';

// JSON suy ra source:string; chuẩn hóa literal mà không ép kiểu toàn bộ fixture.
const entries: DailyEntry[] = campaignFixture.map((entry) => ({ ...entry, source: 'mock' }));

describe('FC-09 kiểm định dữ liệu campaign-2y thật', () => {
  it('tạo đủ 60 hàng cho 3 chiến dịch × 4 metric × 5 model và một lựa chọn mỗi nhóm', () => {
    const rows = validateForecasts(entries);
    expect(rows).toHaveLength(60);
    expect(rows.filter((row) => row.selected)).toHaveLength(12);
    expect(
      rows.every(
        (row) =>
          Number.isFinite(row.smape) && row.smape >= 0 && row.smape <= 200 && Number.isFinite(row.mae) && row.mae >= 0,
      ),
    ).toBe(true);
    expect(new Set(rows.map((row) => row.campaignId)).size).toBe(3);
    for (const chosen of rows.filter((row) => row.selected)) {
      const baseline = rows.find(
        (row) => row.campaignId === chosen.campaignId && row.metric === chosen.metric && row.model === 'seasonal_naive',
      )!;
      if (chosen.model !== baseline.model) expect(chosen.smape).toBeLessThanOrEqual(baseline.smape * 0.95);
    }
  });

  it('dùng rollup thật, dự báo đủ cuối quý và nowcast được khi chưa có dữ liệu tháng mới', () => {
    const series = getSeries(buildRollups(entries), { campaignId: 'thoi-trang', grain: 'day', today: '2026-11-02' });
    const prediction = forecastAll(series, 60);
    const month = nowcast(series, prediction, '2026-11', 'month', '2026-11-02');
    const quarter = nowcast(series, prediction, '2026-Q4', 'quarter', '2026-11-02');
    expect(month.projected.orders.mean).toBeGreaterThanOrEqual(month.actualToDate.orders);
    expect(quarter.projected.orders.mean).toBeGreaterThanOrEqual(quarter.actualToDate.orders);
    expect(prediction[0]?.points.at(-1)?.date).toBe('2026-12-31');
  });

  it('tập rỗng trả rỗng, dữ liệu thiếu lịch sử kiểm định báo rõ lý do', () => {
    expect(validateForecasts([])).toEqual([]);
    expect(() => validateForecasts(entries.slice(0, 15))).toThrow('VALIDATION_REQUIRES_COMPLETE_HISTORY');
    const broken = entries.filter((entry) => entry.date !== addDays('2026-11-01', -7));
    expect(() => validateForecasts(broken)).toThrow('VALIDATION_REQUIRES_COMPLETE_HISTORY');
  });
});
