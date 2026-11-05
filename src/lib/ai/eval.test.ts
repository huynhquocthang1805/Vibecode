import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fallbackInsight } from '@/lib/ai/fallback';
import { enforceGuardrails } from '@/lib/ai/guardrails';
import { insightRequestSchema } from '@/lib/ai/schemas';

import type { AiEvalFixture } from '../../../scripts/eval-ai';

describe('AI-09 · Bộ kịch bản đánh giá AI (src/fixtures/ai-eval)', () => {
  const fixturesDir = resolve('src/fixtures/ai-eval');

  it('thư mục chứa đủ đúng 8 file kịch bản theo manifest BA-06', () => {
    expect(existsSync(fixturesDir)).toBe(true);
    const files = readdirSync(fixturesDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    expect(files).toEqual([
      '01-growth.json',
      '02-cpa-spike.json',
      '03-ctr-fatigue.json',
      '04-three-days.json',
      '05-zero-cost.json',
      '06-volatile.json',
      '07-injection.json',
      '08-two-years.json',
    ]);
  });

  const files = [
    '01-growth.json',
    '02-cpa-spike.json',
    '03-ctr-fatigue.json',
    '04-three-days.json',
    '05-zero-cost.json',
    '06-volatile.json',
    '07-injection.json',
    '08-two-years.json',
  ];

  for (const file of files) {
    describe(`Kịch bản ${file}`, () => {
      const fullPath = resolve(fixturesDir, file);
      const rawText = readFileSync(fullPath, 'utf8');
      const fixture = JSON.parse(rawText) as AiEvalFixture;

      it('kích thước payload UTF-8 không vượt quá giới hạn 32KB', () => {
        expect(Buffer.byteLength(rawText, 'utf8')).toBeLessThanOrEqual(32 * 1024);
      });

      it('đáp ứng Zod schema của InsightRequest', () => {
        const check = insightRequestSchema.safeParse(fixture.request);
        expect(check.success, check.error?.message).toBe(true);
      });

      it('có cấu trúc envelope hợp lệ với expect.overall, mustMention và forbidden', () => {
        expect(fixture.name).toBe(file.replace('.json', ''));
        expect(['up', 'down', 'flat', 'volatile']).toContain(fixture.expect.overall);
        expect(fixture.expect.mustMention.length).toBeGreaterThanOrEqual(1);
        expect(fixture.expect.forbidden.length).toBeGreaterThan(0);
      });

      it('chạy qua pipeline guardrail/fallback luôn trả về đúng 3 gợi ý', () => {
        const fb = fallbackInsight(fixture.request);
        const raw = {
          overall: fb.overall,
          headline: fb.headline,
          metricComments: fb.metricComments,
          forecastComment: fb.forecastComment,
          suggestions: fb.suggestions,
          riskFlags: fb.riskFlags,
        };
        const res = enforceGuardrails(raw, fixture.request, { modelName: 'test-eval' });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value.suggestions.length).toBe(3);
          expect(res.value.overall).toBe(fixture.request.trend.overall);
        }
      });
    });
  }
});
