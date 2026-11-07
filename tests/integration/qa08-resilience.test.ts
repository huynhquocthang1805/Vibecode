// @vitest-environment jsdom
/** QA-08: property-based regression. Owner chỉ viết test, không sửa module data. */
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import { buildRollups, applyDelta, getSeries } from '@/lib/data/aggregate/rollup';
import { DEFAULT_SETTINGS, decodeState, encodeState } from '@/lib/data/storage/codec';
import { createLocalStorageAdapter } from '@/lib/data/storage/localStorageAdapter';
import { addDays } from '@/lib/domain/dates';
import { CONTRACT_VERSION, LIMITS } from '@/types/domain';
import type { DailyEntry, PersistedState } from '@/types/domain';

const keys = ['reach', 'clicks', 'cost', 'orders'] as const;
const blank = { reach: 0, clicks: 0, cost: 0, orders: 0 };
const inputArb = fc.record({
  slot: fc.integer({ min: 0, max: 180 }),
  campaign: fc.integer({ min: 0, max: 5 }),
  reach: fc.integer({ min: 0, max: 1_000_000 }),
  clicksPct: fc.integer({ min: 0, max: 100 }),
  ordersPct: fc.integer({ min: 0, max: 100 }),
  costPerClick: fc.integer({ min: 0, max: 12_000 }),
  remove: fc.boolean(),
});

type Action = {
  slot: number; campaign: number; reach: number; clicksPct: number; ordersPct: number; costPerClick: number; remove: boolean;
};
function entry(a: Action): DailyEntry {
  const campaignId = `camp-${a.campaign}`;
  const date = addDays('2026-01-01', a.slot);
  const clicks = Math.floor(a.reach * a.clicksPct / 100);
  const orders = Math.floor(clicks * a.ordersPct / 100);
  return { id: `${campaignId}|${date}`, date, campaignId,
    reach: a.reach, clicks, orders, cost: clicks * a.costPerClick,
    source: 'mock', createdAt: 0, updatedAt: 0 };
}
const compareSeries = (entries: DailyEntry[]) => {
  const index = buildRollups(entries);
  const series = getSeries(index, { campaignId: 'all', grain: 'month', today: '2026-12-31' });
  return series.buckets.map(({ key, reach, clicks, cost, orders }) => ({ key, reach, clicks, cost, orders }));
};
const normalized = (entries: DailyEntry[]) => entries.map((e) => ({ id: e.id, date: e.date,
  campaignId: e.campaignId, reach: e.reach, clicks: e.clicks, cost: e.cost, orders: e.orders,
  source: e.source })).sort((a,b) => a.id.localeCompare(b.id));
const persisted = (entries: DailyEntry[]): PersistedState => ({
  v: CONTRACT_VERSION, entries,
  campaigns: Array.from({ length: 6 }, (_, i) => ({ id: `camp-${i}`, name: `Chiến dịch ${i}`, createdAt: 0 })),
  settings: DEFAULT_SETTINGS,
});

describe('QA-08 — bất biến #7: incremental rollup == rebuild', () => {
  it('200 chuỗi ngẫu nhiên add/update/remove, giữ đúng tổng theo kỳ', () => {
    fc.assert(fc.property(fc.array(inputArb, { minLength: 1, maxLength: 50 }), (actions) => {
      let incremental = buildRollups([]);
      const state = new Map<string, DailyEntry>();
      for (const action of actions) {
        const next = entry(action);
        const prev = state.get(next.id);
        const added: DailyEntry[] = action.remove ? [] : [next];
        const removed: DailyEntry[] = prev ? [prev] : [];
        incremental = applyDelta(incremental, { added, removed });
        if (action.remove) state.delete(next.id);
        else state.set(next.id, next);
        const direct = getSeries(incremental, { campaignId: 'all', grain: 'month', today: '2026-12-31' });
        const current = direct.buckets.map(({ key, reach, clicks, cost, orders }) => ({ key, reach, clicks, cost, orders }));
        expect(current).toEqual(compareSeries([...state.values()]));
      }
    }), { seed: 20261106, numRuns: 200 });
  });
});

