'use client';

import type { AnalyticsSnapshot } from '@/types/domain';

import { CampaignChart } from './CampaignChart';

export function TrendChart(props: { snapshot: AnalyticsSnapshot | null; showForecast?: boolean }) {
  return <CampaignChart {...props} />;
}
