import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import rawCases from '@/fixtures/edge-cases.json';
import { forecastAll } from '@/lib/analytics';
import { buildRollups, comparePeriods, getSeries } from '@/lib/data/aggregate';
import { addDays, bucketKey, bucketRange, daysBetween, todayVN } from '@/lib/domain/dates';
import { computeKpis, pctChange, sumTotals } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import { createAnalyticsEngine } from '@/lib/workers/analytics.worker';
import { LIMITS, type DailyEntry } from '@/types/domain';

const totalsSchema = z.object({ reach: z.number(), clicks: z.number(), cost: z.number(), orders: z.number() });
const entrySchema = totalsSchema.extend({ date: z.string(), campaignId: z.string() });
const grainSchema = z.enum(['day', 'week', 'month', 'quarter']);
const caseSchema = z.object({
  id: z.string(),
  description: z.string(),
  kind: z.enum(['validate', 'kpi', 'aggregate', 'series', 'pctChange', 'bucketKey', 'scenario']),
  input: z.unknown(),
  expect: z.record(z.string(), z.unknown()),
  context: z.record(z.string(), z.unknown()).optional(),
  scenario: z.string().optional(),
  targetTask: z.string().optional(),
});
const cases = z.array(caseSchema).parse(rawCases);
const contextSchema = z.object({
  today: z.string(),
  existingKeys: z.array(z.string()).optional(),
  now: z.string().optional(),
});
const entries = (raw: unknown): DailyEntry[] =>
  z
    .array(entrySchema)
    .parse(raw)
    .map((row) => ({
      ...row,
      id: `${row.campaignId}|${row.date}`,
      source: 'mock',
      createdAt: 0,
      updatedAt: 0,
    }));

/** So kỳ vọng của BA theo phép chiếu, không dùng output để dựng đáp án. */
function matches(actual: unknown, expected: unknown): void {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(Number.isFinite(actual)).toBe(true);
    expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(1e-9);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    const values = actual as unknown[];
    expect(values).toHaveLength(expected.length);
    expected.forEach((item, index) => matches(values[index], item));
  } else if (expected !== null && typeof expected === 'object') {
    expect(actual).not.toBeNull();
    expect(typeof actual).toBe('object');
    for (const [key, value] of Object.entries(expected)) matches((actual as Record<string, unknown>)[key], value);
  } else expect(actual).toEqual(expected);
}

function expandRanges(raw: unknown): DailyEntry[] {
  const ranges = z
    .array(z.object({ from: z.string(), to: z.string(), campaignId: z.string(), totals: totalsSchema }))
    .parse(raw);
  return ranges.flatMap((range) =>
    entries(
      Array.from({ length: daysBetween(range.from, range.to) + 1 }, (_, index) => ({
        ...range.totals,
        campaignId: range.campaignId,
        date: addDays(range.from, index),
      })),
    ),
  );
}

