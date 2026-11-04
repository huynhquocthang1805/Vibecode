/**
 * Review FD/FI (techlead, 2026-11-04) — lỗi chỉ lộ khi chạy trang thật với dữ liệu nhập qua form.
 * `it.fails` = lỗi đã biết, mã R-xx ở handoffs/REVIEW-FD-FI-2026-11-04.md. Owner sửa xong → đổi thành `it`.
 */
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KpiCards } from '@/components/dashboard/KpiCards';
import fixture from '@/components/dashboard/reviewFixture.json';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useInsights } from '@/lib/ai/useInsights';
import { fmtInt } from '@/lib/domain/format';
import type { AnalyticsSnapshot } from '@/types/domain';

const base = fixture as unknown as AnalyticsSnapshot;

/** Snapshot chưa có dữ liệu — đúng thứ DashboardPage nhận khi vừa mở trang trống */
function emptySnapshot(): AnalyticsSnapshot {
  const s = structuredClone(base);
  s.series.buckets = [];
  s.daily.buckets = [];
  s.totals = { reach: 0, clicks: 0, cost: 0, orders: 0, kpis: { ctr: null, cpc: null, cpa: null, cvr: null } };
  s.dataSpan = { first: null, last: null };
  s.trend = { ...s.trend!, periods: 0, comparison: null, dataQuality: { days: 0, missingDays: 0, sufficient: false } };
  return s;
}

describe('FD-02 · KpiCards', () => {
  // R-01: giá trị chính = TỔNG cả khoảng ngày (692 đơn), nhưng delta = KỲ CUỐI so với kỳ trước (01/11 vs 31/10).
  // Marketer đọc "692 đơn ▼x%" là "692 đơn, giảm x%". Quyết định techlead: giá trị chính khớp với delta
  // (= comparison.current), tổng khoảng ngày hiển thị phụ.
  it.fails('R-01 giá trị chính của thẻ khớp kỳ đang so sánh (comparison.current), không phải tổng khoảng ngày', () => {
    const s = structuredClone(base);
    const cur = s.trend!.comparison!.current;
    render(
      <TooltipProvider>
        <KpiCards snapshot={s} />
      </TooltipProvider>,
    );
    const card = screen.getByText('Đơn hàng').closest('article,section,div[class*="card"]') ?? document.body;
    const text = card.textContent ?? '';
    expect(text).toContain(fmtInt(cur.orders));
    // nếu vẫn hiện tổng thì phải có nhãn rõ "tổng"
    if (text.includes(fmtInt(s.totals.orders))) expect(text).toMatch(/tổng/i);
  });
});

// Lưu ý R-04: nếu caller truyền object snapshot mới mỗi render, effect [snap] gọi fetch liên tục
// (đo được 60 request/50ms) — hook nên khoá theo cacheKey ổn định như useAnalytics (R-01 của PR #4).
describe('FD-05 + AI-06 · useInsights không gọi AI khi chưa đủ dữ liệu (E26)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'BAD_REQUEST', message: 'x' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  // R-02: mở trang trống → useInsights tự POST /api/insights với range {from:"",to:""} → 400 BAD_REQUEST
  // (thấy thật trên trình duyệt). E26: < 3 ngày client không được gọi.
  it.fails('R-02 snapshot chưa đủ dữ liệu (sufficient=false) → không gọi fetch', async () => {
    const empty = emptySnapshot(); // cố định object như snapshot thật từ useAnalytics
    renderHook(() => useInsights(empty));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // R-03: DashboardPage và AiInsightCard đều gọi useInsights cùng snapshot → mỗi lần phân tích gửi 2 request
  // giống hệt (thấy thật: 2 request cách nhau 2ms) → tốn gấp đôi hạn mức 10 request/phút.
  it.fails('R-03 hai nơi dùng useInsights cùng snapshot → chỉ 1 request', async () => {
    const s = structuredClone(base);
    renderHook(() => {
      useInsights(s);
      useInsights(s);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
