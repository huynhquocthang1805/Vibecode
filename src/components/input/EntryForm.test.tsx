import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';

import { EntryForm } from './EntryForm';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

beforeEach(async () => {
  await Promise.resolve();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T03:00:00Z'));
  useDataStore.setState({
    hydrated: true,
    entries: [],
    checksum: { rows: 0, reach: 0, clicks: 0, cost: 0, orders: 0 },
    settings: { ...DEFAULT_SETTINGS },
    campaigns: [{ id: 'default', name: 'Chiến dịch chính', createdAt: 0 }],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function fill(values: { reach?: string; clicks?: string; cost?: string; orders?: string } = {}) {
  fireEvent.change(screen.getByLabelText('Lượt tiếp cận'), { target: { value: values.reach ?? '10.000' } });
  fireEvent.change(screen.getByLabelText('Lượt click'), { target: { value: values.clicks ?? '250' } });
  fireEvent.change(screen.getByLabelText('Chi phí (₫)'), { target: { value: values.cost ?? '1.500.000' } });
  fireEvent.change(screen.getByLabelText('Đơn hàng'), { target: { value: values.orders ?? '12' } });
}

function addExisting() {
  useDataStore
    .getState()
    .addEntries([{ campaignId: 'default', date: '2026-11-02', reach: 1000, clicks: 100, cost: 100000, orders: 3 }]);
}

describe('FI-01 — form nhập số liệu thật', () => {
  it('lưu số có phân cách nghìn, gọi callback và đặt lại bản nháp', () => {
    const onSubmitted = vi.fn();
    render(<EntryForm onSubmitted={onSubmitted} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 1 dòng' }));
    expect(useDataStore.getState().entries[0]).toMatchObject({
      date: '2026-11-02',
      reach: 10000,
      clicks: 250,
      cost: 1500000,
      orders: 12,
    });
    expect(onSubmitted).toHaveBeenCalledWith(1);
    expect(screen.getByLabelText('Lượt tiếp cận')).toHaveValue('');
  });
  it('không cho nhập trước khi dữ liệu thiết bị tải xong', () => {
    useDataStore.setState({ hydrated: false });
    render(<EntryForm />);
    expect(screen.getByRole('button', { name: 'Lưu 1 dòng' })).toBeDisabled();
  });
  it('chặn số âm và gắn lỗi vào đúng ô, không ghi store', () => {
    render(<EntryForm />);
    fill({ cost: '-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 1 dòng' }));
    expect(screen.getByLabelText('Chi phí (₫)')).toHaveAttribute('aria-invalid', 'true');
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
  it('chặn click lớn hơn reach', () => {
    render(<EntryForm />);
    fill({ reach: '100', clicks: '101' });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 1 dòng' }));
    expect(screen.getByLabelText('Lượt click')).toHaveAttribute('aria-invalid', 'true');
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
  it('dán bảng mở preview với nguyên văn dữ liệu, chưa ghi store', async () => {
    render(<EntryForm />);
    const text = 'Ngày\tReach\tClick\tChi phí\tĐơn hàng\n2026-11-01\t1000\t10\t10000\t1';
    fireEvent.paste(screen.getByTestId('entry-form'), { clipboardData: { getData: () => text } });
    const dialog = await screen.findByRole('dialog', {}, { timeout: 10_000 });
    expect(within(dialog).getByLabelText('Nội dung bảng')).toHaveValue(text);
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
  it('giữ nguyên dữ liệu khi huỷ hộp thoại trùng ngày', async () => {
    addExisting();
    render(<EntryForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 1 dòng' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(useDataStore.getState().entries[0]?.reach).toBe(1000);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng' }));
    expect(useDataStore.getState().entries[0]?.reach).toBe(1000);
    expect(screen.getByLabelText('Lượt tiếp cận')).toHaveValue('10.000');
  });
  it('cộng dồn ngày trùng sau khi người dùng lựa chọn', async () => {
    addExisting();
    render(<EntryForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 1 dòng' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Cộng dồn' }));
    expect(useDataStore.getState().entries).toHaveLength(1);
    expect(useDataStore.getState().entries[0]).toMatchObject({ reach: 11000, clicks: 350, cost: 1600000, orders: 15 });
  });
  it('không ghi một phần batch khi còn trùng ngày chưa xử lý', async () => {
    addExisting();
    render(<EntryForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dòng' }));
    const second = screen.getAllByTestId('draft-row')[1]!;
    fireEvent.change(within(second).getByLabelText('Ngày ghi nhận'), { target: { value: '2026-11-01' } });
    for (const label of ['Lượt tiếp cận', 'Lượt click', 'Chi phí (₫)', 'Đơn hàng'])
      fireEvent.change(within(second).getByLabelText(label), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 2 dòng' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(useDataStore.getState().entries).toHaveLength(1);
  });
  it('hiển thị cảnh báo nhưng vẫn cho lưu đơn lớn hơn click', () => {
    render(<EntryForm />);
    fill({ orders: '300' });
    fireEvent.blur(screen.getByLabelText('Đơn hàng'));
    expect(screen.getByText(/Số đơn lớn hơn số click/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 1 dòng' }));
    expect(useDataStore.getState().entries[0]?.orders).toBe(300);
  });
  it('tạo thêm 7 dòng và chặn ngày tương lai trước khi lưu', () => {
    render(<EntryForm />);
    fireEvent.click(screen.getByRole('button', { name: '+7 ngày' }));
    expect(screen.getAllByTestId('draft-row')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu 8 dòng' }));
    expect(screen.getAllByText('Không nhập số liệu cho ngày trong tương lai')).toHaveLength(7);
    expect(useDataStore.getState().entries).toHaveLength(0);
  });
});
