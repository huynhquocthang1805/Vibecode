'use client';

import { CalendarDays } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useContext, useState } from 'react';

import { useDataStore } from '@/lib/data/store';

import { ReviewContext } from './ReviewContext';

const DateRangeDialog = dynamic(() => import('./DateRangeDialog'), {
  ssr: false,
  loading: () => (
    <span role="status" className="sr-only">
      Đang mở bộ lọc ngày…
    </span>
  ),
});

const displayDate = (value: string) => value.split('-').reverse().join('/');

export function DateRangeControl() {
  const range = useDataStore((s) => s.settings.range);
  const hydrated = useDataStore((s) => s.hydrated);
  const preview = useContext(ReviewContext);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="mvp-button" disabled={!hydrated || !!preview} onClick={() => setOpen(true)}>
        <CalendarDays />
        {preview
          ? '03/10 — 01/11/2026'
          : range
            ? `${displayDate(range.from)} — ${displayDate(range.to)}`
            : 'Toàn bộ thời gian'}
      </button>
      {open && <DateRangeDialog onOpenChange={setOpen} />}
    </>
  );
}
