// @vitest-environment jsdom
/**
 * Review test (techlead) cho DATA-01..04 + FC-01 — chạy fixture BA-01 theo đúng quy ước docs/03 §7–§8
 * và các bất biến dữ liệu. QA-01 (Nhân) tiếp quản/mở rộng file này.
 *
 * `it.fails(...)` = LỖI ĐÃ BIẾT (mã R-xx trong handoffs/REVIEW-DATA-01-04-FC-01.md). Test này PASS khi lỗi còn.
 * Owner sửa xong → test báo đỏ → đổi `it.fails` thành `it` trong cùng PR sửa lỗi.
 */
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import { TREND_CONFIG } from '@/config/thresholds';
import { analyzeTrend } from '@/lib/analytics/trend';
import { decodeState, encodeState } from '@/lib/data/storage/codec';
import { useDataStore } from '@/lib/data/store';
import { addDays, bucketKey, bucketRange, daysBetween, todayVN } from '@/lib/domain/dates';
import { computeKpis, pctChange, sumTotals } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import cases from '@/fixtures/edge-cases.json';
import type { Bucket, DailyEntry, EntryInput, Grain, Kpis, Series, Totals } from '@/types/domain';
import { LIMITS } from '@/types/domain';

type Case = {
  id: string;
  kind: string;
  scenario?: string;
  input: unknown;
  context?: { today?: string; now?: string; existingKeys?: string[] };
  expect: Record<string, unknown>;
};
const ALL = cases as unknown as Case[];
const byKind = (k: string) => ALL.filter((c) => c.kind === k);
const byId = (id: string) => ALL.find((c) => c.id === id) as Case;

const EPS = 1e-9;
function expectNum(actual: number | null | undefined, expected: unknown, label: string) {
  if (expected === null) return expect(actual, label).toBeNull();
  expect(typeof actual, label).toBe('number');
  expect(Number.isFinite(actual), `${label} hữu hạn`).toBe(true);
  expect(Math.abs((actual as number) - (expected as number)), label).toBeLessThanOrEqual(EPS);
}
function expectKpis(actual: Kpis, expected: Record<string, unknown>, label: string) {
  for (const k of ['ctr', 'cpc', 'cpa', 'cvr'] as const) {
    if (k in expected) expectNum(actual[k], expected[k], `${label}.${k}`);
  }
}
const NUM_FIELDS = ['reach', 'clicks', 'cost', 'orders'] as const;

/* ───────────── 1. Fixture BA-01 — các kind kiểm từng hàm (docs/03 §7.2) ───────────── */
describe('fixture BA-01 · validate', () => {
  it.each(byKind('validate').map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const ctx = { today: c.context!.today!, existingKeys: new Set(c.context?.existingKeys ?? []) };
    const res = validateEntry(c.input, ctx);
    const e = c.expect as {
      ok: boolean;
      codes: string[];
      issues: { field: string; code: string; level: string }[];
      value?: Record<string, unknown>;
      kpis?: Record<string, unknown>;
      todayVN?: string;
      limits?: Record<string, unknown>;
    };
    expect(res.ok).toBe(e.ok);
    const got = new Set(res.issues.map((i) => `${i.field}|${i.code}|${i.level}`));
    const want = new Set(e.issues.map((i) => `${i.field}|${i.code}|${i.level}`));
    expect([...got].sort()).toEqual([...want].sort());
    expect([...new Set(res.issues.map((i) => i.code))].sort()).toEqual([...e.codes].sort());
    if (e.ok) {
      expect(res.value).toBeDefined();
      for (const [k, v] of Object.entries(e.value ?? {})) expect(res.value![k as keyof EntryInput], k).toEqual(v);
      if (e.kpis) expectKpis(computeKpis(res.value!), e.kpis, 'kpis');
    } else {
      // docs/03 §7.2: không lưu dữ liệu của kết quả ok === false
      expect(res.value).toBeUndefined();
    }
    if (e.todayVN) expect(todayVN(new Date(c.context!.now!))).toBe(e.todayVN);
    for (const [path, v] of Object.entries(e.limits ?? {})) {
      const val = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], LIMITS);
      expect(val, path).toEqual(v);
    }
  });
});

describe('fixture BA-01 · kpi / aggregate / pctChange / bucketKey', () => {
  it.each(byKind('kpi').map((c) => [c.id, c] as const))('kpi %s', (_id, c) => {
    expectKpis(computeKpis(c.input as Totals), c.expect, c.id);
  });
  it.each(byKind('aggregate').map((c) => [c.id, c] as const))('aggregate %s', (_id, c) => {
    const totals = sumTotals(c.input as Totals[]);
    expect(totals).toEqual(c.expect.totals);
    expectKpis(computeKpis(totals), c.expect, c.id);
  });
  it.each(byKind('pctChange').map((c) => [c.id, c] as const))('pctChange %s', (_id, c) => {
    const i = c.input as { curr: number | null; prev: number | null };
    expectNum(pctChange(i.curr, i.prev), c.expect.value, c.id);
  });
  it.each(byKind('bucketKey').map((c) => [c.id, c] as const))('bucketKey %s', (_id, c) => {
    const i = c.input as { date: string; grain: Grain };
    expect(bucketKey(i.date, i.grain)).toBe(c.expect.value);
  });
});

