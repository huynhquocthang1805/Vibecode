'use client';

// Owner: frontend-dashboard (Trường) — FD-05. Thay khung tạm bằng component thật, giữ tên + props.
import { Placeholder } from '@/components/ui/placeholder';
import type { AnalyticsSnapshot } from '@/types/domain';

export function AiInsightCard(_props: { snapshot: AnalyticsSnapshot | null }) {
  return <Placeholder title="AI nhận xét xu hướng + 3 gợi ý" taskId="FD-05" />;
}
