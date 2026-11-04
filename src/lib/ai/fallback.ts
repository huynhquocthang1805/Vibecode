import { METRIC_META } from '@/config/metricMeta';
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

  // 4. Tìm kiếm các luật gợi ý cụ thể dựa trên xu hướng
  const candidates: InsightSuggestion[] = [];

  const getMetricTrend = (m: Metric) => req.trend.metrics.find((item) => item.metric === m);
  const cpaTrend = getMetricTrend('cpa');
  const cvrTrend = getMetricTrend('cvr');
  const ctrTrend = getMetricTrend('ctr');
  const cpcTrend = getMetricTrend('cpc');
  const reachTrend = getMetricTrend('reach');
  const ordersTrend = getMetricTrend('orders');
  const costTrend = getMetricTrend('cost');

  // Luật 1: CPA tăng và CVR giảm
  if ((cpaTrend?.direction === 'up' || (cpaTrend?.changePct ?? 0) > 10) && cvrTrend?.direction === 'down') {
    candidates.push({
      title: 'Tối ưu trang đích và trải nghiệm mua hàng',
      action: 'Kiểm tra tốc độ tải trang đích, rà soát luồng thanh toán và thử nghiệm A/B nút mua hàng.',
      rationale: 'Chi phí trên mỗi đơn hàng CPA tăng trong khi tỉ lệ chuyển đổi CVR sụt giảm.',
      expectedImpact: 'Giúp hạ CPA từ 10% đến 20% và tăng tỉ lệ chốt đơn.',
      priority: 'high',
      relatedMetrics: ['cpa', 'cvr', 'orders'],
    });
  }

  // Luật 2: Orders tăng và CPA giảm (cơ hội mở rộng)
  if (ordersTrend?.direction === 'up' && (cpaTrend?.direction === 'down' || (cpaTrend?.changePct ?? 0) <= 0)) {
    candidates.push({
      title: 'Tăng ngân sách cho nhóm hiệu quả cao',
      action: 'Gia tăng ngân sách 15% đến 20% cho các nhóm quảng cáo đang đem lại đơn hàng tốt nhất.',
      rationale: 'Chiến dịch đang hoạt động tối ưu với số lượng đơn tăng đều và CPA giảm.',
      expectedImpact: 'Gia tăng tối đa sản lượng đơn hàng mà vẫn kiểm soát tốt chi phí.',
      priority: 'high',
      relatedMetrics: ['orders', 'cpa', 'cost'],
    });
  }

  // Luật 3: CTR giảm mạnh (Creative fatigue)
  if (ctrTrend?.direction === 'down' || (ctrTrend?.changePct ?? 0) < -8) {
    candidates.push({
      title: 'Làm mới nội dung và mẫu quảng cáo',
      action: 'Thay thế 2 đến 3 mẫu hình ảnh và tiêu đề mới để tránh tình trạng nhàm chán quảng cáo.',
      rationale: 'Tỉ lệ click CTR đang suy giảm cho thấy đối tượng tiếp cận đã bão hòa với hình ảnh cũ.',
      expectedImpact: 'Cải thiện tỉ lệ click CTR thêm 0.3% đến 0.6%.',
      priority: 'high',
      relatedMetrics: ['ctr', 'clicks'],
    });
  }

  // Luật 4: CPC tăng và Reach giảm
  if (cpcTrend?.direction === 'up' && reachTrend?.direction === 'down') {
    candidates.push({
      title: 'Mở rộng quy mô tệp khách hàng mục tiêu',
      action: 'Mở rộng độ tuổi hoặc khu vực địa lý, giảm bớt điều kiện nhắm chọn hẹp để tránh cạnh tranh thầu.',
      rationale: 'CPC tăng cao trong khi độ phủ reach giảm chứng tỏ tệp mục tiêu đang bị giới hạn.',
      expectedImpact: 'Hạ nhiệt giá thầu click và tiếp cận thêm lượng khách hàng mới.',
      priority: 'medium',
      relatedMetrics: ['cpc', 'reach'],
    });
  }

  // Luật 5: Chi phí tăng nhưng đơn hàng giảm hoặc đi ngang
  if (costTrend?.direction === 'up' && (ordersTrend?.direction === 'down' || ordersTrend?.direction === 'flat')) {
    candidates.push({
      title: 'Tạm dừng các nhóm quảng cáo kém hiệu quả',
      action: 'Rà soát và tắt ngay các quảng cáo đã tiêu hơn 2 lần CPA mục tiêu mà không sinh ra chuyển đổi.',
      rationale: 'Tổng chi phí gia tăng nhưng số lượng đơn hàng không tăng tương ứng.',
      expectedImpact: 'Cắt giảm từ 10% đến 15% ngân sách lãng phí ngay trong 3 ngày tới.',
      priority: 'high',
      relatedMetrics: ['cost', 'orders', 'cpa'],
    });
  }

  // Danh sách gợi ý mặc định (đảm bảo luôn đủ 3 gợi ý phân cấp high/medium/low)
  const defaultSuggestions: InsightSuggestion[] = [
    {
      title: 'Phân bổ lại ngân sách theo giờ cao điểm',
      action: 'Thiết lập lịch phân phối quảng cáo tập trung vào các khung giờ có lượng tương tác cao nhất.',
      rationale: 'Tối ưu hóa chi phí vào các khoảng thời gian người dùng sẵn sàng ra quyết định mua hàng.',
      expectedImpact: 'Tăng 10% hiệu suất chuyển đổi trên cùng mức chi phí.',
      priority: 'medium',
      relatedMetrics: ['cost', 'clicks', 'orders'],
    },
    {
      title: 'Thử nghiệm lời kêu gọi hành động mới',
      action: 'Cập nhật tiêu đề và thay đổi nút CTA trên bài viết quảng cáo sang thông điệp khẩn cấp.',
      rationale: 'Tăng tính kích thích hành vi nhấn chuột của người dùng khi nhìn thấy quảng cáo.',
      expectedImpact: 'Gia tăng tương tác và cải thiện tỉ lệ click CTR.',
      priority: 'low',
      relatedMetrics: ['ctr', 'clicks'],
    },
    {
      title: 'Thiết lập quy tắc cảnh báo chi phí tự động',
      action: 'Cài đặt cảnh báo khi chi phí trong ngày vượt ngưỡng trung bình 20% mà không có đơn.',
      rationale: 'Bảo vệ ngân sách trước các biến động bất thường của thuật toán đấu thầu.',
      expectedImpact: 'Ngăn chặn rủi ro thâm hụt ngân sách chiến dịch.',
      priority: 'low',
      relatedMetrics: ['cost', 'cpa'],
    },
  ];

  for (const ds of defaultSuggestions) {
    if (candidates.length >= 3) break;
    if (!candidates.some((c) => c.title === ds.title)) {
      candidates.push(ds);
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