describe('QA-08 — bất biến #8: codec nhiều năm/nhiều chiến dịch', () => {
  it('200 tập ngẫu nhiên codec roundtrip (bỏ timestamps)', () => {
    fc.assert(fc.property(fc.array(inputArb, { minLength: 1, maxLength: 60 }), (actions) => {
      const items = new Map<string, DailyEntry>();
      for (const a of actions) {
        const record = entry(a);
        // Chia năm 2015 / 2020 / 2026, không đổi key một khi đã tạo.
        const year = a.campaign % 3 === 0 ? '2015' : a.campaign % 3 === 1 ? '2020' : '2026';
        record.date = `${year}${record.date.slice(4)}`;
        record.id = `${record.campaignId}|${record.date}`;
        items.set(record.id, record);
      }
      const state = persisted([...items.values()]);
      const result = decodeState(encodeState(state));
      expect(normalized(result.entries)).toEqual(normalized(state.entries));
    }), { seed: 20261107, numRuns: 200 });
  });
});

describe('QA-08 — bất biến #9: ghi lỗi bất kỳ bước nào', () => {
  it('tiêm QuotaExceededError vào setItem: sau reload là trạng thái cũ hoặc mới, không trộn', async () => {
    for (let failAt = 1; failAt <= 6; failAt++) {
      const key = `qa08-2phase-${failAt}`;
      const before = persisted([entry({ slot: 1, campaign: 0, reach: 100, clicksPct: 10, ordersPct: 50, costPerClick: 1000, remove: false })]);
      const after = persisted([entry({ slot: 2, campaign: 1, reach: 200, clicksPct: 10, ordersPct: 50, costPerClick: 1000, remove: false })]);
      const adapter = createLocalStorageAdapter(key);
      await adapter.save(before);
      const native = Storage.prototype.setItem;
      let writes = 0;
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, val: string) {
        if (k.startsWith(key)) {
          writes++;
          if (writes === failAt) throw new DOMException('Simulated quota', 'QuotaExceededError');
        }
        return native.call(this, k, val);
      });
      try {
        try { await adapter.save(after); } catch { /* Lỗi ghi được phép, dữ liệu không được hỏng. */ }
      } finally { spy.mockRestore(); }
      const afterReload = await createLocalStorageAdapter(key).load();
      expect(afterReload, `failAt=${failAt}`).not.toBeNull();
      const got = normalized(afterReload?.entries ?? []);
      expect([normalized(before.entries), normalized(after.entries)], `failAt=${failAt}`).toContainEqual(got);
      await createLocalStorageAdapter(key).clear();
    }
  });
});

describe('QA-08 — bất biến #10: tổng của mỗi bucket là số nguyên an toàn', () => {
  it('100 bộ dữ liệu tới giới hạn cost/reach vẫn không overflow', () => {
    fc.assert(fc.property(fc.array(fc.record({
      slot: fc.integer({ min: 0, max: 180 }),
      reach: fc.integer({ min: 0, max: LIMITS.MAX_VALUE.reach }),
      clicks: fc.integer({ min: 0, max: LIMITS.MAX_VALUE.clicks }),
      cost: fc.integer({ min: 0, max: LIMITS.MAX_VALUE.cost }),
      orders: fc.integer({ min: 0, max: LIMITS.MAX_VALUE.orders }),
    }), { minLength: 1, maxLength: 75 }), (xs) => {
      const entries = xs.map((x, i): DailyEntry => {
        const date = addDays('2026-01-01', x.slot);
        return { id: `camp-${i}|${date}`, campaignId: `camp-${i}`, date,
          reach: x.reach, clicks: Math.min(x.clicks, x.reach), cost: x.cost,
          orders: Math.min(x.orders, x.clicks, x.reach), source: 'mock', createdAt: 0, updatedAt: 0 };
      });
      const index = buildRollups(entries);
      const series = getSeries(index, { campaignId: 'all', grain: 'quarter', today: '2026-12-31' });
      const totals = { ...blank };
      for (const bucket of series.buckets) {
        for (const field of keys) {
          expect(Number.isSafeInteger(bucket[field]), field).toBe(true);
          totals[field] += bucket[field];
        }
      }
      for (const field of keys) {
        expect(Number.isSafeInteger(totals[field]), field).toBe(true);
        expect(totals[field]).toBe(entries.reduce((sum, e) => sum + e[field], 0));
      }
    }), { seed: 20261108, numRuns: 100 });
  });
});
