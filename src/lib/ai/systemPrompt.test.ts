import { describe, expect, it } from 'vitest';

import { FEW_SHOT, PROMPT_VERSION, SYSTEM_PROMPT_VI } from './prompts';
import { GeminiProvider } from './provider/gemini';
import { OpenAiProvider } from './provider/openai';
import { AI_TEMPERATURE, buildSystemPrompt, modelLabel } from './systemPrompt';

describe('TL-06c · buildSystemPrompt (dùng chung route + eval-ai)', () => {
  it('= SYSTEM_PROMPT_VI + mọi ví dụ FEW_SHOT, ghi rõ chỉ minh hoạ', () => {
    const p = buildSystemPrompt();
    expect(p.startsWith(SYSTEM_PROMPT_VI)).toBe(true);
    FEW_SHOT.forEach((ex, i) => {
      expect(p).toContain(`VÍ DỤ ${i + 1}`);
      expect(p).toContain(ex.assistant);
    });
    expect(p).toMatch(/KHÔNG dùng số liệu của ví dụ/);
    expect(p).not.toMatch(/TODO/);
  });

  it('deterministic', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt());
  });

  it('temperature production = 0.3 (docs/05 §2)', () => {
    expect(AI_TEMPERATURE).toBe(0.3);
  });
});

describe('TL-06c · modelLabel', () => {
  it('Gemini không có AI_MODEL → nhãn là model mặc định thật, không phải "gemini@…"', () => {
    const prev = process.env.AI_MODEL;
    delete process.env.AI_MODEL;
    try {
      expect(modelLabel(new GeminiProvider({ apiKey: 'k' }))).toBe(`gemini-flash-latest@${PROMPT_VERSION}`);
      expect(modelLabel(new OpenAiProvider({ apiKey: 'k' }))).toBe(`gpt-4o-mini@${PROMPT_VERSION}`);
    } finally {
      if (prev !== undefined) process.env.AI_MODEL = prev;
    }
  });

  it('model chỉ định → dùng đúng model đó', () => {
    expect(modelLabel(new GeminiProvider({ apiKey: 'k', model: 'gemini-pro-latest' }))).toBe(
      `gemini-pro-latest@${PROMPT_VERSION}`,
    );
  });

  it('provider không có model (stub) / model rỗng → dùng tên provider', () => {
    expect(modelLabel({ name: 'stub' })).toBe(`stub@${PROMPT_VERSION}`);
    expect(modelLabel({ name: 'stub', model: '  ' })).toBe(`stub@${PROMPT_VERSION}`);
    expect(modelLabel({ name: 'stub', model: 42 })).toBe(`stub@${PROMPT_VERSION}`);
  });
});
