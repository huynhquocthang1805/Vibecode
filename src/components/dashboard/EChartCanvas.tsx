'use client';

import ReactECharts from 'echarts-for-react/lib/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { useEffect, useRef } from 'react';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
  AriaComponent,
  MarkLineComponent,
  CanvasRenderer,
  SVGRenderer,
]);

export default function EChartCanvas({ option, pointCount }: { option: EChartsOption; pointCount: number }) {
  const renderer = pointCount > 1_000 ? 'canvas' : 'svg';
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<ReactECharts>(null);
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        chart.current?.getEchartsInstance()?.resize({ width: 'auto', height: 'auto' }),
      );
    });
    if (container.current) observer.observe(container.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [renderer]);
  return (
    <div ref={container} style={{ height: '100%', width: '100%', minWidth: 0 }}>
      <ReactECharts
        ref={chart}
        key={renderer}
        echarts={echarts}
        option={option}
        notMerge={false}
        replaceMerge={['series', 'yAxis', 'dataZoom']}
        lazyUpdate
        autoResize={false}
        opts={{ renderer }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
