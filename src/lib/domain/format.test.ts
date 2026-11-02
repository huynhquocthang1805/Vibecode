import { describe, expect, it } from 'vitest';

import { fmtDelta, fmtInt, fmtPct, fmtVnd, fmtVndShort } from './format';

describe('DATA-02: format.ts', () => {
  it('fmtInt formats integers or returns "—"', () => {
    expect(fmtInt(125400)).toBe('125.400');
    expect(fmtInt(0)).toBe('0');
    expect(fmtInt(null)).toBe('—');
  });

  it('fmtVnd formats currency in VND or returns "—"', () => {
    expect(fmtVnd(18500000)).toBe('18.500.000 ₫');
    expect(fmtVnd(0)).toBe('0 ₫');
    expect(fmtVnd(null)).toBe('—');
  });

  it('fmtVndShort abbreviates large numbers', () => {
    expect(fmtVndShort(18500000)).toBe('18,5tr');
    expect(fmtVndShort(1200000000)).toBe('1,2 tỷ');
    expect(fmtVndShort(50000)).toBe('50k');
    expect(fmtVndShort(500)).toBe('500 ₫');
    expect(fmtVndShort(null)).toBe('—');
  });

  it('fmtPct formats ratio as percentage', () => {
    expect(fmtPct(0.0256)).toBe('2,56%');
    expect(fmtPct(0.0256, 1)).toBe('2,6%');
    expect(fmtPct(0)).toBe('0,00%');
    expect(fmtPct(null)).toBe('—');
  });

  it('fmtDelta formats change percentage with arrow', () => {
    expect(fmtDelta(12.3)).toBe('▲ 12,3%');
    expect(fmtDelta(-5.2)).toBe('▼ 5,2%');
    expect(fmtDelta(0)).toBe('0,0%');
    expect(fmtDelta(null)).toBe('—');
  });
});
