import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';
import { bus } from '@/lib/data/realtime/bus';
import { startLiveSimulator } from '@/lib/data/realtime/liveSimulator';
import type { AnalyticsSnapshot, Anomaly } from '@/types/domain';

import { AnalyticsStatus } from './AnalyticsStatus';
import { AnomalyFeed } from './AnomalyFeed';
import { ForecastPanel } from './ForecastPanel';
import { LiveModeToggle } from './LiveModeToggle';
import { ReviewContext, useDisplaySnapshot } from './ReviewContext';
import fixture from './reviewFixture.json';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/data/realtime/liveSimulator', () => ({ startLiveSimulator: vi.fn() }));
const snapshot = fixture as AnalyticsSnapshot;
beforeEach(async () => {
  await Promise.resolve();
  vi.clearAllMocks();
  vi.mocked(startLiveSimulator).mockReturnValue(vi.fn());
  useDataStore.setState({
    hydrated: true,
    entries: [],
    revision: 0,
    settings: { ...DEFAULT_SETTINGS },
    campaigns: [{ id: 'default', name: 'Chính', createdAt: 0 }],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FD-07 — Live và cảnh báo', () => {
  it('khởi động, đổi tốc độ và dọn simulator khi tắt', async () => {
    const stop = vi.fn();
    vi.mocked(startLiveSimulator).mockReturnValue(stop);
    render(<LiveModeToggle />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(startLiveSimulator).toHaveBeenCalledWith({ campaignId: 'default', speed: 1 }));
    fireEvent.change(screen.getByLabelText('Tốc độ Live'), { target: { value: '10' } });
    await waitFor(() => expect(startLiveSimulator).toHaveBeenCalledWith({ campaignId: 'default', speed: 10 }));
    expect(stop).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('switch'));
    expect(stop).toHaveBeenCalledTimes(2);
    expect(useDataStore.getState().settings.liveMode).toBe(false);
  });
  it('không chạy simulator trong bản xem trước', () => {
    useDataStore.getState().setSettings({ liveMode: true });
    render(
      <ReviewContext.Provider value={snapshot}>
        <LiveModeToggle />
      </ReviewContext.Provider>,
    );
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(startLiveSimulator).not.toHaveBeenCalled();
  });
  it('sự kiện bất thường hiện toast, danh sách và chọn ngày trên biểu đồ', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const anomaly: Anomaly = {
      date: '2026-11-01',
      metric: 'cpc',
      value: 10000,
      expected: 5000,
      score: 4,
      direction: 'spike',
      severity: 'critical',
    };
    render(<AnomalyFeed anomalies={[]} />);
    act(() => {
      bus.emit({ type: 'anomaly/detected', anomaly });
    });
    expect(toast.error).toHaveBeenCalledWith('CPC ▲ tăng bất thường');
    fireEvent.click(screen.getByRole('button', { name: /CPC ▲ tăng bất thường/ }));
    expect(useDataStore.getState().settings).toMatchObject({
      grain: 'day',
      range: { from: '2026-10-25', to: '2026-11-01' },
    });
    vi.unstubAllGlobals();
  });
  it('giới hạn nhịp hiển thị Live 250ms và 1s khi hơn 50k dòng', () => {
    vi.useFakeTimers();
    useDataStore.getState().setSettings({ liveMode: true });
    const first = { ...snapshot, revision: 1 };
    const second = { ...snapshot, revision: 2 };
    const { result, rerender } = renderHook(({ data }) => useDisplaySnapshot(data), { initialProps: { data: first } });
    rerender({ data: second });
    expect(result.current?.revision).toBe(1);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current?.revision).toBe(2);
    act(() =>
      useDataStore.setState({
        entries: Array.from({ length: 50_001 }, () => ({
          id: '',
          date: '',
          campaignId: '',
          reach: 0,
          clicks: 0,
          cost: 0,
          orders: 0,
          source: 'manual',
          createdAt: 0,
          updatedAt: 0,
        })),
      }),
    );
    rerender({ data: first });
    act(() => vi.advanceTimersByTime(999));
    expect(result.current?.revision).toBe(2);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current?.revision).toBe(1);
  });
});

describe('FD-04/09 — dự báo và dữ liệu lớn', () => {
  it('đặt mặc định 90 ngày cho dữ liệu dài, cho phép người dùng chọn lại Tất cả', () => {
    const data = {
      ...snapshot,
      query: { ...snapshot.query, campaignId: 'all' },
      dataSpan: { first: '2024-01-01', last: '2026-11-01' },
    };
    const { rerender } = render(<AnalyticsStatus snapshot={data} />);
    expect(useDataStore.getState().settings.range).toEqual({ from: '2026-08-04', to: '2026-11-01' });
    act(() => useDataStore.getState().setSettings({ range: null }));
    rerender(<AnalyticsStatus snapshot={{ ...data }} />);
    expect(useDataStore.getState().settings.range).toBeNull();
  });
  it('hiện trạng thái dữ liệu cũ và giữ snapshot khi revision chưa cập nhật', () => {
    useDataStore.setState({ revision: snapshot.revision + 1 });
    render(<AnalyticsStatus snapshot={{ ...snapshot, forecastStatus: 'stale' }} />);
    expect(screen.getByText('Đang cập nhật…')).toBeInTheDocument();
    expect(screen.getByText(/Số liệu đã cũ/)).toBeInTheDocument();
  });
  it('chưa đủ dữ liệu dự báo hiển thị yêu cầu 7 ngày', () => {
    render(<ForecastPanel nowcasts={[]} forecasts={[]} />);
    expect(screen.getByText(/Cần ≥ 7 ngày/)).toBeInTheDocument();
  });
});
