import { describe, expect, it } from 'vitest';

import type { InsightRequest, InsightResponse } from '@/types/domain';

import {
  INSIGHT_JSON_SCHEMA,
  insightRequestSchema,
  insightResponseSchema,
  toGeminiSchema,
} from './schemas';

function createValidRequest(): InsightRequest {
  return {
    locale: 'vi',
    campaignName: 'Chiến dịch Mùa Thu',
    grain: 'day',
    range: { from: '2026-10-01', to: '2026-10-30' },
    totals: {
      reach: 100000,
      clicks: 2500,
      cost: 50000000,
      orders: 120,
      kpis: { ctr: 0.025, cpc: 20000, cpa: 416667, cvr: 0.048 },
    },
    trend: {
      grain: 'day',
      periods: 30,
      overall: 'up',
      metrics: [
        {
          metric: 'orders',
          direction: 'up',
          changePct: 15.5,
          slopePerPeriod: 0.5,
          r2: 0.8,
          cv: 0.1,
          assessment: 'good',
        },
      ],
      comparison: null,
      dataQuality: { days: 30, missingDays: 0, sufficient: true },
    },
    recent: [
      {
        key: '2026-10-30',
        isPartial: false,
        reach: 3500,
        clicks: 90,
        cost: 1800000,
        orders: 5,
        kpis: { ctr: 0.025, cpc: 20000, cpa: 360000, cvr: 0.055 },
      },
    ],
    nowcasts: [],
    forecastConfidence: 'high',
    anomalies: [],
    context: { industry: 'ecommerce', goal: 'sales' },
  };
}

function createValidResponse(): InsightResponse {
  return {
    source: 'ai',
    model: 'gemini-1.5-flash@v1.0',
    generatedAt: 1730000000000,
    overall: 'up',
    headline: 'Chiến dịch tăng trưởng tích cực về số lượng đơn hàng.',
    metricComments: [
      {
        metric: 'orders',
        direction: 'up',
        changePct: 15.5,
        comment: 'Đơn hàng tăng 15,5% so với kỳ trước nhờ cải thiện conversion rate.',
      },
    ],
    forecastComment: 'Dự kiến duy trì đà tăng trưởng đến cuối tháng.',
    suggestions: [
      {
        title: 'Tăng ngân sách nhóm sản phẩm A',
        action: 'Tăng ngân sách 15% cho nhóm sản phẩm chủ lực trong 3 ngày tới',
        rationale: 'CPA đang ở mức tốt 360.000đ thấp hơn mục tiêu',
        expectedImpact: 'Tăng thêm 20-30 đơn hàng',
        priority: 'high',
        relatedMetrics: ['orders', 'cost', 'cpa'],
      },
      {
        title: 'Tối ưu quảng cáo có CTR thấp',
        action: 'Thay thế 2 mẫu ảnh có CTR dưới 1% bằng mẫu ảnh thực tế',
        rationale: 'CTR trung bình 2.5% nhưng một số mẫu chỉ đạt 0.8%',
        expectedImpact: 'Cải thiện CTR thêm 0.5%',
        priority: 'medium',
        relatedMetrics: ['ctr', 'clicks'],
      },
      {
        title: 'Theo dõi chỉ số CPC vào cuối tuần',
        action: 'Thiết lập bid cap tự động để tránh CPC tăng vọt giờ cao điểm',
        rationale: 'CPC cuối tuần dao động mạnh',
        expectedImpact: 'Ổn định chi phí / click',
        priority: 'low',
        relatedMetrics: ['cpc', 'cost'],
      },
    ],
    riskFlags: ['CPA có xu hướng biến động nhẹ cuối tuần'],
    corrected: false,
    warnings: [],
  };
}

describe('AI-01 Schemas', () => {
  it('chấp nhận InsightRequest hợp lệ', () => {
    const req = createValidRequest();
    const parsed = insightRequestSchema.safeParse(req);
    expect(parsed.success).toBe(true);
  });

  it('từ chối InsightRequest thiếu locale hoặc locale khác vi', () => {
    const req = createValidRequest();
    // @ts-expect-error test invalid locale
    req.locale = 'en';
    const parsed = insightRequestSchema.safeParse(req);
    expect(parsed.success).toBe(false);
  });

  it('từ chối InsightRequest có tên chiến dịch rỗng hoặc > 80 ký tự', () => {
    const req = createValidRequest();
    req.campaignName = '';
    expect(insightRequestSchema.safeParse(req).success).toBe(false);

    req.campaignName = 'A'.repeat(81);
    expect(insightRequestSchema.safeParse(req).success).toBe(false);
  });

  it('hỗ trợ trường CR-004 forecastConfidence (tuỳ chọn)', () => {
    const req = createValidRequest();
    delete req.forecastConfidence;
    expect(insightRequestSchema.safeParse(req).success).toBe(true);

    req.forecastConfidence = 'low';
    expect(insightRequestSchema.safeParse(req).success).toBe(true);
  });

  it('chấp nhận InsightResponse hợp lệ với đúng 3 suggestions', () => {
    const res = createValidResponse();
    const parsed = insightResponseSchema.safeParse(res);
    expect(parsed.success).toBe(true);
  });

  it('từ chối InsightResponse khi suggestions không đủ hoặc thừa 3 phần tử', () => {
    const res = createValidResponse();
    // @ts-expect-error test 2 suggestions
    res.suggestions = [res.suggestions[0], res.suggestions[1]];
    expect(insightResponseSchema.safeParse(res).success).toBe(false);
  });

  it('toGeminiSchema chuyển đổi [type, "null"] thành nullable: true', () => {
    const geminiSchema = toGeminiSchema(INSIGHT_JSON_SCHEMA as unknown as Record<string, unknown>);
    expect(geminiSchema).toBeDefined();
    const props = geminiSchema.properties as Record<string, { type: string; nullable?: boolean }>;
    expect(props.forecastComment?.nullable).toBe(true);
    expect(props.forecastComment?.type).toBe('string');
  });
});
