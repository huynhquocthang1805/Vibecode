/**
 * BA-05 / QA — EXTENDED REGRESSION MATRIX.
 * ADDED file: original gen-mock.test.ts is intentionally left untouched.
 * Based on the BA-05 archive supplied in the chat (2026-11-01), not a verified latest checkout.
 * No mocks for DATA-01/02, no skips. Failures reveal contract/integration issues.
 * Never run this directly from a ZIP's nested BA05/ folder: put it at repo/tests/integration/.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';

import { LIMITS } from '@/types/domain';
import type { DailyEntry, ISODate } from '@/types/domain';

import {
  auditDataset,
  DEFAULT_SEED,
  demoEvidence,
  eventFactors,
  generate,
  mulberry32,
  summarize,
} from '../../scripts/gen-mock';

const today = '2026-11-01';
const endDate = '2026-10-31';
const fixed = { today, endDate } as const;

const base: DailyEntry = {
  id: 'default|2026-10-01',
  date: '2026-10-01',
  campaignId: 'default',
  reach: 10000,
  clicks: 200,
  cost: 600000,
  orders: 6,
  source: 'mock',
  createdAt: 0,
  updatedAt: 0,
};

const seeds = Array.from({ length: 384 }, (_, i) => (Math.imul(i + 1, 104729) >>> 0));
const prngSeeds = Array.from({ length: 128 }, (_, i) => (Math.imul(i, 2654435761) >>> 0));
const nValues = Array.from({ length: 220 }, (_, i) => i + 1);
const dayValues = Array.from({ length: 120 }, (_, i) => utcISO(new Date(Date.UTC(2025, 4, 1 + i))));

// Independent UTC oracle: tests must not use production date helpers to compute their own answers.
function utcISO(date: Date): string { return date.toISOString().slice(0, 10); }
function dateUTC(date: string): Date { return new Date(`${date}T00:00:00.000Z`); }
function offset(date: string, days: number): string {
  const d = dateUTC(date); d.setUTCDate(d.getUTCDate() + days); return utcISO(d);
}
function daysApart(start: string, end: string): number {
  return Math.round((dateUTC(end).getTime() - dateUTC(start).getTime()) / 86400000);
}
function eventsOracle(date: string): { reach: number; conversion: number; event: string } {
  const tet: Record<string, string> = { '2024': '2024-02-10', '2025': '2025-01-29', '2026': '2026-02-17' };
  const year = date.slice(0, 4);
  const lunar = tet[year];
  if (!lunar) throw new Error('UNSUPPORTED_TET_YEAR');
  const distance = daysApart(lunar, date);
  if (distance >= -14 && distance <= -1) return { reach: 1.25, conversion: 2, event: 'pre-tet' };
  if (distance >= 0 && distance <= 7) return { reach: 0.55, conversion: 0.8, event: 'post-tet' };
  // Fourth Thursday of November followed by Friday.
  const nov1 = dateUTC(`${year}-11-01`).getUTCDay(); // Sunday=0.
  const firstThursday = 1 + ((4 - nov1 + 7) % 7);
  const blackFriday = `${year}-11-${String(firstThursday + 22).padStart(2, '0')}`;
  if (date === blackFriday || date === `${year}-11-11` || date === `${year}-12-12`)
    return { reach: 1.6, conversion: 1.45, event: 'sale' };
  return { reach: 1, conversion: 1, event: 'normal' };
}
const dates = Array.from({ length: daysApart('2024-01-01', '2026-12-31') + 1 }, (_, i) => offset('2024-01-01', i));

function assertShape(rows: readonly DailyEntry[], expectedCount: number): void {
  expect(rows).toHaveLength(expectedCount);
  expect(new Set(rows.map((row) => row.id)).size).toBe(expectedCount);
  for (const row of rows) {
    expect(row.id).toBe(`${row.campaignId}|${row.date}`);
    expect(row.source).toBe('mock');
    expect(row.createdAt).toBe(0);
    expect(row.updatedAt).toBe(0);
    expect(row.clicks).toBeLessThanOrEqual(row.reach);
    expect(row.orders).toBeLessThanOrEqual(row.clicks);
    expect(Number.isSafeInteger(row.reach)).toBe(true);
    expect(Number.isSafeInteger(row.clicks)).toBe(true);
    expect(Number.isSafeInteger(row.cost)).toBe(true);
    expect(Number.isSafeInteger(row.orders)).toBe(true);
    expect(row.clicks).toBeGreaterThanOrEqual(row.reach * 0.008);
    expect(row.clicks).toBeLessThanOrEqual(row.reach * 0.04);
    expect(row.orders).toBeGreaterThanOrEqual(row.clicks * 0.01);
    expect(row.orders).toBeLessThanOrEqual(row.clicks * 0.06);
    expect(row.cost).toBeGreaterThanOrEqual(row.clicks * 1500);
    expect(row.cost).toBeLessThanOrEqual(row.clicks * 12000);
  }
}

// Calendar: 366 (2024 leap) + 365 + 365 = 1096 independently-checked dates.
describe('BA05-EXT calendar · 1096 days of Tết, sales and normal days', () => {
  it.each(dates)('calendar event %s', (date) => {
    expect(eventFactors(date as ISODate)).toEqual(eventsOracle(date));
  });
});

describe('BA05-EXT deterministic demo · 384 distinct seeds', () => {
  it.each(seeds)('seed %i -> 30 daily rows, stable, strict metadata and KPI ranges', (seed) => {
    const options = { ...fixed, seed, profile: 'demo' as const };
    const rows = generate(30, options);
    assertShape(rows, 30);
    expect(rows[0]?.date).toBe('2026-10-02');
    expect(rows[29]?.date).toBe('2026-10-31');
    expect(rows.every((row) => row.campaignId === 'default')).toBe(true);
    expect(JSON.stringify(generate(30, options))).toBe(JSON.stringify(rows));
  });
});

describe('BA05-EXT stress shape · 220 distinct row counts', () => {
  it.each(nValues)('stress n=%i yields exactly n and no duplicate keys', (n) => {
    const rows = generate(n, { ...fixed, seed: 7, profile: 'stress' });
    assertShape(rows, n);
    const expectedCampaigns = Math.min(100, n);
    expect(new Set(rows.map((row) => row.campaignId)).size).toBe(expectedCampaigns);
  });
});

describe('BA05-EXT mulberry32 · 128 seed streams', () => {
  it.each(prngSeeds)('seed %i yields reproducible bounded uniforms', (seed) => {
    const a = mulberry32(seed);
    const b = mulberry32(seed);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      expect(x).toBe(b());
    }
  });
});

describe('BA05-EXT historical dates · 120 distinct month/day boundaries', () => {
  it.each(dayValues)('30-day demo ending at %s has contiguous correct UTC dates', (last) => {
    const rows = generate(30, { seed: DEFAULT_SEED, today, endDate: last, profile: 'demo' });
    assertShape(rows, 30);
    rows.forEach((row, i) => expect(row.date).toBe(offset(last, i - 29)));
  });
});

describe('BA05-EXT rejected row counts · Zod must reject invalid n', () => {
  const bad = [0, -0.5, NaN, Infinity, -Infinity,
    ...Array.from({ length: 50 }, (_, i) => -i - 1),
    ...Array.from({ length: 30 }, (_, i) => i + 0.5),
    ...Array.from({ length: 20 }, (_, i) => LIMITS.MAX_ROWS_TOTAL + i + 1),
  ];
  it.each(bad)('reject n=%s', (n) => {
    expect(() => generate(n, fixed)).toThrow(z.ZodError);
  });
});

describe('BA05-EXT rejected seeds · strict unsigned 32-bit seed', () => {
  const bad = [NaN, Infinity, -Infinity, 4294967296, 4294967297,
    ...Array.from({ length: 40 }, (_, i) => -1 - i),
    ...Array.from({ length: 30 }, (_, i) => i + 0.5),
  ];
  it.each(bad)('reject PRNG seed=%s', (seed) => {
    expect(() => mulberry32(seed)).toThrow(z.ZodError);
  });
});

describe('BA05-EXT option validation · invalid days and campaign count', () => {
  const bad = [0, NaN, Infinity, -Infinity,
    ...Array.from({ length: 30 }, (_, i) => -1 - i),
    ...Array.from({ length: 30 }, (_, i) => i + 0.5),
  ];
  it.each(bad)('reject days=%s', (days) => {
    expect(() => generate(30, { ...fixed, days })).toThrow(z.ZodError);
  });
  it.each(bad)('reject campaignCount=%s', (campaignCount) => {
    expect(() => generate(30, { ...fixed, campaignCount })).toThrow(z.ZodError);
  });
  const malformed = ['demo-', 'DEM0', 'campaign-2y', 'all', 'unknown', 'normal', '', 'Demo', 'STRESS'];
  it.each(malformed)('reject unknown profile=%s', (profile) => {
    expect(() => generate(30, { ...fixed, profile } as unknown as Parameters<typeof generate>[1])).toThrow(z.ZodError);
  });
});

describe('BA05-EXT date validation · invalid/calendar/future dates', () => {
  const invalidCalendar = [
    '2024-02-30', '2025-02-29', '2026-02-29', '2026-04-31', '2026-06-31',
    '2026-09-31', '2026-11-31', '2026-13-01', '2026-00-01', '2026-01-00',
    '2026-01-32', '2026-1-01', '2026-01-1', '2026/01/01', '2026-01-01T00:00',
    'invalid', '', '20260101', '0000-00-00', '2026-02-00',
  ];
  it.each(invalidCalendar)('reject invalid ISO %s', (date) => {
    expect(() => generate(30, { ...fixed, endDate: date, profile: 'demo' })).toThrow();
  });
  const outOfRange = Array.from({ length: 31 }, (_, i) => offset('2026-11-01', i));
  it.each(outOfRange)('reject endDate %s >= today', (date) => {
    expect(() => generate(30, { ...fixed, endDate: date, profile: 'demo' })).toThrow(/INVALID_DATE_RANGE/);
  });
});

// These are genuine contract tests; if DATA-01 is still a stub they MUST fail, not skip.
describe('BA05-EXT validation gate · invalid field mutations', () => {
  function rejectsBad(row: DailyEntry): void { expect(() => auditDataset([row], today as ISODate, 1)).toThrow(); }
  const fields = ['reach', 'clicks', 'cost', 'orders'] as const;
  it.each(fields.flatMap((field) => Array.from({ length: 20 }, (_, i) => ({ field, value: -1 - i }))))(
    'reject negative $field=$value', ({ field, value }) => { rejectsBad({ ...base, [field]: value }); },
  );
  it.each(fields.flatMap((field) => Array.from({ length: 20 }, (_, i) => ({ field, value: LIMITS.MAX_VALUE[field] + 1 + i }))))(
    'reject out-of-range $field=$value', ({ field, value }) => { rejectsBad({ ...base, [field]: value }); },
  );
  it.each(Array.from({ length: 40 }, (_, i) => 10001 + i))('reject clicks > reach (%i)', (clicks) => {
    rejectsBad({ ...base, clicks });
  });
  it.each(Array.from({ length: 40 }, (_, i) => 201 + i))('reject orders > clicks (%i)', (orders) => {
    rejectsBad({ ...base, orders });
  });
  it.each(Array.from({ length: 30 }, (_, i) => 1 + i))('reject below minimum CPC=1..30 (%i)', (cpc) => {
    rejectsBad({ ...base, cost: base.clicks * cpc });
  });
  it.each(Array.from({ length: 30 }, (_, i) => 12001 + i))('reject CPC above cap (%i)', (cpc) => {
    rejectsBad({ ...base, cost: base.clicks * cpc });
  });
  it.each(Array.from({ length: 25 }, (_, i) => 1 + i))('reject invalid ID suffix #%i', (n) => {
    rejectsBad({ ...base, id: `another|2026-10-${String(n).padStart(2, '0')}` });
  });
  it.each(Array.from({ length: 20 }, (_, i) => i + 1))('reject invalid metadata updatedAt=%i', (updatedAt) => {
    rejectsBad({ ...base, updatedAt });
  });
  it('reject duplicate campaign/date pair', () => {
    expect(() => auditDataset([{ ...base }, { ...base }], today as ISODate, 2)).toThrow();
  });
  it('reject wrong expectedCount before iterating rows', () => {
    expect(() => auditDataset([base], today as ISODate, 2)).toThrow(/WRONG_ROW_COUNT/);
  });
});

describe('BA05-EXT aggregate math oracle · 150 independent case pairs', () => {
  const pairs = Array.from({ length: 150 }, (_, i) => {
    const reach1 = 5000 + i * 13;
    const reach2 = 10000 + i * 17;
    const clicks1 = 150 + (i % 60);
    const clicks2 = 280 + (i % 70);
    const orders1 = 5 + (i % 4);
    const orders2 = 8 + (i % 7);
    const cost1 = clicks1 * (2500 + (i % 100));
    const cost2 = clicks2 * (3300 + (i % 100));
    return { i, reach1, reach2, clicks1, clicks2, orders1, orders2, cost1, cost2 };
  });
  it.each(pairs)('aggregate sum-then-divide case $i', (p) => {
    const a: DailyEntry = { ...base, id: 'a|2026-10-01', campaignId: 'a', reach: p.reach1,
      clicks: p.clicks1, orders: p.orders1, cost: p.cost1 };
    const b: DailyEntry = { ...base, id: 'b|2026-10-01', campaignId: 'b', reach: p.reach2,
      clicks: p.clicks2, orders: p.orders2, cost: p.cost2 };
    const result = summarize([a, b]);
    expect(result.reach).toBe(p.reach1 + p.reach2);
    expect(result.clicks).toBe(p.clicks1 + p.clicks2);
    expect(result.cost).toBe(p.cost1 + p.cost2);
    expect(result.orders).toBe(p.orders1 + p.orders2);
    expect(result.kpis.ctr).toBeCloseTo((p.clicks1 + p.clicks2) / (p.reach1 + p.reach2), 12);
    expect(result.kpis.cpc).toBeCloseTo((p.cost1 + p.cost2) / (p.clicks1 + p.clicks2), 10);
    expect(result.kpis.cpa).toBeCloseTo((p.cost1 + p.cost2) / (p.orders1 + p.orders2), 10);
    expect(result.kpis.cvr).toBeCloseTo((p.orders1 + p.orders2) / (p.clicks1 + p.clicks2), 12);
  });
});

describe('BA05-EXT longer presets, narrative, leap years and default', () => {
  const campaignEnds = ['2025-12-31', '2026-02-28', '2026-06-30', '2026-10-31'];
  it.each(campaignEnds)('730 × 3 campaign at end=%s', (last) => {
    const rows = generate(2190, { today, endDate: last, profile: 'campaign', seed: DEFAULT_SEED });
    assertShape(rows, 2190);
    for (const id of ['thoi-trang', 'my-pham', 'do-gia-dung']) {
      const selected = rows.filter((r) => r.campaignId === id);
      expect(selected).toHaveLength(730);
      expect(selected[0]?.date).toBe(offset(last, -729));
      expect(selected[729]?.date).toBe(last);
    }
  });
  it('demo narrative has lower CTR in fatigue and higher CPA in late stage', () => {
    const evidence = demoEvidence(generate(30, { ...fixed, seed: DEFAULT_SEED, profile: 'demo' }));
    expect(evidence.fatigue.clicks * evidence.early.reach).toBeLessThan(evidence.early.clicks * evidence.fatigue.reach);
    expect(evidence.late.cost * evidence.fatigue.orders).toBeGreaterThan(evidence.fatigue.cost * evidence.late.orders);
  });
  it('stress generation includes leap-day 2024-02-29', () => {
    const rows = generate(45, { today, endDate: '2024-03-01', days: 45, campaignCount: 1, profile: 'stress' });
    expect(rows.some((r) => r.date === '2024-02-29')).toBe(true);
  });
  it('empty aggregate reports undefined KPIs rather than NaN or Infinity', () => {
    expect(summarize([]).kpis).toEqual({ ctr: null, cpc: null, cpa: null, cvr: null });
  });
});

describe('BA05-EXT property based · 3 assertions × 300 trials (not counted as Vitest cases)', () => {
  it('300 generated stress datasets satisfy shape and cross-multiplied ratios', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 1, max: 100 }), (seed, n) => {
      assertShape(generate(n, { ...fixed, seed, profile: 'stress' }), n);
    }), { seed: 20261102, numRuns: 300 });
  }, 60000);
  it('300 arbitrary seeds reproduce first ten PRNG values bit-for-bit', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
      const a = mulberry32(seed); const b = mulberry32(seed);
      for (let j = 0; j < 10; j++) expect(a()).toBe(b());
    }), { seed: 20261102, numRuns: 300 });
  }, 30000);
  it('300 additive aggregation scenarios preserve total counts', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 1, max: 100000 }), (reach1, reach2) => {
        const a = { ...base, reach: reach1, clicks: 0, cost: 0, orders: 0 };
        const b = { ...base, reach: reach2, clicks: 0, cost: 0, orders: 0 };
        const total = summarize([a, b]);
        expect(total.reach).toBe(reach1 + reach2);
        expect(total.kpis.ctr).toBe(0);
      },
    ), { seed: 20261102, numRuns: 300 });
  }, 30000);
});
