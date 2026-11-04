'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { METRIC_META } from '@/config/metricMeta';
import { fmtInt, fmtPct, fmtVnd } from '@/lib/domain/format';
import type { Anomaly } from '@/types/domain';
import { bus } from '@/lib/data/realtime/bus';
import { addDays } from '@/lib/domain/dates';
import { useDataStore } from '@/lib/data/store';

import { ReviewContext } from './ReviewContext';

export function AnomalyFeed({ anomalies }: { anomalies: Anomaly[] }) {
  const preview = useContext(ReviewContext);
  const [events, setEvents] = useState<{ campaignId: string; anomaly: Anomaly }[]>([]);
  const active = useDataStore((s) => s.settings.activeCampaignId);
  useEffect(() => {
    let lastToast = 0;
    return bus.on('anomaly/detected', ({ anomaly }) => {
      if (preview) return;
      setEvents((previous) => [...previous, { campaignId: active, anomaly }].slice(-10));
      if (Date.now() - lastToast >= 10_000) {
        lastToast = Date.now();
        const message = `${METRIC_META[anomaly.metric].short} ${anomaly.direction === 'spike' ? '▲ tăng' : '▼ giảm'} bất thường`;
        if (anomaly.severity === 'critical') toast.error(message);
        else toast.warning(message);
      }
    });
  }, [preview, active]);
  const displayed =
    preview?.anomalies ??
    [...anomalies, ...events.filter((e) => e.campaignId === active).map((e) => e.anomaly)].filter(
      (a, index, list) =>
        list.findIndex((b) => b.date === a.date && b.metric === a.metric && b.value === a.value) === index,
    );
  return (
    <div className="bento-card card-pad">
      <div className="section-label">
        <CircleCheck />
        <h2>Theo dõi bất thường</h2>
      </div>
      {!displayed.length ? (
        <>
          <p className="font-medium text-xs">Chưa có cảnh báo được ghi nhận</p>
          <p className="card-description">
            Các biến động đáng chú ý sẽ được hiển thị tại đây khi có kết quả phân tích.
          </p>
        </>
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {displayed
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
                  <button
                    className="text-left min-h-11"
                    disabled={!!preview}
                    onClick={() => {
                      useDataStore
                        .getState()
                        .setSettings({ grain: 'day', range: { from: addDays(a.date, -7), to: a.date } });
                      window.dispatchEvent(new CustomEvent('kpi:zoom-date', { detail: a.date }));
                      document.querySelector('[aria-label="Biểu đồ"]')?.scrollIntoView({
                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
                      });
                    }}
                  >
                    <strong className="font-medium">
                      {meta.short} {a.direction === 'spike' ? '▲ tăng' : '▼ giảm'} bất thường
                    </strong>
                    <p className="muted">
                      {a.date} · {format(a.value)} / kỳ vọng {format(a.expected)}
                    </p>
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
