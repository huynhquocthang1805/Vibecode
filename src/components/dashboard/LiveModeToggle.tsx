'use client';

import { useContext, useEffect } from 'react';
import { toast } from 'sonner';

import { useDataStore } from '@/lib/data/store';

import { ReviewContext } from './ReviewContext';

export function LiveModeToggle() {
  const enabled = useDataStore((s) => s.settings.liveMode);
  const speed = useDataStore((s) => s.settings.liveSpeed);
  const active = useDataStore((s) => s.settings.activeCampaignId);
  const firstCampaignId = useDataStore((s) => s.campaigns[0]?.id);
  const hydrated = useDataStore((s) => s.hydrated);
  const preview = useContext(ReviewContext);
  const campaignId = active === 'all' ? firstCampaignId : active;

  useEffect(() => {
    if (!hydrated || !enabled || preview || !campaignId) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('@/lib/data/realtime/liveSimulator')
      .then(({ startLiveSimulator }) => {
        if (!cancelled) stop = startLiveSimulator({ speed, campaignId });
      })
      .catch(() => {
        if (cancelled) return;
        useDataStore.getState().setSettings({ liveMode: false });
        toast.error('Chưa bật được Live. Hãy thử lại.');
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [hydrated, enabled, preview, speed, campaignId]);

  return (
    <div className="toolbar" aria-label="Mô phỏng dữ liệu thời gian thực">
      <button
        className="mvp-button"
        role="switch"
        aria-checked={enabled}
        disabled={!hydrated || !!preview || !campaignId}
        onClick={() => useDataStore.getState().setSettings({ liveMode: !enabled })}
        title="Mô phỏng sẽ ghi thêm số liệu vào chiến dịch đang chọn; khi xem Tất cả, dùng chiến dịch đầu tiên."
      >
        <span className={enabled && !preview ? 'live-dot' : 'status-dot'} aria-hidden="true" />
        Live mô phỏng
      </button>
      <label className="sr-only" htmlFor="live-speed">
        Tốc độ Live
      </label>
      <select
        id="live-speed"
        className="mvp-select"
        value={speed}
        disabled={!hydrated || !!preview}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (next === 1 || next === 10 || next === 60) useDataStore.getState().setSettings({ liveSpeed: next });
        }}
      >
        <option value={1}>×1</option>
        <option value={10}>×10</option>
        <option value={60}>×60</option>
      </select>
      {enabled && active === 'all' && <span className="card-description">Ghi vào chiến dịch đầu tiên</span>}
    </div>
  );
}
