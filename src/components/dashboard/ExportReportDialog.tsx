'use client';

import { Copy, Download } from 'lucide-react';
import { useContext, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { downloadText } from '@/components/input/entryActions';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { buildReport } from '@/lib/report/buildReport';
import { copyText } from '@/lib/report/clipboard';
import type { AnalyticsSnapshot, InsightResponse } from '@/types/domain';

import DialogFrame from './DialogFrame';
import { ReviewContext } from './ReviewContext';

export default function ExportReportDialog({
  snapshot,
  insight,
  onOpenChange,
}: {
  snapshot: AnalyticsSnapshot | null;
  insight: InsightResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const preview = useContext(ReviewContext);
  const format = useDataStore((s) => s.settings.reportFormat);
  const campaigns = useDataStore((s) => s.campaigns);
  const active = useDataStore((s) => s.settings.activeCampaignId);
  const preRef = useRef<HTMLPreElement>(null);
  const campaignName =
    active === 'all' ? 'Tất cả chiến dịch' : (campaigns.find((c) => c.id === active)?.name ?? 'Chiến dịch');
  const report = useMemo(() => {
    if (preview)
      return {
        text: '',
        error: 'Bản xem trước dùng số liệu minh hoạ. Hãy đóng bản xem trước để xuất báo cáo từ số liệu thật.',
      };
    if (!snapshot?.series.buckets.length)
      return {
        text: '',
        error: 'Chưa có kết quả tổng hợp để tạo báo cáo. Bạn có thể xuất sao lưu JSON ở tab Dữ liệu.',
      };
    try {
      return { text: buildReport({ campaignName, snapshot, insight, format, generatedAt: new Date() }), error: '' };
    } catch {
      return { text: '', error: 'Tạo báo cáo chưa sẵn sàng trong bản này. Số liệu đã nhập vẫn được giữ nguyên.' };
    }
  }, [snapshot, insight, campaignName, format, preview]);

  async function copy() {
    try {
      if (await copyText(report.text)) {
        toast.success('Đã sao chép — dán vào Zalo/Email');
        return;
      }
    } catch {
      /* Select the preview for manual copy. */
    }
    const selection = window.getSelection();
    if (preRef.current && selection) {
      const range = document.createRange();
      range.selectNodeContents(preRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    toast.error('Không sao chép được. Văn bản đã được chọn, hãy nhấn Ctrl+C hoặc Cmd+C.');
  }

  return (
    <DialogFrame
      open
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
      title="Báo cáo chiến dịch"
      description="Xem trước nội dung, sau đó sao chép hoặc tải file văn bản."
    >
      <div className="grain-switch w-fit" role="group" aria-label="Độ dài báo cáo">
        {(
          [
            ['short', 'Ngắn · Zalo'],
            ['full', 'Đầy đủ · Email'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={format === value}
            onClick={() => useDataStore.getState().setSettings({ reportFormat: value })}
          >
            {label}
          </button>
        ))}
      </div>
      {report.error ? (
        <p role="status" className="notice">
          {report.error}
        </p>
      ) : (
        <pre ref={preRef} tabIndex={0}>
          {report.text}
        </pre>
      )}
      <div className="toolbar justify-end">
        <button
          className="mvp-button"
          disabled={!report.text}
          onClick={() => downloadText(report.text, `kpi-report-${todayVN().replaceAll('-', '')}.txt`)}
        >
          <Download />
          Tải .txt
        </button>
        <button className="mvp-button primary" disabled={!report.text} onClick={() => void copy()}>
          <Copy />
          Sao chép
        </button>
      </div>
    </DialogFrame>
  );
}
