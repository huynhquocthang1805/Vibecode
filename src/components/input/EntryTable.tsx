'use client';

import { Check, ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { fmtInt, fmtPct, fmtVnd } from '@/lib/domain/format';
import { computeKpis } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import type { DailyEntry, ValidationIssue } from '@/types/domain';

import { EntryFields, type DraftValues } from './EntryFields';

const PAGE_SIZE = 25;

export function EntryTable() {
  const entries = useDataStore((s) => s.entries);
  const campaigns = useDataStore((s) => s.campaigns);
  const activeCampaignId = useDataStore((s) => s.settings.activeCampaignId);
  const hydrated = useDataStore((s) => s.hydrated);
  const [page, setPage] = useState(0);
  const [ascending, setAscending] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [draft, setDraft] = useState<DraftValues | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const filtered = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            (activeCampaignId === 'all' || e.campaignId === activeCampaignId) &&
            (!from || e.date >= from) &&
            (!to || e.date <= to),
        )
        .sort((a, b) => (ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))),
    [entries, activeCampaignId, from, to, ascending],
  );
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedIds = filtered.filter((e) => selected.has(e.id)).map((e) => e.id);
  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.has(e.id));

  function remove(ids: string[]) {
    const removed = useDataStore.getState().removeEntries(ids);
    setSelected(new Set());
    toast.success(`Đã xoá ${removed.length} dòng`, {
      duration: 5000,
      action: {
        label: 'Hoàn tác',
        onClick: () => {
          if (!useDataStore.getState().undoLast()) toast.error('Đã hết thời gian hoàn tác.');
        },
      },
    });
  }

  function edit(entry: DailyEntry) {
    setEditing(entry);
    setIssues([]);
    setDraft({
      date: entry.date,
      reach: String(entry.reach),
      clicks: String(entry.clicks),
      cost: String(entry.cost),
      orders: String(entry.orders),
    });
  }

  function saveEdit() {
    if (!draft || !editing) return;
    // Keep raw numeric strings until validation; never silently coerce invalid text.
    const raw = { ...draft, campaignId: editing.campaignId };
    const result = validateEntry(raw, { today: todayVN() });
    setIssues(result.issues);
    if (!result.ok || !result.value) return;
    const updated = useDataStore.getState().updateEntry(editing.id, result.value);
    setIssues(updated.issues);
    if (updated.ok) {
      setEditing(null);
      toast.success('Đã cập nhật số liệu');
    }
  }

  return (
    <>
      <div className="table-actions">
        <div className="toolbar">
          <label className="field-label mb-0" htmlFor="table-from">
            Từ
          </label>
          <input
            id="table-from"
            type="date"
            className="mvp-input w-auto"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
          <label className="field-label mb-0" htmlFor="table-to">
            Đến
          </label>
          <input
            id="table-to"
            type="date"
            className="mvp-input w-auto"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {selectedIds.length > 0 && (
          <button className="mvp-button danger" onClick={() => remove(selectedIds)}>
            <Trash2 />
            Xoá {selectedIds.length} dòng
          </button>
        )}
      </div>
      {!hydrated ? (
        <div className="skeleton-block h-40" aria-label="Đang tải bảng dữ liệu" />
      ) : !filtered.length ? (
        <div className="empty-state">
          <FileSpreadsheet size={30} />
          <strong>Chưa có số liệu trong khoảng này</strong>
          <p>Thêm dòng ở tab Nhập số liệu hoặc chọn khoảng ngày khác.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="entry-table" data-testid="entry-table">
            <caption className="sr-only">Số liệu quảng cáo theo ngày và chỉ số hiệu quả</caption>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="size-5 accent-blue-600"
                    aria-label="Chọn tất cả dòng trên trang"
                    checked={allVisibleSelected}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        visible.forEach((e) => (allVisibleSelected ? next.delete(e.id) : next.add(e.id)));
                        return next;
                      })
                    }
                  />
                </th>
                <th>
                  <button
                    className="min-h-11"
                    onClick={() => setAscending(!ascending)}
                    aria-label={`Sắp xếp ngày ${ascending ? 'giảm' : 'tăng'} dần`}
                  >
                    Ngày {ascending ? '↑' : '↓'}
                  </button>
                </th>
                <th>Chiến dịch</th>
                <th>Reach</th>
                <th>Click</th>
                <th>Chi phí</th>
                <th>Đơn</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>CPA</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => {
                const kpis = computeKpis(entry);
                return (
                  <tr key={entry.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="size-5 accent-blue-600"
                        aria-label={`Chọn dòng ${entry.date} ${entry.campaignId}`}
                        checked={selected.has(entry.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(entry.id)) next.delete(entry.id);
                            else next.add(entry.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>{entry.date.split('-').reverse().join('/')}</td>
                    <td>{campaigns.find((c) => c.id === entry.campaignId)?.name ?? entry.campaignId}</td>
                    <td>{fmtInt(entry.reach)}</td>
                    <td>{fmtInt(entry.clicks)}</td>
                    <td>{fmtVnd(entry.cost)}</td>
                    <td>{fmtInt(entry.orders)}</td>
                    <td>{fmtPct(kpis.ctr)}</td>
                    <td>{fmtVnd(kpis.cpc)}</td>
                    <td>{fmtVnd(kpis.cpa)}</td>
                    <td>
                      <div className="toolbar flex-nowrap">
                        <button
                          className="mvp-button icon-button border-0"
                          aria-label={`Sửa dòng ${entry.date}`}
                          onClick={() => edit(entry)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="mvp-button icon-button border-0"
                          aria-label={`Xoá dòng ${entry.date}`}
                          onClick={() => remove([entry.id])}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-pagination">
        <p>
          {fmtInt(filtered.length)} dòng · Trang {currentPage + 1}/{lastPage + 1}
        </p>
        <div className="toolbar">
          <button
            className="mvp-button icon-button"
            aria-label="Trang trước"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="mvp-button icon-button"
            aria-label="Trang sau"
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="mvp-dialog sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa số liệu</DialogTitle>
            <DialogDescription>
              Cập nhật dòng ngày {editing?.date}. Các chỉ số hiệu quả sẽ được tính lại từ số liệu mới.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <EntryFields
                  id="edit"
                  value={draft}
                  issues={issues}
                  onChange={(field, value) => setDraft((prev) => (prev ? { ...prev, [field]: value } : null))}
                />
              </div>
              {issues
                .filter((i) => i.field === 'row')
                .map((i) => (
                  <p className="field-error" key={i.code}>
                    {i.message}
                  </p>
                ))}
              <div className="toolbar justify-end mt-5">
                <button type="button" className="mvp-button" onClick={() => setEditing(null)}>
                  Huỷ
                </button>
                <button type="submit" className="mvp-button primary">
                  <Check />
                  Lưu thay đổi
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
