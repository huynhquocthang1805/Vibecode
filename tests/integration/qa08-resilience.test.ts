// @vitest-environment jsdom
/** QA-08: specs #7–#10, including real store/import/undo/remote delta and partition codec. */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyDelta, buildRollups, getRollupChecksum, getSeries } from '@/lib/data/aggregate';
import { bus } from '@/lib/data/realtime/bus';
import { createLocalStorageAdapter } from '@/lib/data/storage/localStorageAdapter';
import { decodePartition, encodePartition } from '@/lib/data/storage/partitionCodec';
import { applyRemoteDelta, setStorageAdapter, useDataStore } from '@/lib/data/store';
import { createAnalyticsEngine } from '@/lib/workers/analytics.worker';
import { LIMITS, type EntryDelta, type Grain } from '@/types/domain';

import { business, checksum, persisted, QA_TODAY, row } from './qa08-fixtures';

const options = { seed: 20261107, numRuns: 200 };
const query = { campaignId: 'all', grain: 'day' as const, today: QA_TODAY, horizonDays: 0 };
const rowsArb = fc
  .uniqueArray(
    fc.record({
      day: fc.integer({ min: 0, max: 5 }),
      campaign: fc.integer({ min: 0, max: 5 }),
      year: fc.constantFrom('2015', '2020', '2026'),
      reach: fc.integer({ min: 20, max: 1000000 }),
      source: fc.constantFrom('manual' as const, 'csv' as const, 'live' as const, 'paste' as const, 'mock' as const),
    }),
    { maxLength: 40, selector: (x) => `${x.year}/${x.day}/${x.campaign}` },
  )
  .map((xs) => xs.map((x) => ({ ...row(x.day, x.campaign, x.reach, x.year), source: x.source })));

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T05:00:00Z'));
  setStorageAdapter({
    kind: 'memory',
    load: async () => null,
    save: async () => {},
    clear: async () => {},
    usage: async () => ({ usedBytes: 0, quotaBytes: 0 }),
  });
  await useDataStore.getState().clearAll();
  localStorage.clear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('QA-08 · 4 bất biến, mỗi bất biến 200 lượt seed cố định', () => {
  it('#7/E50: add/update/remove/import/undo/remote giữ store = worker = incremental = rebuild sau từng thao tác', async () => {
    const actionArb = fc.record({
      kind: fc.constantFrom('add', 'update', 'remove', 'import', 'undo', 'remote'),
      day: fc.integer({ min: 0, max: 5 }),
      campaign: fc.integer({ min: 0, max: 2 }),
      reach: fc.integer({ min: 20, max: 5000 }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(actionArb, { maxLength: 20 }), async (randomActions) => {
        await useDataStore.getState().clearAll();
        useDataStore.setState({ revision: 1, campaigns: persisted([]).campaigns });
        const engine = createAnalyticsEngine();
        await engine.init([]);
        let incremental = buildRollups([]);
        const deltas: Array<{ delta: EntryDelta; revision: number }> = [];
        const off = bus.on('entries/changed', (event) => {
          deltas.push(event);
        });
        // Every run covers all six actions; then generated order explores interactions.
        const prefix = ['add', 'update', 'remove', 'import', 'undo', 'remote'].map((kind) => ({
          kind,
          day: 0,
          campaign: 0,
          reach: kind === 'update' ? 246 : 123,
        }));
        try {
          for (const action of [...prefix, ...randomActions]) {
            const next = row(action.day, action.campaign, action.reach);
            const current = useDataStore.getState();
            const old = current.entries.find((entry) => entry.id === next.id);
            if (action.kind === 'add') current.addEntries([next], 'overwrite');
            if (action.kind === 'update' && old) current.updateEntry(old.id, { reach: action.reach });
            if (action.kind === 'remove') current.removeEntries([next.id]);
            if (action.kind === 'import') expect(current.importBatch([next], 'csv', 'overwrite').aborted).toBe(false);
            if (action.kind === 'undo') current.undoLast();
            if (action.kind === 'remote') applyRemoteDelta({ added: [next], removed: old ? [old] : [] });
            for (const event of deltas.splice(0)) {
              incremental = applyDelta(incremental, event.delta);
              await engine.applyDelta(event.delta, event.revision);
            }
            const entries = useDataStore.getState().entries;
            const rebuilt = buildRollups(entries);
            const expected = checksum(entries);
            expect(useDataStore.getState().checksum).toEqual(expected);
            expect(getRollupChecksum(incremental)).toEqual(expected);
            expect(getRollupChecksum(rebuilt)).toEqual(expected);
            expect((await engine.snapshot(query)).checksum).toEqual(expected);
            for (const grain of ['day', 'week', 'month', 'quarter'] satisfies Grain[])
              expect(getSeries(incremental, { ...query, grain })).toEqual(getSeries(rebuilt, { ...query, grain }));
          }
        } finally {
          off();
        }
        vi.clearAllTimers();
      }),
      options,
    );
  }, 60000);

  it('#8: partition thật giữ ngày, campaign, source và tổng qua nhiều năm, kể cả rỗng', () => {
    fc.assert(
      fc.property(rowsArb, (entries) => {
        const campaigns = persisted(entries).campaigns;
        const campIndex = new Map(campaigns.map((campaign, index) => [campaign.id, index]));
        for (const year of ['2015', '2020', '2026']) {
          const part = entries.filter((entry) => entry.date.startsWith(year));
          const encoded = encodePartition(part, `${year}-01-01`, campIndex);
          const decoded = decodePartition(encoded.payload, `${year}-01-01`, campaigns, 12345);
          expect(business(decoded)).toEqual(business(part));
          expect(encoded.rows).toBe(part.length);
          const { reach, clicks, cost, orders } = checksum(part);
          expect(encoded.sum).toEqual([reach, clicks, cost, orders]);
        }
      }),
      options,
    );
  });

  it('#9: quota ngẫu nhiên ở từng partition/manifest, reload chỉ nhận bản commit trước hoặc sau', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 20, max: 100000 }), fc.integer({ min: 0, max: 4 }), async (reach, failAt) => {
        localStorage.clear();
        const key = 'qa08-atomic';
        const before = persisted(['2015', '2020', '2026'].map((year) => row(0, 0, reach, year)));
        const after = persisted(before.entries.map((entry) => ({ ...entry, reach: entry.reach + 7 })));
        const adapter = createLocalStorageAdapter(key);
        await adapter.save(before);
        const native = Storage.prototype.setItem;
        let writes = 0;
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
          this: Storage,
          name: string,
          value: string,
        ) {
          if (name.startsWith(key) && ++writes === failAt) throw new DOMException('QA quota', 'QuotaExceededError');
          return native.call(this, name, value);
        });
        try {
          await expect(adapter.save(after)).resolves.toBeUndefined();
        } finally {
          spy.mockRestore();
        }
        const loaded = await createLocalStorageAdapter(key).load();
        expect(loaded).not.toBeNull();
        expect([business(before.entries), business(after.entries)]).toContainEqual(business(loaded!.entries));
        expect(business(loaded!.entries)).toEqual(business(failAt === 0 ? after.entries : before.entries));
        if (failAt > 0) expect(writes).toBe(failAt);
      }),
      options,
    );
  });

  it('#10: tổng mọi grain chính xác, không vượt số nguyên an toàn, kể cả cận LIMITS', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 0, max: LIMITS.MAX_VALUE.cost }), (n, cost) => {
        const entries = Array.from({ length: n }, (_, i) => ({
          ...row(i % 5, Math.floor(i * 0.2), LIMITS.MAX_VALUE.reach),
          clicks: LIMITS.MAX_VALUE.clicks,
          orders: LIMITS.MAX_VALUE.orders,
          cost,
        }));
        const index = buildRollups(entries);
        for (const grain of ['day', 'week', 'month', 'quarter'] satisfies Grain[]) {
          const buckets = getSeries(index, { ...query, grain }).buckets;
          for (const metric of ['reach', 'clicks', 'cost', 'orders'] as const) {
            expect(buckets.every((bucket) => Number.isSafeInteger(bucket[metric]))).toBe(true);
            const total = buckets.reduce((sum, bucket) => sum + bucket[metric], 0);
            expect(total).toBe(entries.reduce((sum, entry) => sum + entry[metric], 0));
            expect(Number.isSafeInteger(LIMITS.MAX_ROWS_TOTAL * LIMITS.MAX_VALUE[metric])).toBe(true);
          }
        }
      }),
      options,
    );
  });
});
