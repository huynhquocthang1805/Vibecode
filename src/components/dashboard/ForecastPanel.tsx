'use client';

// Owner: frontend-dashboard (Trường) — FD-04. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { MetricForecast, Nowcast } from '@/types/domain';

export function ForecastPanel(_props: { nowcasts: Nowcast[]; forecasts: MetricForecast[] }) {
  return <Placeholder title="Dự kiến cuối tháng / cuối quý" taskId="FD-04" />;
}
