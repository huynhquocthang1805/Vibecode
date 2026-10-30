'use client';

// Owner: frontend-dashboard (Trường) — FD-03. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { AnalyticsSnapshot } from '@/types/domain';

export function KpiRatioChart(_props: { snapshot: AnalyticsSnapshot | null }) {
  return <Placeholder title="Biểu đồ CTR · CPC · CPA" taskId="FD-03" />;
}
