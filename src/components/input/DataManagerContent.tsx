'use client';

import { Database, Download, HardDrive, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { DeferredDialog } from '@/components/dashboard/DeferredDialog';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { fmtInt, fmtPct } from '@/lib/domain/format';
import { safeDiv } from '@/lib/domain/kpi';
import { LIMITS } from '@/types/domain';

import { downloadText } from './entryActions';

export function DataManager() {
  const storage = useDataStore((s) => s.storage);
  const rowCount = useDataStore((s) => s.entries.length);
  const campaigns = useDataStore((s) => s.campaigns);
  const hydrated = useDataStore((s) => s.hydrated);
  const [confirm, setConfirm] = useState<'clear' | 'mock' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const usage = safeDiv(storage.usedBytes, storage.quotaBytes) ?? 0;

  async function confirmedAction() {
    setBusy(true);
    try {
      if (confirm === 'clear') await useDataStore.getState().clearAll();
      else await useDataStore.getState().loadMock('demo-30d');
      toast.success(confirm === 'clear' ? 'Đã xoá toàn bộ số liệu' : 'Đã nạp dữ liệu mẫu');
      setConfirm(null);
      setConfirmation('');
    } catch {
      toast.error('Thao tác chưa hoàn tất. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > LIMITS.MAX_BACKUP_BYTES) {
      toast.error('File sao lưu vượt giới hạn 50 MB.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      // The store owns decoding and validation; UI only preflights capacity.
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || !('entries' in parsed) || !Array.isArray(parsed.entries))
        throw new Error('File không phải bản sao lưu KPI Mini.');
      if (parsed.entries.length + rowCount > LIMITS.MAX_ROWS_TOTAL)
        throw new Error('Không đủ sức chứa. Hãy lưu trữ dữ liệu cũ trước khi nhập.');
      const report = useDataStore.getState().importBackup(text);
      if (report.aborted) throw new Error('File sao lưu không hợp lệ. Dữ liệu hiện tại được giữ nguyên.');
      toast.success(
        `Đã nhập ${report.accepted} dòng · từ chối ${report.rejectedTotal} dòng · ${report.warningTotal} cảnh báo`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đọc được file sao lưu.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <fieldset disabled={!hydrated || busy}>
      <div className="manage-grid">
        <div className="manage-tile">
          <HardDrive size={22} className="mb-4" style={{ color: 'var(--blue)' }} />
          <h3>Dung lượng thiết bị</h3>
          <p>
            {fmtInt(rowCount)} / {fmtInt(LIMITS.MAX_ROWS_TOTAL)} dòng ·{' '}
            {storage.kind === 'memory' ? 'Lưu tạm trong tab' : 'Lưu trong trình duyệt'}
          </p>
          <div className="quota-track">
            <div
              className="quota-fill"
              style={{
                width: `${Math.min(usage * 100, 100)}%`,
                background: usage >= 0.9 ? 'var(--red)' : usage >= 0.7 ? '#bb861d' : undefined,
              }}
            />
          </div>
          <p>
            {fmtPct(usage)} dung lượng đã dùng · {fmtInt(storage.usedBytes)} / {fmtInt(storage.quotaBytes)} byte
          </p>
          {storage.kind === 'memory' && (
            <p role="alert" className="field-error">
              Xuất sao lưu trước khi đóng tab để giữ dữ liệu.
            </p>
          )}
        </div>
        <div className="manage-tile">
          <Database size={22} className="mb-4" style={{ color: 'var(--blue)' }} />
          <h3>Sao lưu số liệu</h3>
          <p>
            Xuất file JSON để lưu trữ. Khi nhập, dòng trùng sẽ ghi đè số liệu hiện có; chiến dịch và bộ lọc được giữ
            nguyên.
          </p>
          <div className="toolbar">
            <button
              className="mvp-button"
              onClick={() =>
                downloadText(useDataStore.getState().exportBackup(), `kpi-backup-${todayVN()}.json`, 'application/json')
              }
            >
              <Download />
              Xuất backup
            </button>
            <button className="mvp-button" onClick={() => fileInput.current?.click()}>
              <Upload />
              Nhập backup
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Chọn file sao lưu JSON"
            onChange={(e) => void importBackup(e.target.files?.[0])}
          />
        </div>
        <div className="manage-tile">
          <Sparkles size={22} className="mb-4" style={{ color: 'var(--blue)' }} />
          <h3>Khám phá với dữ liệu mẫu</h3>
          <p>Nạp 30 ngày số liệu để thử bảng và các thao tác nhập liệu. Dữ liệu mẫu sẽ thay thế số liệu hiện tại.</p>
          <button className="mvp-button" onClick={() => setConfirm('mock')}>
            <RotateCcw />
            Dùng dữ liệu mẫu
          </button>
        </div>
        <div className="manage-tile">
          <Trash2 size={22} className="mb-4" style={{ color: 'var(--red)' }} />
          <h3>Xoá toàn bộ dữ liệu</h3>
          <p>Thao tác xoá số liệu trên thiết bị này. Hãy xuất bản sao lưu trước khi tiếp tục.</p>
          <button
            className="mvp-button danger"
            disabled={!rowCount}
            onClick={() => {
              setConfirmation('');
              setConfirm('clear');
            }}
          >
            <Trash2 />
            Xoá toàn bộ
          </button>
        </div>
        <div className="manage-tile sm:col-span-2">
          <h3>Chiến dịch của bạn</h3>
          <p>{campaigns.map((c) => c.name).join(' · ')}</p>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              if (campaigns.length >= LIMITS.MAX_CAMPAIGNS) {
                toast.error('Đã đạt giới hạn chiến dịch.');
                return;
              }
              useDataStore.getState().upsertCampaign({ name: newName.trim() });
              setNewName('');
              toast.success('Đã tạo chiến dịch');
            }}
          >
            <label htmlFor="new-campaign" className="sr-only">
              Tên chiến dịch mới
            </label>
            <input
              id="new-campaign"
              className="mvp-input max-w-xs"
              maxLength={LIMITS.MAX_CAMPAIGN_NAME}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên chiến dịch mới"
            />
            <button className="mvp-button" type="submit" disabled={!newName.trim()}>
              <Plus />
              Tạo chiến dịch
            </button>
          </form>
        </div>
      </div>
      <DeferredDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
        title={confirm === 'clear' ? 'Xoá toàn bộ dữ liệu?' : 'Thay bằng dữ liệu mẫu?'}
        description={
          confirm === 'clear'
            ? 'Thao tác này không có hoàn tác. Nhập XOÁ để xác nhận.'
            : 'Số liệu hiện tại sẽ được thay thế. Hãy xuất backup trước nếu bạn cần giữ lại.'
        }
      >
        {confirm === 'clear' && (
          <>
            <label className="field-label" htmlFor="delete-confirmation">
              Nhập XOÁ
            </label>
            <input
              id="delete-confirmation"
              className="mvp-input"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </>
        )}
        <div className="toolbar justify-end">
          <button className="mvp-button" disabled={busy} onClick={() => setConfirm(null)}>
            Huỷ
          </button>
          <button
            className={`mvp-button ${confirm === 'clear' ? 'danger' : 'primary'}`}
            disabled={busy || (confirm === 'clear' && confirmation !== 'XOÁ')}
            onClick={() => void confirmedAction()}
          >
            {busy ? 'Đang xử lý…' : confirm === 'clear' ? 'Xác nhận xoá' : 'Nạp dữ liệu mẫu'}
          </button>
        </div>
      </DeferredDialog>
    </fieldset>
  );
}
