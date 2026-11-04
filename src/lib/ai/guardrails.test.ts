import { describe, expect, it } from 'vitest';

import type { InsightRequest, MetricTrend } from '@/types/domain';

import { enforceGuardrails } from './guardrails';

function makeBaseReq(): InsightRequest {
  const metrics: MetricTrend[] = [
    { metric: 'orders', direction: 'up', changePct: 20, slopePerPeriod: 1, r2: 0.8, cv: 0.1, assessment: 'good' },
    { metric: 'cost', direction: 'up', changePct: 10, slopePerPeriod: 100, r2: 0.7, cv: 0.05, assessment: 'neutral' },
    { metric: 'cpa', direction: 'down', changePct: -8, slopePerPeriod: -10, r2: 0.6, cv: 0.1, assessment: 'good' },
  ];

  return {
    locale: 'vi',
    campaignName: 'Test Guardrails',
    grain: 'day',
    range: { from: '2026-10-01', to: '2026-10-15' },
    totals: { reach: 50000, clicks: 1000, cost: 20000000, orders: 100, kpis: { ctr: 0.02, cpc: 20000, cpa: 200000, cvr: 0.1 } },
    trend: {
      grain: 'day',
      periods: 14,
      overall: 'up',
      metrics,
      comparison: null,
      dataQuality: { days: 14, missingDays: 0, sufficient: true },
    },
    recent: [],
    nowcasts: [],
    anomalies: [],
  };
}

