import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { toast, type Action } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';

import { DataManager } from './DataManager';
import { EntryTable } from './EntryTable';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

beforeEach(async () => {
  await Promise.resolve();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T03:00:00Z'));
  useDataStore.setState({
    hydrated: true,
    entries: [],
    checksum: { rows: 0, reach: 0, clicks: 0, cost: 0, orders: 0 },
    settings: { ...DEFAULT_SETTINGS },
    campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: 0 }],
  });
  useDataStore
    .getState()
    .addEntries([{ date: '2026-11-01', campaignId: 'default', reach: 1000, clicks: 0, cost: 0, orders: 0 }]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FI-02 — bảng dữ liệu', () => {
  it('hiển thị KPI null bằng gạch và không có NaN khi số đơn/click bằng 0', () => {
    const { container } = render(<EntryTable />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
  it('lọc ngày và hiển thị trạng thái không tìm thấy', () => {
    render(<EntryTable />);
    fireEvent.change(screen.getByLabelText('Từ'), { target: { value: '2026-11-02' } });
    expect(screen.getByText('Chưa có số liệu trong khoảng này')).toBeInTheDocument();
  });
  it('xoá dòng và có thể hoàn tác qua hành động trong thông báo', () => {
    render(<EntryTable />);
    fireEvent.click(screen.getByRole('button', { name: 'Xoá dòng 2026-11-01' }));
    expect(useDataStore.getState().entries).toHaveLength(0);
    const action = vi.mocked(toast.success).mock.calls.at(-1)?.[1]?.action as Action;
    render(<button onClick={action.onClick}>Hoàn tác thử</button>);
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác thử' }));
    expect(useDataStore.getState().entries[0]?.reach).toBe(1000);
  });
  it('không ghi số âm khi sửa, giữ hộp thoại và lỗi inline', () => {
    render(<EntryTable />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa dòng 2026-11-01' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Lượt tiếp cận'), { target: { value: '-5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(within(dialog).getByLabelText('Lượt tiếp cận')).toHaveAttribute('aria-invalid', 'true');
    expect(useDataStore.getState().entries[0]?.reach).toBe(1000);
  });
  it('lưu dữ liệu chỉnh sửa hợp lệ từ dialog', () => {
    render(<EntryTable />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa dòng 2026-11-01' }));
    fireEvent.change(screen.getByLabelText('Lượt tiếp cận'), { target: { value: '2.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useDataStore.getState().entries[0]?.reach).toBe(2000);
  });
});

describe('FI-05 — quản lý dữ liệu', () => {
  it('chỉ cho xoá toàn bộ khi gõ chính xác XOÁ', async () => {
    render(<DataManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Xoá toàn bộ' }));
    const confirm = screen.getByRole('button', { name: 'Xác nhận xoá' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nhập XOÁ'), { target: { value: 'xoa' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nhập XOÁ'), { target: { value: 'XOÁ' } });
    await act(async () => fireEvent.click(confirm));
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
  it('huỷ nạp dữ liệu mẫu không làm mất dòng đang có', () => {
    render(<DataManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Dùng dữ liệu mẫu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(useDataStore.getState().entries[0]?.reach).toBe(1000);
  });
  it('tạo chiến dịch qua store và hiển thị tên đã bỏ khoảng trắng', () => {
    render(<DataManager />);
    fireEvent.change(screen.getByLabelText('Tên chiến dịch mới'), { target: { value: '  Black Friday  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }));
    expect(useDataStore.getState().campaigns.at(-1)?.name).toBe('Black Friday');
  });
  it('thông báo rõ khi không thể lưu ngoài tab', () => {
    useDataStore.setState({ storage: { kind: 'memory', usedBytes: 0, quotaBytes: 0 } });
    render(<DataManager />);
    expect(screen.getByRole('alert')).toHaveTextContent('Xuất sao lưu trước khi đóng tab');
    expect(screen.getByText(/0,00% dung lượng/)).toBeInTheDocument();
  });
});
