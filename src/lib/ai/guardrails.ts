import { notImplemented } from '@/lib/notImplemented';
import type { InsightRequest, InsightResponse } from '@/types/domain';

/** 7 bước docs/05 §6: schema, đúng 3 gợi ý, đối chiếu số, hướng xu hướng, cấm cụm từ… */
export function enforceGuardrails(
  _raw: unknown,
  _req: InsightRequest,
): { ok: true; value: InsightResponse } | { ok: false; reason: string } {
  return notImplemented('AI-04');
}
