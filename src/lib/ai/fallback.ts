import { METRIC_META } from '@/config/metricMeta';
import { DEFAULT_SUGGESTIONS, RULE_SUGGESTIONS } from '@/config/ruleSuggestions';
import type {
  InsightRequest,
  InsightResponse,
  InsightSuggestion,
  Metric,
  TrendDirection,
} from '@/types/domain';

const PRIORITY_ORDER: Record<'high' | 'medium' | 'low', number> = {
  high: 1,
  medium: 2,
  low: 3,
};

function formatPercent(pct: number | null): string {
  if (pct === null) return '0%';
  const prefix = pct > 0 ? '+' : '';
  return `${prefix}${pct.toFixed(1).replace('.', ',')}%`;
}

function getDirectionText(dir: TrendDirection): string {
  switch (dir) {
    case 'up':
      return 'tăng';
    case 'down':
      return 'giảm';
    case 'flat':
      return 'đi ngang';
    case 'volatile':
      return 'biến động mạnh';
  }
}

/**
 * Sinh gợi ý và nhận xét tự động (rule-based, deterministic) khi AI không khả dụng hoặc lỗi.
 * Đảm bảo luôn trả về đúng 3 gợi ý và dữ liệu đồng nhất.
 */
export function fallbackInsight(req: InsightRequest): InsightResponse {
  const overall = req.trend.overall;

  // 1. Headline dựa trên overall
  let headline = '';
  switch (overall) {
    case 'up':
      headline = 'Chiến dịch đang có xu hướng tăng trưởng tích cực, các chỉ số cốt lõi giữ vững đà đi lên.';
      break;
    case 'down':
      headline = 'Chiến dịch đang có dấu hiệu suy giảm hiệu quả, cần rà soát lại tệp khách hàng và chi phí.';
      break;
    case 'flat':
      headline = 'Hiệu quả chiến dịch duy trì ổn định, chưa có sự đột phá lớn so với kỳ trước.';
      break;
    case 'volatile':
      headline = 'Chiến dịch đang có sự biến động lớn giữa các ngày, cần kiểm tra nguyên nhân bất thường.';
      break;
  }

  // 2. Metric comments cho từng metric trong req.trend
  const metricComments = req.trend.metrics.slice(0, 8).map((mt) => {
    const meta = METRIC_META[mt.metric] ?? { short: mt.metric, label: mt.metric };
    const dirText = getDirectionText(mt.direction);
    const pctStr = formatPercent(mt.changePct);
    const assessmentText =
      mt.assessment === 'good' ? 'tích cực' : mt.assessment === 'bad' ? 'cần lưu ý' : 'ổn định';

    return {
      metric: mt.metric,
      direction: mt.direction,
      changePct: mt.changePct,
      comment: `${meta.short} có xu hướng ${dirText} (${pctStr} so với kỳ trước), diễn biến ở mức ${assessmentText}.`,
    };
  });

  // 3. Forecast comment (nếu có nowcasts)
  let forecastComment: string | null = null;
  if (req.nowcasts && req.nowcasts.length > 0) {
    const nc = req.nowcasts[0];
    if (nc) {
      const gName = nc.grain === 'month' ? 'tháng' : 'quý';
      const ordersProj = Math.round(nc.projected.orders.mean).toLocaleString('vi-VN');
      const costProj = Math.round(nc.projected.cost.mean).toLocaleString('vi-VN');
      forecastComment = `Dự kiến đến hết ${gName} ${nc.periodKey}, chiến dịch đạt khoảng ${ordersProj} đơn hàng với chi phí ước tính ${costProj} ₫.`;
    }
  }

  // 4. Gợi ý theo luật — nội dung + điều kiện do BA soạn ở config/ruleSuggestions.ts (docs/05 §7)
  const getMetricTrend = (m: Metric) => req.trend.metrics.find((item) => item.metric === m);
  const cpaTrend = getMetricTrend('cpa');
  const reachTrend = getMetricTrend('reach');
  const ctx = { trend: getMetricTrend, req };

  // Sao chép để caller (guardrails) sửa thoải mái mà không đụng thư viện dùng chung
  const copy = (s: InsightSuggestion): InsightSuggestion => ({ ...s, relatedMetrics: [...s.relatedMetrics] });
  const candidates: InsightSuggestion[] = RULE_SUGGESTIONS.filter((r) => r.when(ctx)).map((r) => copy(r.suggestion));

  // Bù gợi ý mặc định cho đủ 3 (high/medium/low)
  for (const ds of DEFAULT_SUGGESTIONS) {
    if (candidates.length >= 3) break;
    if (!candidates.some((c) => c.title === ds.title)) {
      candidates.push(copy(ds));
    }
  }

  // Sắp xếp theo priority giảm dần (high -> medium -> low)
  candidates.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const top3 = candidates.slice(0, 3) as [InsightSuggestion, InsightSuggestion, InsightSuggestion];

  // 5. Risk flags
  const riskFlags: string[] = [];
  if (cpaTrend?.direction === 'up') {
    riskFlags.push('Chi phí trên mỗi đơn hàng (CPA) đang có xu hướng tăng cao.');
  }
  if (reachTrend?.direction === 'down') {
    riskFlags.push('Lượt tiếp cận suy giảm, có nguy cơ bão hòa đối tượng.');
  }
  if (req.anomalies && req.anomalies.length > 0) {
    riskFlags.push(`Phát hiện ${req.anomalies.length} điểm bất thường trong chuỗi dữ liệu.`);
  }

  return {
    source: 'fallback',
    model: 'rule-based@v1',
    generatedAt: Date.now(),
    overall,
    headline,
    metricComments,
    forecastComment,
    suggestions: top3,
    riskFlags: riskFlags.slice(0, 5),
    corrected: false,
    warnings: [],
  };
}
