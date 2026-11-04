'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';

import { METRIC_META } from '@/config/metricMeta';
import { fmtInt, fmtPct, fmtVnd } from '@/lib/domain/format';
import type { Anomaly } from '@/types/domain';

export function AnomalyFeed({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <div className="bento-card card-pad">
      <div className="section-label">
        <CircleCheck />
        <h2>Theo dõi bất thường</h2>
      </div>
      {!anomalies.length ? (
        <>
          <p className="font-medium text-xs">Chưa có cảnh báo được ghi nhận</p>
          <p className="card-description">
            Các biến động đáng chú ý sẽ được hiển thị tại đây khi có kết quả phân tích.
          </p>
        </>
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {anomalies
            .slice(-10)
            .reverse()
            .map((a, i) => {
              const meta = METRIC_META[a.metric];
              const format = meta.unit === 'vnd' ? fmtVnd : meta.unit === 'ratio' ? fmtPct : fmtInt;
              return (
                <li key={`${a.date}-${a.metric}-${i}`} className="flex gap-2 text-xs leading-6">
                  <TriangleAlert
                    className="mt-1 shrink-0"
                    size={15}
                    style={{ color: a.severity === 'critical' ? 'var(--red)' : '#bc851c' }}
                  />
                  <div>
                    <strong className="font-medium">
                      {meta.short} {a.direction === 'spike' ? '▲ tăng' : '▼ giảm'} bất thường
                    </strong>
                    <p className="muted">
                      {a.date} · {format(a.value)} / kỳ vọng {format(a.expected)}
                    </p>
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
