'use client';

import { useState } from 'react';

import { useDataStore } from '@/lib/data/store';
import { addDays, parseISODate, todayVN } from '@/lib/domain/dates';
import { LIMITS } from '@/types/domain';

import DialogFrame from './DialogFrame';

export default function DateRangeDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const range = useDataStore((s) => s.settings.range);
  const [draft, setDraft] = useState(() => range ?? { from: '', to: '' });
  const [today] = useState(todayVN);
  const [error, setError] = useState('');

  function apply() {
    if (!draft.from && !draft.to) {
      useDataStore.getState().setSettings({ range: null });
      onOpenChange(false);
      return;
    }
    if (
      !parseISODate(draft.from) ||
      !parseISODate(draft.to) ||
      draft.from > draft.to ||
      draft.from < LIMITS.MIN_DATE ||
      draft.to > today
    ) {
      setError('Chọn đủ ngày bắt đầu và kết thúc, trong khoảng hợp lệ và không quá hôm nay.');
      return;
    }
    useDataStore.getState().setSettings({ range: draft });
    onOpenChange(false);
  }

  return (
    <DialogFrame
      open
      onOpenChange={onOpenChange}
      title="Khoảng thời gian"
      description="Chọn khoảng ngày để xem tổng quan chiến dịch."
    >
      <div className="toolbar">
        {[7, 30, 90].map((days) => (
          <button
            className="mvp-button"
            key={days}
            onClick={() => setDraft({ from: addDays(today, 1 - days), to: today })}
          >
            {days} ngày
          </button>
        ))}
        <button className="mvp-button" onClick={() => setDraft({ from: '', to: '' })}>
          Tất cả
        </button>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            Từ ngày
            <input
              type="date"
              className="mvp-input mt-2"
              min={LIMITS.MIN_DATE}
              max={draft.to || today}
              value={draft.from}
              onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
            />
          </label>
          <label className="field-label">
            Đến ngày
            <input
              type="date"
              className="mvp-input mt-2"
              min={draft.from || LIMITS.MIN_DATE}
              max={today}
              value={draft.to}
              onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
            />
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="toolbar justify-end mt-5">
          <button className="mvp-button" type="button" onClick={() => onOpenChange(false)}>
            Huỷ
          </button>
          <button type="submit" className="mvp-button primary">
            Áp dụng
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
