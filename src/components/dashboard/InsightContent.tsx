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
        {data.corrected && 'Đã tự động hiệu chỉnh số liệu cho khớp dữ liệu. '}
        {data.warnings.join(' ')}
        <br />
        Nhận xét do AI tạo — hãy kiểm tra trước khi gửi.
      </footer>
    </>
  );
}
