import type { AnalyticsQuery, AnalyticsSnapshot, DailyEntry, EntryDelta } from '@/types/domain';

export interface AnalyticsWorkerApi {
  /** trả revision */
  init(entries: DailyEntry[]): Promise<number>;
  /** revision ≠ last + 1 → reject Error('REVISION_GAP') → client init lại */
  applyDelta(delta: EntryDelta, revision: number): Promise<number>;
  snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot>;
}
