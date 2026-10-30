import 'server-only';

import { notImplemented } from '@/lib/notImplemented';

import type { LlmProvider, ProviderName } from './types';

export type { LlmProvider, ProviderName } from './types';

/** Đọc AI_PROVIDER / AI_API_KEY / AI_MODEL ở server. 'stub' chỉ khi ALLOW_STUB=1 (test/E2E). */
export function getProvider(_name?: ProviderName): LlmProvider {
  return notImplemented('AI-03');
}
