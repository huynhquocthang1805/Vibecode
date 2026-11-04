'use client';

import { ArrowUpRight, RefreshCw, Sparkles } from 'lucide-react';
import { useContext } from 'react';
import dynamic from 'next/dynamic';

import { useInsights } from '@/lib/ai/useInsights';
import type { AnalyticsSnapshot } from '@/types/domain';

import { ReviewContext } from './ReviewContext';

const InsightContent = dynamic(() => import('./InsightContent'), {
  ssr: false,
  loading: () => (
    <p role="status" className="card-description">
      Đang hiển thị nhận xét…
    </p>
  ),
});

export function AiInsightCard({ snapshot }: { snapshot: AnalyticsSnapshot | null }) {
  const preview = useContext(ReviewContext);
  const enough = !preview && !!snapshot?.trend?.dataQuality.sufficient;
  const { data, status, error, refresh } = useInsights(enough ? snapshot : null);
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
        <InsightContent data={data} />
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
