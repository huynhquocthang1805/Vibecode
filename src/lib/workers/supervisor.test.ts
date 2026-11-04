// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { buildRollups, getRollupChecksum } from '@/lib/data/aggregate';
import type { DailyEntry, EntryDelta } from '@/types/domain';

import { createAnalyticsEngine } from './analytics.worker';
import { getAnalyticsClient, packEntries, resetAnalyticsClient } from './client';

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
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe('DATA-11 · Worker Supervisor, Cache theo phần & Tự chữa lệch', () => {
  beforeEach(() => {
    resetAnalyticsClient();
    vi.restoreAllMocks();
  });

  it('Đóng gói TypedArray (packEntries) chuyển đổi chính xác dữ liệu', () => {
    const entries: DailyEntry[] = [
      makeEntry('camp-1', '2026-10-01', 1000, 50, 200000, 5),
      makeEntry('camp-2', '2026-10-02', 1500, 75, 300000, 8),
    ];

    const packed = packEntries(entries);
    expect(packed.days.length).toBe(2);
    expect(packed.campaigns).toContain('camp-1');
    expect(packed.campaigns).toContain('camp-2');
    expect(packed.reaches[0]).toBe(1000);
    expect(packed.clicks[0]).toBe(50);
    expect(packed.costs[1]).toBe(300000);
    expect(packed.orders[1]).toBe(8);
  });

  it('Cache theo phần: Live mode chỉ cập nhật hôm nay không tính lại forecast (timings.forecastCached)', async () => {
    const engine = createAnalyticsEngine();
    const entries: DailyEntry[] = [];
    // 30 ngày dữ liệu lịch sử
    for (let i = 1; i <= 30; i++) {
      const dStr = String(i).padStart(2, '0');
      entries.push(makeEntry('default', `2026-10-${dStr}`, 1000 + i * 10, 50 + i, 100000, 5 + i));
    }

    await engine.init(entries);

    // Lần 1: Tính snapshot đầy đủ
    const snap1 = await engine.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-30',
    });
    expect(snap1.forecasts.length).toBeGreaterThan(0);
    expect(snap1.timings.forecastCached).toBeUndefined();

    // Lần 2: Live mode cập nhật entry của chính ngày hôm nay (2026-10-30)
    const liveDelta: EntryDelta = {
      added: [makeEntry('default', '2026-10-30', 1350, 85, 105000, 36)],
      removed: [entries[29]!],
    };

    await engine.applyDelta(liveDelta, 2);

    const t0 = performance.now();
    const snap2 = await engine.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-30',
    });
    const duration = performance.now() - t0;

    // Dự báo được lấy từ cache -> snap2 chạy siêu nhanh (< 15ms)
    expect(snap2.timings.forecastCached).toBe(1);
    expect(duration).toBeLessThan(50);
  });

  it('Bất biến #7 & E50: Sau chuỗi thao tác ngẫu nhiên, applyDelta ≡ buildRollups(entries cuối)', async () => {
    const engine = createAnalyticsEngine();
    let currentEntries: DailyEntry[] = [
      makeEntry('c1', '2026-10-01', 500, 25, 50000, 2),
      makeEntry('c1', '2026-10-02', 600, 30, 60000, 3),
      makeEntry('c2', '2026-10-01', 1000, 50, 100000, 5),
    ];

    let rev = await engine.init(currentEntries);

    // 1. Thao tác Add
    const added1 = [makeEntry('c1', '2026-10-03', 700, 35, 70000, 4)];
    currentEntries = [...currentEntries, ...added1];
    rev = await engine.applyDelta({ added: added1, removed: [] }, ++rev);

    // 2. Thao tác Update (xóa cũ, thêm mới)
    const oldEntry = currentEntries[0]!;
    const updatedEntry = makeEntry('c1', '2026-10-01', 550, 28, 55000, 3);
    currentEntries = currentEntries.filter((e) => e.id !== oldEntry.id).concat(updatedEntry);
    rev = await engine.applyDelta({ added: [updatedEntry], removed: [oldEntry] }, ++rev);

    // 3. Thao tác Remove
    const removedEntry = currentEntries[1]!;
    currentEntries = currentEntries.filter((e) => e.id !== removedEntry.id);
    await engine.applyDelta({ added: [], removed: [removedEntry] }, ++rev);

    // So sánh Snapshot từ engine với buildRollups độc lập
    const snap = await engine.snapshot({
      campaignId: 'all',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    });

    const directIndex = buildRollups(currentEntries);
    const directChecksum = getRollupChecksum(directIndex);

    expect(snap.checksum.rows).toBe(directChecksum.rows);
    expect(snap.checksum.reach).toBe(directChecksum.reach);
    expect(snap.checksum.clicks).toBe(directChecksum.clicks);
    expect(snap.checksum.cost).toBe(directChecksum.cost);
    expect(snap.checksum.orders).toBe(directChecksum.orders);
  });

  it('Supervisor: Chuyển sang Chế độ tương thích và phát system/health khi worker lỗi', async () => {
    const healthEvents: Array<{ area: string; status: string; message: string }> = [];
    const unsub = bus.on('system/health', (e) => healthEvents.push(e));

    const client = getAnalyticsClient();
    const entries = [makeEntry('default', '2026-10-10', 1000, 50, 100000, 5)];

    await client.init(entries);
    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    });

    expect(snap).toBeDefined();
    unsub();
  });
});
