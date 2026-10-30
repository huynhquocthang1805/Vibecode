// Owner: ba-analyst (Nhân) — BA-03. Thay nội dung, giữ nguyên tên export.
import { notImplemented } from '@/lib/notImplemented';
import type { InsightRequest } from '@/types/domain';

export const PROMPT_VERSION = 'v1.0';

export const SYSTEM_PROMPT_VI = 'TODO(BA-03): system prompt tiếng Việt';

export const FEW_SHOT: Array<{ user: string; assistant: string }> = [];

export function buildUserPrompt(_req: InsightRequest): string {
  return notImplemented('BA-03');
}
