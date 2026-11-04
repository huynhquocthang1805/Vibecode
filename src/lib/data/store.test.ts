// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { useDataStore } from './store';

describe('DATA-04: Zustand Data Store', () => {
  beforeEach(async () => {
    localStorage.clear();
    await useDataStore.getState().clearAll();
  });

  it('addEntries with policy "ask" detects conflicts and adds non-conflicting', () => {
    const store = useDataStore.getState();
    const initial = [
      { date: '2026-10-01', campaignId: 'c1', reach: 100, clicks: 10, cost: 500, orders: 1 },
    ];
    store.addEntries(initial, 'ask');

    expect(useDataStore.getState().entries.length).toBe(1);

    const nextBatch = [
      { date: '2026-10-01', campaignId: 'c1', reach: 200, clicks: 20, cost: 1000, orders: 2 },
      { date: '2026-10-02', campaignId: 'c1', reach: 300, clicks: 30, cost: 1500, orders: 3 },
    ];
    const res = useDataStore.getState().addEntries(nextBatch, 'ask');

    expect(res.added).toBe(1);
    expect(res.conflicts.length).toBe(1);
    expect(res.conflicts[0]?.date).toBe('2026-10-01');
    expect(useDataStore.getState().entries.length).toBe(2);
  });

  it('duplicate policies: overwrite, sum, skip', () => {
    const store = useDataStore.getState();
    store.addEntries(
      [{ date: '2026-10-01', campaignId: 'c1', reach: 100, clicks: 10, cost: 500, orders: 1 }],
      'overwrite',
    );

    // 1. sum
    useDataStore.getState().addEntries(
      [{ date: '2026-10-01', campaignId: 'c1', reach: 50, clicks: 5, cost: 250, orders: 1 }],
      'sum',
    );
    let entry = useDataStore.getState().entries[0];
    expect(entry?.reach).toBe(150);
    expect(entry?.clicks).toBe(15);
    expect(entry?.cost).toBe(750);
    expect(entry?.orders).toBe(2);

    // 2. overwrite
    useDataStore.getState().addEntries(
      [{ date: '2026-10-01', campaignId: 'c1', reach: 200, clicks: 20, cost: 1000, orders: 3 }],
      'overwrite',
    );
    entry = useDataStore.getState().entries[0];
    expect(entry?.reach).toBe(200);
    expect(entry?.cost).toBe(1000);

    // 3. skip
    useDataStore.getState().addEntries(
      [{ date: '2026-10-01', campaignId: 'c1', reach: 999, clicks: 99, cost: 9999, orders: 9 }],
      'skip',
    );
    entry = useDataStore.getState().entries[0];
    expect(entry?.reach).toBe(200); // unchanged
  });

  it('updateEntry modifies record and increments revision', () => {
    const store = useDataStore.getState();
    store.addEntries([
      { date: '2026-10-01', campaignId: 'default', reach: 100, clicks: 10, cost: 500, orders: 1 },
    ]);
    const id = 'default|2026-10-01';
    const revBefore = useDataStore.getState().revision;

    const res = useDataStore.getState().updateEntry(id, { clicks: 15 });
    expect(res.ok).toBe(true);

    const updated = useDataStore.getState().entries[0];
    expect(updated?.clicks).toBe(15);
    expect(useDataStore.getState().revision).toBeGreaterThan(revBefore);
  });

  it('removeEntries and undoLast reverts deletion', () => {
    const store = useDataStore.getState();
    store.addEntries([
      { date: '2026-10-01', campaignId: 'c1', reach: 100, clicks: 10, cost: 500, orders: 1 },
      { date: '2026-10-02', campaignId: 'c1', reach: 200, clicks: 20, cost: 1000, orders: 2 },
    ]);

    expect(useDataStore.getState().entries.length).toBe(2);

    const removed = useDataStore.getState().removeEntries(['c1|2026-10-01']);
    expect(removed.length).toBe(1);
    expect(useDataStore.getState().entries.length).toBe(1);

    const undone = useDataStore.getState().undoLast();
    expect(undone).toBe(true);
    expect(useDataStore.getState().entries.length).toBe(2);
  });

  it('DATA-04b: loadMock demo-30d loads fixture and registers default campaign', async () => {
    await useDataStore.getState().loadMock('demo-30d');
    const state = useDataStore.getState();
    expect(state.entries.length).toBe(30);
    expect(state.checksum.rows).toBe(30);
    expect(state.campaigns.some((c) => c.id === 'default')).toBe(true);
    expect(state.entries[0]?.source).toBe('mock');
  });

  it('DATA-04b: loadMock campaign-2y loads 2190 rows and registers 3 sample campaigns', async () => {
    await useDataStore.getState().loadMock('campaign-2y');
    const state = useDataStore.getState();
    expect(state.entries.length).toBe(2190);
    expect(state.checksum.rows).toBe(2190);

    const campIds = state.campaigns.map((c) => c.id);
    expect(campIds).toContain('thoi-trang');
    expect(campIds).toContain('my-pham');
    expect(campIds).toContain('do-gia-dung');

    const thoiTrang = state.campaigns.find((c) => c.id === 'thoi-trang');
    expect(thoiTrang?.name).toBe('Thời trang');

    const myPham = state.campaigns.find((c) => c.id === 'my-pham');
    expect(myPham?.name).toBe('Mỹ phẩm');

    const doGiaDung = state.campaigns.find((c) => c.id === 'do-gia-dung');
    expect(doGiaDung?.name).toBe('Đồ gia dụng');
  });

  it('DATA-04b: loadMock edge-cases loads valid edge cases', async () => {
    await useDataStore.getState().loadMock('edge-cases');
    const state = useDataStore.getState();
    expect(state.entries.length).toBeGreaterThan(0);
    expect(state.checksum.rows).toBe(state.entries.length);
  });
});
