import { describe, expect, it, vi } from 'vitest';

import { LIMITS } from '@/types/domain';

import { backtest } from './backtest';
import * as evaluationModule from './evaluation';
import { fitBest, selectModel } from './fitBest';
import * as fitModule from './fitModel';

describe('backtest và chọn model FC-04', () => {
  it('chấm sMAPE và MAE trên dự báo, xử lý cả cặp 0/0', () => {
    const y = [...Array<number>(7).fill(2), 4, 0];
    expect(backtest(y, 'naive', 2, 1).mae).toBe(2);
    expect(backtest(y, 'naive', 2, 1).smape).toBeCloseTo(133.333333);
    expect(backtest(Array<number>(40).fill(0), 'naive', 7, 3)).toEqual({ smape: 0, mae: 0 });
  });

  it('mỗi fold chỉ fit quá khứ của chính fold đó', () => {
    const spy = vi.spyOn(fitModule, 'fitModel');
    const y = Array.from({ length: 70 }, (_, t) => t + 1);
    backtest(y, 'holt', 7, 3);
    expect(spy.mock.calls.map(([train]) => train.length)).toEqual([49, 56, 63]);
    for (const [train] of spy.mock.calls) expect(train).toEqual(y.slice(0, train.length));
    spy.mockRestore();
  });

  it('không nội suy train bằng quan sát thuộc holdout', () => {
    const spy = vi.spyOn(fitModule, 'fitModel');
    const y = [...Array<number>(13).fill(10), 0, ...Array<number>(7).fill(1000)];
    const mask = y.map((_, index) => index !== 13);
    evaluationModule.evaluateOrigins(y, 'naive', [14], 7, 7, mask);
    expect(spy.mock.calls[0]?.[0][13]).toBe(10);
    spy.mockRestore();
  });

  it('không chấm điểm ngày thiếu bằng giá trị nội suy giả', () => {
    const y = [...Array<number>(7).fill(10), 0, 10];
    const mask = y.map((_, index) => index !== 7);
    expect(evaluationModule.evaluateOrigins(y, 'naive', [7], 2, 7, mask)).toMatchObject({
      observations: 1,
      mae: 0,
      smape: 0,
    });
  });

  it('cắt lịch sử về LIMITS.FORECAST_WINDOW_DAYS trước khi đánh giá', () => {
    const tail = Array.from({ length: LIMITS.FORECAST_WINDOW_DAYS }, (_, t) => 10 + t);
    expect(backtest([...Array<number>(400).fill(1e9), ...tail], 'naive', 7, 3)).toEqual(backtest(tail, 'naive', 7, 3));
    expect(fitBest([...Array<number>(400).fill(1e9), ...tail], 7)).toEqual(fitBest(tail, 7));
  });

  it.each([
    { smape: 95.1, expected: 'seasonal_naive' },
    { smape: 95, expected: 'naive' },
  ])('ngưỡng cải thiện 5% với sMAPE ứng viên $smape', ({ smape, expected }) => {
    const spy = vi.spyOn(evaluationModule, 'evaluateOrigins').mockImplementation((_y, model) => ({
      smape: model === 'seasonal_naive' ? 100 : model === 'naive' ? smape : 150,
      mae: 1,
      folds: 3,
      observations: 21,
    }));
    expect(fitBest(Array<number>(60).fill(10), 7).model).toBe(expected);
    spy.mockRestore();
  });

  it('giữ baseline khi sai số bằng 0, không chọn model phức tạp khi hòa', () => {
    const result = selectModel(Array<number>(60).fill(0), 7);
    expect(result.fit.model).toBe('seasonal_naive');
    expect(result.evaluation?.smape).toBe(0);
    expect(result.baselineSmape).toBe(0);
  });

  it('chọn Holt cho xu hướng tuyến tính thay vì baseline chậm một tuần', () => {
    expect(
      fitBest(
        Array.from({ length: 80 }, (_, t) => 100 + 5 * t),
        7,
      ).model,
    ).toBe('holt');
  });

  it('lịch sử ngắn không giả số đo bằng 0', () => {
    const selected = selectModel(Array<number>(10).fill(5), 7);
    expect(selected.fit.model).toBe('naive');
    expect(selected.evaluation).toBeNull();
    expect(selected.baselineSmape).toBeNull();
    expect(() => backtest(Array<number>(10).fill(5), 'naive', 7, 3)).toThrow('FORECAST_INSUFFICIENT_BACKTEST');
  });

  it('từ chối horizon, folds, chu kỳ, chuỗi không hợp lệ', () => {
    expect(() => backtest([1, 2], 'naive', 0, 3)).toThrow(RangeError);
    expect(() => backtest([1, 2], 'naive', 7, -1)).toThrow(RangeError);
    expect(() => fitBest(Array<number>(30).fill(1), 1)).toThrow(RangeError);
    expect(() => fitBest([NaN, 1, 2, 3, 4, 5, 6], 7)).toThrow(RangeError);
  });
});
