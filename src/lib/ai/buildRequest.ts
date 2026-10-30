import { notImplemented } from '@/lib/notImplemented';
import type { AnalyticsSnapshot, InsightRequest } from '@/types/domain';

/** Nén payload: ≤ 90 kỳ, ≤ 10 bất thường, tên chiến dịch sanitize ≤ 80 ký tự */
export function buildInsightRequest(
  _snap: AnalyticsSnapshot,
  _campaignName: string,
  _ctx?: InsightRequest['context'],
): InsightRequest {
  return notImplemented('AI-07');
}
