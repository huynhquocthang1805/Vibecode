import { expect, test } from '@playwright/test';

import { addDays } from '../../src/lib/domain/dates';
import { pasteRows, prepare } from './helpers/dashboard';

test('QA-04: CSV 1000 dòng nhận 990, báo đúng 10 lỗi rồi dán TSV', async ({ page }) => {
  await prepare(page);
  const csv = [
    'Ngày,Reach,Click,Chi phí,Đơn hàng',
    ...Array.from({ length: 1000 }, (_, i) => `${addDays('2023-01-01', i)},1000,${i % 100 === 0 ? 1001 : 20},100000,2`),
  ].join('\n');
  await page.getByRole('tab', { name: 'Import CSV / Dán Excel' }).click();
  await page.getByRole('button', { name: 'Nhập file CSV' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Chọn file CSV', { exact: true })
    .setInputFiles({ name: 'qa-1000.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await dialog.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Đã nhận 990 dòng · từ chối 10');
  await page.keyboard.press('Escape');
  await pasteRows(page, 'Ngày\tReach\tClick\tChi phí\tĐơn hàng\n2026-11-05\t2000\t40\t200000\t4');
  await expect(page.getByText('991 dòng', { exact: true })).toBeVisible();
});
