// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DailyEntry, PersistedState, StorageAdapter } from '@/types/domain';
import { LIMITS } from '@/types/domain';

import { applyRemoteDelta, drainPendingRemote, getStorageAdapter, setStorageAdapter, useDataStore } from './store';

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

  it('review (vai Huy): delta tới khi CHƯA hydrate → không áp, không ghi (tránh lưu [] + 1 dòng đè mất dữ liệu cũ)', async () => {
    vi.useFakeTimers();
    const saved: PersistedState[] = [];
    setStorageAdapter({
      kind: 'memory',
      load: async () => null,
      save: async (st) => {
        saved.push(st);
      },
      clear: async () => {},
      usage: async () => ({ usedBytes: 0, quotaBytes: 1 }),
    });
    const mk = (date: string): DailyEntry => ({
      id: `default|${date}`,
      date,
      campaignId: 'default',
      reach: 1000,
      clicks: 20,
      cost: 100000,
      orders: 2,
      source: 'manual',
      createdAt: 0,
      updatedAt: 0,
    });
    // tab vừa mở: chưa tải xong dữ liệu đã lưu (2 dòng cũ)
    useDataStore.setState({ hydrated: false, entries: [], revision: 1 });
    applyRemoteDelta({ added: [mk('2026-11-05')], removed: [] }, 2);
    await vi.advanceTimersByTimeAsync(LIMITS.PERSIST_DEBOUNCE_MS + 50);
    expect(useDataStore.getState().entries).toHaveLength(0);
    expect(saved).toHaveLength(0);
    // hydrate xong với 2 dòng cũ → áp delta xếp hàng lên trên → lưu đủ 3 dòng
    useDataStore.setState({ hydrated: true, entries: [mk('2026-11-03'), mk('2026-11-04')], revision: 2 });
    expect(drainPendingRemote()).toBe(1);
    await vi.advanceTimersByTimeAsync(LIMITS.PERSIST_DEBOUNCE_MS + 50);
    expect(saved.at(-1)!.entries.map((e) => e.date).sort()).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(drainPendingRemote()).toBe(0); // hàng đợi đã rỗng
  });
});

