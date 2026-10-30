import { notImplemented } from '@/lib/notImplemented';
import type { Grain, ISODate } from '@/types/domain';

/** Ngày hôm nay theo giờ Asia/Ho_Chi_Minh */
export function todayVN(_now?: Date): ISODate {
  return notImplemented('DATA-02');
}

/** Nhận 'YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY', số serial Excel → ISODate hoặc null */
export function parseISODate(_s: string): ISODate | null {
  return notImplemented('DATA-02');
}

/** '2026-10-29' | '2026-W44' | '2026-10' | '2026-Q4' */
export function bucketKey(_d: ISODate, _g: Grain): string {
  return notImplemented('DATA-02');
}

export function bucketRange(_key: string, _g: Grain): { start: ISODate; end: ISODate; days: number } {
  return notImplemented('DATA-02');
}

export function addDays(_d: ISODate, _n: number): ISODate {
  return notImplemented('DATA-02');
}

export function daysBetween(_a: ISODate, _b: ISODate): number {
  return notImplemented('DATA-02');
}
