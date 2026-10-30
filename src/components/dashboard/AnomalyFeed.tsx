'use client';

// Owner: frontend-dashboard (Trường) — FD-07. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { Anomaly } from '@/types/domain';

export function AnomalyFeed(_props: { anomalies: Anomaly[] }) {
  return <Placeholder title="Cảnh báo bất thường" taskId="FD-07" />;
}
