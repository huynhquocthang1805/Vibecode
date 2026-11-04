import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';
import type { AnalyticsSnapshot } from '@/types/domain';

import { DashboardShell } from './DashboardShell';
import { loadReviewFixture } from './reviewLoader';
import fixture from './reviewFixture.json';

vi.mock('./reviewLoader', () => ({ loadReviewFixture: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const slots = { controls: null, kpis: null, chart: null, forecast: null, insight: null, anomalies: null, data: null };

beforeEach(async () => {
  await Promise.resolve();
  vi.clearAllMocks();
  useDataStore.setState({
    hydrated: true,
    entries: [],
    settings: { ...DEFAULT_SETTINGS },
    campaigns: [{ id: 'c1', name: 'Mùa hè', createdAt: 0 }],
    health: { storage: 'ok', worker: 'ok', sync: 'ok', rollup: 'ok' },
    storage: { kind: 'localStorage', usedBytes: 0, quotaBytes: 1000 },
  });
});
afterEach(cleanup);

describe('FD-10 — review loading/lỗi và nhãn workspace', () => {
  it('hiện loading, khoá nút rồi mở và đóng bản minh hoạ', async () => {
    let resolve!: (data: AnalyticsSnapshot) => void;
    vi.mocked(loadReviewFixture).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<DashboardShell {...slots} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao diện mẫu' }));
    expect(screen.getByRole('button', { name: 'Đang tải bản mẫu…' })).toBeDisabled();
    await act(async () => resolve(fixture as AnalyticsSnapshot));
    expect(screen.getByText('Dữ liệu minh hoạ', { selector: '.workspace-profile p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng bản xem trước' }));
    expect(screen.getByRole('button', { name: 'Xem giao diện mẫu' })).toBeEnabled();
  });
  it('lỗi tải fixture không bật preview và cho thử lại', async () => {
    vi.mocked(loadReviewFixture).mockRejectedValue(new Error('network'));
    render(<DashboardShell {...slots} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao diện mẫu' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Chưa tải được dữ liệu minh hoạ. Hãy thử lại.'));
    expect(screen.getByRole('button', { name: 'Xem giao diện mẫu' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Đóng bản xem trước' })).not.toBeInTheDocument();
  });
  it.each([
    ['all', 'Tất cả chiến dịch'],
    ['c1', 'Mùa hè'],
    ['missing', 'Chiến dịch'],
  ])('nhãn đúng khi chọn %s', (id, label) => {
    useDataStore.getState().setSettings({ activeCampaignId: id });
    const { container } = render(<DashboardShell {...slots} />);
    expect(container.querySelector('.workspace-profile p')).toHaveTextContent(label);
    expect(container.textContent).not.toMatch(/Minh Trường|\bMT\b/);
  });
  it('hiện chế độ suy giảm và quota có hành động sao lưu', () => {
    useDataStore.setState({
      health: { storage: 'ok', worker: 'degraded', sync: 'degraded', rollup: 'ok' },
      storage: { kind: 'localStorage', usedBytes: 900, quotaBytes: 1000 },
    });
    render(<DashboardShell {...slots} />);
    expect(screen.getByText(/Chế độ tương thích/)).toBeInTheDocument();
    expect(screen.getByText(/Không đồng bộ được giữa các tab/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất backup / Lưu trữ năm cũ' })).toBeInTheDocument();
  });
});
