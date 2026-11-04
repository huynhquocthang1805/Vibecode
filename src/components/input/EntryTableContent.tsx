'use client';

import { Check, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

import { DeferredDialog } from '@/components/dashboard/DeferredDialog';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { fmtInt, fmtPct, fmtVnd } from '@/lib/domain/format';
import { computeKpis } from '@/lib/domain/kpi';
import { validateEntry } from '@/lib/domain/validation';
import type { DailyEntry, ValidationIssue } from '@/types/domain';

import { EntryFields, type DraftValues } from './EntryFields';
import './input.css';

type SortKey = 'date' | 'campaignId' | 'reach' | 'clicks' | 'cost' | 'orders';

export function EntryTable() {
  const entries = useDataStore((s) => s.entries);
  const campaigns = useDataStore((s) => s.campaigns);
  const activeCampaignId = useDataStore((s) => s.settings.activeCampaignId);
  const hydrated = useDataStore((s) => s.hydrated);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [source, setSource] = useState('all');
  const [campaign, setCampaign] = useState(activeCampaignId);
  const [jumpDate, setJumpDate] = useState('');
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
            (campaign === 'all' || e.campaignId === campaign) &&
            (source === 'all' || e.source === source) &&
            (!from || e.date >= from) &&
            (!to || e.date <= to),
        )
        .sort((a, b) => {
          const av = a[sortKey];
          const bv = b[sortKey];
          const order =
            typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
          return ascending ? order : -order;
        }),
    [entries, campaign, source, from, to, ascending, sortKey],
  );
  // TanStack Virtual manages its own mutable measurements; React Compiler must skip this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 57,
    overscan: 8,
    initialRect: { width: 1000, height: 480 },
    getItemKey: (index) => filtered[index]?.id ?? index,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const visible = virtualRows.flatMap((item) => (filtered[item.index] ? [filtered[item.index]!] : []));
  const topSpace = virtualRows[0]?.start ?? 0;
  const bottomSpace = virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0);
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
              scrollRef.current?.scrollTo?.({ top: 0 });
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
              scrollRef.current?.scrollTo?.({ top: 0 });
            }}
          />
        </div>
        <div className="toolbar">
          <label>
            Chiến dịch bảng{' '}
            <select className="mvp-select" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
              <option value="all">Tất cả</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nguồn{' '}
            <select className="mvp-select" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">Tất cả nguồn</option>
              <option value="manual">Nhập tay</option>
              <option value="csv">CSV</option>
              <option value="paste">Dán bảng</option>
              <option value="live">Live</option>
              <option value="mock">Dữ liệu mẫu</option>
            </select>
          </label>
          <label>
            Sắp xếp{' '}
            <select className="mvp-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="date">Ngày</option>
              <option value="campaignId">Chiến dịch</option>
              <option value="reach">Reach</option>
              <option value="clicks">Click</option>
              <option value="cost">Chi phí</option>
              <option value="orders">Đơn</option>
            </select>
          </label>
          <label>
            Đi tới ngày{' '}
            <input className="mvp-input" type="date" value={jumpDate} onChange={(e) => setJumpDate(e.target.value)} />
          </label>
          <button
            className="mvp-button"
            onClick={() => {
              const index = filtered.findIndex((row) => row.date === jumpDate);
              if (index < 0) toast.info('Không có dòng trong ngày đã chọn.');
              else virtualizer.scrollToIndex(index, { align: 'start' });
            }}
            disabled={!jumpDate}
          >
            Đi tới ngày
          </button>
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
        <div
          className="table-scroll"
          ref={scrollRef}
          style={{ maxHeight: 480, overflow: 'auto' }}
          tabIndex={0}
          aria-label="Cuộn bảng dữ liệu"
        >
          <table className="entry-table" data-testid="entry-table" aria-rowcount={filtered.length + 1}>
            <caption className="sr-only">Số liệu quảng cáo theo ngày và chỉ số hiệu quả</caption>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="size-5 accent-blue-600"
                    aria-label="Chọn tất cả dòng đang hiển thị"
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
              {topSpace > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={11} style={{ height: topSpace, padding: 0, border: 0 }} />
                </tr>
              )}
              {visible.map((entry, visibleIndex) => {
                const kpis = computeKpis(entry);
                return (
                  <tr
                    className="virtual-entry-row"
                    key={entry.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRows[visibleIndex]?.index}
                  >
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
                    <td data-label="Ngày">{entry.date.split('-').reverse().join('/')}</td>
                    <td data-label="Chiến dịch">
                      {campaigns.find((c) => c.id === entry.campaignId)?.name ?? entry.campaignId}
                    </td>
                    <td data-label="Reach">{fmtInt(entry.reach)}</td>
                    <td data-label="Click">{fmtInt(entry.clicks)}</td>
                    <td data-label="Chi phí">{fmtVnd(entry.cost)}</td>
                    <td data-label="Đơn">{fmtInt(entry.orders)}</td>
                    <td data-label="CTR">{fmtPct(kpis.ctr)}</td>
                    <td data-label="CPC">{fmtVnd(kpis.cpc)}</td>
                    <td data-label="CPA">{fmtVnd(kpis.cpa)}</td>
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
              {bottomSpace > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={11} style={{ height: bottomSpace, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-pagination">
        <p>
          {fmtInt(filtered.length)} dòng · Đang hiển thị {filtered.length ? (virtualRows[0]?.index ?? 0) + 1 : 0}–
          {(virtualRows.at(-1)?.index ?? -1) + 1}
        </p>
      </div>
      <DeferredDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        className="sm:max-w-2xl"
        title="Chỉnh sửa số liệu"
        description={`Cập nhật dòng ngày ${editing?.date ?? ''}. Các chỉ số hiệu quả sẽ được tính lại từ số liệu mới.`}
      >
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
      </DeferredDialog>
    </>
  );
}
