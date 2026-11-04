import { describe, expect, it } from 'vitest';

import { BANNED_PHRASES } from '@/config/bannedPhrases';
import { GLOSSARY } from '@/config/glossary';
import { fallbackInsight } from '@/lib/ai/fallback';
import { enforceGuardrails } from '@/lib/ai/guardrails';
import { insightSuggestionSchema } from '@/lib/ai/schemas';
import { addDays } from '@/lib/domain/dates';
import type { InsightRequest, Metric, MetricTrend } from '@/types/domain';

type Bucket = InsightRequest['recent'][number];

import { DEFAULT_SUGGESTIONS, RULE_SUGGESTIONS, weekendCpaRatio } from './ruleSuggestions';

const METRICS: Metric[] = ['reach', 'clicks', 'cost', 'orders', 'ctr', 'cpc', 'cpa', 'cvr'];
const ALL = [...RULE_SUGGESTIONS.map((r) => r.suggestion), ...DEFAULT_SUGGESTIONS];
const plain = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

/** 2024-01-01 là Thứ 2 → ngày thứ i: i%7 ∈ {5,6} là T7/CN */
function days(n: number, weekendCpa: number, weekdayCpa: number, start = '2024-01-01'): Bucket[] {
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(start, i);
    const weekend = i % 7 >= 5;
    const orders = 10;
    const cost = (weekend ? weekendCpa : weekdayCpa) * orders;
    return {
      key,
      isPartial: false,
      reach: 10000,
      clicks: 200,
      cost,
      orders,
      kpis: { ctr: 0.02, cpc: cost / 200, cpa: cost / orders, cvr: 0.05 },
    };
  });
}

function flatRequest(recent: Bucket[], grain: InsightRequest['grain'] = 'day'): InsightRequest {
  const metrics: MetricTrend[] = METRICS.map((metric) => ({
    metric,
    direction: 'flat',
    changePct: 0,
    slopePerPeriod: 0,
    r2: 0,
    cv: 0.1,
    assessment: 'neutral',
  }));
  return {
    locale: 'vi',
    campaignName: 'Demo',
    grain,
    range: { from: recent[0]?.key ?? '2024-01-01', to: recent.at(-1)?.key ?? '2024-01-01' },
    totals: { reach: 1, clicks: 1, cost: 1, orders: 1, kpis: { ctr: 1, cpc: 1, cpa: 1, cvr: 1 } },
    trend: {
      grain,
      periods: 14,
      overall: 'flat',
      metrics,
      comparison: null,
      dataQuality: { days: recent.length, missingDays: 0, sufficient: true },
    },
    recent,
    nowcasts: [],
    anomalies: [],
  };
}

