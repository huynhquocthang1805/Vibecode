import { notImplemented } from '@/lib/notImplemented';
import type { ISODate, PeriodComparison, Series } from '@/types/domain';

/**
 * Like-for-like (docs/03 §3). Kỳ hiện tại partial và grain ≠ day → cắt cùng số ngày đầu
 * của kỳ trước từ `daily` (CR-003). Không có `daily` → likeForLike = false.
 */
export function comparePeriods(_series: Series, _today: ISODate, _daily?: Series): PeriodComparison | null {
  return notImplemented('DATA-05');
}