/* ───────────── 2. Ngày: bucketKey ↔ bucketRange nhất quán (property) ───────────── */
describe('dates · property', () => {
  const dateArb = fc
    .integer({ min: 0, max: daysBetween('2015-01-01', '2035-12-31') })
    .map((n) => addDays('2015-01-01', n));

  it('mọi ngày nằm trong bucketRange(bucketKey(ngày)) và days = số ngày thật', () => {
    fc.assert(
      fc.property(dateArb, fc.constantFrom<Grain>('day', 'week', 'month', 'quarter'), (d, g) => {
        const r = bucketRange(bucketKey(d, g), g);
        expect(r.start <= d && d <= r.end).toBe(true);
        expect(daysBetween(r.start, r.end) + 1).toBe(r.days);
        // ranh giới kỳ: ngày trước start / sau end thuộc kỳ khác
        expect(bucketKey(addDays(r.start, -1), g)).not.toBe(bucketKey(d, g));
        expect(bucketKey(addDays(r.end, 1), g)).not.toBe(bucketKey(d, g));
      }),
      { numRuns: 500, seed: 20261102 },
    );
  });

  // R-05: bucketKey dùng date-fns (đọc giờ máy) tại 12:00 UTC → máy ở UTC+13/+14 (NZ mùa hè, Tonga, Kiribati)
  // xếp Chủ nhật sang tuần sau, 31/03 sang Q2. Sửa: tính ISO week/quarter bằng toán UTC thuần.
  it.fails('R-05 bucketKey không phụ thuộc múi giờ máy (UTC+14)', () => {
    const saved = process.env.TZ;
    process.env.TZ = 'Pacific/Kiritimati';
    try {
      expect(bucketKey('2026-01-04', 'week')).toBe('2026-W01');
      expect(bucketKey('2026-03-31', 'quarter')).toBe('2026-Q1');
    } finally {
      process.env.TZ = saved;
    }
  });

  it('addDays / daysBetween nghịch đảo nhau', () => {
    fc.assert(
      fc.property(dateArb, fc.integer({ min: -4000, max: 4000 }), (d, n) => {
        expect(daysBetween(d, addDays(d, n))).toBe(n);
      }),
      { numRuns: 500, seed: 7 },
    );
  });
});

/* ───────────── 3. Store: scenario fixture + bất biến ───────────── */
const strip = (e: DailyEntry) => ({
  date: e.date,
  campaignId: e.campaignId,
  reach: e.reach,
  clicks: e.clicks,
  cost: e.cost,
  orders: e.orders,
});
const byKey = (a: { campaignId: string; date: string }, b: { campaignId: string; date: string }) =>
  `${a.campaignId}|${a.date}`.localeCompare(`${b.campaignId}|${b.date}`);

describe('store · scenario fixture', () => {
  beforeEach(async () => {
    localStorage.clear();
    await useDataStore.getState().clearAll();
  });

  it.each(['E17', 'E18'])('%s duplicate-policy', (id) => {
    const c = byId(id);
    const i = c.input as { existing: EntryInput[]; incoming: EntryInput[]; policy: 'sum' | 'overwrite' };
    useDataStore.getState().addEntries(i.existing, 'overwrite');
    useDataStore.getState().addEntries(i.incoming, i.policy);
    const got = useDataStore.getState().entries.map(strip).sort(byKey);
    expect(got).toEqual(c.expect.entries);
    expect(got.length).toBe(c.expect.entryCount);
  });
});

/** Tổng kiểm tra tính lại từ đầu — để so với checksum tăng dần của store */
function recompute(entries: DailyEntry[]) {
  const c = { rows: entries.length, reach: 0, clicks: 0, cost: 0, orders: 0 };
  for (const e of entries) for (const f of NUM_FIELDS) c[f] += e[f];
  return c;
}

