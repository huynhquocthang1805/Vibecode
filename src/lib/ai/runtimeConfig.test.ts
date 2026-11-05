import { describe, expect, it } from 'vitest';

import {
  AI_RETRY_RESERVE_MS,
  AI_TEMPERATURE_DEFAULT,
  AI_TIMEOUT_DEFAULT_MS,
  AI_TIMEOUT_MAX_MS,
  AI_TIMEOUT_MIN_MS,
  readAiRuntimeConfig,
} from './runtimeConfig';

describe('AI-TIMEOUT-01 · readAiRuntimeConfig', () => {
  it('không đặt biến → giữ hành vi cũ: 15 s, tổng 20 s, temperature 0.3', () => {
    expect(readAiRuntimeConfig({})).toEqual({ timeoutMs: 15_000, totalBudgetMs: 20_000, temperature: 0.3 });
    expect(AI_TIMEOUT_DEFAULT_MS + AI_RETRY_RESERVE_MS).toBe(20_000);
  });

  it('AI_TIMEOUT_MS=30000 (model Pro) → chờ 30 s, tổng 35 s', () => {
    const c = readAiRuntimeConfig({ AI_TIMEOUT_MS: '30000' });
    expect(c.timeoutMs).toBe(30_000);
    expect(c.totalBudgetMs).toBe(35_000);
  });

  it('ngoài khoảng → kẹp [5 s, 50 s]; tổng luôn < maxDuration 60 s của route', () => {
    expect(readAiRuntimeConfig({ AI_TIMEOUT_MS: '100' }).timeoutMs).toBe(AI_TIMEOUT_MIN_MS);
    const max = readAiRuntimeConfig({ AI_TIMEOUT_MS: '999999' });
    expect(max.timeoutMs).toBe(AI_TIMEOUT_MAX_MS);
    expect(max.totalBudgetMs).toBeLessThan(60_000);
  });

  it('giá trị hỏng / rỗng / khoảng trắng → mặc định (không NaN)', () => {
    for (const v of ['abc', '', '   ', 'NaN', 'Infinity', '30s']) {
      const c = readAiRuntimeConfig({ AI_TIMEOUT_MS: v, AI_TEMPERATURE: v });
      expect(c.timeoutMs, v).toBe(AI_TIMEOUT_DEFAULT_MS);
      expect(c.temperature, v).toBe(AI_TEMPERATURE_DEFAULT);
    }
  });

  it('timeout số lẻ được làm tròn; temperature giữ số thực và kẹp [0, 1]', () => {
    expect(readAiRuntimeConfig({ AI_TIMEOUT_MS: ' 25000.6 ' }).timeoutMs).toBe(25_001);
    expect(readAiRuntimeConfig({ AI_TEMPERATURE: '0.7' }).temperature).toBe(0.7);
    expect(readAiRuntimeConfig({ AI_TEMPERATURE: '-1' }).temperature).toBe(0);
    expect(readAiRuntimeConfig({ AI_TEMPERATURE: '2' }).temperature).toBe(1);
  });
});
