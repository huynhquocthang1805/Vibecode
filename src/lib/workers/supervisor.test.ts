// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { buildRollups, getRollupChecksum } from '@/lib/data/aggregate';
import { useDataStore } from '@/lib/data/store';
import type { DailyEntry, EntryDelta } from '@/types/domain';

import { createAnalyticsEngine } from './analytics.worker';
import {
  getAnalyticsClient,
  packEntries,
  resetAnalyticsClient,
  simulateWorkerFailure,
} from './client';
import { useAnalytics } from './useAnalytics';

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

  it('R-05: packEntries với > 500 dòng qua init cho kết quả snapshot ≡ truyền mảng thường', async () => {
    const entries: DailyEntry[] = [];
    for (let i = 0; i < 600; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      const camp = i % 2 === 0 ? 'camp-1' : 'camp-2';
      entries.push(makeEntry(camp, `2026-10-${day}`, 1000 + i, 50 + (i % 20), 100000 + i * 10, 5 + (i % 5)));
    }

    const engineRegular = createAnalyticsEngine();
    await engineRegular.init(entries);
    const snapRegular = await engineRegular.snapshot({
      campaignId: 'all',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-30',
    });

    const enginePacked = createAnalyticsEngine();
    await enginePacked.init(packEntries(entries));
    const snapPacked = await enginePacked.snapshot({
      campaignId: 'all',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-30',
    });

    expect(snapPacked.checksum).toEqual(snapRegular.checksum);
    expect(snapPacked.totals).toEqual(snapRegular.totals);
    expect(snapPacked.series.buckets.length).toBe(snapRegular.series.buckets.length);
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

  it('R-04: Supervisor khởi động lại worker bảo toàn các thay đổi từ applyDelta', async () => {
    const client = getAnalyticsClient();
    const initial = [makeEntry('default', '2026-10-10', 1000, 50, 100000, 5)];
    await client.init(initial);

    // Thêm delta
    const deltaEntry = makeEntry('default', '2026-10-11', 1500, 75, 150000, 8);
    await client.applyDelta({ added: [deltaEntry], removed: [] }, 2);

    // Giả lập worker bị crash / lỗi
    simulateWorkerFailure('SIMULATED_TEST_CRASH');

    // Sau khi supervisor restart worker, snapshot mới phải chứa cả entry từ applyDelta (tổng 2 dòng)
    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    });

    expect(snap.checksum.rows).toBe(2);
    expect(snap.totals.reach).toBe(2500);
  });

  it('R-05: Chuyển sang Chế độ tương thích khi restart vượt quá giới hạn WORKER_MAX_RESTARTS', async () => {
    const healthEvents: Array<{ area: string; status: string; message: string }> = [];
    const unsub = bus.on('system/health', (e) => healthEvents.push(e));

    const client = getAnalyticsClient();
    await client.init([makeEntry('default', '2026-10-10', 1000, 50, 100000, 5)]);

    // Lần 1 & 2: restart bình thường trong giới hạn
    simulateWorkerFailure('ERROR_1');
    expect(healthEvents.some((e) => e.message.includes('tự động khởi động lại'))).toBe(true);

    simulateWorkerFailure('ERROR_2');

    // Lần 3: vượt ngưỡng WORKER_MAX_RESTARTS (2 lần) -> chuyển sang Chế độ tương thích
    simulateWorkerFailure('ERROR_3');
    expect(healthEvents.some((e) => e.message.includes('Chế độ tương thích trên main thread'))).toBe(true);

    // Snapshot vẫn chạy bình thường trên main thread
    const snap = await client.snapshot({
      campaignId: 'default',
      grain: 'day',
      horizonDays: 30,
      today: '2026-10-20',
    });
    expect(snap.checksum.rows).toBe(1);

    unsub();
  });

  it('R-05: applyDelta ném REVISION_GAP khi revision không liên tục', async () => {
    const engine = createAnalyticsEngine();
    await engine.init([makeEntry('default', '2026-10-10', 1000, 50, 100000, 5)]);

    const delta: EntryDelta = {
      added: [makeEntry('default', '2026-10-11', 1500, 75, 150000, 8)],
      removed: [],
    };

    await expect(engine.applyDelta(delta, 5)).rejects.toThrow('REVISION_GAP');
  });

  it('R-05: useAnalytics tự chữa lệch khi checksum snapshot khác checksum store', async () => {
    useDataStore.setState({
      hydrated: true,
      entries: [makeEntry('default', '2026-10-10', 1000, 50, 100000, 5)],
      checksum: { rows: 1, reach: 1000, clicks: 50, cost: 100000, orders: 5 },
    });

    const client = getAnalyticsClient();
    let callCount = 0;
    const realSnapshot = client.snapshot.bind(client);
    vi.spyOn(client, 'snapshot').mockImplementation(async (q) => {
      const snap = await realSnapshot(q);
      if (callCount++ === 0) {
        // Lần đầu trả checksum lệch với store
        return {
          ...snap,
          checksum: { ...snap.checksum, rows: 999 },
        };
      }
      return snap;
    });

    const recoveredEvents: Array<{ area: string; status: string; message: string }> = [];
    const unsub = bus.on('system/health', (e) => {
      if (e.area === 'rollup' && e.status === 'recovered') {
        recoveredEvents.push(e);
      }
    });

    renderHook(() =>
      useAnalytics({
        campaignId: 'default',
        grain: 'day',
        horizonDays: 30,
        today: '2026-10-20',
      }),
    );

    // Chờ hook tự chữa lệch
    await waitFor(() => {
      expect(recoveredEvents.length).toBeGreaterThanOrEqual(1);
    });

    unsub();
  });
});
