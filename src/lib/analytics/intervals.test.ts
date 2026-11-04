import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { forecastPoint } from './intervals';

describe('khoảng dự báo FC-05', () => {
  it('dùng z80/z95 và độ lệch chuẩn tăng theo căn bậc hai của bước dự báo', () => {
    const point = forecastPoint('2026-01-01', 100, 10, 4);
    expect(point.lo80).toBeCloseTo(74.368);
    expect(point.hi80).toBeCloseTo(125.632);
    expect(point.lo95).toBeCloseTo(60.8);
    expect(point.hi95).toBeCloseTo(139.2);
    expect(forecastPoint('2026-01-01', 1, 10, 4).lo95).toBe(0);
  });

  it('bất biến #5: mọi biên hữu hạn, không âm và lồng nhau (200 lượt)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1e7, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 366 }),
        (mean, sigma, step) => {
          const p = forecastPoint('2026-01-01', mean, sigma, step);
          const values = [p.lo95, p.lo80, p.mean, p.hi80, p.hi95];
          expect(values.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
          expect(values).toEqual([...values].sort((a, b) => a - b));
        },
      ),
      { numRuns: 200, seed: 20261104 },
    );
  });

  it('từ chối sigma âm, bước 0, NaN và phép tính tràn', () => {
    expect(() => forecastPoint('2026-01-01', 1, -1, 1)).toThrow(RangeError);
    expect(() => forecastPoint('2026-01-01', 1, 1, 0)).toThrow(RangeError);
    expect(() => forecastPoint('2026-01-01', NaN, 1, 1)).toThrow(RangeError);
    expect(() => forecastPoint('2026-01-01', Number.MAX_VALUE, Number.MAX_VALUE, 9)).toThrow(RangeError);
  });
});
