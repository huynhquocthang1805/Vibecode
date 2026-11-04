'use client';

import { Copy, Keyboard, Plus, Save, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Suspense, useRef, useState, type ClipboardEvent } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataStore } from '@/lib/data/store';
import { parsePastedTable } from '@/lib/data/import/paste';
import { addDays, todayVN } from '@/lib/domain/dates';
import { validateEntry } from '@/lib/domain/validation';
import { LIMITS, type EntryInput, type DuplicatePolicy, type ValidationIssue } from '@/types/domain';

import { EntryFields, emptyDraft, type DraftValues } from './EntryFields';
import { saveValidatedEntries } from './entryActions';

const PasteDialog = dynamic(() => import('./PasteImportDialog').then((m) => m.PasteImportDialog), { ssr: false });
type Draft = { key: number; value: DraftValues; issues: ValidationIssue[] };

export function EntryForm({ onSubmitted }: { onSubmitted?: (n: number) => void }) {
  return (
    <Suspense fallback={<div className="skeleton-block h-44" aria-label="Đang tải biểu mẫu" />}>
      <EntryFormContent onSubmitted={onSubmitted} />
    </Suspense>
  );
}

function EntryFormContent({ onSubmitted }: { onSubmitted?: (n: number) => void }) {
  const hydrated = useDataStore((s) => s.hydrated);
  const campaigns = useDataStore((s) => s.campaigns);
  const activeCampaign = useDataStore((s) => s.settings.activeCampaignId);
  const [campaignId, setCampaignId] = useState(activeCampaign === 'all' ? 'default' : activeCampaign);
  const [rows, setRows] = useState<Draft[]>(() => [{ key: 0, value: emptyDraft(), issues: [] }]);
  const [pending, setPending] = useState<EntryInput[] | null>(null);
  const [largePaste, setLargePaste] = useState('');
  const [showLargePaste, setShowLargePaste] = useState(false);
  const counter = useRef(1);
  const formRef = useRef<HTMLFormElement>(null);
  const effectiveCampaign = campaigns.some((c) => c.id === campaignId) ? campaignId : (campaigns[0]?.id ?? 'default');

  function addRows(count: number, copy?: DraftValues) {
    if (rows.length + count > LIMITS.MAX_DRAFT_ROWS) {
      toast.info(`Tối đa ${LIMITS.MAX_DRAFT_ROWS} dòng nháp. Hãy dùng nhập bảng cho dữ liệu lớn.`);
      return;
    }
    const lastDate = rows.at(-1)?.value.date || todayVN();
    const nextRows = Array.from({ length: count }, (_, i) => ({
      key: counter.current++,
      value: copy ? { ...copy, date: addDays(copy.date || lastDate, 1) } : emptyDraft(addDays(lastDate, i + 1)),
      issues: [],
    }));
    setRows((prev) => [...prev, ...nextRows]);
  }

  function validateRow(row: Draft) {
    return validateEntry({ ...row.value, campaignId: effectiveCampaign, source: 'manual' }, { today: todayVN() });
  }

  function finish(inputs: EntryInput[], policy: DuplicatePolicy) {
    try {
      const result = saveValidatedEntries(inputs, policy);
      setPending(null);
      setRows([{ key: counter.current++, value: emptyDraft(), issues: [] }]);
      toast.success(result.added ? `Đã lưu ${result.added} dòng` : 'Đã bỏ qua các dòng trùng');
      onSubmitted?.(result.added);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chưa lưu được số liệu. Hãy thử lại.');
    }
  }

  function submit() {
    const results = rows.map(validateRow);
    setRows((prev) => prev.map((row, i) => ({ ...row, issues: results[i]?.issues ?? [] })));
    if (results.some((result) => !result.ok)) {
      toast.error('Hãy kiểm tra các ô được đánh dấu.');
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const inputs = results.flatMap((result) => (result.value ? [result.value] : []));
    const keys = new Set(inputs.map((input) => `${input.campaignId}|${input.date}`));
    if (keys.size !== inputs.length) {
      toast.error('Có ngày trùng trong bản nháp. Hãy sửa ngày hoặc xoá dòng trùng.');
      return;
    }
    const existing = new Set(useDataStore.getState().entries.map((entry) => entry.id));
    if (inputs.some((input) => existing.has(`${input.campaignId}|${input.date}`))) setPending(inputs);
    else finish(inputs, 'ask');
  }

  function paste(event: ClipboardEvent<HTMLFormElement>) {
    const text = event.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    if (text.split(/\r?\n/).length > LIMITS.PASTE_INLINE_MAX_ROWS) {
      setLargePaste(text);
      setShowLargePaste(true);
      return;
    }
    try {
      // DATA-07 is the single source of parsing rules; no duplicate parser in UI.
      const parsed = parsePastedTable(text);
      if (!parsed.rows.length) {
        toast.info('Bảng dán chưa có dữ liệu.');
        return;
      }
      setLargePaste(text);
      setShowLargePaste(true);
    } catch {
      toast.info('Chức năng dán bảng chưa sẵn sàng. Bạn có thể nhập từng dòng ngay bên dưới.');
    }
  }

  return (
    <>
      <form
        noValidate
        ref={formRef}
        onPaste={paste}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        data-testid="entry-form"
      >
        <fieldset disabled={!hydrated}>
          <div className="form-campaign">
            <label className="field-label mb-0" htmlFor="entry-campaign">
              Nhập cho
            </label>
            <select
              id="entry-campaign"
              className="mvp-select"
              value={effectiveCampaign}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="entry-rows">
            {rows.map((row, index) => (
              <div className="entry-row" key={row.key} data-testid="draft-row">
                <EntryFields
                  id={`draft-${row.key}`}
                  value={row.value}
                  issues={row.issues}
                  onChange={(field, value) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? {
                              ...item,
                              value: { ...item.value, [field]: value },
                              issues: item.issues.filter((issue) => issue.field !== field && issue.field !== 'row'),
                            }
                          : item,
                      ),
                    )
                  }
                  onBlur={(field) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? {
                              ...item,
                              issues: [
                                ...item.issues.filter((issue) => issue.field !== field),
                                ...validateRow(item).issues.filter((issue) => issue.field === field),
                              ],
                            }
                          : item,
                      ),
                    )
                  }
                />
                <div className="row-actions">
                  <button
                    type="button"
                    className="mvp-button icon-button border-0"
                    aria-label={`Nhân bản dòng ${index + 1}`}
                    onClick={() => addRows(1, row.value)}
                    disabled={rows.length >= LIMITS.MAX_DRAFT_ROWS}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="mvp-button icon-button border-0"
                    aria-label={`Xoá dòng nháp ${index + 1}`}
                    onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                    disabled={rows.length === 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="form-footer">
            <div className="toolbar">
              <button
                className="mvp-button"
                type="button"
                onClick={() => addRows(1)}
                disabled={rows.length >= LIMITS.MAX_DRAFT_ROWS}
              >
                <Plus />
                Thêm dòng
              </button>
              <button
                className="mvp-button"
                type="button"
                onClick={() => addRows(7)}
                disabled={rows.length + 7 > LIMITS.MAX_DRAFT_ROWS}
              >
                +7 ngày
              </button>
            </div>
            <button className="mvp-button primary" type="submit">
              <Save />
              Lưu {rows.length} dòng
            </button>
          </div>
          <p className="form-hint mt-4">
            <Keyboard size={14} />
            Dùng Tab để chuyển ô. Nhập số nguyên hoặc số có phân cách nghìn: 12.000.
          </p>
        </fieldset>
      </form>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent className="mvp-dialog">
          <DialogHeader>
            <DialogTitle>Ngày này đã có số liệu</DialogTitle>
            <DialogDescription>
              Một số ngày trong {pending?.length} dòng đã tồn tại. Chọn cách xử lý cho tất cả ngày trùng. Chưa có dòng
              nào được lưu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {(
              [
                ['skip', 'Bỏ qua'],
                ['sum', 'Cộng dồn'],
                ['overwrite', 'Ghi đè'],
              ] as const
            ).map(([policy, label]) => (
              <button
                key={policy}
                className={`mvp-button ${policy === 'overwrite' ? 'primary' : ''}`}
                onClick={() => pending && finish(pending, policy)}
              >
                {label}
              </button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showLargePaste && (
        <PasteDialog initialText={largePaste} initiallyOpen onClose={() => setShowLargePaste(false)} />
      )}
    </>
  );
}
