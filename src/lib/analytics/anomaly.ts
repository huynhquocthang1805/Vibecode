// Owner: ai-engineer (Hoàng Anh) — FC-07. Pure, không I/O.
import { notImplemented } from '@/lib/notImplemented';
import type { Anomaly, AnomalyConfig, Series, Totals } from '@/types/domain';

/** robust z / MAD, cửa sổ 14 ngày trước (docs/04 §5) */
export function detectAnomalies(_daily: Series, _cfg: AnomalyConfig): Anomaly[] {
  return notImplemented('FC-07');
}

export function detectLiveAnomaly(
  _todaySoFar: Totals,
  _hourFraction: number,
  _history: Series,
  _cfg: AnomalyConfig,
): Anomaly | null {
  return notImplemented('FC-07');
}
