import { describe, expect, it } from 'vitest';

import { movingAverage, naive, seasonalNaive } from './baselines';

describe('baseline FC-02', () => {
  it('naive dùng quan sát trước cho fitted và quan sát cuối cho tương lai', () => {
    const result = naive([2, 4, 7, 11], 3);
    expect(result.fitted).toEqual([2, 2, 4, 7]);
    expect(result.forecast).toEqual([11, 11, 11]);
    expect(result.residualSd).toBeCloseTo(1);
  });

  it('seasonal naive lặp đúng pha kể cả khi độ dài không chia hết chu kỳ', () => {
    const result = seasonalNaive([1, 2, 3, 1, 2], 3, 7);
    expect(result.fitted).toEqual([1, 2, 3, 1, 2]);
    expect(result.forecast).toEqual([3, 1, 2, 3, 1, 2, 3]);
    expect(result.residualSd).toBe(0);
  });

  it('moving average không nhìn trước và giữ trung bình cuối khi dự báo', () => {
    const result = movingAverage([2, 4, 6, 8, 100], 2, 3);
    expect(result.fitted).toEqual([2, 2, 3, 5, 7]);
    expect(result.forecast).toEqual([54, 54, 54]);
  });

  it.each([0, 17])('chuỗi hằng %s có dự báo hằng và SD bằng 0', (value) => {
    const y = Array<number>(21).fill(value);
    for (const result of [naive(y, 7), seasonalNaive(y, 7, 7), movingAverage(y, 7, 7)]) {
      expect(result.forecast).toEqual(Array<number>(7).fill(value));
      expect(result.residualSd).toBeCloseTo(0);
    }
  });

  it('chấp nhận horizon 0, một quan sát và cửa sổ dài hơn lịch sử', () => {
    expect(naive([5], 0)).toEqual({ fitted: [5], forecast: [], residualSd: 0 });
    expect(movingAverage([5], 7, 2).forecast).toEqual([5, 5]);
    expect(seasonalNaive([5], 1, 2).forecast).toEqual([5, 5]);
  });

  it.each([[], [-1], [NaN], [Infinity]].map((y) => ({ y })))('từ chối chuỗi rỗng hoặc quan sát lỗi $y', ({ y }) => {
    expect(() => naive(y, 2)).toThrow(RangeError);
    expect(() => movingAverage(y, 7, 2)).toThrow(RangeError);
    expect(() => seasonalNaive(y, 1, 2)).toThrow(RangeError);
  });

  it.each([-1, 1.5, Infinity, NaN])('từ chối horizon không hợp lệ %s', (h) => {
    expect(() => naive([1, 2], h)).toThrow(RangeError);
    expect(() => movingAverage([1, 2], 7, h)).toThrow(RangeError);
    expect(() => seasonalNaive([1, 2], 1, h)).toThrow(RangeError);
  });

  it('từ chối chu kỳ/cửa sổ sai và lịch sử chưa đủ một chu kỳ', () => {
    expect(() => seasonalNaive([1, 2], 7, 1)).toThrow(RangeError);
    expect(() => seasonalNaive([1, 2], 0, 1)).toThrow(RangeError);
    expect(() => movingAverage([1, 2], 0, 1)).toThrow(RangeError);
    expect(() => movingAverage([1, 2], 1.5, 1)).toThrow(RangeError);
  });

  it('không sửa dữ liệu đầu vào', () => {
    const y = [1, 2, 4, 8];
    const original = [...y];
    naive(y, 2);
    seasonalNaive(y, 2, 2);
    movingAverage(y, 2, 2);
    expect(y).toEqual(original);
  });
});
