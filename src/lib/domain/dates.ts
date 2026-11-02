import { getISOWeek, getISOWeekYear, getQuarter } from 'date-fns';

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

/** Tính khoảng ngày theo lịch chuẩn độc lập với múi giờ server */
export function bucketRange(key: string, g: Grain): { start: ISODate; end: ISODate; days: number } {
  if (g === 'day') {
    return { start: key, end: key, days: 1 };
  }

  const parts = key.split('-');
  const yearPart = parts[0] ?? '2026';
  const rest = parts[1] ?? '';
  const year = Number(yearPart);

  if (g === 'month') {
    const month = Number(rest);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, days: lastDay };
  }

  if (g === 'quarter') {
    const qNum = Number(rest.replace('Q', ''));
    const startMonth = (qNum - 1) * 3 + 1;
    const endMonth = qNum * 3;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const startMs = Date.UTC(year, startMonth - 1, 1);
    const endMs = Date.UTC(year, endMonth - 1, lastDay);
    const days = Math.round((endMs - startMs) / 86400000) + 1;
    return { start, end, days };
  }

  if (g === 'week') {
    const weekNum = Number(rest.replace('W', ''));
    // ISO week 1 là tuần chứa ngày 4 tháng 1
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // 1 = Thứ Hai, 7 = Chủ Nhật
    const monW1Ms = jan4.getTime() - (dayOfWeek - 1) * 86400000;
    const monWMs = monW1Ms + (weekNum - 1) * 7 * 86400000;
    const sunWMs = monWMs + 6 * 86400000;

    const monDate = new Date(monWMs);
    const sunDate = new Date(sunWMs);

    const start = `${monDate.getUTCFullYear()}-${String(monDate.getUTCMonth() + 1).padStart(2, '0')}-${String(monDate.getUTCDate()).padStart(2, '0')}`;
    const end = `${sunDate.getUTCFullYear()}-${String(sunDate.getUTCMonth() + 1).padStart(2, '0')}-${String(sunDate.getUTCDate()).padStart(2, '0')}`;
    return { start, end, days: 7 };
  }

  return { start: key, end: key, days: 1 };
}

export function addDays(d: ISODate, n: number): ISODate {
  const [yStr = '2026', mStr = '01', dayStr = '01'] = d.split('-');
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dayStr) + n));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay = '2026', am = '01', ad = '01'] = a.split('-');
  const [by = '2026', bm = '01', bd = '01'] = b.split('-');
  const da = Date.UTC(Number(ay), Number(am) - 1, Number(ad));
  const db = Date.UTC(Number(by), Number(bm) - 1, Number(bd));
  return Math.round((db - da) / 86400000);
}
