// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import type { DailyEntry, PersistedState } from '@/types/domain';
import { CONTRACT_VERSION } from '@/types/domain';

import { decodeState, encodeState } from './codec';
import { createLocalStorageAdapter } from './localStorageAdapter';
import { migrate } from './migrate';

describe('DATA-03: Storage, Codec & Migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleState: PersistedState = {
    v: CONTRACT_VERSION,
    campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: 1730000000000 }],
    entries: [
      {
        id: 'default|2026-10-01',
        date: '2026-10-01',
        campaignId: 'default',
        reach: 12000,
        clicks: 240,
        cost: 1500000,
        orders: 8,
        source: 'manual',
        createdAt: 1730000000000,
        updatedAt: 1730000000000,
      },
      {
        id: 'default|2026-10-02',
        date: '2026-10-02',
        campaignId: 'default',
        reach: 13500,
        clicks: 310,
        cost: 1620000,
        orders: 11,
        source: 'csv',
        createdAt: 1730000000000,
        updatedAt: 1730000000000,
      },
    ],
    settings: {
      activeCampaignId: 'all',
      grain: 'day',
      range: null,
      liveMode: false,
      liveSpeed: 1,
      targets: {},
      reportFormat: 'short',
      duplicatePolicy: 'ask',
    },
  };

  it('codec roundtrip preserves all entry data without storing id/t', () => {
    const encoded = encodeState(sampleState);
    expect(typeof encoded).toBe('string');
    // Ensure id and t columns are not stored in raw payload
    expect(encoded).not.toContain('"id":[');
    expect(encoded).not.toContain('"t":[');

    const decoded = decodeState(encoded);
    expect(decoded.v).toBe(1);
    expect(decoded.entries.length).toBe(2);

    expect(decoded.entries[0]?.id).toBe('default|2026-10-01');
    expect(decoded.entries[0]?.reach).toBe(12000);
    expect(decoded.entries[0]?.clicks).toBe(240);
    expect(decoded.entries[0]?.cost).toBe(1500000);
    expect(decoded.entries[0]?.orders).toBe(8);
    expect(decoded.entries[0]?.source).toBe('manual');

    expect(decoded.entries[1]?.id).toBe('default|2026-10-02');
    expect(decoded.entries[1]?.source).toBe('csv');
  });

  it('50.000 rows encoded size is <= 3.5MB', () => {
    const entries: DailyEntry[] = [];
    for (let i = 0; i < 50_000; i++) {
      entries.push({
        id: `default|2024-01-01`,
        date: '2024-01-01',
        campaignId: 'default',
        reach: 15000,
        clicks: 300,
        cost: 2000000,
        orders: 15,
        source: 'manual',
        createdAt: 1730000000000,
        updatedAt: 1730000000000,
      });
    }

    const state50k: PersistedState = {
      ...sampleState,
      entries,
    };

    const encoded = encodeState(state50k);
    const sizeInMB = new Blob([encoded]).size / (1024 * 1024);
    expect(sizeInMB).toBeLessThanOrEqual(3.5);
  });

  it('migrate: converts v0 prototype array into PersistedState v1', () => {
    const v0Array = [
      { date: '2026-05-10', reach: 500, clicks: 25, cost: 100000, orders: 2 },
      { date: '2026-05-11', reach: 600, clicks: 30, cost: 120000, orders: 3 },
    ];
    const migrated = migrate(v0Array);
    expect(migrated.v).toBe(1);
    expect(migrated.entries.length).toBe(2);
    expect(migrated.entries[0]?.id).toBe('default|2026-05-10');
    expect(migrated.entries[0]?.campaignId).toBe('default');
  });

  it('localStorageAdapter: saves, loads, usage and clears cleanly', async () => {
    const adapter = createLocalStorageAdapter('test-storage-key');
    await adapter.save(sampleState);

    const loaded = await adapter.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.entries.length).toBe(2);

    const { usedBytes } = await adapter.usage();
    expect(usedBytes).toBeGreaterThan(0);

    await adapter.clear();
    const emptyLoad = await adapter.load();
    expect(emptyLoad).toBeNull();
  });

  it('localStorageAdapter: handles corrupt JSON gracefully without crashing', async () => {
    localStorage.setItem('corrupt-test-key', '{ invalid json corrupt: true');
    const adapter = createLocalStorageAdapter('corrupt-test-key');

    const loaded = await adapter.load();
    expect(loaded).toBeNull();
  });
});
