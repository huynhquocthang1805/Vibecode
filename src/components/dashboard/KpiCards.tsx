'use client';

// Owner: frontend-dashboard (Trường) — FD-02. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { AnalyticsSnapshot } from '@/types/domain';

export function KpiCards(_props: { snapshot: AnalyticsSnapshot | null }) {
  return <Placeholder title="Thẻ KPI: Reach · Click · Chi phí · Đơn · CTR · CPC · CPA" taskId="FD-02" />;
}
