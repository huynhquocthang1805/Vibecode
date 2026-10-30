import { notImplemented } from '@/lib/notImplemented';
import type { InsightRequest, InsightResponse } from '@/types/domain';

/** Rule-based, deterministic — luôn có nội dung khi AI lỗi */
export function fallbackInsight(_req: InsightRequest): InsightResponse {
  return notImplemented('AI-05');
}
