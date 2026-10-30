'use client';

import type { AnalyticsQuery, AnalyticsSnapshot } from '@/types/domain';

export interface UseAnalyticsResult {
  data: AnalyticsSnapshot | null;
  loading: boolean;
  error: Error | null;
}

const NOT_READY = new Error('NOT_IMPLEMENTED: DATA-06');

/**
 * Stub KHÔNG throw (hook gọi trong render — throw sẽ làm trắng trang).
 * Trả error để UI hiện trạng thái "chưa có số liệu". DATA-06 thay bằng bản thật.
 */
export function useAnalytics(_q: AnalyticsQuery): UseAnalyticsResult {
  return { data: null, loading: false, error: NOT_READY };
}
