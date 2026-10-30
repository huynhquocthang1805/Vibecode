import { notImplemented } from '@/lib/notImplemented';
import type { AnalyticsQuery, DailyEntry, EntryDelta, Series } from '@/types/domain';

/**
 * Kiểu nội bộ (opaque) — chỉ lib/data + lib/workers đọc bên trong.
 * data-engineer tự định nghĩa cấu trúc thật (mảng dày theo ngày, docs/13 §3).
 */
export interface RollupIndex {
  readonly kind: 'rollup-index';
}

/** O(n) */
export function buildRollups(_entries: DailyEntry[]): RollupIndex {
  return notImplemented('DATA-05');
}

/** O(|delta|) */
export function applyDelta(_index: RollupIndex, _delta: EntryDelta): RollupIndex {
  return notImplemented('DATA-05');
}

export function getSeries(
  _index: RollupIndex,
  _q: Pick<AnalyticsQuery, 'campaignId' | 'grain' | 'range' | 'today'>,
): Series {
  return notImplemented('DATA-05');
}
