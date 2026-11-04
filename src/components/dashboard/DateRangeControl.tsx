'use client';

import { CalendarDays } from 'lucide-react';
import { useContext, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDataStore } from '@/lib/data/store';
import { addDays, parseISODate, todayVN } from '@/lib/domain/dates';
import { LIMITS } from '@/types/domain';

import { ReviewContext } from './ReviewContext';

const displayDate = (value: string) => value.split('-').reverse().join('/');

export function DateRangeControl() {
  const range = useDataStore((s) => s.settings.range);
  const hydrated = useDataStore((s) => s.hydrated);
  const preview = useContext(ReviewContext);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [today, setToday] = useState('');
  const [error, setError] = useState('');

  function openPicker() {
    setDraft(range ?? { from: '', to: '' });
    setToday(todayVN());
    setError('');
    setOpen(true);
  }

  function apply() {
    if (!draft.from && !draft.to) {
      useDataStore.getState().setSettings({ range: null });
      setOpen(false);
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
    setOpen(false);
  }

  return (
    <>
      <button className="mvp-button" disabled={!hydrated || !!preview} onClick={openPicker}>
        <CalendarDays />
        {preview
          ? '03/10 — 01/11/2026'
          : range
            ? `${displayDate(range.from)} — ${displayDate(range.to)}`
            : 'Toàn bộ thời gian'}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="mvp-dialog">
          <DialogHeader>
            <DialogTitle>Khoảng thời gian</DialogTitle>
            <DialogDescription>Chọn khoảng ngày để xem tổng quan chiến dịch.</DialogDescription>
          </DialogHeader>
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
              <button className="mvp-button" type="button" onClick={() => setOpen(false)}>
                Huỷ
              </button>
              <button type="submit" className="mvp-button primary">
                Áp dụng
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
