import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AnalyticsSnapshot } from '@/types/domain';

import { KpiCards } from './KpiCards';
import { ReviewContext } from './ReviewContext';
import fixture from './reviewFixture.json';

afterEach(cleanup);
const snapshot = fixture as AnalyticsSnapshot;

describe('FD-02 — thẻ KPI', () => {
  it('hiển thị dấu gạch khi chưa có snapshot, không có NaN/Infinity', () => {
    const { container } = render(<KpiCards snapshot={null} />);
    expect(container.querySelectorAll('.metric-value')).toHaveLength(7);
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(container.querySelector('.metric-value')).toHaveTextContent('—');
  });
  it('đọc số liệu minh hoạ chỉ khi được cung cấp qua context', () => {
    const { container } = render(
      <ReviewContext.Provider value={snapshot}>
        <KpiCards snapshot={null} />
      </ReviewContext.Provider>,
    );
    expect(container.querySelector('.metric-value')).not.toHaveTextContent('—');
  });
  it('dùng snapshot thật khi không bật bản xem trước', () => {
    const real = { ...snapshot, totals: { ...snapshot.totals, orders: 123456 } };
    const { container } = render(<KpiCards snapshot={real} />);
    expect(container.querySelector('.metric-value')).toHaveTextContent('123.456');
  });
  it('CPA tăng được đánh dấu xấu, CPA null hiển thị gạch', () => {
    const altered = structuredClone(snapshot);
    altered.totals.kpis.cpa = null;
    altered.trend!.comparison!.deltaPct.cpa = 15;
    render(<KpiCards snapshot={altered} />);
    const cpa = screen.getByText('CPA', { exact: true }).closest('article')!;
    expect(within(cpa).getByText('▲ 15,0%')).toHaveClass('bad');
    expect(cpa.querySelector('.metric-value')).toHaveTextContent('—');
  });
});
