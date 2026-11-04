// Owner: ba-analyst — BA-02 (techlead điền thay Nhân 2026-11-04). docs/05 §7.
// Thư viện gợi ý cho fallbackInsight (ai-engineer): luật = điều kiện trên TrendSummary + nội dung gợi ý.
// fallback lấy theo thứ tự: các luật khớp (theo thứ tự mảng) → bù DEFAULT_SUGGESTIONS → sắp high→medium→low → 3 cái đầu.
// Điều kiện 5 luật đầu giữ nguyên như AI-05 đã duyệt; luật cuối tuần mới thêm (docs/05 §7 dòng 5).
import { daysBetween } from '@/lib/domain/dates';
import { safeDiv } from '@/lib/domain/kpi';
import type { InsightRequest, InsightSuggestion, Metric, MetricTrend } from '@/types/domain';

export interface RuleContext {
  trend(metric: Metric): MetricTrend | undefined;
  req: InsightRequest;
}

export interface RuleSuggestion {
  id: string;
  /** Pure, deterministic — chỉ đọc ctx */
  when(ctx: RuleContext): boolean;
  suggestion: InsightSuggestion;
}

/** Luật cuối tuần: CPA T7–CN thấp hơn ngày thường ít nhất 20%, cần ≥ 14 ngày dữ liệu ngày */
export const WEEKEND_RULE = { minDays: 14, cpaGap: 0.2 } as const;

/** 0 = Thứ 2 … 5 = Thứ 7, 6 = Chủ nhật. 2024-01-01 là Thứ 2. Không dùng new Date('YYYY-MM-DD') (CLAUDE.md §5). */
function weekdayIndex(isoDate: string): number {
  return ((daysBetween('2024-01-01', isoDate) % 7) + 7) % 7;
}

/** CPA cuối tuần vs ngày thường = tỉ số của tổng (CLAUDE.md §5), null khi không đủ dữ liệu */
export function weekendCpaRatio(req: InsightRequest): number | null {
  if (req.grain !== 'day') return null;
  const days = req.recent.filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.key) && !b.isPartial);
  if (days.length < WEEKEND_RULE.minDays) return null;
  let weCost = 0;
  let weOrders = 0;
  let wdCost = 0;
  let wdOrders = 0;
  for (const b of days) {
    if (weekdayIndex(b.key) >= 5) {
      weCost += b.cost;
      weOrders += b.orders;
    } else {
      wdCost += b.cost;
      wdOrders += b.orders;
    }
  }
  const weCpa = weOrders > 0 ? safeDiv(weCost, weOrders) : null;
  const wdCpa = wdOrders > 0 ? safeDiv(wdCost, wdOrders) : null;
  if (weCpa === null || wdCpa === null) return null;
  return safeDiv(weCpa, wdCpa);
}

