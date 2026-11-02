'use client';

import { createContext, useContext } from 'react';

import type { AnalyticsSnapshot } from '@/types/domain';

/** Bản xem trước tách biệt, không thay thế dữ liệu đã lưu. */
export const ReviewContext = createContext<AnalyticsSnapshot | null>(null);
export const ChartAppearanceContext = createContext(false);

export function useDisplaySnapshot(snapshot: AnalyticsSnapshot | null) {
  const preview = useContext(ReviewContext);
  return preview ?? snapshot;
}
