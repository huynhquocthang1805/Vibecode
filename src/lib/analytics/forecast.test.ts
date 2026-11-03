import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/domain/dates';

import { forecastAll, forecastMetric } from './forecast';
import { testSeries } from './testSeries';

const datesFor = (length: number) => Array.from({ length }, (_, i) => addDays('2026-01-01', i));

describe('forecast FC-04/05', () => {
  it('E27: mười ngày chỉ dùng baseline, confidence thấp, đủ bảy điểm hữu hạn', () => {
    const result = forecastMetric(Array<number>(10).fill(5), datesFor(10), 'orders', 7);
    expect(['naive', 'moving_avg']).toContain(result.model);
    expect(result.confidence).toBe('low');
    expect(result.backtest.smape).toBeNull();
    expect(result.points).toHaveLength(7);
    expect(result.points[0]?.date).toBe('2026-01-11');
    expect(result.points.every((point) => point.mean === 5 && Number.isFinite(point.hi95))).toBe(true);
  });

  it('chuỗi toàn 0 đủ lịch sử có sMAPE thật bằng 0 và khoảng bằng 0', () => {
    const result = forecastMetric(Array<number>(60).fill(0), datesFor(60), 'orders', 7);
    expect(result.backtest).toEqual({ smape: 0, mae: 0, baselineSmape: 0 });
    expect(result.confidence).toBe('high');
    expect(result.points[0]).toMatchObject({ mean: 0, lo80: 0, hi80: 0, lo95: 0, hi95: 0 });
  });

  it('ít hơn bảy quan sát và horizon 0 không dự báo', () => {
    expect(forecastMetric([1, 2], datesFor(2), 'orders', 7).points).toEqual([]);
    expect(forecastMetric([], [], 'orders', 7).horizonDays).toBe(0);
    expect(forecastAll(testSeries(Array<number>(10).fill(1)), 0)).toEqual([]);
    expect(forecastAll(testSeries([1, 2]), 7)).toEqual([]);
  });

  it('forecastAll dự báo đúng bốn chỉ số gốc và bỏ hôm nay partial', () => {
    const series = testSeries(Array<number>(11).fill(5));
    series.buckets[10]!.orders = 1e6;
    series.buckets[10]!.isPartial = true;
    const result = forecastAll(series, 7);
    expect(result.map((item) => item.metric)).toEqual(['reach', 'clicks', 'cost', 'orders']);
    expect(result[3]?.points[0]).toMatchObject({ date: '2026-01-11', mean: 5 });
  });

  it('ngày thiếu được nội suy chỉ để fit, không thay đổi dữ liệu gốc', () => {
    const series = testSeries(Array<number>(15).fill(10));
    series.buckets[8]!.daysWithData = 0;
    series.buckets[8]!.orders = 0;
    const before = structuredClone(series);
    const result = forecastAll(series, 7);
    expect(result[3]?.points.every((point) => point.mean === 10)).toBe(true);
    expect(series).toEqual(before);
    expect(forecastMetric([10, 10], ['2026-01-01', '2026-02-01'], 'orders', 7).points).toEqual([]);
  });

  it('từ chối ngày sai, trùng, đảo thứ tự, lệch kích thước và grain sai', () => {
    expect(() => forecastMetric([1, 2], ['2026-01-01'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastMetric([1], ['2026-02-30'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastMetric([1, 2], ['2026-01-01', '2026-01-01'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastMetric([1, 2], ['2026-01-02', '2026-01-01'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastMetric([NaN], ['2026-01-01'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastAll({ ...testSeries([1]), grain: 'month' }, 7)).toThrow(RangeError);
    expect(() => forecastAll(testSeries([1]), -1)).toThrow(RangeError);
  });
});
