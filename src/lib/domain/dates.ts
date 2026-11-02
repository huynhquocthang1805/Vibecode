import {
  addDays as addDaysFn,
  differenceInCalendarDays,
  endOfISOWeek,
  endOfMonth,
  endOfQuarter,
  getISOWeek,
  getISOWeekYear,
  getQuarter,
  startOfISOWeek,
  startOfMonth,
  startOfQuarter,
} from 'date-fns';

import type { Grain, ISODate } from '@/types/domain';

const vnDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Helper: format Date to YYYY-MM-DD in Asia/Ho_Chi_Minh */
function formatVN(date: Date): ISODate {
  return vnDateFormatter.format(date);
}

/** Ngày hôm nay theo giờ Asia/Ho_Chi_Minh */
export function todayVN(now?: Date): ISODate {
  const target = now ?? new Date();
  return formatVN(target);
}

/** Nhận 'YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY', số serial Excel → ISODate hoặc null */
export function parseISODate(s: string): ISODate | null {
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();

  // Try ISO format YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return trimmed;
    }
    return null;
  }

  // European style DD/MM/YYYY or D/M/YYYY
  const dmY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY && dmY[1] && dmY[2] && dmY[3]) {
    const d = Number(dmY[1]);
    const m = Number(dmY[2]);
    const y = Number(dmY[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  // Excel serial number (days since 1899-12-30)
  const serial = Number(trimmed);
  if (!Number.isNaN(serial) && Number.isInteger(serial) && serial > 0 && serial < 100_000) {
    const ms = (serial - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    return formatVN(dt);
  }

  return null;
}

/** '2026-10-29' | '2026-W44' | '2026-10' | '2026-Q4' */
export function bucketKey(d: ISODate, g: Grain): string {
  const [yStr = '2026', mStr = '01', dayStr = '01'] = d.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));

  switch (g) {
    case 'day':
      return d;
    case 'week': {
      const isoYear = getISOWeekYear(date);
      const week = getISOWeek(date);
      return `${isoYear}-W${String(week).padStart(2, '0')}`;
    }
    case 'month': {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
    case 'quarter': {
      const quarter = getQuarter(date);
      return `${y}-Q${quarter}`;
    }
    default:
      return d;
  }
}

export function bucketRange(key: string, g: Grain): { start: ISODate; end: ISODate; days: number } {
  if (g === 'day') {
    return { start: key, end: key, days: 1 };
  }

  const parts = key.split('-');
  const yearPart = parts[0] ?? '2026';
  const rest = parts[1] ?? '';
  const year = Number(yearPart);

  if (g === 'week') {
    const weekNum = Number(rest.replace('W', ''));
    // ISO week 1 contains Jan 4th
    const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
    const jan4Week = getISOWeek(jan4);
    const dayOffset = (weekNum - jan4Week) * 7;
    const approx = addDaysFn(jan4, dayOffset);
    const startDt = startOfISOWeek(approx);
    const endDt = endOfISOWeek(approx);
    const start = formatVN(startDt);
    const end = formatVN(endDt);
    const days = differenceInCalendarDays(endDt, startDt) + 1;
    return { start, end, days };
  }

  if (g === 'month') {
    const monthIndex = Number(rest) - 1;
    const startDt = startOfMonth(new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0)));
    const endDt = endOfMonth(startDt);
    const start = formatVN(startDt);
    const end = formatVN(endDt);
    const days = differenceInCalendarDays(endDt, startDt) + 1;
    return { start, end, days };
  }

  if (g === 'quarter') {
    const qNum = Number(rest.replace('Q', ''));
    const startMonthIndex = (qNum - 1) * 3;
    const startDt = startOfQuarter(new Date(Date.UTC(year, startMonthIndex, 1, 12, 0, 0)));
    const endDt = endOfQuarter(startDt);
    const start = formatVN(startDt);
    const end = formatVN(endDt);
    const days = differenceInCalendarDays(endDt, startDt) + 1;
    return { start, end, days };
  }

  return { start: key, end: key, days: 1 };
}

export function addDays(d: ISODate, n: number): ISODate {
  const [yStr = '2026', mStr = '01', dayStr = '01'] = d.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const newDate = addDaysFn(date, n);
  return formatVN(newDate);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay = '2026', am = '01', ad = '01'] = a.split('-');
  const [by = '2026', bm = '01', bd = '01'] = b.split('-');
  const da = new Date(Date.UTC(Number(ay), Number(am) - 1, Number(ad)));
  const db = new Date(Date.UTC(Number(by), Number(bm) - 1, Number(bd)));
  return differenceInCalendarDays(db, da);
}
