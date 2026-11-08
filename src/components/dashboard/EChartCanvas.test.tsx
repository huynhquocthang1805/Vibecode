import { cleanup, render } from '@testing-library/react';
import { init } from 'echarts/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EChartCanvas from './EChartCanvas';

const chart = vi.hoisted(() => ({ setOption: vi.fn(), dispose: vi.fn(), dispatchAction: vi.fn() }));
vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => chart),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FD-10 — renderer dữ liệu lớn', () => {
  it.each([
    [0, 'svg'],
    [400, 'svg'],
    [401, 'canvas'],
  ])('%i điểm dùng %s', (pointCount, renderer) => {
    render(<EChartCanvas option={{}} pointCount={pointCount} />);
    expect(init).toHaveBeenCalledWith(expect.any(HTMLElement), undefined, { renderer });
  });

  it('giữ instance khi cập nhật dữ liệu và giải phóng khi đổi renderer', () => {
    const { rerender } = render(<EChartCanvas option={{}} pointCount={400} />);
    rerender(<EChartCanvas option={{ animation: false }} pointCount={399} />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalledTimes(2);
    rerender(<EChartCanvas option={{}} pointCount={401} />);
    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenLastCalledWith(expect.any(HTMLElement), undefined, { renderer: 'canvas' });
  });
});
