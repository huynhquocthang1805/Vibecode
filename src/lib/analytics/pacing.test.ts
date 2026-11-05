import { describe, expect, it } from 'vitest';

import type { Nowcast, Totals } from '@/types/domain';

import { computePacing, computeRequiredDailyRate } from './pacing';

describe('FC-08 computePacing', () => {
  const mockProjected: Nowcast['projected'] = {
    reach: { mean: 12000, lo80: 10000, hi80: 14000 },
    clicks: { mean: 1200, lo80: 1000, hi80: 1400 },
    cost: { mean: 4500000, lo80: 4000000, hi80: 5000000 },
    orders: { mean: 150, lo80: 130, hi80: 170 },
  };

  it('tính đúng % hoàn thành mục tiêu (pacing = projected / target * 100)', () => {
    const target: Partial<Totals> = {
      orders: 100, // 150 / 100 = 150%
      cost: 5000000, // 4.5M / 5M = 90%
    };

    const pacing = computePacing(mockProjected, target);

    expect(pacing.orders).toBe(150);
    expect(pacing.cost).toBe(90);
    expect(pacing.reach).toBeUndefined();
    expect(pacing.clicks).toBeUndefined();
  });

  it('xử lý target đầy đủ cả 4 chỉ số cơ sở', () => {
    const target: Totals = {
      reach: 10000,
      clicks: 1000,
      cost: 4500000,
      orders: 150,
    };

    const pacing = computePacing(mockProjected, target);

    expect(pacing.reach).toBe(120);
    expect(pacing.clicks).toBe(120);
    expect(pacing.cost).toBe(100);
    expect(pacing.orders).toBe(100);
  });

  it('trả về đối tượng rỗng khi target hoặc projected không có hoặc rỗng', () => {
    expect(computePacing(mockProjected, {})).toEqual({});
    expect(computePacing(null as unknown as Nowcast['projected'], { orders: 100 })).toEqual({});
    expect(computePacing(mockProjected, null as unknown as Partial<Totals>)).toEqual({});
  });

  it('bỏ qua chỉ số khi target = 0 (tránh chia 0)', () => {
    const target: Partial<Totals> = {
      orders: 0,
      cost: 5000000,
    };

    const pacing = computePacing(mockProjected, target);

    expect(pacing.orders).toBeUndefined();
    expect(pacing.cost).toBe(90);
  });

  it('từ chối target âm hoặc không hữu hạn (NaN, Infinity)', () => {
    expect(() => computePacing(mockProjected, { orders: -10 })).toThrow(RangeError);
    expect(() => computePacing(mockProjected, { cost: NaN })).toThrow(RangeError);
    expect(() => computePacing(mockProjected, { clicks: Infinity })).toThrow(RangeError);
  });

  it('từ chối projected mean âm hoặc không hữu hạn', () => {
    const invalidProjected = {
      ...mockProjected,
      orders: { mean: -5, lo80: 0, hi80: 10 },
    };
    expect(() => computePacing(invalidProjected, { orders: 100 })).toThrow(RangeError);

    const nanProjected = {
      ...mockProjected,
      orders: { mean: NaN, lo80: 0, hi80: 10 },
    };
    expect(() => computePacing(nanProjected, { orders: 100 })).toThrow(RangeError);
  });

  it('không làm thay đổi (mutate) tham số đầu vào', () => {
    const target: Partial<Totals> = { orders: 100 };
    const targetClone = structuredClone(target);
    const projectedClone = structuredClone(mockProjected);

    computePacing(mockProjected, target);

    expect(target).toEqual(targetClone);
    expect(mockProjected).toEqual(projectedClone);
  });
});

describe('FC-08 computeRequiredDailyRate', () => {
  it('tính số lượng cần trung bình mỗi ngày trong các ngày còn lại', () => {
    // Cần 50 đơn nữa trong 5 ngày -> 10 đơn/ngày
    expect(computeRequiredDailyRate(50, 5)).toBe(10);
    // Đã vượt mục tiêu (còn -10 đơn) -> 0 đơn/ngày
    expect(computeRequiredDailyRate(-10, 5)).toBe(0);
  });

  it('trả về null khi số ngày còn lại <= 0 hoặc số không hợp lệ', () => {
    expect(computeRequiredDailyRate(50, 0)).toBeNull();
    expect(computeRequiredDailyRate(50, -2)).toBeNull();
    expect(computeRequiredDailyRate(NaN, 5)).toBeNull();
    expect(computeRequiredDailyRate(50, Infinity)).toBeNull();
  });
});