export const RULE_SUGGESTIONS: readonly RuleSuggestion[] = [
  {
    id: 'cpa-up-cvr-down',
    when: ({ trend }) =>
      (trend('cpa')?.direction === 'up' || (trend('cpa')?.changePct ?? 0) > 10) && trend('cvr')?.direction === 'down',
    suggestion: {
      title: 'Tối ưu trang đích và trải nghiệm mua hàng',
      action: 'Kiểm tra tốc độ tải trang đích, rà soát luồng thanh toán và thử nghiệm A/B nút mua hàng.',
      rationale: 'Chi phí trên mỗi đơn hàng CPA tăng trong khi tỉ lệ chuyển đổi CVR sụt giảm.',
      expectedImpact: 'Giúp hạ CPA từ 10% đến 20% và tăng tỉ lệ chốt đơn.',
      priority: 'high',
      relatedMetrics: ['cpa', 'cvr', 'orders'],
    },
  },
  {
    id: 'orders-up-cpa-down',
    when: ({ trend }) =>
      trend('orders')?.direction === 'up' &&
      (trend('cpa')?.direction === 'down' || (trend('cpa')?.changePct ?? 0) <= 0),
    suggestion: {
      title: 'Tăng ngân sách cho nhóm hiệu quả cao',
      action: 'Gia tăng ngân sách 15% đến 20% cho các nhóm quảng cáo đang đem lại đơn hàng tốt nhất.',
      rationale: 'Chiến dịch đang hoạt động tối ưu với số lượng đơn tăng đều và CPA giảm.',
      expectedImpact: 'Gia tăng tối đa sản lượng đơn hàng mà vẫn kiểm soát tốt chi phí.',
      priority: 'high',
      relatedMetrics: ['orders', 'cpa', 'cost'],
    },
  },
  {
    id: 'ctr-down-creative-fatigue',
    when: ({ trend }) => trend('ctr')?.direction === 'down' || (trend('ctr')?.changePct ?? 0) < -8,
    suggestion: {
      title: 'Làm mới nội dung và mẫu quảng cáo',
      action: 'Thay thế 2 đến 3 mẫu hình ảnh và tiêu đề mới để tránh tình trạng nhàm chán quảng cáo.',
      rationale: 'Tỉ lệ click CTR đang suy giảm cho thấy đối tượng tiếp cận đã bão hòa với hình ảnh cũ.',
      expectedImpact: 'Cải thiện tỉ lệ click CTR thêm 0.3% đến 0.6%.',
      priority: 'high',
      relatedMetrics: ['ctr', 'clicks'],
    },
  },
  {
    id: 'cpc-up-reach-down',
    when: ({ trend }) => trend('cpc')?.direction === 'up' && trend('reach')?.direction === 'down',
    suggestion: {
      title: 'Mở rộng quy mô tệp khách hàng mục tiêu',
      action: 'Mở rộng độ tuổi hoặc khu vực địa lý, giảm bớt điều kiện nhắm chọn hẹp để tránh cạnh tranh thầu.',
      rationale: 'CPC tăng cao trong khi độ phủ reach giảm chứng tỏ tệp mục tiêu đang bị giới hạn.',
      expectedImpact: 'Hạ nhiệt giá thầu click và tiếp cận thêm lượng khách hàng mới.',
      priority: 'medium',
      relatedMetrics: ['cpc', 'reach'],
    },
  },
  {
    id: 'cost-up-orders-flat',
    when: ({ trend }) =>
      trend('cost')?.direction === 'up' &&
      (trend('orders')?.direction === 'down' || trend('orders')?.direction === 'flat'),
    suggestion: {
      title: 'Tạm dừng các nhóm quảng cáo kém hiệu quả',
      action: 'Rà soát và tắt ngay các quảng cáo đã tiêu hơn 2 lần CPA mục tiêu mà không sinh ra chuyển đổi.',
      rationale: 'Tổng chi phí gia tăng nhưng số lượng đơn hàng không tăng tương ứng.',
      expectedImpact: 'Cắt giảm từ 10% đến 15% ngân sách lãng phí ngay trong 3 ngày tới.',
      priority: 'high',
      relatedMetrics: ['cost', 'orders', 'cpa'],
    },
  },
  {
    id: 'weekend-cpa-better',
    when: ({ req }) => {
      const ratio = weekendCpaRatio(req);
      return ratio !== null && ratio <= 1 - WEEKEND_RULE.cpaGap;
    },
    suggestion: {
      title: 'Dồn thêm ngân sách vào Thứ 7 – Chủ nhật',
      action: 'Trong 2 tuần tới, chuyển 15% ngân sách ngày thường sang T7–CN và giữ nguyên mẫu quảng cáo để so sánh.',
      rationale: 'CPA những ngày cuối tuần thấp hơn ít nhất 20% so với ngày thường trong dữ liệu gần đây.',
      expectedImpact: 'Thêm đơn với cùng tổng chi phí; theo dõi CPA cuối tuần có còn thấp hơn ngày thường.',
      priority: 'medium',
      relatedMetrics: ['cpa', 'cost', 'orders'],
    },
  },
];

/** Bù cho đủ 3 gợi ý khi ít luật khớp (giữ nguyên nội dung AI-05) */
export const DEFAULT_SUGGESTIONS: readonly InsightSuggestion[] = [
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
