import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EChartCanvas from './EChartCanvas';

vi.mock('echarts-for-react/lib/core', () => ({
  default: ({ opts }: { opts: { renderer: string } }) => <div data-testid="renderer">{opts.renderer}</div>,
}));
beforeEach(() => {
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
    [1000, 'svg'],
    [1001, 'canvas'],
  ])('%i điểm dùng %s', (pointCount, renderer) => {
    render(<EChartCanvas option={{}} pointCount={pointCount} />);
    expect(screen.getByTestId('renderer')).toHaveTextContent(renderer);
  });
});
