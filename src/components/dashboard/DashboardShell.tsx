'use client';

import {
  ArrowDownToLine,
  ArrowRight,
  ChartNoAxesCombined,
  ChevronRight,
  Database,
  LayoutDashboard,
  Moon,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

import { useDataStore } from '@/lib/data/store';
import { fmtInt } from '@/lib/domain/format';
import type { AnalyticsSnapshot } from '@/types/domain';
import { safeDiv } from '@/lib/domain/kpi';
import { fmtPct } from '@/lib/domain/format';

import { ChartAppearanceContext, ReviewContext } from './ReviewContext';
import { DateRangeControl } from './DateRangeControl';
import { SectionBoundary } from './SectionBoundary';
import { DeferredDialog } from './DeferredDialog';
import { loadReviewFixture } from './reviewLoader';
import './dashboard.css';

const MobileEntryForm = dynamic(() => import('@/components/input/EntryForm').then((m) => m.EntryForm), {
  ssr: false,
  loading: () => <p role="status">Đang mở biểu mẫu…</p>,
});

export interface DashboardShellProps {
  controls: ReactNode;
  kpis: ReactNode;
  chart: ReactNode;
  forecast: ReactNode;
  insight: ReactNode;
  anomalies: ReactNode;
  data: ReactNode;
}

export function DashboardShell({ controls, kpis, chart, forecast, insight, anomalies, data }: DashboardShellProps) {
  const [dark, setDark] = useState(false);
  const [preview, setPreview] = useState<AnalyticsSnapshot | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mobileEntry, setMobileEntry] = useState(false);
  const hydrated = useDataStore((s) => s.hydrated);
  const campaigns = useDataStore((s) => s.campaigns);
  const settings = useDataStore((s) => s.settings);
  const rowCount = useDataStore((s) => s.entries.length);
  const health = useDataStore((s) => s.health);
  const storageKind = useDataStore((s) => s.storage.kind);
  const storageUsed = useDataStore((s) => s.storage.usedBytes);
  const storageQuota = useDataStore((s) => s.storage.quotaBytes);
  const quotaUsage = safeDiv(storageUsed, storageQuota) ?? 0;
  const workspaceLabel = preview
    ? 'Dữ liệu minh hoạ'
    : settings.activeCampaignId === 'all'
      ? 'Tất cả chiến dịch'
      : (campaigns.find((campaign) => campaign.id === settings.activeCampaignId)?.name ?? 'Chiến dịch');

  async function togglePreview() {
    if (preview) {
      setPreview(null);
      return;
    }
    if (previewLoading) return;
    setPreviewLoading(true);
    try {
      setPreview(await loadReviewFixture());
    } catch {
      toast.error('Chưa tải được dữ liệu minh hoạ. Hãy thử lại.');
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    let lastNotification = 0;
    const notifyError = () => {
      if (Date.now() - lastNotification < 10_000) return;
      lastNotification = Date.now();
      toast.error('Một thao tác chưa hoàn tất. Hãy thử lại hoặc xuất bản sao lưu.');
    };
    window.addEventListener('unhandledrejection', notifyError);
    window.addEventListener('error', notifyError);
    return () => {
      window.removeEventListener('unhandledrejection', notifyError);
      window.removeEventListener('error', notifyError);
    };
  }, []);

  function goToData(tab = 'entry') {
    const section = document.getElementById('du-lieu');
    if (section) {
      const index = ['entry', 'table', 'import', 'manage'].indexOf(tab);
      section.querySelectorAll<HTMLButtonElement>('[data-slot="tabs-trigger"]')[index]?.click();
      section.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  }

  return (
    <ReviewContext.Provider value={preview}>
      <ChartAppearanceContext.Provider value={dark}>
        <div className="kpi-workspace" data-theme={dark ? 'dark' : 'light'}>
          <a href="#tong-quan" className="sr-only focus:not-sr-only">
            Đi đến nội dung chính
          </a>
          <aside className="workspace-sidebar" aria-label="Điều hướng chính">
            <a className="workspace-logo" href="#tong-quan" aria-label="KPI Mini — Tổng quan">
              <span className="logo-mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>
                kpimini<span style={{ color: 'var(--blue)' }}>.</span>
              </span>
            </a>
            <p className="nav-caption">Không gian làm việc</p>
            <nav className="workspace-nav">
              <a href="#tong-quan" className="active" aria-current="page">
                <LayoutDashboard />
                <span>Tổng quan</span>
              </a>
              <a
                href="#du-lieu"
                onClick={(e) => {
                  e.preventDefault();
                  goToData('table');
                }}
              >
                <ChartNoAxesCombined />
                <span>Số liệu chiến dịch</span>
              </a>
              <a href="#nhan-xet">
                <Sparkles />
                <span>Phân tích & gợi ý</span>
                <span className="nav-pill">AI</span>
              </a>
              <a href="#bao-cao">
                <ArrowDownToLine />
                <span>Báo cáo</span>
              </a>
              <a
                href="#du-lieu"
                onClick={(e) => {
                  e.preventDefault();
                  goToData('manage');
                }}
              >
                <SlidersHorizontal />
                <span>Quản lý dữ liệu</span>
              </a>
            </nav>
            <div className="sidebar-note">
              <ShieldCheck size={20} style={{ color: 'var(--blue)' }} />
              <strong>Dữ liệu của bạn, trên thiết bị của bạn.</strong>Chủ động sao lưu để giữ số liệu luôn an toàn.
            </div>
            <div className="workspace-profile">
              <div className="profile-avatar" aria-hidden="true">
                <ChartNoAxesCombined size={16} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs truncate" title={workspaceLabel}>
                  {workspaceLabel}
                </p>
                <p className="muted text-[10px] mt-1">Chiến dịch đang xem</p>
              </div>
            </div>
          </aside>
          <div className="workspace-main">
            <header className="workspace-topbar">
              <div className="breadcrumb">
                <span className="logo-mark topbar-logo" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Không gian làm việc</span>
                <ChevronRight size={13} />
                <strong>Tổng quan</strong>
              </div>
              <div className="toolbar">
                <span className="status-label">
                  <span className="status-dot" />
                  Lưu trên thiết bị
                </span>
                <button
                  className="mvp-button icon-button"
                  aria-label={dark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun /> : <Moon />}
                </button>
                <span className="profile-avatar topbar-avatar" aria-hidden="true">
                  <ChartNoAxesCombined size={16} />
                </span>
              </div>
            </header>
            <main className="workspace-content" id="tong-quan">
              <div className="workspace-heading">
                <div>
                  <p className="eyebrow mb-2">Mỗi con số, một quyết định tốt hơn</p>
                  <h1>
                    Tổng quan chiến dịch<span style={{ color: 'var(--blue)' }}>.</span>
                  </h1>
                  <p className="muted">Theo dõi hiệu quả. Hiểu xu hướng. Tự tin ra quyết định.</p>
                </div>
                <div className="toolbar">
                  <button
                    className="mvp-button"
                    onClick={() => document.getElementById('bao-cao')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <ArrowDownToLine />
                    Xuất báo cáo
                  </button>
                  <button className="mvp-button primary" onClick={() => goToData()}>
                    <Plus />
                    Nhập số liệu
                  </button>
                </div>
              </div>
              {hydrated && (storageKind === 'memory' || health.storage === 'degraded') && (
                <div role="alert" className="notice warn">
                  Chưa lưu được trên thiết bị. Hãy xuất bản sao lưu trước khi đóng tab.
                </div>
              )}
              {hydrated && health.worker === 'degraded' && (
                <p role="status" className="notice warn">
                  Chế độ tương thích: tính toán trên thiết bị có thể chậm hơn. Bạn vẫn có thể nhập và xuất số liệu.
                </p>
              )}
              {hydrated && health.sync === 'degraded' && (
                <p role="status" className="notice warn">
                  Không đồng bộ được giữa các tab. Hãy tiếp tục làm việc trong tab này và xuất backup.
                </p>
              )}
              {hydrated && health.rollup === 'degraded' && (
                <p role="status" className="notice warn">
                  Đang khôi phục số liệu tổng hợp. Giữ kết quả gần nhất trong khi cập nhật.
                </p>
              )}
              {hydrated && quotaUsage >= 0.7 && (
                <div className="notice warn" role="status">
                  Đã dùng {fmtPct(quotaUsage)} dung lượng ({storageKind}).{' '}
                  {quotaUsage >= 0.9 ? 'Dung lượng gần đầy.' : 'Nên sao lưu số liệu.'}
                  <button className="mvp-button ml-2" onClick={() => goToData('manage')}>
                    Xuất backup / Lưu trữ năm cũ
                  </button>
                </div>
              )}
              <div className="workspace-filters">
                <div className="filter-group">
                  <label className="sr-only" htmlFor="campaign-filter">
                    Lọc chiến dịch
                  </label>
                  <select
                    id="campaign-filter"
                    className="mvp-select"
                    disabled={!hydrated || !!preview}
                    value={settings.activeCampaignId}
                    onChange={(e) => useDataStore.getState().setSettings({ activeCampaignId: e.target.value })}
                  >
                    <option value="all">Tất cả chiến dịch</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <DateRangeControl />
                  <button
                    className="mvp-button"
                    aria-pressed={!!preview}
                    aria-busy={previewLoading}
                    disabled={previewLoading}
                    onClick={() => void togglePreview()}
                  >
                    <Sparkles />
                    {previewLoading ? 'Đang tải bản mẫu…' : preview ? 'Đóng bản xem trước' : 'Xem giao diện mẫu'}
                  </button>
                </div>
                <div className="header-controls">{controls}</div>
              </div>
              {preview && (
                <div className="notice" role="status">
                  Bản xem trước giao diện · số liệu minh hoạ cố định từ 03/10–01/11/2026. Nhập liệu bên dưới vẫn dùng dữ
                  liệu thật; thay đổi sẽ không cập nhật các thẻ minh hoạ.
                </div>
              )}
              {!hydrated ? (
                <div aria-label="Đang tải dữ liệu" className="kpi-primary-grid">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-block h-40" />
                  ))}
                </div>
              ) : (
                <section aria-label="Chỉ số tổng quan">{kpis}</section>
              )}
              <div className="dashboard-grid">
                <div className="dashboard-stack">
                  <section className="bento-card chart-card" aria-label="Biểu đồ">
                    <div className="card-heading">
                      <div>
                        <h2 className="card-title">Hiệu suất chiến dịch</h2>
                        <p className="card-description">Một góc nhìn rõ ràng về từng ngày.</p>
                      </div>
                      <span className="badge-soft">{preview ? 'Dữ liệu minh hoạ' : 'Theo kỳ đã chọn'}</span>
                    </div>
                    {chart}
                  </section>
                  <section id="nhan-xet" aria-label="Nhận xét AI">
                    {insight}
                  </section>
                </div>
                <div className="dashboard-stack side-stack">
                  <section aria-label="Dự báo">{forecast}</section>
                  <section aria-label="Cảnh báo">{anomalies}</section>
                  <section className="bento-card card-pad onboarding-card">
                    <p className="eyebrow">Bắt đầu thật đơn giản</p>
                    <h2 className="card-title mt-3">Từ số liệu đến hành động.</h2>
                    {[
                      ['Nhập số liệu', 'Thêm reach, click, chi phí và đơn hàng.'],
                      ['Đọc hiệu quả', 'Theo dõi CTR, CPC và CPA tại một nơi.'],
                      ['Chia sẻ kết quả', 'Tạo báo cáo gửi đội ngũ của bạn.'],
                    ].map(([title, text], i) => (
                      <div className="onboarding-step" key={title}>
                        <span className="step-number">{i + 1}</span>
                        <div>
                          <strong className="font-medium">{title}</strong>
                          <p className="muted">{text}</p>
                        </div>
                      </div>
                    ))}
                    <button className="text-button" onClick={() => goToData()}>
                      Thêm dòng đầu tiên <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
              </div>
              <section id="du-lieu" className="bento-card data-section" aria-label="Dữ liệu">
                <div className="data-section-header">
                  <div>
                    <h2 className="card-title">Dữ liệu chiến dịch</h2>
                    <p className="card-description">Mọi thay đổi bắt đầu từ đây.</p>
                  </div>
                  <span className="badge-soft">
                    <Database size={11} />
                    {fmtInt(rowCount)} dòng
                  </span>
                </div>
                <SectionBoundary name="Nhập và quản lý dữ liệu">{data}</SectionBoundary>
              </section>
              <footer className="workspace-footer">
                <span>© 2026 KPI Mini · Rõ số liệu, vững quyết định.</span>
                <span>Được thiết kế cho người làm Marketing.</span>
              </footer>
            </main>
          </div>
          <button className="mvp-button primary mobile-fab" onClick={() => setMobileEntry(true)}>
            <Plus />
            Nhập số liệu
          </button>
          <DeferredDialog
            open={mobileEntry}
            onOpenChange={setMobileEntry}
            className="mobile-entry-sheet"
            title="Nhập số liệu"
            description="Nhập các dòng số liệu. Sau khi lưu, chỉ số tổng quan sẽ cập nhật."
          >
            <SectionBoundary name="Nhập số liệu mobile">
              <MobileEntryForm onSubmitted={() => setMobileEntry(false)} />
            </SectionBoundary>
          </DeferredDialog>
        </div>
      </ChartAppearanceContext.Provider>
    </ReviewContext.Provider>
  );
}
