import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/domain/dates';
import { computeKpis } from '@/lib/domain/kpi';
import type { MetricForecast } from '@/types/domain';

import { BASE_METRICS } from './forecast';
import { forecastPoint } from './intervals';
import { nowcast } from './nowcast';
import { testSeries } from './testSeries';

function forecasts(start: string, length: number, value = 10, sigma = 0): MetricForecast[] {
  return BASE_METRICS.map((metric) => ({
    metric,
    model: 'naive',
    params: {},
    horizonDays: length,
    confidence: 'low',
    backtest: { smape: null, mae: null, baselineSmape: null },
    points: Array.from({ length }, (_, i) => forecastPoint(addDays(start, i), value, sigma, i + 1)),
  }));
}

describe('nowcast FC-06', () => {
  it('giữa tháng: cộng đúng thực tế và ngày còn lại, KPI lấy tỉ số của tổng', () => {
    const daily = testSeries(Array<number>(15).fill(2));
    const result = nowcast(daily, forecasts('2026-01-16', 16, 10), '2026-01', 'month', '2026-01-15');
    expect(result.daysElapsed).toBe(15);
    expect(result.daysTotal).toBe(31);
    expect(result.actualToDate.orders).toBe(30);
    expect(result.projected.orders).toEqual({ mean: 190, lo80: 190, hi80: 190 });
    expect(result.projectedKpis).toEqual(computeKpis({ reach: 3160, clicks: 460, cost: 30160, orders: 190 }));
  });

  it('hôm nay partial lấy max(actual, forecast) và không cộng trùng hôm nay', () => {
    const daily = testSeries([2], '2026-01-31');
    daily.buckets[0]!.isPartial = true;
    const prediction = forecasts('2026-01-31', 1, 5);
    const result = nowcast(daily, prediction, '2026-01', 'month', '2026-01-31');
    expect(result.actualToDate.orders).toBe(2);
    expect(result.projected.orders.mean).toBe(5);
    expect(result.projected.cost.mean).toBe(2000);
  });

  it('ngày đầu tháng, chưa có dữ liệu tháng này vẫn dùng đúng dự báo theo ngày', () => {
    const daily = testSeries([999], '2026-01-31');
    const result = nowcast(daily, forecasts('2026-02-01', 28, 3), '2026-02', 'month', '2026-02-01');
    expect(result.actualToDate.orders).toBe(0);
    expect(result.projected.orders.mean).toBe(84);
    expect(result.daysElapsed).toBe(1);
  });

  it('tháng 2 năm nhuận và cuối quý dùng helper ngày', () => {
    const leap = nowcast(
      testSeries([], '2024-02-01'),
      forecasts('2024-02-01', 29, 1),
      '2024-02',
      'month',
      '2024-02-01',
    );
    expect(leap.daysTotal).toBe(29);
    expect(leap.projected.orders.mean).toBe(29);
    const quarter = nowcast(testSeries([7], '2026-12-31'), [], '2026-Q4', 'quarter', '2026-12-31');
    expect(quarter.daysTotal).toBe(92);
    expect(quarter.daysElapsed).toBe(92);
    expect(quarter.projected.orders.mean).toBe(7);
  });

  it('khoảng tổng cộng phương sai thay vì cộng trực tiếp biên từng ngày', () => {
    const daily = testSeries([1], '2026-01-29');
    const result = nowcast(daily, forecasts('2026-01-30', 2, 10, 2), '2026-01', 'month', '2026-01-29');
    expect(result.projected.orders.mean).toBe(21);
    expect(result.projected.orders.hi80).toBeCloseTo(21 + 1.2816 * Math.sqrt(4 + 8));
    expect(result.projected.orders.lo80).toBeCloseTo(21 - 1.2816 * Math.sqrt(4 + 8));
  });

  it('bất biến #6: projected và biên dưới không nhỏ hơn actual (200 lượt)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (actual, prediction, sigma) => {
          const daily = testSeries([actual], '2026-01-31');
          daily.buckets[0]!.isPartial = true;
          const result = nowcast(
            daily,
            forecasts('2026-01-31', 1, prediction, sigma),
            '2026-01',
            'month',
            '2026-01-31',
          );
          for (const metric of BASE_METRICS) {
            expect(result.projected[metric].mean).toBeGreaterThanOrEqual(result.actualToDate[metric]);
            expect(result.projected[metric].lo80).toBeGreaterThanOrEqual(result.actualToDate[metric]);
            expect(result.projected[metric].hi80).toBeGreaterThanOrEqual(result.projected[metric].mean);
          }
        },
      ),
      { numRuns: 200, seed: 20261104 },
    );
  });

  it('giữ target, không gọi stub pacing của FC-08 và không sửa input', () => {
    const daily = testSeries([1], '2026-01-31');
    const before = structuredClone(daily);
    const target = { orders: 100 };
    const result = nowcast(daily, [], '2026-01', 'month', '2026-01-31', target);
    expect(result.target).toEqual(target);
    expect(result.target).not.toBe(target);
    expect(result.pacing).toBeUndefined();
    expect(daily).toEqual(before);
  });

  it('từ chối thiếu dự báo cuối kỳ để không đưa ra tổng quý bị hụt', () => {
    expect(() =>
      nowcast(testSeries([], '2026-01-01'), forecasts('2026-01-01', 30), '2026-Q1', 'quarter', '2026-01-01'),
    ).toThrow('NOWCAST_INCOMPLETE_FORECAST');
    expect(() => nowcast(testSeries([], '2026-01-01'), [], '2026-01', 'month', '2026-01-01')).toThrow(
      'NOWCAST_INCOMPLETE_FORECAST',
    );
  });

  it('từ chối kỳ, dữ liệu, target và khoảng dự báo không hợp lệ', () => {
    const daily = testSeries([1], '2026-01-31');
    expect(() => nowcast(daily, [], '2026-13', 'month', '2026-01-31')).toThrow(RangeError);
    expect(() => nowcast(daily, [], '2026-Q5', 'quarter', '2026-01-31')).toThrow(RangeError);
    expect(() => nowcast(daily, [], '2026-01', 'month', 'bad')).toThrow(RangeError);
    expect(() => nowcast(daily, [], '2026-01', 'month', '2026-01-31', { orders: -1 })).toThrow(RangeError);
    daily.buckets[0]!.orders = NaN;
    expect(() => nowcast(daily, [], '2026-01', 'month', '2026-01-31')).toThrow(RangeError);
    const invalid = forecasts('2026-01-31', 1);
    invalid[0]!.points[0]!.lo80 = 1000;
    expect(() => nowcast(testSeries([]), invalid, '2026-01', 'month', '2026-01-31')).toThrow(
      'NOWCAST_INVALID_FORECAST',
    );
  });

  it('từ chối ngày hoặc metric trùng thay vì cộng hai lần', () => {
    const daily = testSeries([1], '2026-01-31');
    daily.buckets.push({ ...daily.buckets[0]! });
    expect(() => nowcast(daily, [], '2026-01', 'month', '2026-01-31')).toThrow('NOWCAST_INVALID_SERIES');
    const duplicate = forecasts('2026-01-31', 1);
    duplicate.push(duplicate[0]!);
    expect(() => nowcast(testSeries([]), duplicate, '2026-01', 'month', '2026-01-31')).toThrow(
      'NOWCAST_DUPLICATE_METRIC',
    );
  });
});