describe('AI-04 Guardrails (7 bước)', () => {
  it('Bước 1: bóc chuỗi json bọc trong markdown code blocks', () => {
    const req = makeBaseReq();
    const raw = `\`\`\`json
{
  "overall": "up",
  "headline": "Tăng trưởng tốt.",
  "metricComments": [],
  "forecastComment": null,
  "suggestions": [
    {
      "title": "Tăng ngân sách",
      "action": "Tăng ngân sách 15% cho nhóm sản phẩm chủ lực",
      "rationale": "CPA đang giảm và số đơn tăng tốt",
      "expectedImpact": "Tăng 20% lượng đơn",
      "priority": "high",
      "relatedMetrics": ["orders", "cpa"]
    },
    {
      "title": "Tối ưu mẫu ảnh",
      "action": "Thử nghiệm 3 mẫu ảnh mới với màu sắc nổi bật",
      "rationale": "Cải thiện thêm tỉ lệ click",
      "expectedImpact": "Tăng CTR",
      "priority": "medium",
      "relatedMetrics": ["ctr"]
    },
    {
      "title": "Điều chỉnh giờ",
      "action": "Phân bổ ngân sách vào khung giờ tối từ 19h đến 22h",
      "rationale": "Khung giờ này có lượng mua cao",
      "expectedImpact": "Tối ưu chi phí",
      "priority": "low",
      "relatedMetrics": ["cost"]
    }
  ],
  "riskFlags": []
}
\`\`\``;

    const res = enforceGuardrails(raw, req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.headline).toBe('Tăng trưởng tốt.');
    }
  });

  it('Bước 1: trả lỗi khi chuỗi JSON sai cú pháp', () => {
    const req = makeBaseReq();
    const res = enforceGuardrails('{ "overall": "up", ', req);
    expect(res.ok).toBe(false);
  });

  it('Bước 3 & 4: đối chiếu và ghi đè overall, direction, changePct khi model bịa số', () => {
    const req = makeBaseReq();
    const rawObj = {
      overall: 'down', // Sai, req.trend.overall là 'up'
      headline: 'Hiệu quả giảm sút.',
      metricComments: [
        {
          metric: 'orders',
          direction: 'down', // Sai, req.trend là 'up'
          changePct: 99.9, // Sai, req.trend là 20%
          comment: 'Đơn hàng giảm mạnh.',
        },
      ],
      forecastComment: null,
      suggestions: [
        { title: 'S1', action: 'Hành động 1 dài hơn hai mươi lăm ký tự', rationale: 'R1', expectedImpact: 'E1', priority: 'high', relatedMetrics: ['orders'] },
        { title: 'S2', action: 'Hành động 2 dài hơn hai mươi lăm ký tự', rationale: 'R2', expectedImpact: 'E2', priority: 'medium', relatedMetrics: ['cpa'] },
        { title: 'S3', action: 'Hành động 3 dài hơn hai mươi lăm ký tự', rationale: 'R3', expectedImpact: 'E3', priority: 'low', relatedMetrics: ['cost'] },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawObj, req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.corrected).toBe(true);
      expect(res.value.overall).toBe('up'); // Đã bị ghi đè thành 'up'
      expect(res.value.metricComments[0]?.direction).toBe('up'); // Đã bị ghi đè
      expect(res.value.metricComments[0]?.changePct).toBe(20); // Đã bị ghi đè thành 20%
    }
  });

  it('Bước 5: thêm cảnh báo khi phát hiện % lạ không có trong dữ liệu', () => {
    const req = makeBaseReq();
    const rawObj = {
      overall: 'up',
      headline: 'Tỉ lệ khách quay lại tăng 88.5%!', // 88.5% không có trong req
      metricComments: [],
      forecastComment: null,
      suggestions: [
        { title: 'S1', action: 'Hành động 1 dài hơn hai mươi lăm ký tự', rationale: 'R1', expectedImpact: 'E1', priority: 'high', relatedMetrics: ['orders'] },
        { title: 'S2', action: 'Hành động 2 dài hơn hai mươi lăm ký tự', rationale: 'R2', expectedImpact: 'E2', priority: 'medium', relatedMetrics: ['cpa'] },
        { title: 'S3', action: 'Hành động 3 dài hơn hai mươi lăm ký tự', rationale: 'R3', expectedImpact: 'E3', priority: 'low', relatedMetrics: ['cost'] },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawObj, req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.warnings.some((w) => w.includes('88.5%'))).toBe(true);
    }
  });

  it('Bước 6: thay thế gợi ý chứa cụm từ cấm chung chung', () => {
    const req = makeBaseReq();
    const rawObj = {
      overall: 'up',
      headline: 'Hiệu quả tốt.',
      metricComments: [],
      forecastComment: null,
      suggestions: [
        {
          title: 'Tối ưu chiến dịch',
          action: 'Cần tối ưu chiến dịch ngay', // Cụm cấm & ngắn < 40 chars & không có số
          rationale: 'Chiến dịch chưa tốt',
          expectedImpact: 'Tăng hiệu quả',
          priority: 'high',
          relatedMetrics: ['orders'],
        },
        { title: 'S2', action: 'Hành động 2 dài hơn hai mươi lăm ký tự', rationale: 'R2', expectedImpact: 'E2', priority: 'medium', relatedMetrics: ['cpa'] },
        { title: 'S3', action: 'Hành động 3 dài hơn hai mươi lăm ký tự', rationale: 'R3', expectedImpact: 'E3', priority: 'low', relatedMetrics: ['cost'] },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawObj, req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.corrected).toBe(true);
      // Gợi ý đầu tiên phải bị thay thế bởi gợi ý fallback cụ thể
      expect(res.value.suggestions[0]?.title).not.toBe('Tối ưu chiến dịch');
      expect(res.value.suggestions).toHaveLength(3);
    }
  });

  it('Bước 7: làm sạch thẻ HTML và cắt giới hạn độ dài', () => {
    const req = makeBaseReq();
    const rawObj = {
      overall: 'up',
      headline: '<script>alert("hack")</script><b>Chiến dịch tăng trưởng</b>',
      metricComments: [],
      forecastComment: null,
      suggestions: [
        { title: 'S1', action: 'Hành động 1 dài hơn hai mươi lăm ký tự', rationale: 'R1', expectedImpact: 'E1', priority: 'high', relatedMetrics: ['orders'] },
        { title: 'S2', action: 'Hành động 2 dài hơn hai mươi lăm ký tự', rationale: 'R2', expectedImpact: 'E2', priority: 'medium', relatedMetrics: ['cpa'] },
        { title: 'S3', action: 'Hành động 3 dài hơn hai mươi lăm ký tự', rationale: 'R3', expectedImpact: 'E3', priority: 'low', relatedMetrics: ['cost'] },
      ],
      riskFlags: [],
    };

    const res = enforceGuardrails(rawObj, req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.headline).not.toContain('<script>');
      expect(res.value.headline).not.toContain('<b>');
      expect(res.value.headline).toContain('Chiến dịch tăng trưởng');
    }
  });
});
