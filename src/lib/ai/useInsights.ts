'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AnalyticsSnapshot,
  InsightError,
  InsightRequest,
  InsightResponse,
  Totals,
} from '@/types/domain';

import { buildInsightRequest } from './buildRequest';

export type InsightStatus = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

export interface UseInsightsResult {
  data: InsightResponse | null;
  status: InsightStatus;
  error?: InsightError;
  refresh(): void;
}

const CACHE_STORAGE_KEY = 'kpi-dash:ai-cache';
const CACHE_MAX_ITEMS = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const AUTO_REFRESH_DEBOUNCE_MS = 60 * 1000; // 60s debounce
const SIGNIFICANT_CHANGE_THRESHOLD = 0.05; // 5% thay đổi

interface ClientCacheEntry {
  value: InsightResponse;
  expiresAt: number;
  totals: Totals;
}

type ClientCacheMap = Record<string, ClientCacheEntry>;

function getClientCache(): ClientCacheMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ClientCacheMap) : {};
  } catch {
    return {};
  }
}

function saveClientCache(cache: ClientCacheMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Bỏ qua lỗi quota storage
  }
}

function hasSignificantChange(curr: Totals, prev: Totals): boolean {
  if (prev.reach === 0 && curr.reach === 0) return false;
  const metrics: Array<keyof Totals> = ['reach', 'clicks', 'cost', 'orders'];
  for (const m of metrics) {
    const oldVal = prev[m];
    const newVal = curr[m];
    if (oldVal === 0 && newVal === 0) continue;
    if (oldVal === 0 && newVal > 0) return true;
    const change = Math.abs(newVal - oldVal) / (oldVal || 1);
    if (change > SIGNIFICANT_CHANGE_THRESHOLD) return true;
  }
  return false;
}

function makeCacheKey(campaignId: string, grain: string, rangeKey: string): string {
  return `${campaignId}|${grain}|${rangeKey}`;
}

type FetchOutcome =
  | { ok: true; data: InsightResponse }
  | { ok: false; status: number; error: InsightError; fallback?: InsightResponse };

type OutcomeSubscriber = (outcome: FetchOutcome) => void;

/**
 * Module-level state:
 * - inflightRequests: gộp các request đang bay cùng cacheKey (R-03)
 * - subscribers: đồng bộ kết quả giữa các instance hook dùng chung cacheKey
 */
const inflightRequests = new Map<string, Promise<FetchOutcome>>();
const subscribers = new Map<string, Set<OutcomeSubscriber>>();

/** Dùng cho kiểm thử để xoá trạng thái module giữa các test */
export function _resetInflightState(): void {
  inflightRequests.clear();
  subscribers.clear();
}

async function executeApiRequest(
  cacheKey: string,
  payload: InsightRequest,
  totals: Totals,
): Promise<FetchOutcome> {
  let outcome: FetchOutcome;
  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const resData = (await response.json()) as InsightResponse;
      // Lưu cache client
      const cache = getClientCache();
      const keys = Object.keys(cache);
      if (keys.length >= CACHE_MAX_ITEMS && keys[0]) {
        delete cache[keys[0]];
      }
      cache[cacheKey] = {
        value: resData,
        expiresAt: Date.now() + CACHE_TTL_MS,
        totals,
      };
      saveClientCache(cache);
      outcome = { ok: true, data: resData };
    } else {
      const errData = (await response.json().catch(() => ({}))) as InsightError;
      const insightErr: InsightError = {
        code: errData.code || 'PROVIDER_ERROR',
        message: errData.message || `Lỗi yêu cầu (HTTP ${response.status})`,
        fallback: errData.fallback,
      };

      outcome = {
        ok: false,
        status: response.status,
        error: insightErr,
        fallback: errData.fallback,
      };
    }
  } catch (err: unknown) {
    outcome = {
      ok: false,
      status: 0,
      error: {
        code: 'PROVIDER_ERROR',
        message: err instanceof Error ? err.message : 'Lỗi kết nối tới dịch vụ AI.',
      },
    };
  } finally {
    inflightRequests.delete(cacheKey);
  }

  // R-05: Broadcast kết quả duy nhất một lần tới các subscriber đang active của cacheKey này.
  // Không bao giờ gọi fallback hay applyOutcome lên các component đã unmount hoặc chuyển sang key khác.
  const subs = subscribers.get(cacheKey);
  if (subs) {
    for (const sub of subs) {
      sub(outcome);
    }
  }

  return outcome;
}

/**
 * Hook truy xuất nhận xét AI / dự phòng từ /api/insights:
 * - Bỏ qua khi chưa đủ dữ liệu (sufficient=false) — R-02 (E26).
 * - Gộp request đang bay theo cacheKey ở module-level — R-03.
 * - Khoá effect theo [isSufficient, cacheKey, revision] thay vì object snapshot — R-04.
 * - Chống race condition ghi đè kết quả khi đổi cacheKey hoặc unmount giữa chừng — R-05.
 * - Cache client localStorage TTL 24h, tối đa 20 mục.
 * - Tự động refresh khi dữ liệu đổi > 5% và sau ít nhất 60s debounce.
 * - refresh() bỏ qua cache client để gọi mới.
 * - Tuyệt đối không bao giờ throw trong render tree.
 */
