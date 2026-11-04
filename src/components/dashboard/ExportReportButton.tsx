'use client';

import { Download, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import type { AnalyticsSnapshot, InsightResponse } from '@/types/domain';

const ReportDialog = dynamic(() => import('./ExportReportDialog'), {
  ssr: false,
  loading: () => (
    <span role="status" className="sr-only">
      Đang mở báo cáo…
    </span>
  ),
});

export function ExportReportButton({
  snapshot,
  insight,
}: {
  snapshot: AnalyticsSnapshot | null;
  insight: InsightResponse | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div id="bao-cao" className="bento-card card-pad mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="empty-icon size-10 rounded-xl">
            <FileText size={18} />
          </span>
          <div>
            <h2 className="card-title">Chia sẻ bức tranh tổng quan</h2>
            <p className="card-description">Báo cáo gọn gàng, sẵn sàng gửi đội ngũ.</p>
          </div>
        </div>
        <button className="mvp-button" onClick={() => setOpen(true)}>
          <Download />
          Xem báo cáo
        </button>
      </div>
      {open && <ReportDialog snapshot={snapshot} insight={insight} onOpenChange={setOpen} />}
    </div>
  );
}
