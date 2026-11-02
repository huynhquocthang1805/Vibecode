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

  it('loadMock loads predefined mock dataset', async () => {
    await useDataStore.getState().loadMock('demo-30d');
    const entries = useDataStore.getState().entries;
    expect(entries.length).toBe(30);
    expect(useDataStore.getState().checksum.rows).toBe(30);
  });
});
