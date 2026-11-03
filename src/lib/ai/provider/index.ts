import 'server-only';

import { GeminiProvider } from './gemini';
import { OpenAiProvider } from './openai';
import { StubProvider } from './stub';
import type { LlmProvider, ProviderName } from './types';

export type { LlmProvider, ProviderName } from './types';
export { GeminiProvider } from './gemini';
export { OpenAiProvider } from './openai';
export { StubProvider } from './stub';

/**
 * Đọc AI_PROVIDER / AI_API_KEY / AI_MODEL ở server.
 * 'stub' chỉ bật khi AI_PROVIDER=stub hoặc có cờ ALLOW_STUB=1 (cho test/E2E).
 */
export function getProvider(name?: ProviderName): LlmProvider {
  const providerName = name ?? (process.env.AI_PROVIDER as ProviderName) ?? 'gemini';

  switch (providerName) {
    case 'gemini':
      return new GeminiProvider();
    case 'openai':
      return new OpenAiProvider();
    case 'stub':
      return new StubProvider();
    default:
      return new GeminiProvider();
  }
}
