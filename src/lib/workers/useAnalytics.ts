'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { bus } from '@/lib/data/realtime/bus';
import { useDataStore } from '@/lib/data/store';
import type { AnalyticsQuery, AnalyticsSnapshot, EntryDelta } from '@/types/domain';

import { getAnalyticsClient } from './client';

export interface UseAnalyticsResult {
  data: AnalyticsSnapshot | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook useAnalytics theo hợp đồng docs/10 §C.
 * - R-01: Ổn định khoá truy vấn (qKey) tránh vòng lặp re-render vô tận khi UI truyền object mới.
 * - R-02: Cập nhật tăng dần qua bus.on('entries/changed') và client.applyDelta, chỉ init khi gặp REVISION_GAP.
 * - Debounce 50ms khi có nhiều delta dồn dập.
 * - Tự chữa lệch (self-healing) nếu checksum không khớp.
 * - Huỷ kết quả cũ theo revision (latest-wins).
 * - KHÔNG bao giờ throw trong quá trình render (trả { data, loading, error }).
 */
export function useAnalytics(q: AnalyticsQuery): UseAnalyticsResult {
  const store = useDataStore;
  const hydrated = store((s) => s.hydrated);

  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef(getAnalyticsClient());
  const initializedRef = useRef(false);
  const reqIdRef = useRef(0);
  const qRef = useRef(q);

  useEffect(() => {
    qRef.current = q;
  }, [q]);

  // R-01: Ổn định khoá truy vấn để tránh re-render vô tận khi UI truyền object literal mới
  const qKey = useMemo(() => {
    return JSON.stringify({
      campaignId: q.campaignId,
      grain: q.grain,
      range: q.range,
      horizonDays: q.horizonDays,
      today: q.today,
      targets: q.targets,
    });
  }, [q.campaignId, q.grain, q.range, q.horizonDays, q.today, q.targets]);

  const scheduleSnapshot = useRef<(() => void) | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    scheduleSnapshot.current = () => {
      reqIdRef.current++;
      const currentReqId = reqIdRef.current;
      setLoading(true);

      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const client = clientRef.current;
          const currentEntries = store.getState().entries;

          if (!initializedRef.current) {
            await client.init(currentEntries);
            initializedRef.current = true;
          }

          let snap = await client.snapshot(qRef.current);

          // Tự chữa lệch (self-healing): nếu checksum không khớp store
          const currentStoreChecksum = store.getState().checksum;
          if (
            snap.checksum.rows !== currentStoreChecksum.rows ||
            snap.checksum.reach !== currentStoreChecksum.reach ||
            snap.checksum.clicks !== currentStoreChecksum.clicks ||
            snap.checksum.cost !== currentStoreChecksum.cost ||
            snap.checksum.orders !== currentStoreChecksum.orders
          ) {
            await client.init(currentEntries);
            snap = await client.snapshot(qRef.current);
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
    };

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [store]);

  // R-02: Lắng nghe delta từ event bus để áp dụng tăng dần qua client.applyDelta
  useEffect(() => {
    const unsub = bus.on('entries/changed', async (e: { delta: EntryDelta; revision: number }) => {
      try {
        const client = clientRef.current;
        if (!initializedRef.current) {
          await client.init(store.getState().entries);
          initializedRef.current = true;
        } else {
          try {
            await client.applyDelta(e.delta, e.revision);
          } catch (err) {
            // Nếu gặp REVISION_GAP -> self-heal bằng init lại toàn bộ
            if (err instanceof Error && err.message === 'REVISION_GAP') {
              await client.init(store.getState().entries);
            } else {
              throw err;
            }
          }
        }
      } catch {
        // Lưới an toàn: init lại từ store
        try {
          await clientRef.current.init(store.getState().entries);
        } catch {
          // ignore
        }
      }
      scheduleSnapshot.current?.();
    });

    return unsub;
  }, [store]);

  // Chạy snapshot khi mount (sau khi hydrated) hoặc khi qKey đổi
  useEffect(() => {
    if (!hydrated) return;
    scheduleSnapshot.current?.();
  }, [hydrated, qKey]);

  return { data, loading, error };
}
