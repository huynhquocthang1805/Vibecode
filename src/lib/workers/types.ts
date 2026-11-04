import type { AnalyticsQuery, AnalyticsSnapshot, DailyEntry, EntryDelta } from '@/types/domain';

export interface PackedEntries {
  days: Int32Array;
  campaignIdxs: Uint16Array;
  reaches: Float64Array;
  clicks: Float64Array;
  costs: Float64Array;
  orders: Float64Array;
  sources: Uint8Array;
  epoch: string;
  campaigns: string[];
}

export interface AnalyticsWorkerApi {
  /** trả revision */
  init(entries: DailyEntry[] | PackedEntries): Promise<number>;
  /** revision ≠ last + 1 → reject Error('REVISION_GAP') → client init lại */
  applyDelta(delta: EntryDelta, revision: number): Promise<number>;
  snapshot(q: AnalyticsQuery): Promise<AnalyticsSnapshot>;
  /** Ping kiểm tra trạng thái worker */
  ping(): Promise<string>;
}
