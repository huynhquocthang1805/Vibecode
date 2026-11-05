import { toGeminiSchema } from '../schemas';
import type { LlmProvider } from './types';

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts?: GeminiProviderOptions) {
    this.apiKey = opts?.apiKey ?? process.env.AI_API_KEY ?? '';
    this.model = opts?.model ?? (process.env.AI_MODEL || 'gemini-flash-latest'); // TL-06b: dòng 1.5 đã bị Google ngừng; khớp .env.example
  }

  async generateJson(
    system: string,
    user: string,
    jsonSchema: object,
    opts: { timeoutMs: number; temperature: number },
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('PROVIDER_ERROR: Thiếu API key cho Google Gemini (AI_API_KEY).');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model,
      )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const geminiSchema = toGeminiSchema(jsonSchema as Record<string, unknown>);

      const payload = {
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: user }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiSchema,
          temperature: opts.temperature,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`PROVIDER_ERROR: Gemini API trả mã lỗi ${response.status}: ${errorText}`);
      }

      const resData = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const candidate = resData.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('PROVIDER_ERROR: Gemini không trả về nội dung hợp lệ.');
      }

      return JSON.parse(text);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('TIMEOUT: Quá thời gian chờ phản hồi từ Gemini API.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

