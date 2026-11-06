// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DailyEntry, PersistedState, StorageAdapter } from '@/types/domain';
import { LIMITS } from '@/types/domain';

import { applyRemoteDelta, getStorageAdapter, setStorageAdapter, useDataStore } from './store';

describe('TL-06d (BUG-QA04-01) · tab nhận dữ liệu từ tab khác cũng lưu', () => {
  const original = getStorageAdapter();
  afterEach(() => {
    setStorageAdapter(original);
    vi.useRealTimers();
  });

  it('applyRemoteDelta → sau debounce gọi adapter.save với dòng vừa nhận (reload tab nhận không mất)', async () => {
    vi.useFakeTimers();
    const saved: PersistedState[] = [];
    const fake: StorageAdapter = {
      kind: 'memory',
      load: async () => null,
      save: async (s) => {
        saved.push(s);
      },
      clear: async () => {},
      usage: async () => ({ usedBytes: 0, quotaBytes: 1 }),
    };
    setStorageAdapter(fake);
    useDataStore.setState({ entries: [], revision: 1 });
    const entry: DailyEntry = {
      id: 'default|2026-11-05',
      date: '2026-11-05',
      campaignId: 'default',
      reach: 1000,
      clicks: 20,
      cost: 100000,
      orders: 2,
      source: 'manual',
      createdAt: 0,
      updatedAt: 0,
    };
    applyRemoteDelta({ added: [entry], removed: [] }, 2);
    expect(useDataStore.getState().entries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(LIMITS.PERSIST_DEBOUNCE_MS + 50);
    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(saved.at(-1)!.entries.map((e) => e.id)).toEqual(['default|2026-11-05']);
  });
});
