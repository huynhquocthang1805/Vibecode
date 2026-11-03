import { describe, expect, it } from 'vitest';

import type { DailyEntry, EntryDelta } from '@/types/domain';

import { getAnalyticsClient } from './client';

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

describe('DATA-06 · AnalyticsWorker & Client', () => {
  it('init và snapshot cơ bản', async () => {
    const client = getAnalyticsClient();
    const entries: DailyEntry[] = [
      makeEntry('default', '2026-10-10', 1000, 50, 100000, 5),
      makeEntry('default', '2026-10-11', 1200, 60, 120000, 6),
    ];

    const rev = await client.init(entries);
    expect(rev).toBe(1);

    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      range: { from: '2026-10-10', to: '2026-10-11' },
      horizonDays: 30,
      today: '2026-10-20',
    });

    expect(snap).toBeDefined();
    expect(snap.series.buckets).toHaveLength(2);
    expect(snap.totals.reach).toBe(2200);
    expect(snap.totals.clicks).toBe(110);
    expect(snap.checksum.rows).toBe(2);
    expect(snap.timings).toBeDefined();
    expect(typeof snap.timings.series).toBe('number');
  });

  it('applyDelta thành công khi revision = last + 1', async () => {
    const client = getAnalyticsClient();
    const entries: DailyEntry[] = [
      makeEntry('default', '2026-10-10', 1000, 50, 100000, 5),
    ];
    await client.init(entries);

    const delta: EntryDelta = {
      added: [makeEntry('default', '2026-10-11', 1500, 75, 150000, 8)],
      removed: [],
    };

    const nextRev = await client.applyDelta(delta, 2);
    expect(nextRev).toBe(2);

    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      range: { from: '2026-10-10', to: '2026-10-11' },
      horizonDays: 30,
      today: '2026-10-20',
    });

    expect(snap.totals.reach).toBe(2500);
    expect(snap.checksum.rows).toBe(2);
  });

  it('applyDelta ném REVISION_GAP khi revision không liên tục', async () => {
    const client = getAnalyticsClient();
    await client.init([makeEntry('default', '2026-10-10', 1000, 50, 100000, 5)]);

    const delta: EntryDelta = {
      added: [makeEntry('default', '2026-10-11', 1500, 75, 150000, 8)],
      removed: [],
    };

    // Revision nhảy cóc: đang ở 1 mà gửi revision 3
    await expect(client.applyDelta(delta, 3)).rejects.toThrow('REVISION_GAP');
  });

  it('tính forecastStatus = stale khi dữ liệu cũ > 14 ngày (E43)', async () => {
    const client = getAnalyticsClient();
    const entries: DailyEntry[] = [];
    // 10 ngày dữ liệu nhưng kết thúc ngày 2026-08-01 (cách 2026-10-20 hơn 30 ngày)
    for (let day = 1; day <= 10; day++) {
      const dStr = String(day).padStart(2, '0');
      entries.push(makeEntry('default', `2026-08-${dStr}`, 1000, 50, 100000, 5));
    }
    await client.init(entries);

    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    });

    expect(snap.forecastStatus).toBe('stale');
  });

  it('tính forecastStatus = insufficient khi < 7 ngày dữ liệu', async () => {
    const client = getAnalyticsClient();
    const entries: DailyEntry[] = [
      makeEntry('default', '2026-10-15', 1000, 50, 100000, 5),
      makeEntry('default', '2026-10-16', 1000, 50, 100000, 5),
    ];
    await client.init(entries);

    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    });

    expect(snap.forecastStatus).toBe('insufficient');
  });
});
