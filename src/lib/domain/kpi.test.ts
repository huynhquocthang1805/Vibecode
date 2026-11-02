import { describe, expect, it } from 'vitest';

import type { Totals } from '@/types/domain';

import { computeKpis, pctChange, safeDiv, sumTotals } from './kpi';

describe('DATA-02: kpi.ts', () => {
  it('safeDiv returns null when b === 0, otherwise a / b', () => {
    expect(safeDiv(10, 0)).toBeNull();
    expect(safeDiv(0, 0)).toBeNull();
    expect(safeDiv(0, 10)).toBe(0);
    expect(safeDiv(10, 2)).toBe(5);
  });

  it('computeKpis computes CTR, CPC, CPA, CVR via safeDiv', () => {
    const t: Totals = { reach: 1000, clicks: 50, cost: 100000, orders: 5 };
    const kpis = computeKpis(t);
    expect(kpis.ctr).toBe(0.05);
    expect(kpis.cpc).toBe(2000);
    expect(kpis.cpa).toBe(20000);
    expect(kpis.cvr).toBe(0.1);
  });

  it('computeKpis with zeroes returns appropriate 0 or null', () => {
    const zeroTotals: Totals = { reach: 0, clicks: 0, cost: 0, orders: 0 };
    expect(computeKpis(zeroTotals)).toEqual({
      ctr: null,
      cpc: null,
      cpa: null,
      cvr: null,
    });

    const reachOnly: Totals = { reach: 1000, clicks: 0, cost: 100000, orders: 0 };
    expect(computeKpis(reachOnly)).toEqual({
      ctr: 0,
      cpc: null,
      cpa: null,
      cvr: null,
    });
  });

  it('sumTotals sums all fields across items', () => {
    const items: Totals[] = [
      { reach: 100, clicks: 10, cost: 1000, orders: 1 },
      { reach: 200, clicks: 20, cost: 2000, orders: 2 },
    ];
    expect(sumTotals(items)).toEqual({
      reach: 300,
      clicks: 30,
      cost: 3000,
      orders: 3,
    });
    expect(sumTotals([])).toEqual({ reach: 0, clicks: 0, cost: 0, orders: 0 });
  });

  it('pctChange follows docs/03 §3 rules', () => {
    expect(pctChange(125, 100)).toBe(25);
    expect(pctChange(75, 100)).toBe(-25);
    expect(pctChange(0, 100)).toBe(-100);
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
    expect(pctChange(null, 100)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
  });
});
