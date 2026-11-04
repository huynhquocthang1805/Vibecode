'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DeferredDialog } from '@/components/dashboard/DeferredDialog';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { fmtInt } from '@/lib/domain/format';

import { downloadText } from './entryActions';

export function ArchiveManager() {
  const entries = useDataStore((s) => s.entries);
  const years = useMemo(() => [...new Set(entries.map((e) => Number(e.date.slice(0, 4))))].sort(), [entries]);
  const [year, setYear] = useState('');
  const [downloaded, setDownloaded] = useState<{ year: number; revision: number; ids: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function archiveDownload() {
    const store = useDataStore.getState();
    const selectedYear = Number(year);
    const ids = store.entries.filter((e) => Number(e.date.slice(0, 4)) === selectedYear).map((e) => e.id);
    if (!ids.length) return;
    try {
      downloadText(
        store.exportBackup({ years: [selectedYear] }),
        `kpi-archive-${selectedYear}.json`,
        'application/json',
      );
      setDownloaded({ year: selectedYear, revision: store.revision, ids });
      setConfirmed(false);
    } catch {
      toast.error('Không tải được bản lưu trữ. Chưa xoá dữ liệu.');
    }
  }

  return (
    <div className="manage-tile">
      <h3>Lưu trữ năm cũ</h3>
      <p>Tải bản sao lưu, kiểm tra file đã lưu rồi xác nhận xoá các dòng của năm đó để giải phóng dung lượng.</p>
      <div className="toolbar">
        <label>
          Năm lưu trữ{' '}
          <select className="mvp-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Chọn năm</option>
            {years
              .filter((y) => y < Number(todayVN().slice(0, 4)))
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </label>
        <button className="mvp-button" disabled={!year} onClick={archiveDownload}>
          Tải bản lưu trữ
        </button>
      </div>
      <DeferredDialog
        open={!!downloaded}
        onOpenChange={(open) => {
          if (!open) setDownloaded(null);
        }}
        title="Xác nhận đã lưu file"
        description={`Năm ${downloaded?.year}: ${fmtInt(downloaded?.ids.length ?? 0)} dòng. Chỉ xoá sau khi đã kiểm tra bản sao lưu.`}
      >
        <label className="flex gap-3 items-center min-h-11">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Tôi đã lưu và kiểm tra file JSON
        </label>
        <div className="toolbar justify-end">
          <button className="mvp-button" onClick={() => setDownloaded(null)}>
            Huỷ
          </button>
          <button
            className="mvp-button danger"
            disabled={!confirmed}
            onClick={() => {
              const store = useDataStore.getState();
              if (!downloaded) return;
              if (store.revision !== downloaded.revision) {
                toast.error('Số liệu đã thay đổi. Hãy tải lại bản lưu trữ trước khi xoá.');
                setDownloaded(null);
                return;
              }
              const removed = store.removeEntries(downloaded.ids);
              setDownloaded(null);
              toast.success(`Đã lưu trữ ${removed.length} dòng`, {
                action: {
                  label: 'Hoàn tác',
                  onClick: () => {
                    if (!useDataStore.getState().undoLast())
                      toast.error('Đã hết thời gian hoàn tác. Nhập lại file lưu trữ để khôi phục.');
                  },
                },
              });
            }}
          >
            Xoá các dòng đã lưu trữ
          </button>
        </div>
      </DeferredDialog>
    </div>
  );
}
