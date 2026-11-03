import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GeminiProvider } from './gemini';
import { getProvider } from './index';
import { StubProvider } from './stub';

describe('AI-03 Provider Adapters', () => {
  it('StubProvider trả về JSON có cấu trúc hợp lệ', async () => {
    const stub = new StubProvider();
    const result = (await stub.generateJson('system prompt', 'user prompt', {}, {
      timeoutMs: 1000,
      temperature: 0.3,
    })) as { overall: string; suggestions: unknown[] };

    expect(result).toBeDefined();
    expect(result.overall).toBe('up');
    expect(result.suggestions).toHaveLength(3);
  });

  it('StubProvider mô phỏng lỗi khi cấu hình simulateError', async () => {
    const stub = new StubProvider({ simulateError: 'Quota exceeded' });
    await expect(
      stub.generateJson('sys', 'usr', {}, { timeoutMs: 1000, temperature: 0.3 }),
    ).rejects.toThrow('Quota exceeded');
  });

  it('StubProvider mô phỏng timeout khi delayMs > timeoutMs', async () => {
    const stub = new StubProvider({ delayMs: 100 });
    await expect(
      stub.generateJson('sys', 'usr', {}, { timeoutMs: 20, temperature: 0.3 }),
    ).rejects.toThrow('TIMEOUT');
  });

  it('GeminiProvider ném lỗi rõ ràng khi thiếu AI_API_KEY', async () => {
    const gemini = new GeminiProvider({ apiKey: '' });
    await expect(
      gemini.generateJson('sys', 'usr', {}, { timeoutMs: 1000, temperature: 0.3 }),
    ).rejects.toThrow('Thiếu API key cho Google Gemini');
  });

  it('getProvider trả về đúng instance theo tên', () => {
    const stub = getProvider('stub');
    expect(stub.name).toBe('stub');

    const gemini = getProvider('gemini');
    expect(gemini.name).toBe('gemini');
  });
});
