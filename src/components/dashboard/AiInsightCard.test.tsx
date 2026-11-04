import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInsights } from '@/lib/ai/useInsights';
import type { AnalyticsSnapshot } from '@/types/domain';

import { AiInsightCard } from './AiInsightCard';
import { ReviewContext } from './ReviewContext';
import fixture from './reviewFixture.json';

vi.mock('@/lib/ai/useInsights', () => ({ useInsights: vi.fn() }));
const snapshot = fixture as AnalyticsSnapshot;
const refresh = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useInsights).mockReturnValue({ data: null, status: 'idle', refresh });
});
afterEach(cleanup);

describe('FD-05 — chỉ phân tích khi đủ dữ liệu thật', () => {
  it.each(['null', 'no-trend', 'insufficient'] as const)('R-02 %s không truyền snapshot vào hook gọi AI', (state) => {
    const data = structuredClone(snapshot);
    if (state === 'no-trend') data.trend = null;
    if (state === 'insufficient') data.trend!.dataQuality.sufficient = false;
    render(<AiInsightCard snapshot={state === 'null' ? null : data} />);
    expect(useInsights).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: 'Phân tích lại bằng AI' })).toBeDisabled();
    expect(screen.getByText(/Cần ít nhất 3 ngày/)).toBeInTheDocument();
  });
  it('không gửi dữ liệu khi bật bản minh hoạ dù snapshot thật đủ ngày', () => {
    render(
      <ReviewContext.Provider value={snapshot}>
        <AiInsightCard snapshot={snapshot} />
      </ReviewContext.Provider>,
    );
    expect(useInsights).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: 'Phân tích lại bằng AI' })).toBeDisabled();
  });
  it('truyền nguyên snapshot đủ dữ liệu và cho phân tích lại', () => {
    render(<AiInsightCard snapshot={snapshot} />);
    expect(useInsights).toHaveBeenLastCalledWith(snapshot);
    fireEvent.click(screen.getByRole('button', { name: 'Phân tích lại bằng AI' }));
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('không gửi thêm yêu cầu bằng nút khi đang phân tích', () => {
    vi.mocked(useInsights).mockReturnValue({ data: null, status: 'loading', refresh });
    render(<AiInsightCard snapshot={snapshot} />);
    expect(screen.getByRole('status')).toHaveTextContent('AI đang đọc số liệu');
    expect(screen.getByRole('button', { name: 'Phân tích lại bằng AI' })).toBeDisabled();
  });
});
