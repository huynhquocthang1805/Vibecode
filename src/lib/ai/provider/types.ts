export interface LlmProvider {
  name: string;
  generateJson(
    system: string,
    user: string,
    jsonSchema: object,
    opts: { timeoutMs: number; temperature: number },
  ): Promise<unknown>;
}

export type ProviderName = 'gemini' | 'openai' | 'stub';
