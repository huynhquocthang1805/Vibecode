import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';

import { DateRangeControl } from './DateRangeControl';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T03:00:00Z'));
  useDataStore.setState({ hydrated: true, settings: { ...DEFAULT_SETTINGS } });
});

describe('Bộ chọn khoảng ngày', () => {
  it('không chấp nhận khoảng đảo ngược', async () => {
    render(<DateRangeControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Toàn bộ thời gian' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(useDataStore.getState().settings.range).toBeNull();
  });
  it('lưu khoảng hợp lệ và cho bỏ lọc về tất cả', async () => {
    render(<DateRangeControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Toàn bộ thời gian' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(useDataStore.getState().settings.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    fireEvent.click(screen.getByRole('button', { name: '01/10/2026 — 31/10/2026' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(useDataStore.getState().settings.range).toBeNull();
  });
});
