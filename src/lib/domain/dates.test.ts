import { describe, expect, it } from 'vitest';

import { addDays, bucketKey, bucketRange, daysBetween, parseISODate, todayVN } from './dates';

describe('DATA-02: dates.ts', () => {
  it('E11: todayVN returns current date in Asia/Ho_Chi_Minh', () => {
    // 2026-10-20 16:59:00 UTC = 2026-10-20 23:59:00 VN
    const dateAt2359VN = new Date(Date.UTC(2026, 9, 20, 16, 59, 0));
    expect(todayVN(dateAt2359VN)).toBe('2026-10-20');

    // 2026-10-20 17:01:00 UTC = 2026-10-21 00:01:00 VN
    const datePastMidnightVN = new Date(Date.UTC(2026, 9, 20, 17, 1, 0));
    expect(todayVN(datePastMidnightVN)).toBe('2026-10-21');
  });

  it('E24: bucketKey with grain="week" maps to ISO week year', () => {
    expect(bucketKey('2025-12-29', 'week')).toBe('2026-W01');
    expect(bucketKey('2026-10-29', 'week')).toBe('2026-W44');
  });

  it('E25: bucketKey with grain="quarter" maps correctly', () => {
    expect(bucketKey('2026-10-15', 'quarter')).toBe('2026-Q4');
    expect(bucketKey('2026-02-15', 'quarter')).toBe('2026-Q1');
  });

  it('bucketKey with grain="day" and "month"', () => {
    expect(bucketKey('2026-10-29', 'day')).toBe('2026-10-29');
    expect(bucketKey('2026-10-29', 'month')).toBe('2026-10');
  });

  it('bucketRange calculates correct start, end, and days count', () => {
    const dayR = bucketRange('2026-10-29', 'day');
    expect(dayR).toEqual({ start: '2026-10-29', end: '2026-10-29', days: 1 });

    const monthR = bucketRange('2026-10', 'month');
    expect(monthR.start).toBe('2026-10-01');
    expect(monthR.end).toBe('2026-10-31');
    expect(monthR.days).toBe(31);

    const qR = bucketRange('2026-Q4', 'quarter');
    expect(qR.start).toBe('2026-10-01');
    expect(qR.end).toBe('2026-12-31');
    expect(qR.days).toBe(92);
  });

  it('parseISODate handles YYYY-MM-DD, DD/MM/YYYY, Excel serials', () => {
    expect(parseISODate('2026-10-20')).toBe('2026-10-20');
    expect(parseISODate('20/10/2026')).toBe('2026-10-20');
    expect(parseISODate('5/8/2026')).toBe('2026-08-05');
    expect(parseISODate('31/02/2026')).toBeNull();
    expect(parseISODate('invalid-date')).toBeNull();
  });

  it('addDays and daysBetween work accurately', () => {
    expect(addDays('2026-10-20', 5)).toBe('2026-10-25');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-20', '2026-10-25')).toBe(5);
    expect(daysBetween('2026-10-25', '2026-10-20')).toBe(-5);
  });
});
