import type { LlmProvider } from './types';

export interface OpenAiProviderOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly apiKey: string;
  /** Tên model thật đang gọi — route/eval đọc để gắn nhãn InsightResponse.model */
  readonly model: string;

  constructor(opts?: OpenAiProviderOptions) {
    this.apiKey = opts?.apiKey ?? process.env.AI_API_KEY ?? '';
    this.model = opts?.model ?? process.env.AI_MODEL ?? 'gpt-4o-mini';
  }

  async generateJson(
    system: string,
    user: string,
    jsonSchema: object,
    opts: { timeoutMs: number; temperature: number },
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('PROVIDER_ERROR: Thiếu API key cho OpenAI (AI_API_KEY).');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const url = 'https://api.openai.com/v1/chat/completions';

      const payload = {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'insight_response',
            strict: true,
            schema: jsonSchema,
          },
        },
        temperature: opts.temperature,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`PROVIDER_ERROR: OpenAI API trả mã lỗi ${response.status}: ${errorText}`);
      }

      const resData = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const choice = resData.choices?.[0];
      const text = choice?.message?.content;

      if (!text) {
        throw new Error('PROVIDER_ERROR: OpenAI không trả về nội dung hợp lệ.');
      }

      return JSON.parse(text);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('TIMEOUT: Quá thời gian chờ phản hồi từ OpenAI API.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

