import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { providerHint } from './errors';
import { GeminiProvider, summarizeGeminiError } from './gemini';
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

  it('getProvider ném lỗi rõ ràng khi tên provider sai chính tả hoặc không hỗ trợ (R-03)', () => {
    expect(() => getProvider('gemni' as never)).toThrow(/Nhà cung cấp AI không được hỗ trợ/);
    expect(() => getProvider('claude' as never)).toThrow(/Nhà cung cấp AI không được hỗ trợ/);
  });
});

describe('AI-FIX-03 · Gemini gửi key qua header, lỗi upstream có mã + gợi ý', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('key nằm trong header x-goog-api-key, KHÔNG nằm trong URL', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await new GeminiProvider({ apiKey: 'k-bi-mat', model: 'm' }).generateJson('s', 'u', {}, { timeoutMs: 1000, temperature: 0 });
    expect(out).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('k-bi-mat');
    expect(url).toMatch(/models\/m:generateContent$/);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k-bi-mat');
  });

  it('429 RESOURCE_EXHAUSTED → lỗi có mã + trạng thái Google, gợi ý "hết hạn mức"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }, { status: 429 })));
    const err = (await new GeminiProvider({ apiKey: 'k', model: 'm' })
      .generateJson('s', 'u', {}, { timeoutMs: 1000, temperature: 0 })
      .catch((e: unknown) => e)) as Error;
    expect(err.message).toBe('PROVIDER_ERROR: Gemini API trả mã lỗi 429: RESOURCE_EXHAUSTED Quota exceeded');
    expect(providerHint(err.message)).toContain('hết hạn mức');
  });

  it('providerHint: 400 key sai / 403 / 404 model / 503 / thiếu key / lỗi lạ', () => {
    expect(providerHint('PROVIDER_ERROR: Gemini API trả mã lỗi 400: INVALID_ARGUMENT API key not valid')).toContain('không hợp lệ');
    expect(providerHint('… mã lỗi 403: PERMISSION_DENIED')).toContain('403');
    expect(providerHint('… mã lỗi 404: NOT_FOUND')).toContain('AI_MODEL');
    expect(providerHint('… mã lỗi 503: UNAVAILABLE')).toContain('quá tải');
    expect(providerHint('PROVIDER_ERROR: Thiếu API key cho Google Gemini (AI_API_KEY).')).toContain('AI_API_KEY');
    expect(providerHint('SyntaxError: Unexpected token')).toBe('');
  });

  it('summarizeGeminiError: body không phải JSON → cắt 200 ký tự', () => {
    expect(summarizeGeminiError('x'.repeat(500))).toHaveLength(200);
  });
});
