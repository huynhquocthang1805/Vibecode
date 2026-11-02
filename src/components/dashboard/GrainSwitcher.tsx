'use client';

import { useContext } from 'react';

import { useDataStore } from '@/lib/data/store';
import type { Grain } from '@/types/domain';

import { ReviewContext } from './ReviewContext';

export function GrainSwitcher() {
  const grain = useDataStore((s) => s.settings.grain);
  const hydrated = useDataStore((s) => s.hydrated);
  const preview = useContext(ReviewContext);
  return (
    <div className="grain-switch" role="group" aria-label="Độ chi tiết thời gian">
      {(
        [
          ['day', 'Ngày'],
          ['week', 'Tuần'],
          ['month', 'Tháng'],
          ['quarter', 'Quý'],
        ] as [Grain, string][]
      ).map(([value, label]) => (
        <button
          key={value}
          disabled={!hydrated || (!!preview && value !== 'day')}
          aria-pressed={(preview ? 'day' : grain) === value}
          onClick={() => useDataStore.getState().setSettings({ grain: value })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
