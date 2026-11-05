// Owner: ai-engineer (Hoàng Anh) — FC-08. Pure, không I/O.
import type { BaseMetric, Nowcast, Totals } from '@/types/domain';

const BASE_METRICS: BaseMetric[] = ['reach', 'clicks', 'cost', 'orders'];

/**
 * Tính tỉ lệ hoàn thành mục tiêu (target pacing) (docs/04 §4):
 * - pacing = projected / target * 100 (100 = đạt đúng mục tiêu)
 * - Trả về Record từng metric cơ sở có trong target
 * - target <= 0 hoặc không hợp lệ -> ném RangeError hoặc bỏ qua theo quy tắc an toàn
 */
export function computePacing(
  projected: Nowcast['projected'],
  target: Partial<Totals>,
): NonNullable<Nowcast['pacing']> {
  if (!projected || !target || typeof target !== 'object') {
    return {};
  }

  const pacing: NonNullable<Nowcast['pacing']> = {};

  for (const metric of BASE_METRICS) {
    const targetVal = target[metric];
    if (targetVal === undefined || targetVal === null) {
      continue;
    }

    if (!Number.isFinite(targetVal) || targetVal < 0) {
      throw new RangeError(`PACING_INVALID_TARGET:${metric}`);
    }

    // Nếu target = 0, phép chia safeDiv không xác định -> bỏ qua chỉ số này
    if (targetVal === 0) {
      continue;
    }

    const proj = projected[metric];
    if (!proj || typeof proj.mean !== 'number' || !Number.isFinite(proj.mean) || proj.mean < 0) {
      throw new RangeError(`PACING_INVALID_PROJECTED:${metric}`);
    }

    // % dự kiến đạt so với target (100 = đạt đúng)
    pacing[metric] = (proj.mean / targetVal) * 100;
  }

  return pacing;
}

/**
 * Tính số lượng cần trung bình mỗi ngày trong các ngày còn lại để đạt mục tiêu (docs/04 §4).
 * Trả về null nếu daysRemaining <= 0 hoặc số không hợp lệ.
 */
export function computeRequiredDailyRate(
  remainingTarget: number,
  daysRemaining: number,
): number | null {
  if (daysRemaining <= 0 || !Number.isFinite(remainingTarget) || !Number.isFinite(daysRemaining)) {
    return null;
  }
  return Math.max(0, remainingTarget) / daysRemaining;
}
