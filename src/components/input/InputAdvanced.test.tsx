import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';

import { ArchiveManager } from './ArchiveManager';
import { CampaignManager } from './CampaignManager';
import { EntryTable } from './EntryTableContent';
import { ImportDialog } from './ImportDialog';
import { downloadText } from './entryActions';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('./entryActions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./entryActions')>()),
  downloadText: vi.fn(),
}));

beforeEach(async () => {
  await Promise.resolve();
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('table-scroll') ? 480 : 57;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T03:00:00Z'));
  useDataStore.setState({
    hydrated: true,
    entries: [],
    settings: { ...DEFAULT_SETTINGS },
    campaigns: [{ id: 'default', name: 'Chính', createdAt: 0 }],
  });
  useDataStore
    .getState()
    .addEntries([{ date: '2025-10-01', campaignId: 'default', reach: 1000, clicks: 20, cost: 10000, orders: 1 }]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Nhập liệu nâng cao của Trường', () => {
  it('đổi tên qua store, chặn tên rỗng và chuyển chiến dịch', () => {
    render(<CampaignManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên Chính' }));
    fireEvent.change(screen.getByLabelText('Tên mới của Chính'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Lưu tên' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tên mới của Chính'), { target: { value: '  Tết  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tên' }));
    expect(useDataStore.getState().campaigns[0]?.name).toBe('Tết');
    fireEvent.change(screen.getByLabelText('Chiến dịch đang xem'), { target: { value: 'all' } });
    expect(useDataStore.getState().settings.activeCampaignId).toBe('all');
  });

  it('chỉ xoá năm cũ sau khi tải và xác nhận; có thể hoàn tác', async () => {
    render(<ArchiveManager />);
    fireEvent.change(screen.getByLabelText('Năm lưu trữ'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tải bản lưu trữ' }));
    expect(downloadText).toHaveBeenCalledWith(
      expect.stringContaining('2025-10-01'),
      'kpi-archive-2025.json',
      'application/json',
    );
    const dialog = await screen.findByRole('dialog');
    expect(useDataStore.getState().entries).toHaveLength(1);
    const remove = within(dialog).getByRole('button', { name: 'Xoá các dòng đã lưu trữ' });
    expect(remove).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(remove);
    expect(useDataStore.getState().entries).toHaveLength(0);
    act(() => {
      expect(useDataStore.getState().undoLast()).toBe(true);
    });
    expect(useDataStore.getState().entries).toHaveLength(1);
  });

  it('không xoá khi số liệu đổi sau khi tải bản lưu trữ', async () => {
    render(<ArchiveManager />);
    fireEvent.change(screen.getByLabelText('Năm lưu trữ'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tải bản lưu trữ' }));
    await screen.findByRole('dialog');
    act(() => {
      useDataStore.getState().updateEntry('default|2025-10-01', { reach: 2000 });
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá các dòng đã lưu trữ' }));
    expect(useDataStore.getState().entries[0]?.reach).toBe(2000);
  });

  it('giới hạn số dòng DOM với 100.000 dòng và lọc nguồn', () => {
    const template = useDataStore.getState().entries[0]!;
    useDataStore.setState({
      entries: Array.from({ length: 100_000 }, (_, i) => ({ ...template, id: `row-${i}`, source: 'csv' })),
    });
    render(<EntryTable />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '100001');
    expect(screen.getAllByRole('row').length).toBeLessThan(50);
    fireEvent.change(screen.getByLabelText('Nguồn'), { target: { value: 'manual' } });
    expect(screen.getByText('Chưa có số liệu trong khoảng này')).toBeInTheDocument();
  });

  it('dán bảng gộp dòng trùng, hiện lỗi và hoàn tác import', async () => {
    render(
      <ImportDialog
        mode="paste"
        initiallyOpen
        initialText={
          'Ngày\tReach\tClick\tChi phí\tĐơn hàng\n2026-11-01\t100\t10\t1000\t1\n2026-11-01\t200\t20\t2000\t2\n2026-11-02\t-1\t1\t0\t0'
        }
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xem trước bảng' }));
    await screen.findByRole('button', { name: 'Nhập dữ liệu' });
    fireEvent.click(screen.getByRole('button', { name: 'Nhập dữ liệu' }));
    expect(useDataStore.getState().entries.find((e) => e.date === '2026-11-01')?.reach).toBe(300);
    expect(screen.getByRole('button', { name: 'Tải danh sách lỗi CSV' })).toBeInTheDocument();
    expect(screen.getByText(/gộp trong file 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác import' }));
    expect(useDataStore.getState().entries).toHaveLength(1);
  });
});
