import { describe, expect, it } from 'vitest';

import edgeCases from '@/fixtures/edge-cases.json';
import { LIMITS } from '@/types/domain';

import { validateBatch, validateEntry } from './validation';
import type { ValidationContext } from './validation';

describe('DATA-01: Validation', () => {
  const validateCases = (edgeCases as Array<{
    id: string;
    description: string;
    kind: string;
    context?: { today?: string; now?: string; existingKeys?: string[] };
    input: unknown;
    expect: {
      ok: boolean;
      codes?: string[];
      value?: unknown;
    };
  }>).filter((c) => c.kind === 'validate');

  it(`passes all ${validateCases.length} edge-cases of kind "validate"`, () => {
    for (const c of validateCases) {
      const today = c.context?.today ?? '2026-10-20';
      const existingKeys = c.context?.existingKeys ? new Set(c.context.existingKeys) : undefined;
      const ctx: ValidationContext = { today, existingKeys };

      const res = validateEntry(c.input, ctx);

      expect(res.ok, `Case ${c.id}: ${c.description} - ok mismatch`).toBe(c.expect.ok);

      if (c.expect.codes) {
        const resultCodes = res.issues.map((i) => i.code);
        for (const code of c.expect.codes) {
          expect(resultCodes, `Case ${c.id} missing code ${code}`).toContain(code);
        }
      }

      if (c.expect.ok && c.expect.value) {
        expect(res.value, `Case ${c.id} value mismatch`).toMatchObject(c.expect.value as Record<string, unknown>);
      }
    }
  });

  describe('E31 - E33 (docs/13 §10)', () => {
    const defaultCtx: ValidationContext = { today: '2026-10-20' };

    it('E31: date = ngày trước MIN_DATE -> error DATE_TOO_OLD', () => {
      const res = validateEntry(
        {
          date: '2014-12-31',
          campaignId: 'default',
          reach: 100,
          clicks: 10,
          cost: 1000,
          orders: 1,
        },
        defaultCtx,
      );
      expect(res.ok).toBe(false);
      expect(res.issues.some((i) => i.code === 'DATE_TOO_OLD')).toBe(true);
    });

    it('E32: cost = MAX_VALUE.cost + 1 -> error TOO_LARGE', () => {
      const res = validateEntry(
        {
          date: '2026-10-20',
          campaignId: 'default',
          reach: 100,
          clicks: 10,
          cost: LIMITS.MAX_VALUE.cost + 1,
          orders: 1,
        },
        defaultCtx,
      );
      expect(res.ok).toBe(false);
      expect(res.issues.some((i) => i.code === 'TOO_LARGE')).toBe(true);
    });

    it('E33: reach = "1.2E+06" -> 1.200.000', () => {
      const res = validateEntry(
        {
          date: '2026-10-20',
          campaignId: 'default',
          reach: '1.2E+06',
          clicks: 10,
          cost: 1000,
          orders: 1,
        },
        defaultCtx,
      );
      expect(res.ok).toBe(true);
      expect(res.value?.reach).toBe(1_200_000);
    });
  });

  it('validateBatch: merges duplicates in same file and reports correctly', () => {
    const rows = [
      { date: '2026-10-10', campaignId: 'c1', reach: 100, clicks: 10, cost: 500, orders: 1 },
      { date: '2026-10-10', campaignId: 'c1', reach: 50, clicks: 5, cost: 250, orders: 1 },
      { date: '2026-10-11', campaignId: 'c1', reach: 200, clicks: 20, cost: 1000, orders: 2 },
      { date: '2026-10-12', campaignId: 'c1', reach: -1, clicks: 20, cost: 1000, orders: 2 },
    ];
    const { valid, report } = validateBatch(rows, { today: '2026-10-20' });

    expect(report.totalRows).toBe(4);
    expect(report.accepted).toBe(2);
    expect(report.rejectedTotal).toBe(1);
    expect(report.mergedInFile).toBe(1);
    expect(valid[0]?.reach).toBe(150);
  });

  it('perf: validateBatch 50k rows < 300ms', () => {
    const row = {
      date: '2026-10-10',
      campaignId: 'default',
      reach: 1000,
      clicks: 50,
      cost: 500000,
      orders: 5,
    };
    const rows = Array.from({ length: 50_000 }, () => row);
    const start = performance.now();
    const { valid, report } = validateBatch(rows, { today: '2026-10-20' });
    const duration = performance.now() - start;

    expect(report.totalRows).toBe(50_000);
    expect(valid.length).toBe(1); // duplicate merged
    expect(duration).toBeLessThan(300);
  });
});
