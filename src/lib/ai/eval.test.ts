import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fallbackInsight } from '@/lib/ai/fallback';
import { enforceGuardrails } from '@/lib/ai/guardrails';
import { insightRequestSchema } from '@/lib/ai/schemas';

import {
  calculatePercentile,
  checkBannedPhrases,
  checkMustMention,
} from './evalMetrics';
import type { AiEvalFixture } from './evalMetrics';

describe('AI-09 · Các hàm đánh giá và chấm điểm (evalMetrics)', () => {
  describe('calculatePercentile', () => {
    it('mảng rỗng hoặc không hợp lệ trả về 0', () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([], 95)).toBe(0);
    });

    it('mảng 1 phần tử trả về chính phần tử đó cho mọi phân vị', () => {
      expect(calculatePercentile([450], 50)).toBe(450);
      expect(calculatePercentile([450], 95)).toBe(450);
      expect(calculatePercentile([450], 0)).toBe(450);
      expect(calculatePercentile([450], 100)).toBe(450);
    });

    it('mảng nhiều phần tử tính đúng phân vị p50 và p95 theo nearest-rank', () => {
      const data = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      expect(calculatePercentile(data, 50)).toBe(500);
      expect(calculatePercentile(data, 90)).toBe(900);
      expect(calculatePercentile(data, 95)).toBe(1000);
    });

    it('hoạt động chính xác khi mảng chưa sắp xếp', () => {
      const unsorted = [750, 450, 520, 620, 470, 510, 500, 800];
      const p50 = calculatePercentile(unsorted, 50);
      expect(p50).toBe(510);
      const p95 = calculatePercentile(unsorted, 95);
      expect(p95).toBe(800);
    });
  });

  describe('checkBannedPhrases (BR-08)', () => {
    const sampleBanned = ['tối ưu chiến dịch', 'cải thiện hiệu quả', 'tiếp tục theo dõi'];

    it('trả về violated: false khi danh sách cấm hoặc gợi ý rỗng', () => {
      expect(checkBannedPhrases([], sampleBanned)).toEqual({ violated: false, details: [] });
      expect(checkBannedPhrases([{ title: 'Tiêu đề', action: 'Hành động cụ thể' }], [])).toEqual({
        violated: false,
        details: [],
      });
    });

    it('phát hiện cụm cấm khi hành động quá ngắn (< 40 ký tự)', () => {
      const suggestions = [
        {
          title: 'Tối ưu chiến dịch',
          action: 'Hãy tối ưu chiến dịch ngay.', // < 40 ký tự
        },
      ];
      const res = checkBannedPhrases(suggestions, sampleBanned);
      expect(res.violated).toBe(true);
      expect(res.details.length).toBeGreaterThan(0);
      expect(res.details[0]).toContain('tối ưu chiến dịch');
    });

    it('phát hiện cụm cấm khi hành động không có số liệu hoặc tên chỉ số', () => {
      const suggestions = [
        {
          title: 'Cải thiện hiệu quả',
          action: 'Cần nỗ lực cải thiện hiệu quả phân phối quảng cáo trên toàn bộ các kênh.', // > 40 ký tự nhưng không có số/chỉ số
        },
      ];
      const res = checkBannedPhrases(suggestions, sampleBanned);
      expect(res.violated).toBe(true);
      expect(res.details.length).toBeGreaterThan(0);
    });

    it('không phạt oan khi chứa từ khóa nhưng hành động chi tiết (≥ 40 ký tự và có số liệu cụ thể)', () => {
      const suggestions = [
        {
          title: 'Tối ưu chiến dịch sản phẩm chủ lực',
          action: 'Thực hiện tối ưu chiến dịch bằng cách tăng ngân sách 15% cho nhóm đơn hàng CPA < 50.000đ.',
        },
      ];
      const res = checkBannedPhrases(suggestions, sampleBanned);
      expect(res.violated).toBe(false);
      expect(res.details).toEqual([]);
    });

    it('không phát hiện vi phạm khi gợi ý hoàn toàn sạch', () => {
      const suggestions = [
        {
          title: 'Thay mới hình ảnh quảng cáo',
          action: 'Thay thế 2 hình ảnh có CTR thấp nhất bằng hình ảnh sản phẩm thực tế trong 3 ngày tới.',
        },
      ];
      const res = checkBannedPhrases(suggestions, sampleBanned);
      expect(res.violated).toBe(false);
      expect(res.details).toEqual([]);
    });

    it('nhận diện chính xác cả khi viết hoa/thường hoặc biến thể dấu tiếng Việt', () => {
      const suggestions = [
        {
          title: 'TIẾP TỤC THEO DÕI',
          action: 'Tiếp tục theo dõi thêm.', // ngắn, không số
        },
      ];
      const res = checkBannedPhrases(suggestions, sampleBanned);
      expect(res.violated).toBe(true);
    });
  });

  describe('checkMustMention (BR-06)', () => {
    it('trả về passed: true khi có đủ toàn bộ metrics yêu cầu', () => {
      const comments = [{ metric: 'orders' as const }, { metric: 'cpa' as const }, { metric: 'cost' as const }];
      const res = checkMustMention(comments, ['orders', 'cpa']);
      expect(res.passed).toBe(true);
      expect(res.missing).toEqual([]);
    });

    it('trả về passed: false và liệt kê đúng metric bị thiếu', () => {
      const comments = [{ metric: 'orders' as const }];
      const res = checkMustMention(comments, ['orders', 'cpa', 'cost']);
      expect(res.passed).toBe(false);
      expect(res.missing).toEqual(['cpa', 'cost']);
    });

    it('trả về passed: false khi danh sách nhận xét rỗng', () => {
      const res = checkMustMention([], ['orders']);
      expect(res.passed).toBe(false);
      expect(res.missing).toEqual(['orders']);
    });
  });
});