describe('store · bất biến sau chuỗi thao tác ngẫu nhiên', () => {
  beforeEach(async () => {
    localStorage.clear();
    await useDataStore.getState().clearAll();
  });

  const inputArb = fc.record({
    date: fc.integer({ min: 0, max: 9 }).map((n) => addDays('2026-10-01', n)),
    campaignId: fc.constantFrom('a', 'b'),
    reach: fc.integer({ min: 100, max: 1000 }),
    clicks: fc.integer({ min: 0, max: 100 }),
    cost: fc.integer({ min: 0, max: 1_000_000 }),
    orders: fc.integer({ min: 0, max: 10 }),
  });
  const opArb = fc.oneof(
    fc.record({
      t: fc.constant('add' as const),
      rows: fc.array(inputArb, { maxLength: 4 }),
      p: fc.constantFrom('overwrite', 'sum', 'skip') as fc.Arbitrary<'overwrite' | 'sum' | 'skip'>,
    }),
    fc.record({ t: fc.constant('remove' as const), pick: fc.nat() }),
    fc.record({ t: fc.constant('updateDate' as const), pick: fc.nat(), day: fc.integer({ min: 0, max: 9 }) }),
    fc.record({ t: fc.constant('undo' as const) }),
  );

  // R-01: undoStack toàn cục không bị xoá khi clearAll/loadMock → hoàn tác áp delta cũ, checksum âm, dòng ma
  it.fails('R-01 checksum = tính lại; id duy nhất = campaignId|date; không NaN', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 25 }), async (ops) => {
        localStorage.clear();
        await useDataStore.getState().clearAll();
        for (const op of ops) {
          const s = useDataStore.getState();
          if (op.t === 'add') s.addEntries(op.rows, op.p);
          else if (op.t === 'remove' && s.entries.length) s.removeEntries([s.entries[op.pick % s.entries.length]!.id]);
          else if (op.t === 'updateDate' && s.entries.length) {
            useDataStore.getState().setSettings({ duplicatePolicy: 'overwrite' });
            s.updateEntry(s.entries[op.pick % s.entries.length]!.id, { date: addDays('2026-10-01', op.day) });
          } else if (op.t === 'undo') s.undoLast();
        }
        const st = useDataStore.getState();
        expect(st.checksum).toEqual(recompute(st.entries));
        const ids = st.entries.map((e) => e.id);
        expect(new Set(ids).size, 'khoá trùng').toBe(ids.length);
        for (const e of st.entries) {
          expect(e.id).toBe(`${e.campaignId}|${e.date}`);
          for (const f of NUM_FIELDS) expect(Number.isFinite(e[f])).toBe(true);
        }
      }),
      { numRuns: 150, seed: 42 },
    );
  });
});

