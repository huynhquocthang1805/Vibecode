import { describe, expect, it } from 'vitest';

import { addDays, bucketKey, bucketRange, daysBetween, hourVN, parseISODate, todayVN } from './dates';

describe('DATA-02: dates.ts', () => {
  it('E11: todayVN returns current date in Asia/Ho_Chi_Minh', () => {
    // 2026-10-20 16:59:00 UTC = 2026-10-20 23:59:00 VN
    const dateAt2359VN = new Date(Date.UTC(2026, 9, 20, 16, 59, 0));
    expect(todayVN(dateAt2359VN)).toBe('2026-10-20');

    // 2026-10-20 17:01:00 UTC = 2026-10-21 00:01:00 VN
    const datePastMidnightVN = new Date(Date.UTC(2026, 9, 20, 17, 1, 0));
    expect(todayVN(datePastMidnightVN)).toBe('2026-10-21');
  });

  it('R-03: hourVN returns current hour in Asia/Ho_Chi_Minh', () => {
    // 13:00 UTC = 20:00 VN (giờ cao điểm tối 19-22h)
    const utc13 = new Date(Date.UTC(2026, 9, 20, 13, 0, 0));
    expect(hourVN(utc13)).toBe(20);

    // 00:00 UTC = 07:00 VN
    const utc00 = new Date(Date.UTC(2026, 9, 20, 0, 0, 0));
    expect(hourVN(utc00)).toBe(7);

    // 17:00 UTC = 00:00 VN (nửa đêm)
    const utc17 = new Date(Date.UTC(2026, 9, 20, 17, 0, 0));
    expect(hourVN(utc17)).toBe(0);
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
  });

  it('daysBetween and addDays operate correctly', () => {
    expect(daysBetween('2026-10-01', '2026-10-20')).toBe(19);
    expect(addDays('2026-10-20', 5)).toBe('2026-10-25');
  });
});
