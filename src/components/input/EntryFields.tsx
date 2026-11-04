'use client';

import { METRIC_META } from '@/config/metricMeta';
import { todayVN } from '@/lib/domain/dates';
import { LIMITS, type ValidationIssue } from '@/types/domain';

export type DraftValues = { date: string; reach: string; clicks: string; cost: string; orders: string };
export const NUMERIC_FIELDS = ['reach', 'clicks', 'cost', 'orders'] as const;

export function emptyDraft(date = todayVN()): DraftValues {
  return { date, reach: '', clicks: '', cost: '', orders: '' };
}

export function EntryFields({
  value,
  onChange,
  onBlur,
  issues = [],
  id,
}: {
  value: DraftValues;
  onChange: (field: keyof DraftValues, value: string) => void;
  onBlur?: (field: keyof DraftValues) => void;
  issues?: ValidationIssue[];
  id: string;
}) {
  return (
    <>
      {(['date', ...NUMERIC_FIELDS] as const).map((field) => {
        const messages = issues.filter((issue) => issue.field === field);
        const invalid = messages.some((issue) => issue.level === 'error');
        const inputId = `${id}-${field}`;
        return (
          <div key={field}>
            <label className="field-label" htmlFor={inputId}>
              {field === 'date' ? 'Ngày ghi nhận' : `${METRIC_META[field].label}${field === 'cost' ? ' (₫)' : ''}`}
            </label>
            <input
              id={inputId}
              className="mvp-input"
              type={field === 'date' ? 'date' : 'text'}
              inputMode={field === 'date' ? undefined : 'numeric'}
              enterKeyHint="next"
              min={field === 'date' ? LIMITS.MIN_DATE : undefined}
              max={field === 'date' ? todayVN() : undefined}
              value={value[field]}
              placeholder={field === 'cost' ? 'VD: 1.500.000' : '0'}
              aria-invalid={invalid}
              aria-describedby={messages.length ? `${inputId}-messages` : undefined}
              onChange={(e) => onChange(field, e.target.value)}
              onBlur={() => onBlur?.(field)}
            />
            {messages.length > 0 && (
              <div id={`${inputId}-messages`}>
                {messages.map((issue) => (
                  <p key={issue.code} className={issue.level === 'error' ? 'field-error' : 'field-warning'}>
                    {issue.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
