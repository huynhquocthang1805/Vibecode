'use client';

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

import { CANVAS_POINT_THRESHOLD } from './chartRendering';

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
  const renderer = pointCount > CANVAS_POINT_THRESHOLD ? 'canvas' : 'svg';
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.EChartsType | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const instance = echarts.init(element, undefined, { renderer });
    chart.current = instance;
    function zoom(event: Event) {
      const date: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof date !== 'string') return;
      instance.dispatchAction({ type: 'dataZoom', startValue: date, endValue: date });
    }
    window.addEventListener('kpi:zoom-date', zoom);
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (element.clientWidth !== instance.getWidth() || element.clientHeight !== instance.getHeight()) {
          instance.resize({ width: 'auto', height: 'auto' });
        }
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('kpi:zoom-date', zoom);
      instance.dispose();
      chart.current = null;
    };
  }, [renderer]);
  useEffect(() => {
    chart.current?.setOption(option, { replaceMerge: ['series', 'yAxis', 'dataZoom'], lazyUpdate: true });
  }, [option, renderer]);
  return <div ref={container} style={{ height: '100%', width: '100%', minWidth: 0 }} />;
}
