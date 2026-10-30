'use client';

// Owner: frontend-dashboard (Trường) — FD-03. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { AnalyticsSnapshot } from '@/types/domain';

export function TrendChart(_props: { snapshot: AnalyticsSnapshot | null; showForecast?: boolean }) {
  return <Placeholder title="Biểu đồ Reach · Chi phí · Đơn hàng (ECharts)" taskId="FD-03" />;
}
