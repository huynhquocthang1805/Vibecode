import { describe, expect, it } from 'vitest';

import type { DailyEntry } from '@/types/domain';

import { comparePeriods } from './compare';
import { buildRollups, getSeries } from './rollup';

function makeEntry(campaignId: string, date: string, reach: number, clicks: number, cost: number, orders: number): DailyEntry {
  return {
    id: `${campaignId}|${date}`,
    campaignId,
    date,
    reach,
    clicks,
    cost,
    orders,
    source: 'manual',
    createdAt: 1730000000000,
    updatedAt: 1730000000000,
  };
}

describe('DATA-05 · comparePeriods (Like-for-like)', () => {
  it('E21: So sánh 29 ngày đầu tháng, loại ngày 30 tháng trước khỏi phép so', () => {
    // 29 ngày của tháng 9 (từ 01 đến 29)
    const entries: DailyEntry[] = [];
    for (let day = 1; day <= 29; day++) {
      const dStr = String(day).padStart(2, '0');
      entries.push(makeEntry('default', `2026-09-${dStr}`, 10, 1, 100, 1));
    }
    // Ngày 30/09 (giá trị đột biến để kiểm tra loại trừ)
    entries.push(makeEntry('default', '2026-09-30', 10000, 1000, 100000, 100));

    // 29 ngày của tháng 10 (từ 01 đến 29)
    for (let day = 1; day <= 29; day++) {
      const dStr = String(day).padStart(2, '0');
      entries.push(makeEntry('default', `2026-10-${dStr}`, 20, 2, 200, 2));
    }

    const index = buildRollups(entries);
    const monthSeries = getSeries(index, {
      campaignId: 'default',
      grain: 'month',
      range: { from: '2026-09-01', to: '2026-10-31' },
      today: '2026-10-29',
    });
    const dailySeries = getSeries(index, {
      campaignId: 'default',
      grain: 'day',
      range: { from: '2026-09-01', to: '2026-10-31' },
      today: '2026-10-29',
    });

    const cmp = comparePeriods(monthSeries, '2026-10-29', dailySeries);

    expect(cmp).not.toBeNull();
    expect(cmp!.likeForLike).toBe(true);
    expect(cmp!.current.key).toBe('2026-10');
    expect(cmp!.previous?.key).toBe('2026-09');

    // 29 ngày của tháng 10: 29 * 20 = 580 reach, clicks 58, cost 5800, orders 58
    expect(cmp!.current.reach).toBe(580);
    expect(cmp!.current.clicks).toBe(58);
    expect(cmp!.current.cost).toBe(5800);
    expect(cmp!.current.orders).toBe(58);

    // 29 ngày đầu tháng 9: 29 * 10 = 290 reach, clicks 29, cost 2900, orders 29
    expect(cmp!.previous?.reach).toBe(290);
    expect(cmp!.previous?.clicks).toBe(29);
    expect(cmp!.previous?.cost).toBe(2900);
    expect(cmp!.previous?.orders).toBe(29);

    // deltaPct: (580 - 290) / 290 * 100 = 100%
    expect(cmp!.deltaPct.reach).toBe(100);
    expect(cmp!.deltaPct.clicks).toBe(100);
    expect(cmp!.deltaPct.cost).toBe(100);
    expect(cmp!.deltaPct.orders).toBe(100);
    expect(cmp!.deltaPct.ctr).toBe(0);
    expect(cmp!.deltaPct.cpc).toBe(0);
    expect(cmp!.deltaPct.cpa).toBe(0);
    expect(cmp!.deltaPct.cvr).toBe(0);
  });

  it('E22: Ngày 31 tháng 3: giới hạn kỳ trước ở 28 ngày của tháng 2', () => {
    const entries: DailyEntry[] = [];
    // Tháng 2 năm 2026 có 28 ngày
    for (let day = 1; day <= 28; day++) {
      const dStr = String(day).padStart(2, '0');
      entries.push(makeEntry('default', `2026-02-${dStr}`, 100, 5, 10000, 1));
    }
    // Tháng 3 năm 2026: 31 ngày
    for (let day = 1; day <= 31; day++) {
      const dStr = String(day).padStart(2, '0');
      entries.push(makeEntry('default', `2026-03-${dStr}`, 120, 6, 12000, 1));
    }

    const index = buildRollups(entries);
    const monthSeries = getSeries(index, {
      campaignId: 'default',
      grain: 'month',
      range: { from: '2026-02-01', to: '2026-03-31' },
      today: '2026-03-31',
    });
    const dailySeries = getSeries(index, {
      campaignId: 'default',
      grain: 'day',
      range: { from: '2026-02-01', to: '2026-03-31' },
      today: '2026-03-31',
    });

    const cmp = comparePeriods(monthSeries, '2026-03-31', dailySeries);
    expect(cmp).not.toBeNull();
    expect(cmp!.likeForLike).toBe(true);
    expect(cmp!.previous?.daysInPeriod).toBe(28);
    expect(cmp!.previous?.start).toBe('2026-02-01');
    expect(cmp!.previous?.end).toBe('2026-02-28');
  });

  it('không có daily series -> likeForLike = false', () => {
    const entries: DailyEntry[] = [
      makeEntry('default', '2026-10-10', 100, 10, 1000, 1),
    ];
    const index = buildRollups(entries);
    const monthSeries = getSeries(index, {
      campaignId: 'default',
      grain: 'month',
      today: '2026-10-20',
    });

    const cmp = comparePeriods(monthSeries, '2026-10-20');
    expect(cmp).not.toBeNull();
    expect(cmp!.likeForLike).toBe(false);
  });
});
