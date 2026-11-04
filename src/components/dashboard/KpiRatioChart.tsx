'use client';

import type { AnalyticsSnapshot } from '@/types/domain';

import { CampaignChart } from './CampaignChart';

export function KpiRatioChart(props: { snapshot: AnalyticsSnapshot | null }) {
  return <CampaignChart {...props} ratio />;
}
