'use client';

import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDataStore } from '@/lib/data/store';
import { autoMapHeaders, parseCsv, parsePastedTable } from '@/lib/data/import';
import { todayVN } from '@/lib/domain/dates';
import { validateBatch } from '@/lib/domain/validation';
import { LIMITS, type DuplicatePolicy, type ImportReport } from '@/types/domain';

import { assertEntriesCanBeSaved, downloadText } from './entryActions';

const FIELDS = [
  ['date', 'Ngày'],
  ['reach', 'Reach'],
  ['clicks', 'Click'],
  ['cost', 'Chi phí'],
  ['orders', 'Đơn hàng'],
] as const;
type Field = (typeof FIELDS)[number][0];
type Preview = { rows: Record<string, string>[]; headers: string[]; encoding?: string; delimiter?: string };

export function ImportDialog({
  mode,
  initialText = '',
  initiallyOpen = false,
  onClose,
}: {
  mode: 'csv' | 'paste';
  initialText?: string;
  initiallyOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [text, setText] = useState(initialText);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<Field, string>>>({});
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importRevision, setImportRevision] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const hydrated = useDataStore((s) => s.hydrated);
  const active = useDataStore((s) => s.settings.activeCampaignId);
  const campaigns = useDataStore((s) => s.campaigns);
  const [campaignId, setCampaignId] = useState(active === 'all' ? 'default' : active);
  useEffect(() => () => controller.current?.abort(), []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      controller.current?.abort();
      setBusy(false);
      onClose?.();
    }
  }

  async function parse(file?: File) {
    if (mode === 'csv' && !file) return;
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setError('Hãy chọn file có đuôi .csv.');
      return;
    }
    if (file && file.size > LIMITS.MAX_IMPORT_FILE_BYTES) {
      setError('File vượt giới hạn 20 MB.');
      return;
    }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setProgress(0);
    setError('');
    setReport(null);
    setPreview(null);
    try {
      const result =
        mode === 'csv' && file
          ? await parseCsv(
              file,
              (p) => {
                if (!request.signal.aborted) setProgress(p);
              },
              request.signal,
            )
          : parsePastedTable(text);
      if (request.signal.aborted) return;
      setPreview(result);
      setMapping(autoMapHeaders(result.headers));
      if (!result.rows.length) setError('Bảng chưa có dòng dữ liệu.');
    } catch (err) {
      if (request.signal.aborted) return;
      setError(
        err instanceof Error && err.message.includes('NOT_IMPLEMENTED')
          ? 'Nhập CSV và dán Excel chưa sẵn sàng trong bản này. Bạn vẫn có thể nhập từng dòng ở tab Nhập số liệu.'
          : 'Không đọc được bảng. Hãy kiểm tra nội dung và thử lại.',
      );
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }

  function commit() {
    if (!preview) return;
    try {
      const raw = preview.rows.map((row) =>
        Object.assign(Object.fromEntries(FIELDS.map(([field]) => [field, row[mapping[field] ?? '']])), {
          campaignId,
          source: mode === 'csv' ? 'csv' : 'paste',
        }),
      );
      const checked = validateBatch(raw, { today: todayVN() });
      const store = useDataStore.getState();
      assertEntriesCanBeSaved(checked.valid, policy);
      const result = store.importBatch(checked.valid, mode === 'csv' ? 'csv' : 'paste', policy);
      setImportRevision(useDataStore.getState().revision);
      setReport({ ...checked.report, accepted: result.accepted, aborted: result.aborted });
      if (result.aborted)
        setError('Không đủ sức chứa hoặc lần nhập đã bị huỷ. Hãy lọc khoảng ngày hoặc lưu trữ năm cũ rồi thử lại.');
      else {
        toast.success(`Đã nhập ${result.accepted} dòng`);
        setPreview(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nhập chưa hoàn tất. Hãy kiểm tra bảng và thử lại.');
    }
  }

  return (
    <>
      <button className="mvp-button w-fit" disabled={!hydrated} onClick={() => changeOpen(true)}>
        {mode === 'csv' ? <Upload /> : <FileSpreadsheet />}
        {mode === 'csv' ? 'Nhập file CSV' : 'Dán từ Excel / Google Sheets'}
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="mvp-dialog sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{mode === 'csv' ? 'Nhập dữ liệu từ CSV' : 'Dán bảng từ Excel'}</DialogTitle>
            <DialogDescription>Chọn chiến dịch, kiểm tra cột dữ liệu và xem trước trước khi lưu.</DialogDescription>
          </DialogHeader>
          <div className="toolbar">
            <label className="field-label mb-0" htmlFor={`import-campaign-${mode}`}>
              Chiến dịch
            </label>
            <select
              className="mvp-select"
              id={`import-campaign-${mode}`}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="text-button ml-auto"
              onClick={() =>
                downloadText(
                  `Ngày,Reach,Click,Chi phí,Đơn hàng\n${todayVN()},10000,250,1500000,12\n`,
                  'kpi-mau.csv',
                  'text/csv;charset=utf-8',
                )
              }
            >
              Tải CSV mẫu
            </button>
          </div>
          {mode === 'csv' ? (
            <div
              className="empty-state rounded-xl border border-dashed"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void parse(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={30} />
              <p>Kéo thả file CSV tại đây · tối đa 20 MB</p>
              <button className="mvp-button" disabled={busy} onClick={() => fileInput.current?.click()}>
                Chọn file CSV
              </button>
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                aria-label="Chọn file CSV"
                accept=".csv,text/csv"
                onChange={(e) => {
                  void parse(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <>
              <label htmlFor="paste-text" className="field-label">
                Nội dung bảng
              </label>
              <textarea
                id="paste-text"
                className="mvp-input font-mono"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'Ngày\tReach\tClick\tChi phí\tĐơn hàng'}
              />
              <button className="mvp-button" disabled={!text.trim() || busy} onClick={() => void parse()}>
                Xem trước bảng
              </button>
            </>
          )}
          {busy && (
            <div role="status">
              <p className="text-xs">Đang đọc file… {Math.round(progress)}%</p>
              <progress className="w-full" max={100} value={progress} />
              <button
                className="mvp-button"
                onClick={() => {
                  controller.current?.abort();
                  setBusy(false);
                }}
              >
                <X />
                Huỷ
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="notice warn mb-0">
              {error}
            </p>
          )}
          {preview && (
            <>
              <p className="muted text-xs">
                {preview.rows.length} dòng · {preview.encoding ?? 'Văn bản'} · phân cách{' '}
                {preview.delimiter === '\t' ? 'Tab' : preview.delimiter || 'tự nhận'} · hiển thị tối đa 20 dòng
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {FIELDS.map(([field, label]) => (
                  <label className="field-label" key={field}>
                    {label}
                    <select
                      className="mvp-select w-full mt-2"
                      value={mapping[field] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="">Chọn cột</option>
                      {preview.headers.map((header) => (
                        <option key={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="table-scroll">
                <table className="entry-table">
                  <thead>
                    <tr>
                      {preview.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {preview.headers.map((h) => (
                          <td key={h}>{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="toolbar justify-between">
                <label className="text-xs">
                  Ngày trùng{' '}
                  <select
                    className="mvp-select ml-2"
                    value={policy}
                    onChange={(e) => setPolicy(e.target.value as DuplicatePolicy)}
                  >
                    <option value="skip">Bỏ qua</option>
                    <option value="overwrite">Ghi đè</option>
                    <option value="sum">Cộng dồn</option>
                  </select>
                </label>
                <button
                  className="mvp-button primary"
                  disabled={FIELDS.some(([field]) => !mapping[field]) || !preview.rows.length}
                  onClick={commit}
                >
                  <Upload />
                  Nhập dữ liệu
                </button>
              </div>
            </>
          )}
          {report && (
            <div className="notice" role="status">
              <p>
                Đã nhận {report.accepted} dòng · từ chối {report.rejectedTotal} · cảnh báo {report.warningTotal} · gộp
                trong file {report.mergedInFile}.
              </p>
              {report.rejected.slice(0, 20).map((row) => (
                <p key={row.row}>
                  Dòng {row.row}: {row.issues.map((i) => i.message).join('; ')}
                </p>
              ))}
              {report.detailsTruncated && <p>Danh sách lỗi đã được rút gọn.</p>}
              {report.aborted && <p>Lần nhập bị huỷ, chưa ghi thêm dữ liệu.</p>}
              <div className="toolbar">
                {report.accepted > 0 && !report.aborted && (
                  <button
                    className="mvp-button"
                    onClick={() => {
                      if (useDataStore.getState().revision !== importRevision) {
                        toast.error('Số liệu đã thay đổi sau lần import. Không thể hoàn tác import này.');
                        return;
                      }
                      if (useDataStore.getState().undoLast()) {
                        toast.success('Đã hoàn tác thao tác gần nhất');
                        setReport(null);
                      } else toast.error('Đã hết thời gian hoàn tác.');
                    }}
                  >
                    Hoàn tác import
                  </button>
                )}
                {report.rejected.length > 0 && (
                  <button
                    className="mvp-button"
                    onClick={() => {
                      const cell = (value: string) =>
                        `"${(/^[=+@\-]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
                      const csv = [
                        'Dòng,Lỗi,Dữ liệu',
                        ...report.rejected.map((r) =>
                          [String(r.row), r.issues.map((i) => i.message).join('; '), JSON.stringify(r.raw)]
                            .map(cell)
                            .join(','),
                        ),
                      ].join('\r\n');
                      downloadText('\uFEFF' + csv, 'kpi-dong-loi.csv', 'text/csv;charset=utf-8');
                    }}
                  >
                    Tải danh sách lỗi CSV
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
