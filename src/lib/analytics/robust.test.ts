import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/domain/dates';

import { forecastMetric } from './forecast';
import { robustSeries, sliceAfterLongGap, trimLeadingZeros, winsorize } from './robust';

const START = '2026-08-01';
const dates = (n: number, start = START) => Array.from({ length: n }, (_, i) => addDays(start, i));
const wave = (n: number, base = 100) => Array.from({ length: n }, (_, i) => base + ((i * 7) % 11) - 5);

describe('FC-10 · robust (docs/13 §5)', () => {
  it('winsorize: 1 ngày gõ nhầm ×100 bị kẹp về median + 5·MAD; dữ liệu thường không đổi', () => {
    const v = wave(30);
    v[20] = v[20]! * 100;
    const w = winsorize(v);
    expect(w.clipped).toBe(1);
    expect(w.values[20]!).toBeLessThan(150);
    expect(w.values.filter((x, i) => i !== 20)).toEqual(v.filter((_, i) => i !== 20));
  });

  it('winsorize: chuỗi hằng (MAD = 0) hoặc < 3 điểm → không kẹp; không bao giờ âm', () => {
    expect(winsorize([5, 5, 5, 5, 500]).clipped).toBe(0); // MAD = 0
    expect(winsorize([1, 900]).clipped).toBe(0);
    const w = winsorize([0, 0, 1, 100, 102, 98, 101, 99, 0]);
    expect(Math.min(...w.values)).toBeGreaterThanOrEqual(0);
  });

  it('bỏ 0 đầu chuỗi (chưa chạy); chuỗi toàn 0 giữ nguyên', () => {
    const t = trimLeadingZeros([0, 0, 0, 4, 5, 0, 6], dates(7));
    expect(t.removed).toBe(3);
    expect(t.values).toEqual([4, 5, 0, 6]);
    expect(t.dates[0]).toBe(addDays(START, 3));
    expect(trimLeadingZeros([0, 0, 0], dates(3)).removed).toBe(0);
  });

  it('khoảng trống > 28 ngày → chỉ giữ đoạn sau khoảng trống CUỐI; ≤ 28 ngày → giữ nguyên', () => {
    const d = [...dates(10), ...dates(10, '2026-09-20'), ...dates(8, '2026-10-29')];
    const v = d.map((_, i) => i + 1);
    const s = sliceAfterLongGap(v, d);
    expect(s.cut).toBe(true);
    expect(s.dates[0]).toBe('2026-10-29');
    expect(s.values).toHaveLength(8);
    const short = [...dates(10), ...dates(10, addDays(START, 10 + 28))]; // trống đúng 28 ngày
    expect(sliceAfterLongGap(short.map(() => 1), short).cut).toBe(false);
  });

  it('robustSeries: đúng thứ tự bỏ 0 → cắt khoảng trống → winsorize', () => {
    const r = robustSeries([0, 0, ...wave(30)], dates(32));
    expect(r.leadingZeros).toBe(2);
    expect(r.cutAtGap).toBe(false);
    expect(r.values).toHaveLength(30);
  });
});

describe('FC-10 · forecastMetric bền vững', () => {
  it('1 ngày chi phí ×100 không làm dự báo "bay" (trước: trung bình dự báo vọt lên)', () => {
    const v = wave(35, 1_000_000);
    const clean = forecastMetric(v, dates(35), 'cost', 7);
    const dirty = [...v];
    dirty[30] = dirty[30]! * 100;
    const f = forecastMetric(dirty, dates(35), 'cost', 7);
    const mean = (x: typeof f) => x.points.reduce((a, p) => a + p.mean, 0) / x.points.length;
    expect(mean(f)).toBeLessThan(mean(clean) * 1.2);
    for (const p of f.points) for (const k of ['mean', 'lo80', 'hi80', 'lo95', 'hi95'] as const) expect(Number.isFinite(p[k])).toBe(true);
  });

  it('nghỉ 2 tháng rồi chạy lại 10 ngày → dự báo theo mức MỚI, không nội suy qua khoảng trống', () => {
    const d = [...dates(40), ...dates(10, '2026-11-01')];
    const v = [...Array(40).fill(1000), ...Array(10).fill(200)];
    const f = forecastMetric(v, d, 'reach', 7);
    expect(f.points[0]!.date).toBe('2026-11-11');
    for (const p of f.points) expect(p.mean).toBeLessThan(400);
  });

  it('đoạn sau khoảng trống < 7 ngày → baseline naive theo mức mới (không bỏ trống dự báo)', () => {
    const d = [...dates(40), ...dates(3, '2026-11-01')];
    const v = [...Array(40).fill(1000), 210, 200, 205];
    const f = forecastMetric(v, d, 'reach', 5);
    expect(f.model).toBe('naive');
    expect(f.points).toHaveLength(5);
    expect(f.points[0]!.mean).toBe(205);
    expect(f.points[0]!.date).toBe('2026-11-04');
  });

  it('chuỗi toàn 0 / hằng số → dự báo hằng, hữu hạn, không NaN', () => {
    for (const v of [Array(20).fill(0), Array(20).fill(42)]) {
      const f = forecastMetric(v, dates(20), 'orders', 7);
      expect(f.points).toHaveLength(7);
      for (const p of f.points) {
        expect(Number.isFinite(p.mean)).toBe(true);
        expect(p.mean).toBeCloseTo(v[0], 6);
      }
    }
  });

  it('vẫn từ chối đầu vào hỏng TRƯỚC khi xử lý robust (ngày trùng, NaN)', () => {
    expect(() => forecastMetric([1, 2], ['2026-01-01', '2026-01-01'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastMetric([NaN, 1], dates(2), 'orders', 7)).toThrow(RangeError);
  });
});
