// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '@/lib/data/realtime/bus';
import { createLocalStorageAdapter, DEFAULT_STORAGE_KEY } from '@/lib/data/storage/localStorageAdapter';
import { DEFAULT_SETTINGS, setStorageAdapter, useDataStore } from '@/lib/data/store';
import { addDays } from '@/lib/domain/dates';
import { getAnalyticsClient, packEntries, resetAnalyticsClient } from '@/lib/workers/client';
import { CONTRACT_VERSION, LIMITS, type DailyEntry, type PersistedState } from '@/types/domain';

const rows: DailyEntry[] = Array.from({ length: 600 }, (_, i) => {
  const date = addDays('2025-01-01', i);
  return {
    id: `default|${date}`,
    campaignId: 'default',
    date,
    reach: 1000 + i,
    clicks: 20,
    cost: 100000,
    orders: 2,
    source: 'csv',
    createdAt: 0,
    updatedAt: 0,
  };
});
const payload = (entries = rows): PersistedState => ({
  v: CONTRACT_VERSION,
  campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: 0 }],
  entries,
  settings: DEFAULT_SETTINGS,
});
const business = (entries: DailyEntry[]) =>
  entries.map(({ createdAt: _created, updatedAt: _updated, ...entry }) => entry);

beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T05:00:00Z'));
  setStorageAdapter(createLocalStorageAdapter());
  await useDataStore.getState().clearAll();
  useDataStore.setState({ settings: { ...DEFAULT_SETTINGS } });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetAnalyticsClient();
});

describe('QA-02 · store → persistence → reload', () => {
  it('giữ nguyên dữ liệu và settings sau import, lưu debounce và hydrate module mới', async () => {
    expect(useDataStore.getState().importBatch(rows, 'csv', 'overwrite').accepted).toBe(600);
    useDataStore.getState().setSettings({ grain: 'month', activeCampaignId: 'default' });
    await vi.advanceTimersByTimeAsync(LIMITS.PERSIST_DEBOUNCE_MS + 1);
    expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).not.toBeNull();
    vi.resetModules();
    const fresh = await import('@/lib/data/store');
    await vi.advanceTimersByTimeAsync(1);
    expect(fresh.useDataStore.getState().hydrated).toBe(true);
    expect(business(fresh.useDataStore.getState().entries)).toEqual(business(rows));
    expect(fresh.useDataStore.getState().settings).toMatchObject({ grain: 'month', activeCampaignId: 'default' });
    expect(fresh.useDataStore.getState().checksum).toMatchObject({
      rows: 600,
      clicks: 12000,
      cost: 60000000,
      orders: 1200,
    });
  });

  it('JSON hỏng không làm load crash và phát cảnh báo', async () => {
    const events: string[] = [];
    const off = bus.on('system/health', (event) => events.push(event.status));
    try {
      localStorage.setItem('qa-corrupt', '{ broken');
      expect(await createLocalStorageAdapter('qa-corrupt').load()).toBeNull();
      expect(events).toContain('degraded');
    } finally {
      off();
    }
  });

  it('migrate dữ liệu v0 qua adapter và lưu lại dạng hiện hành', async () => {
    localStorage.setItem(
      'qa-v0',
      JSON.stringify([{ date: '2026-10-01', reach: 1000, clicks: 20, cost: 100000, orders: 2 }]),
    );
    const adapter = createLocalStorageAdapter('qa-v0');
    const loaded = await adapter.load();
    expect(loaded?.v).toBe(CONTRACT_VERSION);
    expect(loaded?.entries[0]).toMatchObject({ id: 'default|2026-10-01', source: 'manual', orders: 2 });
    expect(loaded).not.toBeNull();
    await adapter.save(loaded!);
    expect((await createLocalStorageAdapter('qa-v0').load())?.entries[0]?.orders).toBe(2);
  });

  it('E30 quota thất bại giữ bản commit cũ; lần lưu tiếp theo hoạt động trong RAM', async () => {
    const adapter = createLocalStorageAdapter('qa-quota');
    await adapter.save(payload(rows.slice(0, 1)));
    const committed = localStorage.getItem('qa-quota');
    const events: string[] = [];
    const off = bus.on('system/health', (event) => events.push(event.status));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      await expect(adapter.save(payload(rows.slice(0, 2)))).resolves.toBeUndefined();
      expect(localStorage.getItem('qa-quota')).toBe(committed);
      expect(events).toContain('degraded');
      await adapter.save(payload(rows.slice(0, 2)));
      expect(business((await adapter.load())!.entries)).toEqual(business(rows.slice(0, 2)));
    } finally {
      off();
    }
  });

  it('adapter khi trình duyệt chặn localStorage vẫn dùng RAM', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const adapter = createLocalStorageAdapter('qa-blocked');
    await adapter.save(payload(rows.slice(0, 2)));
    expect(business((await adapter.load())!.entries)).toEqual(business(rows.slice(0, 2)));
  });

  it('BUG-QA02-01: store khởi tạo được khi getter localStorage ném SecurityError', async () => {
    vi.resetModules();
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    await expect(import('@/lib/data/store')).resolves.toBeDefined();
  });

  it('backup JSON hỏng không xoá dữ liệu đang có; remove và undo khôi phục checksum', () => {
    useDataStore.getState().addEntries(rows.slice(0, 2));
    const before = useDataStore.getState().checksum;
    expect(useDataStore.getState().importBackup('{broken').aborted).toBe(true);
    expect(useDataStore.getState().checksum).toEqual(before);
    useDataStore.getState().removeEntries([rows[0]!.id]);
    expect(useDataStore.getState().entries).toHaveLength(1);
    expect(useDataStore.getState().undoLast()).toBe(true);
    expect(useDataStore.getState().checksum).toEqual(before);
    expect(useDataStore.getState().undoLast()).toBe(false);
  });
});

describe('QA-02 · worker và fallback', () => {
  it('không khởi tạo được Worker vẫn trả KPI/series/checksum giống engine packed', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('CSP blocks worker');
        }
      },
    );
    const fallback = getAnalyticsClient();
    // Worker state is module-scoped. Isolate the reference module so this compares two independent states.
    vi.resetModules();
    const { createAnalyticsEngine } = await import('@/lib/workers/analytics.worker');
    const engine = createAnalyticsEngine();
    await fallback.init(rows);
    await engine.init(packEntries(rows));
    for (const grain of ['day', 'week', 'month', 'quarter'] as const) {
      const query = { campaignId: 'all', grain, today: '2026-11-06', horizonDays: 7 };
      const [actual, expected] = await Promise.all([fallback.snapshot(query), engine.snapshot(query)]);
      expect(actual.checksum).toEqual(expected.checksum);
      expect(actual.totals).toEqual(expected.totals);
      expect(actual.series).toEqual(expected.series);
      expect(actual.trend).toEqual(expected.trend);
    }
    const delta = { added: [], removed: rows.slice(0, 1) };
    await fallback.applyDelta(delta, 2);
    await engine.applyDelta(delta, 2);
    const query = { campaignId: 'default', grain: 'month' as const, today: '2026-11-06', horizonDays: 7 };
    expect((await fallback.snapshot(query)).totals).toEqual((await engine.snapshot(query)).totals);
  }, 30_000);
});