describe('AI-09 · Bộ kịch bản và Guardrails xử lý ca biên', () => {
  const fixturesDir = resolve('src/fixtures/ai-eval');
  const fixture01 = JSON.parse(readFileSync(resolve(fixturesDir, '01-growth.json'), 'utf8')) as AiEvalFixture;

  it('xử lý khi output thô có ít hơn 3 gợi ý (< 3) -> bù đúng 3 gợi ý', () => {
    const rawWith2Suggestions = {
      overall: 'up' as const,
      headline: 'Tăng trưởng tốt',
      metricComments: [{ metric: 'orders' as const, direction: 'up' as const, changePct: 25, comment: 'Đơn hàng tăng' }],
      forecastComment: null,
      suggestions: [
        {
          title: 'Gợi ý 1',
          action: 'Hành động cụ thể tăng ngân sách 15% cho nhóm sản phẩm chủ lực.',
          rationale: 'Lý do rõ ràng',
          expectedImpact: 'Tác động dự kiến',
          priority: 'high' as const,
          relatedMetrics: ['orders' as const],
        },
        {
          title: 'Gợi ý 2',
          action: 'Hành động cụ thể giảm giá thầu 10% cho nhóm chi phí cao.',
          rationale: 'Lý do rõ ràng',
          expectedImpact: 'Tác động dự kiến',
          priority: 'medium' as const,
          relatedMetrics: ['cost' as const],
        },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawWith2Suggestions, fixture01.request);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.suggestions.length).toBe(3);
      expect(res.value.corrected).toBe(true);
      expect(res.value.warnings.some((w) => w.includes('Bổ sung'))).toBe(true);
    }
  });

  it('xử lý khi output thô có nhiều hơn 3 gợi ý (> 3) -> cắt còn đúng 3 theo priority', () => {
    const rawWith4Suggestions = {
      overall: 'up' as const,
      headline: 'Tăng trưởng tốt',
      metricComments: [{ metric: 'orders' as const, direction: 'up' as const, changePct: 25, comment: 'Đơn hàng tăng' }],
      forecastComment: null,
      suggestions: [
        {
          title: 'Gợi ý thấp',
          action: 'Hành động điều chỉnh giá thầu 5% vào các ngày cuối tuần.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'low' as const,
          relatedMetrics: ['cost' as const],
        },
        {
          title: 'Gợi ý cao 1',
          action: 'Hành động tăng ngân sách 20% cho nhóm đơn hàng hiệu quả.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'high' as const,
          relatedMetrics: ['orders' as const],
        },
        {
          title: 'Gợi ý trung bình',
          action: 'Hành động làm mới 2 mẫu quảng cáo có CTR thấp.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'medium' as const,
          relatedMetrics: ['ctr' as const],
        },
        {
          title: 'Gợi ý cao 2',
          action: 'Hành động mở rộng tập khách hàng tương tự 2%.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'high' as const,
          relatedMetrics: ['reach' as const],
        },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawWith4Suggestions, fixture01.request);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.suggestions.length).toBe(3);
      // Gợi ý low bị loại bỏ, giữ lại high và medium
      expect(res.value.suggestions.some((s) => s.priority === 'low')).toBe(false);
    }
  });

  it('làm sạch mã HTML độc hại hoặc markdown codeblock trong đầu ra thô', () => {
    const rawWithHtml = {
      overall: 'up' as const,
      headline: 'Tăng trưởng <b>tốt</b> <script>alert(1)</script>',
      metricComments: [],
      forecastComment: null,
      suggestions: [
        {
          title: 'Tiêu đề <i>nghiêng</i>',
          action: 'Hành động <b>đậm</b> có chứa số 15% và chi phí 50.000đ kéo dài trên 40 ký tự.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'high' as const,
          relatedMetrics: ['orders' as const],
        },
        {
          title: 'Tiêu đề 2',
          action: 'Hành động cụ thể số 2 với đơn hàng tăng 25% trong 3 ngày tới.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'medium' as const,
          relatedMetrics: ['orders' as const],
        },
        {
          title: 'Tiêu đề 3',
          action: 'Hành động cụ thể số 3 điều chỉnh chi phí CPA giảm 10% ngay.',
          rationale: 'Lý do',
          expectedImpact: 'Tác động',
          priority: 'low' as const,
          relatedMetrics: ['cpa' as const],
        },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawWithHtml, fixture01.request);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.headline).not.toContain('<script>');
      expect(res.value.headline).not.toContain('<b>');
      expect(res.value.suggestions[0]?.title).toBe('Tiêu đề nghiêng');
    }
  });

  it('từ chối khi đầu ra không thể parse JSON', () => {
    const invalidJsonString = 'Đây không phải JSON: { headline: "lỗi" ';
    const res = enforceGuardrails(invalidJsonString, fixture01.request);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain('JSON_PARSE_ERROR');
    }
  });

  it('từ chối khi đầu ra sai cấu trúc Zod schema', () => {
    const brokenSchema = {
      overall: 'khong_hop_le', // sai enum
      headline: 12345, // sai type
    };
    const res = enforceGuardrails(brokenSchema, fixture01.request);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain('SCHEMA_VALIDATION_ERROR');
    }
  });
});

describe('AI-09 · Kiểm định toàn vẹn 8 kịch bản tham chiếu (src/fixtures/ai-eval)', () => {
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
