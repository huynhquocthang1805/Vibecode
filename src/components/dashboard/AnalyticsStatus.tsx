'use client';

import { useEffect, useRef } from 'react';

import { useDataStore } from '@/lib/data/store';
import { addDays, daysBetween } from '@/lib/domain/dates';
import type { AnalyticsSnapshot } from '@/types/domain';
import { LIMITS } from '@/types/domain';

const FORECAST_MESSAGES = {
  ok: '',
  insufficient: 'Cần ≥ 7 ngày có số liệu để dự báo.',
  stale: 'Số liệu đã cũ. Thêm số liệu gần đây để cập nhật dự báo.',
  disabled: 'Dự báo đang tắt trong chế độ tương thích. Số liệu thực tế vẫn dùng được.',
};

export function AnalyticsStatus({
  snapshot,
  preview = false,
}: {
  snapshot: AnalyticsSnapshot | null;
  preview?: boolean;
}) {
  const revision = useDataStore((s) => s.revision);
  const settings = useDataStore((s) => s.settings);
  const initialized = useRef(new Set<string>());
  useEffect(() => {
    if (
      !snapshot ||
      preview ||
      initialized.current.has(settings.activeCampaignId) ||
      snapshot.query.campaignId !== settings.activeCampaignId
    )
      return;
    const { first, last } = snapshot.dataSpan;
    if (!first || !last) return;
    initialized.current.add(settings.activeCampaignId);
    if (!settings.range && daysBetween(first, last) > 180) {
      useDataStore.getState().setSettings({ range: { from: addDays(last, 1 - LIMITS.DEFAULT_RANGE_DAYS), to: last } });
    }
  }, [snapshot, settings.activeCampaignId, settings.range, preview]);
  if (!snapshot)
    return (
      <p role="status" className="card-description">
        Đang chuẩn bị số liệu. Nếu chưa có dữ liệu, hãy nhập số liệu hoặc nạp dữ liệu mẫu.
      </p>
    );
  const updating =
    !preview &&
    (snapshot.revision < revision ||
      snapshot.query.campaignId !== settings.activeCampaignId ||
      snapshot.query.grain !== settings.grain ||
      JSON.stringify(snapshot.query.range ?? null) !== JSON.stringify(settings.range));
  return (
    <div className="toolbar mb-3" aria-live="polite">
      {updating && (
        <span className="badge-soft" role="status">
          Đang cập nhật…
        </span>
      )}
      {snapshot.dataSpan.first && (
        <span className="card-description">
          Dữ liệu có: {snapshot.dataSpan.first} — {snapshot.dataSpan.last}
        </span>
      )}
      {snapshot.series.grain === 'day' && snapshot.series.buckets.length > 400 && (
        <button
          className="mvp-button"
          disabled={preview}
          onClick={() => useDataStore.getState().setSettings({ grain: 'week' })}
        >
          Xem theo Tuần cho dễ đọc?
        </button>
      )}
      {FORECAST_MESSAGES[snapshot.forecastStatus] && (
        <span className="card-description">{FORECAST_MESSAGES[snapshot.forecastStatus]}</span>
      )}
    </div>
  );
}
