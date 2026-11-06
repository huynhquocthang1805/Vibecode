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

const SNAPSHOT_DEBOUNCE_MS = 50;
const SNAPSHOT_MAX_WAIT_MS = 100;

/**
 * Hook useAnalytics theo hợp đồng docs/10 §C.
 * - R-01: Ổn định khoá truy vấn (qKey) tránh vòng lặp re-render vô tận khi UI truyền object mới.
 * - R-02: Cập nhật tăng dần qua bus.on('entries/changed') và client.applyDelta, chỉ init khi gặp REVISION_GAP.
 * - BUG-QA04-03: Debounce 50ms kèm maxWait 100ms (throttle) + single-flight để Live x60 (~16ms/tick) không làm đói cập nhật.
 * - Tự chữa lệch (self-healing) nếu checksum không khớp ở cùng revision.
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
  const revisionOffsetRef = useRef(0);
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    let firstWaitTime: number | null = null;
    let inFlight = false;
    let pendingAfterFlight = false;
    let unmounted = false;

    const runSnapshot = async () => {
      timer = null;
      firstWaitTime = null;

      if (inFlight) {
        pendingAfterFlight = true;
        return;
      }

      inFlight = true;
      pendingAfterFlight = false;
      const currentReqId = ++reqIdRef.current;

      try {
        const client = clientRef.current;
        const stateBefore = store.getState();
        const revBefore = stateBefore.revision;

        if (!initializedRef.current) {
          await client.init(stateBefore.entries);
          revisionOffsetRef.current = 1 - stateBefore.revision;
          initializedRef.current = true;
        }

        let snap = await client.snapshot(qRef.current);

        // Tự chữa lệch (self-healing): chỉ đối chiếu khi store chưa nhảy sang revision mới trong lúc chờ worker
        const stateAfter = store.getState();
        if (stateAfter.revision === revBefore) {
          const currentStoreChecksum = stateAfter.checksum;
          if (
            snap.checksum.rows !== currentStoreChecksum.rows ||
            snap.checksum.reach !== currentStoreChecksum.reach ||
            snap.checksum.clicks !== currentStoreChecksum.clicks ||
            snap.checksum.cost !== currentStoreChecksum.cost ||
            snap.checksum.orders !== currentStoreChecksum.orders
          ) {
            await client.init(stateAfter.entries);
            revisionOffsetRef.current = 1 - stateAfter.revision;
            snap = await client.snapshot(qRef.current);
            bus.emit({
              type: 'system/health',
              area: 'rollup',
              status: 'recovered',
              message: 'Đã tự động chữa lệch rollup index.',
            });
          }
        }

        if (!unmounted && currentReqId === reqIdRef.current) {
          setData(snap);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!unmounted && currentReqId === reqIdRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      } finally {
        inFlight = false;
        if (!unmounted && pendingAfterFlight) {
          pendingAfterFlight = false;
          scheduleSnapshot.current?.();
        }
      }
    };

    scheduleSnapshot.current = () => {
      setLoading(true);

      if (inFlight) {
        pendingAfterFlight = true;
        return;
      }

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (firstWaitTime === null) {
        firstWaitTime = now;
      }

      const elapsed = Math.max(0, now - firstWaitTime);
      const remainingMaxWait = Math.max(0, SNAPSHOT_MAX_WAIT_MS - elapsed);
      const delay = Math.min(SNAPSHOT_DEBOUNCE_MS, remainingMaxWait);

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void runSnapshot();
      }, delay);
    };

    return () => {
      unmounted = true;
      if (timer) clearTimeout(timer);
    };
  }, [store]);

  // R-02: Lắng nghe delta từ event bus để áp dụng tăng dần qua client.applyDelta
  useEffect(() => {
    const unsub = bus.on('entries/changed', async (e: { delta: EntryDelta; revision: number }) => {
      try {
        const client = clientRef.current;
        if (!initializedRef.current) {
          const s = store.getState();
          await client.init(s.entries);
          revisionOffsetRef.current = 1 - s.revision;
          initializedRef.current = true;
        } else {
          try {
            await client.applyDelta(e.delta, e.revision + revisionOffsetRef.current);
          } catch (err) {
            // Nếu gặp REVISION_GAP -> self-heal bằng init lại toàn bộ
            if (err instanceof Error && err.message === 'REVISION_GAP') {
              const s = store.getState();
              await client.init(s.entries);
              revisionOffsetRef.current = 1 - s.revision;
            } else {
              throw err;
            }
          }
        }
      } catch {
        // Lưới an toàn: init lại từ store
        try {
          const s = store.getState();
          await clientRef.current.init(s.entries);
          revisionOffsetRef.current = 1 - s.revision;
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
