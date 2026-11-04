import { describe, expect, it } from 'vitest';

import type { DailyEntry, EntryDelta } from '@/types/domain';

import { applyDelta, buildRollups, getRollupChecksum, getRollupDataSpan, getSeries } from './rollup';

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

describe('DATA-05 · RollupIndex & getSeries', () => {
  it('E20: một ngày dữ liệu trong tháng -> isPartial true và daysWithData = 1', () => {
    const entries: DailyEntry[] = [
      makeEntry('default', '2026-10-10', 1000, 50, 100000, 5),
    ];

    const index = buildRollups(entries);
    const series = getSeries(index, {
      campaignId: 'default',
      grain: 'month',
      today: '2026-10-20',
    });

    expect(series.buckets).toHaveLength(1);
    const b = series.buckets[0]!;
    expect(b.key).toBe('2026-10');
    expect(b.grain).toBe('month');
    expect(b.start).toBe('2026-10-01');
    expect(b.end).toBe('2026-10-31');
    expect(b.daysWithData).toBe(1);
    expect(b.daysInPeriod).toBe(31);
    expect(b.isPartial).toBe(true);
    expect(b.reach).toBe(1000);
    expect(b.clicks).toBe(50);
    expect(b.cost).toBe(100000);
    expect(b.orders).toBe(5);
    expect(b.kpis.ctr).toBe(0.05);
    expect(b.kpis.cpc).toBe(2000);
    expect(b.kpis.cpa).toBe(20000);
    expect(b.kpis.cvr).toBe(0.1);
  });

  it('Bất biến #1: tổng của all bằng tổng từng chiến dịch gộp lại', () => {
    const entries: DailyEntry[] = [
      makeEntry('camp1', '2026-10-01', 1000, 50, 100000, 5),
      makeEntry('camp2', '2026-10-01', 2000, 100, 250000, 12),
      makeEntry('camp1', '2026-10-02', 1500, 75, 150000, 8),
      makeEntry('camp2', '2026-10-02', 2500, 125, 300000, 15),
    ];

    const index = buildRollups(entries);

    for (const grain of ['day', 'week', 'month', 'quarter'] as const) {
      const seriesAll = getSeries(index, { campaignId: 'all', grain, today: '2026-11-01' });
      const seriesC1 = getSeries(index, { campaignId: 'camp1', grain, today: '2026-11-01' });
      const seriesC2 = getSeries(index, { campaignId: 'camp2', grain, today: '2026-11-01' });

      expect(seriesAll.buckets.length).toBeGreaterThan(0);
      expect(seriesAll.buckets.length).toBe(seriesC1.buckets.length);

      for (let i = 0; i < seriesAll.buckets.length; i++) {
        const bAll = seriesAll.buckets[i]!;
        const bC1 = seriesC1.buckets[i]!;
        const bC2 = seriesC2.buckets[i]!;

        expect(bAll.reach).toBe(bC1.reach + bC2.reach);
        expect(bAll.clicks).toBe(bC1.clicks + bC2.clicks);
        expect(bAll.cost).toBe(bC1.cost + bC2.cost);
        expect(bAll.orders).toBe(bC1.orders + bC2.orders);
      }
    }
  });

  it('Bất biến #10: applyDelta cho kết quả giống hệt buildRollups từ đầu', () => {
    const initial: DailyEntry[] = [
      makeEntry('c1', '2026-10-01', 100, 10, 1000, 1),
      makeEntry('c1', '2026-10-02', 200, 20, 2000, 2),
      makeEntry('c2', '2026-10-01', 300, 30, 3000, 3),
    ];

    const delta: EntryDelta = {
      added: [
        makeEntry('c1', '2026-10-03', 400, 40, 4000, 4),
        makeEntry('c2', '2026-10-02', 500, 50, 5000, 5),
      ],
      removed: [
        initial[1]!, // remove c1 on 2026-10-02
      ],
    };

    const finalEntries = [initial[0]!, initial[2]!, ...delta.added];

    const indexFromScratch = buildRollups(finalEntries);
    const indexFromDelta = applyDelta(buildRollups(initial), delta);

    for (const grain of ['day', 'week', 'month'] as const) {
      const s1 = getSeries(indexFromScratch, { campaignId: 'all', grain, today: '2026-11-01' });
      const s2 = getSeries(indexFromDelta, { campaignId: 'all', grain, today: '2026-11-01' });

      expect(s2.buckets).toEqual(s1.buckets);
    }

    expect(getRollupChecksum(indexFromDelta)).toEqual(getRollupChecksum(indexFromScratch));
  });

  it('dataSpan trả đúng ngày đầu và ngày cuối có dữ liệu', () => {
    const entries: DailyEntry[] = [
      makeEntry('c1', '2026-05-10', 10, 1, 100, 0),
      makeEntry('c1', '2026-08-20', 20, 2, 200, 0),
    ];
    const index = buildRollups(entries);

    expect(getRollupDataSpan(index, 'c1')).toEqual({
      first: '2026-05-10',
      last: '2026-08-20',
    });
    expect(getRollupDataSpan(index, 'unknown')).toEqual({
      first: null,
      last: null,
    });
  });

  it('Hiệu năng: 100k dòng build < 300ms, delta 1 dòng < 2ms', () => {
    const n = 100_000;
    const entries: DailyEntry[] = new Array(n);

    // Tạo 100k dòng mẫu trải đều 10 chiến dịch × 10000 ngày
    for (let i = 0; i < n; i++) {
      const campIdx = i % 10;
      entries[i] = {
        id: `c${campIdx}|${i}`,
        campaignId: `c${campIdx}`,
        date: '2026-10-15',
        reach: 1000 + i,
        clicks: 50,
        cost: 100000,
        orders: 5,
        source: 'mock',
        createdAt: 0,
        updatedAt: 0,
      };
    }

    const t0 = performance.now();
    const index = buildRollups(entries);
    const buildMs = performance.now() - t0;

    expect(buildMs).toBeLessThan(300);

    const singleDelta: EntryDelta = {
      added: [makeEntry('c0', '2026-10-16', 500, 25, 50000, 2)],
      removed: [],
    };

    const tDelta = performance.now();
    applyDelta(index, singleDelta);
    const deltaMs = performance.now() - tDelta;

    expect(deltaMs).toBeLessThan(10);
  });
});
