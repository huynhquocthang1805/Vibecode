'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AnalyticsSnapshot,
  InsightError,
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

/**
 * Hook truy xuất nhận xét AI / dự phòng từ /api/insights:
 * - Cache client localStorage TTL 24h, tối đa 20 mục.
 * - Tự động refresh khi dữ liệu đổi > 5% và sau ít nhất 60s debounce.
 * - refresh() bỏ qua cache client để gọi mới.
 * - AbortController tự huỷ request khi unmount hoặc khi snap thay đổi.
 * - Tuyệt đối không bao giờ throw trong render tree.
 */
export function useInsights(snap: AnalyticsSnapshot | null): UseInsightsResult {
  const [data, setData] = useState<InsightResponse | null>(null);
  const [status, setStatus] = useState<InsightStatus>('idle');
  const [error, setError] = useState<InsightError | undefined>(undefined);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchedTimeRef = useRef<number>(0);
  const lastFetchedTotalsRef = useRef<Totals | null>(null);
  const lastFetchedKeyRef = useRef<string>('');

  const fetchInsights = useCallback(
    async (snapshot: AnalyticsSnapshot, bypassCache = false) => {
      // Huỷ request đang chạy nếu có
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const campaignName = snapshot.query.campaignId || 'Chiến dịch';
      const rangeKey = `${snapshot.dataSpan.first ?? ''}_${snapshot.dataSpan.last ?? ''}`;
      const cacheKey = makeCacheKey(snapshot.query.campaignId, snapshot.query.grain, rangeKey);

      // Kiểm tra cache client nếu không bypass
      if (!bypassCache) {
        const cache = getClientCache();
        const entry = cache[cacheKey];
        if (entry && Date.now() < entry.expiresAt) {
          setData(entry.value);
          setStatus(entry.value.source === 'fallback' ? 'fallback' : 'success');
          setError(undefined);
          lastFetchedTimeRef.current = Date.now();
          lastFetchedTotalsRef.current = snapshot.totals;
          lastFetchedKeyRef.current = cacheKey;
          return;
        }
      }

      setStatus('loading');
      setError(undefined);

      try {
        const payload = buildInsightRequest(snapshot, campaignName);

        const response = await fetch('/api/insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.ok) {
          const resData = (await response.json()) as InsightResponse;
          setData(resData);
          setStatus(resData.source === 'fallback' ? 'fallback' : 'success');
          setError(undefined);
          lastFetchedTimeRef.current = Date.now();
          lastFetchedTotalsRef.current = snapshot.totals;
          lastFetchedKeyRef.current = cacheKey;

          // Lưu cache client
          const cache = getClientCache();
          const keys = Object.keys(cache);
          if (keys.length >= CACHE_MAX_ITEMS && keys[0]) {
            delete cache[keys[0]];
          }
          cache[cacheKey] = {
            value: resData,
            expiresAt: Date.now() + CACHE_TTL_MS,
            totals: snapshot.totals,
          };
          saveClientCache(cache);
        } else {
          const errData = (await response.json().catch(() => ({}))) as InsightError;
          const insightErr: InsightError = {
            code: errData.code || 'PROVIDER_ERROR',
            message: errData.message || `Lỗi yêu cầu (HTTP ${response.status})`,
            fallback: errData.fallback,
          };

          if (errData.fallback) {
            setData(errData.fallback);
            setStatus('fallback');
          } else {
            setStatus('error');
          }
          setError(insightErr);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request đã bị huỷ bởi người dùng hoặc unmount, giữ nguyên trạng thái
          return;
        }
        setStatus('error');
        setError({
          code: 'PROVIDER_ERROR',
          message: err instanceof Error ? err.message : 'Lỗi kết nối tới dịch vụ AI.',
        });
      }
    },
    [],
  );

  const refresh = useCallback(() => {
    if (snap) {
      fetchInsights(snap, true);
    }
  }, [snap, fetchInsights]);

  useEffect(() => {
    if (!snap) {
      lastFetchedKeyRef.current = '';
      lastFetchedTotalsRef.current = null;
      return;
    }

    const rangeKey = `${snap.dataSpan.first ?? ''}_${snap.dataSpan.last ?? ''}`;
    const cacheKey = makeCacheKey(snap.query.campaignId, snap.query.grain, rangeKey);

    const isNewKey = cacheKey !== lastFetchedKeyRef.current;
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchedTimeRef.current;
    const totalsChanged =
      !lastFetchedTotalsRef.current ||
      hasSignificantChange(snap.totals, lastFetchedTotalsRef.current);

    if (isNewKey || (totalsChanged && timeSinceLastFetch > AUTO_REFRESH_DEBOUNCE_MS)) {
      fetchInsights(snap, false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [snap, fetchInsights]);

  if (!snap) {
    return { data: null, status: 'idle', refresh };
  }

  return { data, status, error, refresh };
}
