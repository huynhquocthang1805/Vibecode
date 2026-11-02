'use client';

import { ArrowUpRight, RefreshCw, Sparkles } from 'lucide-react';
import { useContext } from 'react';

import { METRIC_META } from '@/config/metricMeta';
import { useInsights } from '@/lib/ai/useInsights';
import { fmtDelta } from '@/lib/domain/format';
import type { AnalyticsSnapshot } from '@/types/domain';

import { ReviewContext } from './ReviewContext';

const DIRECTION = { up: '▲', down: '▼', flat: '→', volatile: '↕' };

export function AiInsightCard({ snapshot }: { snapshot: AnalyticsSnapshot | null }) {
  const preview = useContext(ReviewContext);
  const { data, status, error, refresh } = useInsights(preview ? null : snapshot);
  const enough = !preview && !!snapshot?.trend?.dataQuality.sufficient;
  const loading = status === 'loading';
  return (
    <div className="bento-card insight-card" data-testid="ai-insight">
      <div className="card-heading">
        <div className="section-label mb-0">
          <Sparkles />
          <h2>Góc nhìn từ AI</h2>
          <span className="badge-soft">{data ? (data.source === 'ai' ? 'AI' : 'Dự phòng') : 'Trợ lý chiến dịch'}</span>
        </div>
        <button
          className="text-button min-h-9 py-0"
          disabled={!enough || loading}
          onClick={refresh}
          aria-label="Phân tích lại bằng AI"
        >
          <RefreshCw size={13} className={loading ? 'motion-safe:animate-spin' : ''} />
          <span>{data ? 'Phân tích lại' : 'Phân tích'}</span>
        </button>
      </div>
      {loading ? (
        <div role="status">
          <p className="card-description mb-4">AI đang đọc số liệu…</p>
          <div className="skeleton-block h-5 w-3/4" />
          <div className="suggestion-grid">
            {[1, 2, 3].map((i) => (
              <div className="skeleton-block h-32" key={i} />
            ))}
          </div>
        </div>
      ) : data ? (
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
      ) : (
        <>
          <h3 className="insight-headline">
            Hiểu điều gì đang diễn ra.
            <br />
            <span className="muted">Biết nên làm gì tiếp theo.</span>
          </h3>
          <p className="card-description mt-3">
            {error?.message ??
              (!enough
                ? 'Cần ít nhất 3 ngày số liệu và kết quả phân tích để bắt đầu.'
                : 'Sẵn sàng đọc xu hướng và đề xuất 3 hành động cụ thể cho chiến dịch.')}
          </p>
          <div className="suggestion-grid">
            {[
              ['Thêm số liệu theo ngày', 'Reach, click, chi phí và số đơn — chỉ cần 4 con số.'],
              ['Kiểm tra chỉ số hiệu quả', 'CTR, CPC, CPA giúp bạn đọc đúng chi phí và chuyển đổi.'],
              ['Nhận gợi ý hành động', 'Kết quả AI sẽ có đúng 3 đề xuất, kèm lý do và mức ưu tiên.'],
            ].map(([title, body], i) => (
              <div className="suggestion" key={title}>
                <span className="suggestion-number">0{i + 1}</span>
                <h4>{title}</h4>
                <p className="muted">{body}</p>
              </div>
            ))}
          </div>
          <div className="insight-footer flex items-center justify-between">
            <span>Chưa có nhận xét AI. Các bước trên là hướng dẫn bắt đầu.</span>
            <ArrowUpRight size={14} />
          </div>
        </>
      )}
    </div>
  );
}
