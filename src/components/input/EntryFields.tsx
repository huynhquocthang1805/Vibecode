'use client';

import { METRIC_META } from '@/config/metricMeta';
import { todayVN } from '@/lib/domain/dates';
import { fmtInt } from '@/lib/domain/format';
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
              onChange={(e) => {
                const input = e.currentTarget;
                const raw = input.value;
                // Chỉ định dạng số nguyên không âm; giữ nguyên chuỗi lỗi cho validator.
                const inputType = 'inputType' in e.nativeEvent ? String(e.nativeEvent.inputType) : '';
                const groupedTyping =
                  field !== 'date' &&
                  /^\d{1,3}(?:\.\d{3})+$/.test(value[field]) &&
                  /^(insertText|deleteContentBackward|deleteContentForward)$/.test(inputType) &&
                  /^[\d.]+$/.test(raw);
                if (field !== 'date' && (/^\d+(?:\.\d{3})*$/.test(raw) || groupedTyping)) {
                  const number = Number(raw.replaceAll('.', ''));
                  if (Number.isSafeInteger(number)) {
                    const digitsBefore = raw.slice(0, input.selectionStart ?? raw.length).replaceAll('.', '').length;
                    const formatted = fmtInt(number);
                    onChange(field, formatted);
                    requestAnimationFrame(() => {
                      let cursor = 0;
                      let digits = 0;
                      while (cursor < formatted.length && digits < digitsBefore) {
                        if (/\d/.test(formatted[cursor]!)) digits++;
                        cursor++;
                      }
                      if (document.activeElement === input) input.setSelectionRange(cursor, cursor);
                    });
                    return;
                  }
                }
                onChange(field, raw);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return;
                const inputs = Array.from(
                  e.currentTarget.form?.querySelectorAll<HTMLInputElement>(
                    'input:not([type="hidden"]):not(:disabled)',
                  ) ?? [],
                );
                const next = inputs[inputs.indexOf(e.currentTarget) + 1];
                if (next) {
                  e.preventDefault();
                  next.focus();
                }
              }}
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
