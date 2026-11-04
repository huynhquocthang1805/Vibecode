'use client';

import { MoveUpRight, TrendingUp } from 'lucide-react';

import { fmtInt, fmtPct, fmtVnd, fmtVndShort } from '@/lib/domain/format';
import { safeDiv } from '@/lib/domain/kpi';
import type { MetricForecast, Nowcast } from '@/types/domain';

const MODELS = {
  naive: 'Naive',
  seasonal_naive: 'Seasonal Naive',
  moving_avg: 'Trung bình động',
  holt: 'Holt',
  holt_winters: 'Holt-Winters',
};

export function ForecastPanel({ nowcasts, forecasts }: { nowcasts: Nowcast[]; forecasts: MetricForecast[] }) {
  return (
    <div className="bento-card card-pad">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Nhìn về phía trước</p>
          <h2 className="card-title">Dự báo tăng trưởng</h2>
        </div>
        <TrendingUp size={18} style={{ color: 'var(--blue)' }} />
      </div>
      {!nowcasts.length ? (
        <>
          <div className="forecast-visual" aria-hidden="true">
            {[26, 42, 35, 57, 51, 64, 73, 88].map((height, i) => (
              <span style={{ height }} key={i} />
            ))}
          </div>
          <p className="font-medium text-xs">Bức tranh tiếp theo của chiến dịch.</p>
          <p className="card-description">Chưa có kết quả dự báo. Số liệu thực tế vẫn được lưu bình thường.</p>
          <div className="timeline-note mt-5">
            <span className="empty-icon size-8 rounded-lg">
              <MoveUpRight size={16} />
            </span>
            <span className="muted">Dự kiến cuối tháng & cuối quý</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-5">
          {nowcasts.map((nowcast) => (
            <article key={nowcast.periodKey}>
              <p className="card-description">
                Dự kiến cuối {nowcast.grain === 'month' ? 'tháng' : 'quý'} · {nowcast.periodKey}
              </p>
              <p className="metric-value">
                {fmtInt(nowcast.projected.orders.mean)} <span className="metric-unit">đơn</span>
              </p>
              <p className="card-description">
                Khoảng 80%: {fmtInt(nowcast.projected.orders.lo80)}–{fmtInt(nowcast.projected.orders.hi80)} đơn
              </p>
              <div className="flex justify-between text-xs mt-4">
                <span className="muted">Chi phí dự kiến</span>
                <strong className="font-medium">
                  {fmtVndShort(nowcast.projected.cost.mean)}
                  {Math.abs(nowcast.projected.cost.mean) >= 1_000 ? ' ₫' : ''}
                </strong>
              </div>
              <div className="flex justify-between text-xs mt-3">
                <span className="muted">CPA dự kiến</span>
                <strong className="font-medium">{fmtVnd(nowcast.projectedKpis.cpa)}</strong>
              </div>
              <progress
                className="mt-4 h-1 w-full accent-blue-600"
                value={nowcast.daysElapsed}
                max={nowcast.daysTotal}
                aria-label={`Đã qua ${nowcast.daysElapsed}/${nowcast.daysTotal} ngày`}
              />
              <p className="card-description">
                {nowcast.daysElapsed}/{nowcast.daysTotal} ngày đã qua
              </p>
            </article>
          ))}
          {forecasts.slice(0, 1).map((f) => (
            <p className="card-description border-t pt-3" key={f.metric}>
              {MODELS[f.model]} · Tin cậy{' '}
              {f.confidence === 'high' ? 'cao' : f.confidence === 'medium' ? 'trung bình' : 'thấp'}
              <br />
              sMAPE {fmtPct(f.backtest.smape === null ? null : safeDiv(f.backtest.smape, 100))}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
