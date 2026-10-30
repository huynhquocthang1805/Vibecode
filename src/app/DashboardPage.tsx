'use client';

/**
 * Trang ghép (techlead). Nối store → useAnalytics → useInsights → component.
 * Mỗi khu bọc SectionBoundary (docs/13 §7). TL-06 nối dữ liệu thật khi các module xong.
 */
import dynamic from 'next/dynamic';

import { AiInsightCard } from '@/components/dashboard/AiInsightCard';
import { AnomalyFeed } from '@/components/dashboard/AnomalyFeed';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ExportReportButton } from '@/components/dashboard/ExportReportButton';
import { ForecastPanel } from '@/components/dashboard/ForecastPanel';
import { GrainSwitcher } from '@/components/dashboard/GrainSwitcher';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { LiveModeToggle } from '@/components/dashboard/LiveModeToggle';
import { SectionBoundary } from '@/components/dashboard/SectionBoundary';
import { DataManager } from '@/components/input/DataManager';
import { EntryForm } from '@/components/input/EntryForm';
import { EntryTable } from '@/components/input/EntryTable';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInsights } from '@/lib/ai/useInsights';
import { useDataStore } from '@/lib/data/store';
import { useAnalytics } from '@/lib/workers/useAnalytics';

// ECharts nặng → tách chunk, chỉ tải ở client
const TrendChart = dynamic(() => import('@/components/dashboard/TrendChart').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
});
const KpiRatioChart = dynamic(() => import('@/components/dashboard/KpiRatioChart').then((m) => m.KpiRatioChart), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
});
// Dialog import chỉ tải khi mở tab
const CsvImportDialog = dynamic(() => import('@/components/input/CsvImportDialog').then((m) => m.CsvImportDialog), {
  ssr: false,
});
const PasteImportDialog = dynamic(
  () => import('@/components/input/PasteImportDialog').then((m) => m.PasteImportDialog),
  { ssr: false },
);

export function DashboardPage() {
  const settings = useDataStore((s) => s.settings);
  const rowCount = useDataStore((s) => s.entries.length);
  // TL-06: today = todayVN() khi DATA-02 xong; tạm lấy ngày cuối của dữ liệu demo
  const lastDate = useDataStore((s) => s.entries.at(-1)?.date ?? '');

  const { data: snapshot } = useAnalytics({
    campaignId: settings.activeCampaignId,
    grain: settings.grain,
    range: settings.range ?? undefined,
    horizonDays: 30,
    targets: settings.targets,
    today: lastDate,
  });
  const { data: insight } = useInsights(snapshot);

  return (
    <DashboardShell
      controls={
        <SectionBoundary name="Bộ lọc">
          <span className="text-sm text-muted-foreground">{rowCount} dòng (store tạm)</span>
          <GrainSwitcher />
          <LiveModeToggle />
        </SectionBoundary>
      }
      kpis={
        <SectionBoundary name="Thẻ KPI">
          <KpiCards snapshot={snapshot} />
        </SectionBoundary>
      }
      chart={
        <SectionBoundary name="Biểu đồ">
          <Tabs defaultValue="volume">
            <TabsList>
              <TabsTrigger value="volume">Khối lượng</TabsTrigger>
              <TabsTrigger value="ratio">Hiệu quả CTR/CPC/CPA</TabsTrigger>
            </TabsList>
            <TabsContent value="volume">
              <TrendChart snapshot={snapshot} showForecast />
            </TabsContent>
            <TabsContent value="ratio">
              <KpiRatioChart snapshot={snapshot} />
            </TabsContent>
          </Tabs>
        </SectionBoundary>
      }
      forecast={
        <SectionBoundary name="Dự báo">
          <ForecastPanel nowcasts={snapshot?.nowcasts ?? []} forecasts={snapshot?.forecasts ?? []} />
        </SectionBoundary>
      }
      insight={
        <SectionBoundary name="Nhận xét AI">
          <div className="flex flex-col gap-2">
            <AiInsightCard snapshot={snapshot} />
            <ExportReportButton snapshot={snapshot} insight={insight} />
          </div>
        </SectionBoundary>
      }
      anomalies={
        <SectionBoundary name="Bất thường">
          <AnomalyFeed anomalies={snapshot?.anomalies ?? []} />
        </SectionBoundary>
      }
      data={
        <SectionBoundary name="Dữ liệu">
          <Tabs defaultValue="entry">
            <TabsList>
              <TabsTrigger value="entry">Nhập số liệu</TabsTrigger>
              <TabsTrigger value="table">Bảng dữ liệu</TabsTrigger>
              <TabsTrigger value="import">Import CSV / Dán Excel</TabsTrigger>
              <TabsTrigger value="manage">Dữ liệu</TabsTrigger>
            </TabsList>
            <TabsContent value="entry">
              <EntryForm />
            </TabsContent>
            <TabsContent value="table">
              <EntryTable />
            </TabsContent>
            <TabsContent value="import" className="flex flex-col gap-2">
              <CsvImportDialog />
              <PasteImportDialog />
            </TabsContent>
            <TabsContent value="manage">
              <DataManager />
            </TabsContent>
          </Tabs>
        </SectionBoundary>
      }
    />
  );
}
