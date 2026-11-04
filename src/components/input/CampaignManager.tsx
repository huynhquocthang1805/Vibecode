'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { useDataStore } from '@/lib/data/store';
import { LIMITS } from '@/types/domain';

export function CampaignManager() {
  const campaigns = useDataStore((s) => s.campaigns);
  const active = useDataStore((s) => s.settings.activeCampaignId);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  return (
    <div className="space-y-3">
      <label>
        Chiến dịch đang xem{' '}
        <select
          className="mvp-select"
          value={active}
          onChange={(e) => useDataStore.getState().setSettings({ activeCampaignId: e.target.value })}
        >
          <option value="all">Tất cả chiến dịch</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {campaigns.map((c) => (
        <div className="toolbar" key={c.id}>
          <span style={{ color: c.color }} className="text-xs">
            ● {c.name}
          </span>
          {editing === c.id ? (
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                useDataStore.getState().upsertCampaign({ id: c.id, name: name.trim() });
                setEditing(null);
                toast.success('Đã đổi tên chiến dịch');
              }}
            >
              <label className="sr-only" htmlFor={`rename-${c.id}`}>
                Tên mới của {c.name}
              </label>
              <input
                id={`rename-${c.id}`}
                className="mvp-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={LIMITS.MAX_CAMPAIGN_NAME}
              />
              <button className="mvp-button" disabled={!name.trim()}>
                Lưu tên
              </button>
              <button className="mvp-button" type="button" onClick={() => setEditing(null)}>
                Huỷ đổi tên
              </button>
            </form>
          ) : (
            <button
              className="mvp-button"
              onClick={() => {
                setEditing(c.id);
                setName(c.name);
              }}
            >
              Đổi tên {c.name}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
