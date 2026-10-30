import { notImplemented } from '@/lib/notImplemented';
import type { ISODate, PeriodComparison, Series } from '@/types/domain';

/** Like-for-like (docs/03 §3) */
export function comparePeriods(_series: Series, _today: ISODate): PeriodComparison | null {
  return notImplemented('DATA-05');
}