export function useInsights(snap: AnalyticsSnapshot | null): UseInsightsResult {
  const isSufficient = Boolean(snap?.trend?.dataQuality?.sufficient);
  const campaignId = snap?.query.campaignId ?? '';
  const grain = snap?.query.grain ?? '';
  const rangeKey = snap ? `${snap.dataSpan.first ?? ''}_${snap.dataSpan.last ?? ''}` : '';
  const cacheKey = snap ? makeCacheKey(campaignId, grain, rangeKey) : '';
  const revision = snap?.revision ?? 0;

  // Hiển thị trạng thái loading ngay nếu request cho cacheKey này đã đang bay từ instance khác
  const [data, setData] = useState<InsightResponse | null>(null);
  const [status, setStatus] = useState<InsightStatus>(() =>
    cacheKey && inflightRequests.has(cacheKey) ? 'loading' : 'idle',
  );
  const [error, setError] = useState<InsightError | undefined>(undefined);

  const snapRef = useRef<AnalyticsSnapshot | null>(snap);
  const activeKeyRef = useRef<string>(cacheKey);

  useEffect(() => {
    snapRef.current = snap;
    activeKeyRef.current = cacheKey;
  }, [snap, cacheKey]);

  const lastFetchedTimeRef = useRef<number>(0);
  const lastFetchedTotalsRef = useRef<Totals | null>(null);
  const lastFetchedKeyRef = useRef<string>('');

  const applyOutcome = useCallback((outcome: FetchOutcome) => {
    if (outcome.ok) {
      setData(outcome.data);
      setStatus(outcome.data.source === 'fallback' ? 'fallback' : 'success');
      setError(undefined);
    } else {
      if (outcome.fallback) {
        setData(outcome.fallback);
        setStatus('fallback');
      } else {
        setData(null);
        setStatus('error');
      }
      setError(outcome.error);
    }
  }, []);

  const fetchInsights = useCallback(
    async (snapshot: AnalyticsSnapshot, bypassCache = false) => {
      // R-02 (E26): Chặn nếu dữ liệu chưa đủ điều kiện
      if (!snapshot.trend?.dataQuality.sufficient) {
        return;
      }

      const cName = snapshot.query.campaignId || 'Chiến dịch';
      const rKey = `${snapshot.dataSpan.first ?? ''}_${snapshot.dataSpan.last ?? ''}`;
      const cKey = makeCacheKey(snapshot.query.campaignId, snapshot.query.grain, rKey);

      // Kiểm tra cache client nếu không bypass
      if (!bypassCache) {
        const cache = getClientCache();
        const entry = cache[cKey];
        if (entry && Date.now() < entry.expiresAt) {
          // R-05: Chỉ cập nhật nếu hook vẫn đang xem cKey
          if (activeKeyRef.current === cKey) {
            setData(entry.value);
            setStatus(entry.value.source === 'fallback' ? 'fallback' : 'success');
            setError(undefined);
            lastFetchedTimeRef.current = Date.now();
            lastFetchedTotalsRef.current = snapshot.totals;
            lastFetchedKeyRef.current = cKey;
          }
          return;
        }
      }

      // R-05: Chỉ cập nhật trạng thái loading nếu hook vẫn đang xem cKey
      if (activeKeyRef.current === cKey) {
        setStatus('loading');
        setError(undefined);
      }

      // R-03: Gộp request đang bay theo cacheKey
      let promise = inflightRequests.get(cKey);
      if (!promise) {
        const payload = buildInsightRequest(snapshot, cName);
        promise = executeApiRequest(cKey, payload, snapshot.totals);
        inflightRequests.set(cKey, promise);
      }

      await promise;
      // R-05: Không cập nhật state hay refs ở đây; executeApiRequest đã tự động
      // phát tới handleOutcome của các subscribers đang active của cKey.
    },
    [],
  );

  const refresh = useCallback(() => {
    const currentSnap = snapRef.current;
    if (currentSnap && currentSnap.trend?.dataQuality.sufficient) {
      void fetchInsights(currentSnap, true);
    }
  }, [fetchInsights]);

  useEffect(() => {
    // R-02 (E26): Dữ liệu rỗng hoặc chưa đủ 3 ngày → không gọi AI
    if (!isSufficient || !cacheKey) {
      lastFetchedKeyRef.current = '';
      lastFetchedTotalsRef.current = null;
      return;
    }

    const currentSnap = snapRef.current;
    if (!currentSnap) return;

    let active = true;

    // R-05: Đăng ký subscriber chỉ nhận kết quả khi hook còn active và vẫn đang xem cacheKey này
    const handleOutcome: OutcomeSubscriber = (outcome) => {
      if (!active) return;
      if (activeKeyRef.current !== cacheKey) return;

      applyOutcome(outcome);
      if (outcome.ok) {
        lastFetchedTimeRef.current = Date.now();
        lastFetchedTotalsRef.current = currentSnap.totals;
        lastFetchedKeyRef.current = cacheKey;
      }
    };

    let subs = subscribers.get(cacheKey);
    if (!subs) {
      subs = new Set();
      subscribers.set(cacheKey, subs);
    }
    subs.add(handleOutcome);

    const isNewKey = cacheKey !== lastFetchedKeyRef.current;
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchedTimeRef.current;
    const totalsChanged =
      !lastFetchedTotalsRef.current ||
      hasSignificantChange(currentSnap.totals, lastFetchedTotalsRef.current);

    if (isNewKey || (totalsChanged && timeSinceLastFetch > AUTO_REFRESH_DEBOUNCE_MS)) {
      void fetchInsights(currentSnap, false);
    }

    return () => {
      active = false;
      const currentSubs = subscribers.get(cacheKey);
      if (currentSubs) {
        currentSubs.delete(handleOutcome);
        if (currentSubs.size === 0) {
          subscribers.delete(cacheKey);
        }
      }
    };
  }, [isSufficient, cacheKey, revision, applyOutcome, fetchInsights]);

  if (!snap || !isSufficient) {
    return { data: null, status: 'idle', refresh };
  }

  return { data, status, error, refresh };
}
