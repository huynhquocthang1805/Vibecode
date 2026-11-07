'use client';

import { ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { METRIC_META } from '@/config/metricMeta';
import { fmtInt, fmtPct, fmtVnd } from '@/lib/domain/format';
import type { Anomaly } from '@/types/domain';
import { bus } from '@/lib/data/realtime/bus';
import { addDays } from '@/lib/domain/dates';
import { safeDiv } from '@/lib/domain/kpi';
import { useDataStore } from '@/lib/data/store';

import { ReviewContext } from './ReviewContext';

/** Số cảnh báo hiện sẵn; phần còn lại ở nút "Xem thêm" (UI audit 2026-11-06: 10 dòng làm cột phải quá dài) */
const COLLAPSED = 4;
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Lệch so với kỳ vọng, dạng "+65%" — dễ hiểu hơn hai con số tuyệt đối */
function deviation(a: Anomaly): string | null {
  const ratio = safeDiv(a.value - a.expected, Math.abs(a.expected));
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const pct = Math.round(ratio * 100);
  return `${pct > 0 ? '+' : ''}${fmtInt(pct)}%`;
}

export function AnomalyFeed({ anomalies }: { anomalies: Anomaly[] }) {
  const preview = useContext(ReviewContext);
  const [expanded, setExpanded] = useState(false);
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
        <>
          <p className="card-description mb-3">
            {displayed.length > 10
              ? `10 cảnh báo gần nhất (trong ${displayed.length})`
              : `${displayed.length} cảnh báo gần đây`}{' '}
            · bấm để xem trên biểu đồ
          </p>
          <ul className="anomaly-list" aria-live="polite">
            {displayed
              .slice(-10)
              .reverse()
              .slice(0, expanded ? 10 : COLLAPSED)
              .map((a, i) => {
                const meta = METRIC_META[a.metric];
                const format = meta.unit === 'vnd' ? fmtVnd : meta.unit === 'ratio' ? fmtPct : fmtInt;
                const change = deviation(a);
                return (
                  <li key={`${a.date}-${a.metric}-${i}`} className={`anomaly-item ${a.severity}`}>
                    <TriangleAlert className="mt-0.5 shrink-0" size={15} aria-hidden />
                    <button
                      className="min-h-11 flex-1 text-left"
                      disabled={!!preview}
                      onClick={() => {
                        useDataStore
                          .getState()
                          .setSettings({ grain: 'day', range: { from: addDays(a.date, -7), to: a.date } });
                        window.dispatchEvent(new CustomEvent('kpi:zoom-date', { detail: a.date }));
                        document.querySelector('[aria-label="Biểu đồ"]')?.scrollIntoView({
                          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                            ? 'instant'
                            : 'smooth',
                        });
                      }}
                    >
                      <span className="anomaly-head">
                        <strong className="font-medium">
                          {meta.short} {a.direction === 'spike' ? '▲ tăng' : '▼ giảm'} bất thường
                        </strong>
                        {change && <span className="anomaly-chip">{change}</span>}
                      </span>
                      <span className="muted block">
                        {dayMonth(a.date)} · {format(a.value)}{' '}
                        <span className="whitespace-nowrap">(thường khoảng {format(a.expected)})</span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
          {Math.min(displayed.length, 10) > COLLAPSED && (
            <button className="anomaly-more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              {expanded ? 'Thu gọn' : `Xem thêm ${Math.min(displayed.length, 10) - COLLAPSED} cảnh báo`}
              <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}