describe('BA-02 · thư viện gợi ý (ruleSuggestions)', () => {
  it('mọi gợi ý qua schema docs/05 §5, action ≥ 25 ký tự, có chỉ số liên quan', () => {
    for (const s of ALL) {
      expect(insightSuggestionSchema.safeParse(s).success, s.title).toBe(true);
      expect(s.action.length, s.title).toBeGreaterThanOrEqual(25);
      expect(s.relatedMetrics.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('id luật không trùng; mặc định có đủ 3 gợi ý để bù', () => {
    const ids = RULE_SUGGESTIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_SUGGESTIONS).toHaveLength(3);
  });

  it('tiêu đề + hành động không tự dính cụm chung chung mà guardrail cấm', () => {
    for (const s of ALL) {
      const text = plain(`${s.title} ${s.action}`);
      for (const p of BANNED_PHRASES) expect(text, `${s.title} ⟂ ${p}`).not.toContain(plain(p));
    }
  });
});

describe('BA-02 · luật cuối tuần (weekendCpaRatio)', () => {
  it('CPA T7–CN 100.000 ₫ vs ngày thường 200.000 ₫ → tỉ lệ 0,5 (tỉ số của tổng)', () => {
    expect(weekendCpaRatio(flatRequest(days(14, 100_000, 200_000)))).toBeCloseTo(0.5, 6);
  });

  it('ít hơn 14 ngày, grain ≠ ngày, hoặc cuối tuần không có đơn → null', () => {
    expect(weekendCpaRatio(flatRequest(days(13, 100_000, 200_000)))).toBeNull();
    expect(weekendCpaRatio(flatRequest(days(14, 100_000, 200_000), 'week'))).toBeNull();
    const noWeekendOrders = days(14, 100_000, 200_000).map((b, i) => (i % 7 >= 5 ? { ...b, orders: 0 } : b));
    expect(weekendCpaRatio(flatRequest(noWeekendOrders))).toBeNull();
  });

  it('kỳ partial (hôm nay chưa hết ngày) không tính vào', () => {
    const d = days(14, 100_000, 200_000);
    d[13] = { ...d[13]!, isPartial: true };
    expect(weekendCpaRatio(flatRequest(d))).toBeNull(); // còn 13 ngày đủ
  });

  it('fallback: cuối tuần rẻ hơn ≥ 20% → có gợi ý dồn ngân sách T7–CN; chênh 10% → không', () => {
    const titles = (r: InsightRequest) => fallbackInsight(r).suggestions.map((s) => s.title);
    expect(titles(flatRequest(days(14, 150_000, 200_000)))).toContain('Dồn thêm ngân sách vào Thứ 7 – Chủ nhật');
    expect(titles(flatRequest(days(14, 180_000, 200_000)))).not.toContain('Dồn thêm ngân sách vào Thứ 7 – Chủ nhật');
  });

  it('fallback trả bản sao — sửa kết quả không làm hỏng thư viện dùng chung', () => {
    const res = fallbackInsight(flatRequest(days(14, 150_000, 200_000)));
    res.suggestions[0]!.title = 'đã sửa';
    res.suggestions[0]!.relatedMetrics.push('reach');
    expect(ALL.some((s) => s.title === 'đã sửa')).toBe(false);
    expect(fallbackInsight(flatRequest(days(14, 150_000, 200_000))).suggestions[0]!.title).not.toBe('đã sửa');
  });
});

describe('BA-02 · cụm cấm (bannedPhrases) được guardrail dùng', () => {
  it('gợi ý AI "Tăng tương tác cho fanpage" (cụm mới, không có số) bị thay bằng gợi ý dự phòng', () => {
    const req = flatRequest(days(14, 200_000, 200_000));
    const good = (title: string, priority: 'high' | 'medium' | 'low') => ({
      title,
      action: 'Trong 3 ngày thay 2 mẫu quảng cáo có CTR thấp nhất bằng mẫu mới và so sánh CTR.',
      rationale: 'CTR đang đi ngang ở 2%.',
      expectedImpact: 'CTR tăng thêm 0,2 điểm.',
      priority,
      relatedMetrics: ['ctr'],
    });
    const raw = {
      overall: 'flat',
      headline: 'Chiến dịch đi ngang',
      metricComments: [],
      forecastComment: null,
      suggestions: [
        { ...good('Tăng tương tác', 'high'), action: 'Tăng tương tác cho fanpage bằng nhiều bài viết hơn nữa' },
        good('Thay mẫu quảng cáo', 'medium'),
        good('Thử tiêu đề mới', 'low'),
      ],
      riskFlags: [],
    };
    const res = enforceGuardrails(JSON.stringify(raw), req);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.suggestions.map((s) => s.title)).not.toContain('Tăng tương tác');
      expect(res.value.warnings.join(' ')).toMatch(/thay thế/);
    }
  });

  it('không có từ đơn quá rộng (bắt nhầm gợi ý tốt) và không trùng sau khi bỏ dấu', () => {
    for (const p of BANNED_PHRASES) expect(p.trim().split(/\s+/).length, p).toBeGreaterThanOrEqual(2);
    expect(new Set(BANNED_PHRASES.map(plain)).size).toBe(BANNED_PHRASES.length);
  });
});

describe('BA-02 · glossary', () => {
  it('đủ 8 chỉ số, chỉ số tỉ lệ có công thức "÷", không rỗng', () => {
    for (const m of METRICS) expect(GLOSSARY[m]?.length, m).toBeGreaterThan(20);
    for (const m of ['ctr', 'cpc', 'cpa', 'cvr']) expect(GLOSSARY[m]).toContain('÷');
  });
});
