'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

export default function EChartCanvas({ option }: { option: EChartsOption }) {
  return (
    <ReactECharts
      option={option}
      notMerge={false}
      replaceMerge={['series', 'yAxis', 'dataZoom']}
      lazyUpdate
      opts={{ renderer: 'svg' }}
      style={{ height: '100%', width: '100%' }}
    />
  );
}
