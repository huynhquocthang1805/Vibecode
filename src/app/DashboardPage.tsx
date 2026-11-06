'use client';

/**
 * Trang ghép (techlead). Nối store → useAnalytics → useInsights → component.
 * Mỗi khu bọc SectionBoundary (docs/13 §7). TL-06 nối dữ liệu thật khi các module xong.
 */
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

import { AiInsightCard } from '@/components/dashboard/AiInsightCard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ExportReportButton } from '@/components/dashboard/ExportReportButton';
import { GrainSwitcher } from '@/components/dashboard/GrainSwitcher';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { LiveModeToggle } from '@/components/dashboard/LiveModeToggle';
import { SectionBoundary } from '@/components/dashboard/SectionBoundary';
import { EntryForm } from '@/components/input/EntryForm';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInsights } from '@/lib/ai/useInsights';
import { useDataStore } from '@/lib/data/store';
import { todayVN } from '@/lib/domain/dates';
import { useAnalytics } from '@/lib/workers/useAnalytics';

// TL-06b: better-auth client + dialog tài khoản (~40 KB gzip) ra khỏi bundle đầu — khách (P0) không cần;
// menu hiện sau hydrate, giữ chỗ 44 px để không xô layout
const AccountMenu = dynamic(() => import('@/components/account/AccountMenu').then((m) => m.AccountMenu), {
  ssr: false,
  loading: () => <div className="size-11 shrink-0" aria-hidden />,
});
// TL-06b: 2 tab không mở mặc định (bảng ảo hoá, quản lý dữ liệu) tải khi người dùng bấm vào tab — bundle đầu < 250 KB
const EntryTable = dynamic(() => import('@/components/input/EntryTable').then((m) => m.EntryTable), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
const DataManager = dynamic(() => import('@/components/input/DataManager').then((m) => m.DataManager), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full" />,
});
// TL-06b: khu dự báo + cảnh báo (P1/P2) nằm dưới màn hình đầu → tách chunk
const ForecastPanel = dynamic(() => import('@/components/dashboard/ForecastPanel').then((m) => m.ForecastPanel), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});
const AnomalyFeed = dynamic(() => import('@/components/dashboard/AnomalyFeed').then((m) => m.AnomalyFeed), {
  ssr: false,
  loading: () => <Skeleton className="h-32 w-full" />,
});
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

const noopSubscribe = () => () => undefined;

export function DashboardPage({ accountsEnabled = false }: { accountsEnabled?: boolean }) {
  const settings = useDataStore((s) => s.settings);
  // Ngày hôm nay theo giờ VN chỉ đọc ở client: Next 16 (Cache Components) cấm new Date() lúc prerender
  const today = useSyncExternalStore(noopSubscribe, todayVN, () => '');

  const { data: snapshot } = useAnalytics({
    campaignId: settings.activeCampaignId,
    grain: settings.grain,
    range: settings.range ?? undefined,
    horizonDays: 30,
    targets: settings.targets,
    today,
  });
  const { data: insight } = useInsights(snapshot);

  return (
    <DashboardShell
      controls={
        <SectionBoundary name="Bộ lọc">
          <GrainSwitcher />
          <LiveModeToggle />
          {accountsEnabled && <AccountMenu />}
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
