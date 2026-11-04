'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { useDataStore } from '@/lib/data/store';
import type { AnalyticsSnapshot } from '@/types/domain';

/** Bản xem trước tách biệt, không thay thế dữ liệu đã lưu. */
export const ReviewContext = createContext<AnalyticsSnapshot | null>(null);
export const ChartAppearanceContext = createContext(false);

export function useDisplaySnapshot(snapshot: AnalyticsSnapshot | null) {
  const preview = useContext(ReviewContext);
  const live = useDataStore((s) => s.settings.liveMode);
  const large = useDataStore((s) => s.entries.length > 50_000);
  const latest = useRef(snapshot);
  const [displayed, setDisplayed] = useState(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setDisplayed(latest.current), large ? 1000 : 250);
    return () => clearInterval(timer);
  }, [live, large]);
  // Bộ lọc mới không được hiển thị snapshot cũ của chiến dịch khác.
  const sameQuery = displayed && snapshot && JSON.stringify(displayed.query) === JSON.stringify(snapshot.query);
  return preview ?? (live && sameQuery ? displayed : snapshot);
}
