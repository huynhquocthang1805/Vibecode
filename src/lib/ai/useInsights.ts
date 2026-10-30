'use client';

import type { AnalyticsSnapshot, InsightError, InsightResponse } from '@/types/domain';

export type InsightStatus = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

export interface UseInsightsResult {
  data: InsightResponse | null;
  status: InsightStatus;
  error?: InsightError;
  refresh(): void;
}

/** Stub không throw (hook gọi trong render). AI-06 thay bằng bản thật: POST /api/insights + cache. */
export function useInsights(_snap: AnalyticsSnapshot | null): UseInsightsResult {
  return { data: null, status: 'idle', refresh: () => undefined };
}
