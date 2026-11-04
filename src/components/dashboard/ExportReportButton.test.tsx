import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, useDataStore } from '@/lib/data/store';
import { buildReport } from '@/lib/report/buildReport';
import type { AnalyticsSnapshot } from '@/types/domain';

import { ExportReportButton } from './ExportReportButton';
import fixture from './reviewFixture.json';

vi.mock('@/lib/report/buildReport', () => ({ buildReport: vi.fn() }));
const snapshot = fixture as AnalyticsSnapshot;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FD-06 — xuất báo cáo', () => {
  it('không cho sao chép/tải khi chưa có snapshot', async () => {
    render(<ExportReportButton snapshot={null} insight={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    expect(screen.getByRole('button', { name: 'Sao chép' })).toBeDisabled();
    expect(buildReport).not.toHaveBeenCalled();
  });
  it('hiển thị trạng thái chờ khi module báo cáo chưa sẵn sàng, không làm trắng trang', async () => {
    vi.mocked(buildReport).mockImplementation(() => {
      throw new Error('NOT_IMPLEMENTED: AI-08');
    });
    render(<ExportReportButton snapshot={snapshot} insight={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    expect(screen.getByRole('status')).toHaveTextContent('Tạo báo cáo chưa sẵn sàng');
    expect(screen.getByRole('button', { name: 'Tải .txt' })).toBeDisabled();
  });
  it('đổi định dạng qua settings và cập nhật bản xem trước', async () => {
    useDataStore.setState({ settings: { ...DEFAULT_SETTINGS } });
    vi.mocked(buildReport).mockImplementation((input) => `Báo cáo ${input.format}`);
    render(<ExportReportButton snapshot={snapshot} insight={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }));
    await screen.findByRole('dialog', {}, { timeout: 10_000 });
    expect(screen.getByText('Báo cáo short', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đầy đủ · Email' }));
    expect(screen.getByText('Báo cáo full', { exact: true })).toBeInTheDocument();
    expect(useDataStore.getState().settings.reportFormat).toBe('full');
  });
});
