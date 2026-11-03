import { describe, expect, it } from 'vitest';

import { safeDiv } from '@/lib/domain/kpi';

import { fitModel, predictModel } from './fitModel';
import { FORECAST_CONFIG } from '../forecastConfig';
import { holt } from './holt';
import { holtWinters } from './holtWinters';

describe('Holt và Holt-Winters FC-03', () => {
  it('tối ưu SSE dừng sớm vẫn chọn cùng mức lỗi với duyệt đầy đủ 343 tổ hợp', () => {
    const y = Array.from({ length: 49 }, (_, t) => 100 + t + 15 * Math.sin(safeDiv(2 * Math.PI * t, 7) ?? 0));
    const squaredError = (fitted: number[]) =>
      y.slice(14).reduce((sum, value, index) => sum + (value - fitted[index + 14]!) ** 2, 0);
    let minimum = Infinity;
    for (const alpha of FORECAST_CONFIG.grid) {
      for (const beta of FORECAST_CONFIG.grid) {
        for (const gamma of FORECAST_CONFIG.grid) {
          minimum = Math.min(minimum, squaredError(holtWinters(y, 7, alpha, beta, gamma, 0, 0.98).fitted));
        }
      }
    }
    const chosen = fitModel(y, 'holt_winters');
    expect(squaredError(predictModel(y, chosen, 0).fitted)).toBeCloseTo(minimum, 8);
  });

  it('Holt mặc định phi=1 dự báo đúng đường thẳng', () => {
    const y = Array.from({ length: 40 }, (_, t) => 100 + 2 * t);
    holt(y, 0.3, 0.2, 3).forecast.forEach((value, index) => expect(value).toBeCloseTo(180 + 2 * index));
    expect(holt(y, 0.3, 0.2, 3, 0.98).forecast[2]).toBeLessThan(184);
  });

  it.each([0, 10])('chuỗi hằng %s không sinh NaN, khoảng dao động giả hoặc chia 0', (value) => {
    const y = Array<number>(42).fill(value);
    expect(holt(y, 0.2, 0.2, 7).forecast).toEqual(Array<number>(7).fill(value));
    for (const point of holtWinters(y, 7, 0.2, 0.2, 0.2, 7).forecast) expect(point).toBeCloseTo(value);
  });

  it('fit HW đạt sMAPE dưới 10% trên 14 ngày chưa dùng để fit', () => {
    // Nhiễu xác định từ seed, không gọi Math.random hoặc đồng hồ.
    let seed = 20261104;
    const y = Array.from({ length: 112 }, (_, t) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = ((safeDiv(seed, 4294967296) ?? 0) - 0.5) * 4;
      return 100 + 2 * t + 20 * Math.sin(safeDiv(2 * Math.PI * t, 7) ?? 0) + noise;
    });
    const train = y.slice(0, -14);
    const fitted = fitModel(train, 'holt_winters');
    const predicted = predictModel(train, fitted, 14).forecast;
    const error = y
      .slice(-14)
      .reduce(
        (sum, value, index) =>
          sum +
          (safeDiv(200 * Math.abs(value - predicted[index]!), Math.abs(value) + Math.abs(predicted[index]!)) ?? 0),
        0,
      );
    expect(safeDiv(error, 14)).toBeLessThan(10);
    expect(fitted.params.phi).toBe(0.98);
  });

  it('giữ đúng pha mùa vụ khi độ dài không là bội của 7', () => {
    const pattern = [20, 25, 30, 35, 40, 45, 50];
    const y = Array.from({ length: 43 }, (_, t) => pattern[t % 7]!);
    const result = holtWinters(y, 7, 0.3, 0.2, 0.2, 8);
    expect(result.forecast).toEqual([25, 30, 35, 40, 45, 50, 20, 25]);
  });

  it('kẹp dự báo âm của xu hướng giảm về 0', () => {
    const y = [10, 8, 6, 4, 2, 0];
    expect(holt(y, 1, 1, 7).forecast).toEqual(Array<number>(7).fill(0));
  });

  it('không sửa input và hỗ trợ horizon 0', () => {
    const y = Array<number>(14).fill(3);
    const copy = [...y];
    expect(holt(y, 0.5, 0.5, 0).forecast).toEqual([]);
    expect(holtWinters(y, 7, 0.5, 0.5, 0.5, 0).forecast).toEqual([]);
    expect(y).toEqual(copy);
  });

  it('từ chối chuỗi quá ngắn, dữ liệu không hữu hạn và tham số sai', () => {
    expect(() => holt([1], 0.5, 0.5, 1)).toThrow(RangeError);
    expect(() => holt([1, NaN], 0.5, 0.5, 1)).toThrow(RangeError);
    expect(() => holt([1, 2], 2, 0.5, 1)).toThrow(RangeError);
    expect(() => holt([1, 2], 0.5, 0.5, -1)).toThrow(RangeError);
    expect(() => holtWinters([1, 2], 7, 0.5, 0.5, 0.5, 1)).toThrow(RangeError);
    expect(() => holtWinters(Array<number>(14).fill(1), 7, 0.5, 0.5, NaN, 1)).toThrow(RangeError);
    expect(() => fitModel(Array<number>(14).fill(1), 'holt_winters')).toThrow(RangeError);
  });
});
