'use client';

import { METRIC_META } from '@/config/metricMeta';
import { fmtDelta } from '@/lib/domain/format';
import type { InsightResponse } from '@/types/domain';

const DIRECTION = { up: '▲', down: '▼', flat: '→', volatile: '↕' };

export default function InsightContent({ data }: { data: InsightResponse }) {
  return (
    <>
      <h3 className="insight-headline">{data.headline}</h3>
      <div className="toolbar mt-4">
        {data.metricComments.map((c) => (
          <span className="badge-soft" key={c.metric} title={c.comment}>
            {DIRECTION[c.direction]} {METRIC_META[c.metric].short} {fmtDelta(c.changePct)}
          </span>
        ))}
      </div>
      {data.forecastComment && <p className="card-description mt-3">{data.forecastComment}</p>}
      <div className="suggestion-grid">
        {data.suggestions.map((s, i) => (
          <article className="suggestion" key={`${i}-${s.title}`}>
            <span className="suggestion-number">0{i + 1}</span>
            <h4>{s.title}</h4>
            <p className="muted">{s.action}</p>
            <details className="mt-2 muted">
              <summary className="cursor-pointer">Vì sao & kỳ vọng</summary>
              <p>{s.rationale}</p>
              <p>{s.expectedImpact}</p>
              <span className="badge-soft mt-2">
                Ưu tiên {s.priority === 'high' ? 'cao' : s.priority === 'medium' ? 'vừa' : 'thấp'}
              </span>
            </details>
          </article>
        ))}
      </div>
      {data.riskFlags.map((flag) => (
        <p className="field-warning" key={flag}>
          {flag}
        </p>
      ))}
      <footer className="insight-footer">
        {data.source === 'ai' ? `AI · ${data.model}` : 'Nhận xét tự động theo quy tắc (dự phòng)'} ·{' '}
        {new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(data.generatedAt)}
        <br />
        {/* Chi tiết kiểm định gói lại — marketer chỉ cần biết số đã được đối chiếu (UI audit 2026-11-06) */}
        {(data.corrected || data.warnings.length > 0) && (
          <details className="insight-checks" data-testid="insight-checks">
            <summary>
              {data.corrected ? 'Đã tự động hiệu chỉnh số liệu cho khớp dữ liệu' : 'Đã kiểm tra đối chiếu số liệu'}
              {data.warnings.length > 0 && ` · xem ${data.warnings.length} chi tiết`}
            </summary>
            {data.warnings.length > 0 && (
              <ul>
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </details>
        )}
        Nhận xét do AI tạo — hãy kiểm tra trước khi gửi.
      </footer>
    </>
  );
}
