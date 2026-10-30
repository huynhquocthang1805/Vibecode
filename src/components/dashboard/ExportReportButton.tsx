'use client';

// Owner: frontend-dashboard (Trường) — FD-06. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { AnalyticsSnapshot, InsightResponse } from '@/types/domain';

export function ExportReportButton(_props: { snapshot: AnalyticsSnapshot | null; insight: InsightResponse | null }) {
  return <Placeholder title="Xuất báo cáo text" taskId="FD-06" />;
}