describe('QA-01 · fixture BA qua contracts thật', () => {
  it('ID duy nhất, kind lạ bị báo lỗi; scenario phải có nơi nghiệm thu', () => {
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
    expect(() => caseSchema.parse({ ...cases[0], kind: 'unknown' })).toThrow();
    for (const item of cases.filter((item) => item.kind === 'scenario')) {
      expect(item.scenario).toBeTruthy();
      expect(item.targetTask).toBeTruthy();
    }
  });
  it.each(cases.filter((item) => item.kind !== 'scenario'))('$id · $description', (item) => {
    const expected = item.expect;
    switch (item.kind) {
      case 'validate': {
        const ctx = contextSchema.parse(item.context);
        const actual = validateEntry(item.input, { today: ctx.today, existingKeys: new Set(ctx.existingKeys ?? []) });
        expect(actual.ok).toBe(expected.ok);
        expect([...new Set(actual.issues.map((issue) => issue.code))].sort()).toEqual(
          z.array(z.string()).parse(expected.codes).sort(),
        );
        const issues = z
          .array(z.object({ field: z.string(), code: z.string(), level: z.string() }))
          .parse(expected.issues);
        const issueKey = (issue: { field: string; code: string; level: string }) =>
          `${issue.field}|${issue.code}|${issue.level}`;
        expect(actual.issues.map(issueKey).sort()).toEqual(issues.map(issueKey).sort());
        if (expected.value) matches(actual.value, expected.value);
        if (expected.kpis) {
          expect(actual.value).toBeDefined();
          matches(computeKpis(actual.value!), expected.kpis);
        }
        if (expected.todayVN) expect(todayVN(new Date(z.string().parse(ctx.now)))).toBe(expected.todayVN);
        if (expected.limits)
          for (const [path, value] of Object.entries(z.record(z.string(), z.unknown()).parse(expected.limits))) {
            const actualLimit = path
              .split('.')
              .reduce<unknown>((obj, key) => (obj as Record<string, unknown>)[key], LIMITS);
            matches(actualLimit, value);
          }
        break;
      }
      case 'kpi':
        matches(computeKpis(totalsSchema.parse(item.input)), expected);
        break;
      case 'aggregate': {
        const totals = sumTotals(z.array(totalsSchema).parse(item.input));
        matches({ totals, ...computeKpis(totals) }, expected);
        break;
      }
      case 'pctChange': {
        const values = z.object({ curr: z.number().nullable(), prev: z.number().nullable() }).parse(item.input);
        matches(pctChange(values.curr, values.prev), expected.value);
        break;
      }
      case 'bucketKey': {
        const values = z.object({ date: z.string(), grain: grainSchema }).parse(item.input);
        matches(bucketKey(values.date, values.grain), expected.value);
        break;
      }
      case 'series': {
        const query = z.object({ today: z.string(), campaignId: z.string(), grain: grainSchema }).parse(item.context);
        const series = getSeries(buildRollups(entries(item.input)), query);
        matches({ bucketCount: series.buckets.length, buckets: series.buckets }, expected);
        break;
      }
      default:
        throw new Error(`UNHANDLED_FIXTURE: ${item.id}`);
    }
  });

  it('E21 · like-for-like loại ngày 30 tháng trước có số liệu lớn', () => {
    const item = cases.find((row) => row.id === 'E21')!;
    const raw = z.object({ dailyRanges: z.unknown() }).parse(item.input);
    const index = buildRollups(expandRanges(raw.dailyRanges));
    const today = z.string().parse(item.context?.today);
    const query = { today, campaignId: 'default', grain: 'month' as const };
    const comparison = comparePeriods(getSeries(index, query), today, getSeries(index, { ...query, grain: 'day' }));
    expect(comparison?.likeForLike).toBe(true);
    matches(comparison?.current, item.expect.currentTotals);
    matches(comparison?.previous, item.expect.previousTotals);
    matches(comparison?.deltaPct, item.expect.deltaPct);
    matches({ from: comparison?.current.start, to: today }, item.expect.currentRange);
    matches({ from: comparison?.previous?.start, to: comparison?.previous?.end }, item.expect.previousRange);
  });
  it('E22 · tháng 3 có 31 ngày không sinh ngày 29–31 tháng 2', () => {
    const item = cases.find((row) => row.id === 'E22')!;
    const current = bucketRange('2026-03', 'month'),
      previous = bucketRange('2026-02', 'month');
    matches({ from: current.start, to: current.end }, item.expect.currentRange);
    matches({ from: previous.start, to: previous.end }, item.expect.previousRange);
    expect(previous.days).toBe(item.expect.previousDays);
  });
  it('E27 · lịch sử 10 ngày dùng baseline, độ tin cậy thấp và số hữu hạn', () => {
    const item = cases.find((row) => row.id === 'E27')!;
    const raw = z.object({ dailyRanges: z.unknown(), horizonDays: z.number(), metric: z.string() }).parse(item.input);
    const series = getSeries(buildRollups(expandRanges(raw.dailyRanges)), {
      today: '2026-10-20',
      campaignId: 'default',
      grain: 'day',
    });
    const result = forecastAll(series, raw.horizonDays).find((prediction) => prediction.metric === raw.metric)!;
    expect(item.expect.modelOneOf).toContain(result.model);
    expect(result.confidence).toBe(item.expect.confidence);
    expect(result.points).toHaveLength(z.number().parse(item.expect.pointCount));
    expect(
      result.points.every((point) =>
        Object.values(point).every((value) => typeof value === 'string' || Number.isFinite(value)),
      ),
    ).toBe(true);
  });
  it('E43 · snapshot dữ liệu cũ không có forecast/nowcast', async () => {
    const engine = createAnalyticsEngine();
    await engine.init(
      expandRanges([
        {
          from: '2026-09-08',
          to: '2026-10-07',
          campaignId: 'default',
          totals: { reach: 1000, clicks: 20, cost: 100000, orders: 1 },
        },
      ]),
    );
    const result = await engine.snapshot({ campaignId: 'default', grain: 'day', horizonDays: 30, today: '2026-11-06' });
    expect(result.forecastStatus).toBe('stale');
    expect(result.forecasts).toEqual([]);
    expect(result.nowcasts).toEqual([]);
  });
});
