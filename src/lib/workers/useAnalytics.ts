'use client';

import { useEffect, useRef, useState } from 'react';

import { useDataStore } from '@/lib/data/store';
import type { AnalyticsQuery, AnalyticsSnapshot } from '@/types/domain';

import { getAnalyticsClient } from './client';

export interface UseAnalyticsResult {
  data: AnalyticsSnapshot | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook useAnalytics theo hợp đồng docs/10 §C.
 * Debounce 50ms khi có nhiều delta dồn dập.
 * Tự chữa lệch (self-healing) nếu checksum không khớp.
 * Huỷ kết quả cũ theo revision (latest-wins).
 * KHÔNG bao giờ throw trong quá trình render (trả { data, loading, error }).
 */
export function useAnalytics(q: AnalyticsQuery): UseAnalyticsResult {
  const entries = useDataStore((s) => s.entries);
  const revision = useDataStore((s) => s.revision);
  const storeChecksum = useDataStore((s) => s.checksum);
  const hydrated = useDataStore((s) => s.hydrated);

  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reqIdRef = useRef(0);
  const clientRef = useRef(getAnalyticsClient());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    reqIdRef.current++;
    const currentReqId = reqIdRef.current;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const client = clientRef.current;
        if (!initializedRef.current) {
          await client.init(entries);
          initializedRef.current = true;
        }

        let snap = await client.snapshot(q);

        // Tự chữa lệch (self-healing, docs/13 §3)
        if (
          snap.checksum.rows !== storeChecksum.rows ||
          snap.checksum.reach !== storeChecksum.reach ||
          snap.checksum.clicks !== storeChecksum.clicks ||
          snap.checksum.cost !== storeChecksum.cost ||
          snap.checksum.orders !== storeChecksum.orders
        ) {
          await client.init(entries);
          snap = await client.snapshot(q);
        }

        if (currentReqId === reqIdRef.current) {
          setData(snap);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (currentReqId === reqIdRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [hydrated, revision, entries, storeChecksum, q]);

  return { data, loading, error };
}
