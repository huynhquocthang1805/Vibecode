/** Bundled only by QA tooling into an isolated page; never imported by the app. */
import { createIndexedDbAdapter } from '../../src/lib/data/storage/indexedDbAdapter';
import { createLocalStorageAdapter } from '../../src/lib/data/storage/localStorageAdapter';
import { createAnalyticsEngine } from '../../src/lib/workers/analytics.worker';
import type { PersistedState, StorageAdapter } from '../../src/types/domain';

let state: PersistedState;
let adapter: StorageAdapter;
let engine = createAnalyticsEngine();
let revision = 1;
const query = { campaignId: 'all', grain: 'day' as const, today: '2026-11-06', horizonDays: 30 };

const api = {
  async setup(data: PersistedState, kind: 'localStorage' | 'indexedDB') {
    state = data;
    adapter = kind === 'localStorage' ? createLocalStorageAdapter('qa08-perf') : createIndexedDbAdapter();
    await adapter.clear();
    await adapter.save(state);
    engine = createAnalyticsEngine();
    revision = await engine.init(state.entries);
    await engine.snapshot(query);
  },
  async tick() {
    const old = state.entries.at(-1)!;
    const updated = { ...old, reach: old.reach + 1 };
    state.entries[state.entries.length - 1] = updated;
    await engine.applyDelta({ added: [updated], removed: [old] }, ++revision);
    const start = performance.now();
    const snapshot = await engine.snapshot(query);
    if (snapshot.checksum.rows !== state.entries.length || snapshot.timings.forecastCached !== 1)
      throw new Error('Invalid live snapshot or missing cache hit');
    return performance.now() - start;
  },
  async save() {
    const start = performance.now();
    await adapter.save(state);
    return performance.now() - start;
  },
  async verify() {
    const reader = adapter.kind === 'localStorage' ? createLocalStorageAdapter('qa08-perf') : createIndexedDbAdapter();
    const loaded = await reader.load();
    const last = state.entries.at(-1)!;
    return {
      durable: loaded?.entries.find((entry) => entry.id === last.id)?.reach === last.reach,
      rows: loaded?.entries.length ?? 0,
      utf16Bytes: Object.keys(localStorage)
        .filter((key) => key.startsWith('qa08-perf'))
        .reduce((sum, key) => sum + (localStorage.getItem(key)?.length ?? 0) * 2, 0),
    };
  },
};
declare global {
  interface Window {
    qa08Module: typeof api;
  }
}
window.qa08Module = api;
