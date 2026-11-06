'use client';

// Owner: frontend-input — DATA-12 (techlead làm theo yêu cầu chủ dự án 2026-11-06).
// Thư viện "Bộ dữ liệu test": mỗi tình huống nạp ngay vào app hoặc tải CSV để thử luồng Import.
import { Download, FlaskConical, Play } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DeferredDialog } from '@/components/dashboard/DeferredDialog';
import { buildScenario, SAMPLE_SCENARIOS, scenarioCsv, type SampleScenario } from '@/lib/data/samples/scenarios';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { fmtInt } from '@/lib/domain/format';

import { downloadText } from './entryActions';

/** Thay dữ liệu hiện tại bằng tình huống — đi qua importBatch (validate như nhập thật) */
export async function loadScenario(s: SampleScenario): Promise<number> {
  const store = useDataStore.getState();
  await store.clearAll();
  for (const c of s.campaigns) store.upsertCampaign({ id: c.id, name: c.name });
  const report = store.importBatch(buildScenario(s.id, todayVN()), 'mock', 'overwrite');
  return report.accepted;
}

export function SampleGallery() {
  const [pending, setPending] = useState<SampleScenario | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmLoad() {
    if (!pending) return;
    setBusy(true);
    try {
      const n = await loadScenario(pending);
      toast.success(`Đã nạp "${pending.title}" — ${fmtInt(n)} dòng. Kéo lên để xem phân tích.`);
      setPending(null);
      document.getElementById('tong-quan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      toast.error('Chưa nạp được bộ dữ liệu. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  function download(s: SampleScenario) {
    const today = todayVN();
    downloadText(scenarioCsv(s.id, today), `kpi-mini-${s.id}-${today}.csv`, 'text/csv;charset=utf-8');
    toast.success('Đã tải CSV. Mở tab "Import CSV / Dán Excel" để nhập thử.');
  }

  return (
    <section className="manage-tile sm:col-span-2" aria-labelledby="sample-gallery-title" data-testid="sample-gallery">
      <div className="flex items-start gap-3">
        <FlaskConical size={22} style={{ color: 'var(--blue)' }} aria-hidden />
        <div>
          <h3 id="sample-gallery-title">Bộ dữ liệu test</h3>
          <p>
            8 tình huống thật của marketer, ngày tính đến hôm qua. Nạp ngay để xem KPI, biểu đồ, AI và dự báo phản
            ứng — hoặc tải CSV để thử Import.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2" role="list">
        {SAMPLE_SCENARIOS.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border p-4"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
            data-testid={`sample-${s.id}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <strong className="text-sm">{s.title}</strong>
              <span className="muted shrink-0 text-xs">
                ~{fmtInt(s.approxRows)} dòng
              </span>
            </div>
            <p className="text-xs leading-relaxed">{s.summary}</p>
            <p className="muted text-xs leading-relaxed">
              <b>Kỳ vọng:</b> {s.expect}
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              {s.loadable && (
                <button className="mvp-button primary" onClick={() => setPending(s)} aria-label={`Dùng ngay: ${s.title}`}>
                  <Play />
                  Dùng ngay
                </button>
              )}
              <button className="mvp-button" onClick={() => download(s)} aria-label={`Tải CSV: ${s.title}`}>
                <Download />
                Tải CSV
              </button>
            </div>
          </li>
        ))}
      </ul>
      <DeferredDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={`Nạp "${pending?.title ?? ''}"?`}
        description="Số liệu hiện tại sẽ được thay thế. Hãy xuất backup trước nếu bạn cần giữ lại."
      >
        <div className="toolbar justify-end">
          <button className="mvp-button" disabled={busy} onClick={() => setPending(null)}>
            Huỷ
          </button>
          <button className="mvp-button primary" disabled={busy} onClick={confirmLoad}>
            Nạp bộ dữ liệu
          </button>
        </div>
      </DeferredDialog>
    </section>
  );
}
