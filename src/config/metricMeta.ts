// Owner: ba-analyst (Nhân) — BA-02/BA-07 rà lại nhãn & tooltip. Chiều tốt/xấu theo docs/03 §3.
import type { Metric, MetricMeta } from '@/types/domain';

export const METRIC_META: Record<Metric, MetricMeta> = {
  reach: { label: 'Lượt tiếp cận', short: 'Reach', unit: 'count', higherIsBetter: true },
  clicks: { label: 'Lượt click', short: 'Click', unit: 'count', higherIsBetter: true },
  cost: { label: 'Chi phí', short: 'Chi phí', unit: 'vnd', higherIsBetter: null },
  orders: { label: 'Đơn hàng', short: 'Đơn', unit: 'count', higherIsBetter: true },
  ctr: { label: 'Tỉ lệ click', short: 'CTR', unit: 'ratio', higherIsBetter: true, formula: 'Click ÷ Reach' },
  cpc: { label: 'Chi phí / click', short: 'CPC', unit: 'vnd', higherIsBetter: false, formula: 'Chi phí ÷ Click' },
  cpa: { label: 'Chi phí / đơn hàng', short: 'CPA', unit: 'vnd', higherIsBetter: false, formula: 'Chi phí ÷ Số đơn' },
  cvr: { label: 'Tỉ lệ chuyển đổi', short: 'CVR', unit: 'ratio', higherIsBetter: true, formula: 'Đơn ÷ Click' },
};
