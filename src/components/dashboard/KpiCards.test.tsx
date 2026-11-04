import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AnalyticsSnapshot } from '@/types/domain';
import { fmtInt, fmtPct, fmtVnd } from '@/lib/domain/format';

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
  it('R-01 giá trị chính khớp kỳ so sánh; tổng khoảng ngày có nhãn riêng', () => {
    const real = structuredClone(snapshot);
    real.totals.orders = 123456;
    const current = real.trend!.comparison!.current;
    current.orders = 42;
    render(<KpiCards snapshot={real} />);
    expect(screen.getByTestId('kpi-value-orders')).toHaveTextContent(/^42$/);
    expect(screen.getByTestId('kpi-total-orders')).toHaveTextContent('Tổng kỳ đã chọn: 123.456');
    expect(screen.getByTestId('kpi-value-reach')).toHaveTextContent(fmtInt(current.reach));
    expect(screen.getByTestId('kpi-value-clicks')).toHaveTextContent(fmtInt(current.clicks));
    expect(screen.getByTestId('kpi-value-cost')).toHaveAttribute('title', fmtVnd(current.cost));
    expect(screen.getByTestId('kpi-value-ctr')).toHaveTextContent(fmtPct(current.kpis.ctr));
    expect(screen.getByTestId('kpi-value-cpc')).toHaveTextContent(fmtVnd(current.kpis.cpc));
    expect(screen.getByTestId('kpi-value-cpa')).toHaveTextContent(fmtVnd(current.kpis.cpa));
  });
  it('hiển thị tổng và không gắn delta khi chưa có kỳ so sánh', () => {
    const real = structuredClone(snapshot);
    real.trend!.comparison = null;
    real.totals.orders = 0;
    render(<KpiCards snapshot={real} />);
    expect(screen.getByTestId('kpi-value-orders')).toHaveTextContent(/^0$/);
    expect(screen.getAllByText('— Chưa có so sánh')).toHaveLength(7);
    expect(screen.queryByTestId('kpi-total-orders')).not.toBeInTheDocument();
    expect(screen.getByTestId('kpi-value-ctr')).toHaveTextContent(fmtPct(real.totals.kpis.ctr));
  });
  it('CPA tăng được đánh dấu xấu, CPA null hiển thị gạch', () => {
    const altered = structuredClone(snapshot);
    altered.trend!.comparison!.current.kpis.cpa = null;
    altered.trend!.comparison!.deltaPct.cpa = 15;
    render(<KpiCards snapshot={altered} />);
    const cpa = screen.getByText('CPA', { exact: true }).closest('article')!;
    expect(within(cpa).getByText('▲ 15,0%')).toHaveClass('bad');
    expect(cpa.querySelector('.metric-value')).toHaveTextContent('—');
  });
});