describe('store · nghi vấn từ review', () => {
  beforeEach(async () => {
    localStorage.clear();
    await useDataStore.getState().clearAll();
  });

  // R-02: updateEntry đổi khoá trùng dòng khác khi policy ≠ ask → 2 dòng cùng khoá
  it.fails('R-02 E47: sửa ngày sang ngày đã có (policy overwrite) không tạo 2 dòng cùng khoá', () => {
    const s = useDataStore.getState();
    s.setSettings({ duplicatePolicy: 'overwrite' });
    s.addEntries(
      [
        { date: '2026-10-01', campaignId: 'default', reach: 100, clicks: 10, cost: 1000, orders: 1 },
        { date: '2026-10-02', campaignId: 'default', reach: 200, clicks: 20, cost: 2000, orders: 2 },
      ],
      'overwrite',
    );
    useDataStore.getState().updateEntry('default|2026-10-01', { date: '2026-10-02' });
    const ids = useDataStore.getState().entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // R-03: source được ép kiểu, không kiểm enum
  it.fails('R-03 validateEntry: source ngoài enum không lọt vào value', () => {
    const r = validateEntry(
      { date: '2026-10-01', campaignId: 'default', reach: 10, clicks: 1, cost: 1, orders: 0, source: 'hacker' },
      { today: '2026-10-20' },
    );
    expect(['manual', 'paste', 'csv', 'live', 'mock', undefined]).toContain(r.value?.source);
  });

  // R-04: regex xoá ký tự ₫/đ/V/N/D ở MỌI vị trí → parse một phần (docs/03 §4.1 #4 cấm)
  it.fails('R-04 validateEntry: chuỗi có chữ "d"/"v" giữa số không bị parse một phần ("1d2" ≠ 12)', () => {
    const r = validateEntry(
      { date: '2026-10-01', campaignId: 'default', reach: '1d2', clicks: 1, cost: 1, orders: 0 },
      { today: '2026-10-20' },
    );
    expect(r.issues.map((i) => `${i.field}|${i.code}`)).toContain('reach|NOT_NUMBER');
  });
});

/* ───────────── 4. Codec: roundtrip (bất biến #4 docs/08) ───────────── */
describe('codec · roundtrip', () => {
  it('decode(encode(s)) giữ nguyên ngày, chiến dịch, 4 chỉ số, nguồn', () => {
    const entryArb = fc.record({
      day: fc.integer({ min: 0, max: 4000 }),
      campaignId: fc.constantFrom('default', 'c2', 'c3'),
      reach: fc.integer({ min: 0, max: LIMITS.MAX_VALUE.reach }),
      clicks: fc.integer({ min: 0, max: 1000 }),
      cost: fc.integer({ min: 0, max: LIMITS.MAX_VALUE.cost }),
      orders: fc.integer({ min: 0, max: 1000 }),
      source: fc.constantFrom('manual', 'paste', 'csv', 'live', 'mock') as fc.Arbitrary<DailyEntry['source']>,
    });
    fc.assert(
      fc.property(fc.uniqueArray(entryArb, { selector: (e) => `${e.campaignId}|${e.day}`, maxLength: 60 }), (raw) => {
        const entries: DailyEntry[] = raw.map((r) => {
          const date = addDays(LIMITS.MIN_DATE, r.day);
          return { ...r, id: `${r.campaignId}|${date}`, date, createdAt: 0, updatedAt: 0 };
        });
        const state = {
          v: 1 as const,
          campaigns: [
            { id: 'default', name: 'Chính', createdAt: 0 },
            { id: 'c2', name: 'Hai', createdAt: 0 },
            { id: 'c3', name: 'Ba', createdAt: 0 },
          ],
          entries,
          settings: useDataStore.getState().settings,
        };
        const back = decodeState(encodeState(state));
        const pick = (e: DailyEntry) => ({ ...strip(e), id: e.id, source: e.source });
        expect(back.entries.map(pick).sort(byKey)).toEqual(entries.map(pick).sort(byKey));
      }),
      { numRuns: 200, seed: 3 },
    );
  });

  it('chuỗi hỏng ném lỗi có mã, không crash', () => {
    for (const bad of ['', '{', 'null', '{"v":1}', '[1,2]']) {
      expect(() => decodeState(bad)).toThrow(/CORRUPT/);
    }
  });
});

/* ───────────── 5. FC-01: analyzeTrend không bao giờ NaN/Infinity ───────────── */
function mkBucket(i: number, t: Totals): Bucket {
  const d = addDays('2026-10-01', i);
  return {
    key: d,
    grain: 'day',
    start: d,
    end: d,
    daysWithData: 1,
    daysInPeriod: 1,
    isPartial: false,
    kpis: computeKpis(t),
    ...t,
  };
}

describe('FC-01 · analyzeTrend', () => {
  it('mọi số trong TrendSummary hữu hạn hoặc null, kể cả chuỗi toàn 0 / hằng số', () => {
    const totArb = fc.record({
      reach: fc.integer({ min: 0, max: 1e6 }),
      clicks: fc.integer({ min: 0, max: 1e4 }),
      cost: fc.integer({ min: 0, max: 1e8 }),
      orders: fc.integer({ min: 0, max: 500 }),
    });
    fc.assert(
      fc.property(fc.array(totArb, { minLength: 0, maxLength: 20 }), (rows) => {
        const series: Series = { grain: 'day', campaignId: 'all', buckets: rows.map((t, i) => mkBucket(i, t)) };
        const s = analyzeTrend(series, null, TREND_CONFIG);
        expect(s.metrics).toHaveLength(8);
        for (const m of s.metrics) {
          for (const v of [m.changePct, m.slopePerPeriod, m.r2, m.cv]) {
            expect(v === null || Number.isFinite(v), `${m.metric}`).toBe(true);
          }
        }
      }),
      { numRuns: 300, seed: 11 },
    );
  });

  it('đơn tăng đều + CPA giảm → overall up; CPA tăng đều → assessment bad', () => {
    const up: Series = {
      grain: 'day',
      campaignId: 'all',
      buckets: Array.from({ length: 14 }, (_, i) =>
        mkBucket(i, { reach: 10000, clicks: 500, cost: 1_000_000, orders: 10 + i * 2 }),
      ),
    };
    const s = analyzeTrend(up, null, TREND_CONFIG);
    expect(s.overall).toBe('up');
    expect(s.metrics.find((m) => m.metric === 'orders')?.assessment).toBe('good');
    expect(s.metrics.find((m) => m.metric === 'cpa')?.assessment).toBe('good');

    const worse: Series = {
      grain: 'day',
      campaignId: 'all',
      buckets: Array.from({ length: 14 }, (_, i) =>
        mkBucket(i, { reach: 10000, clicks: 500, cost: 1_000_000 + i * 200_000, orders: 20 }),
      ),
    };
    const w = analyzeTrend(worse, null, TREND_CONFIG);
    expect(w.metrics.find((m) => m.metric === 'cpa')?.assessment).toBe('bad');
    // Ghi chú cho BA-02: CPA tăng ~3 lần trong 14 ngày nhưng overall = 'flat' vì quy tắc "CPA up > 10%" dùng
    // changePct kỳ-trước-kỳ (ngày) chỉ ~6%. Đúng đặc tả docs/04 §2 hiện tại, nhưng nên xét thêm slope.
    expect(['flat', 'down']).toContain(w.overall);
  });
});
