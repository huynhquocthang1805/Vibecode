import { expect, test } from '@playwright/test';

import { enterRows, prepare } from './helpers/dashboard';

test('QA-04: reload ngay sau nhập giữ dữ liệu; xoá và hoàn tác phục hồi KPI', async ({ page }) => {
  await prepare(page);
  await enterRows(page, [['2026-11-05', '1000', '20', '100000', '2']]);
  await expect(page.getByText('1 dòng', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 dòng', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Bảng dữ liệu', exact: true }).click();
  await page.getByTestId('entry-table').getByRole('button', { name: 'Xoá dòng 2026-11-05' }).click();
  await expect(page.getByText('0 dòng', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(page.getByText('1 dòng', { exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-value-orders')).toHaveText('2');
});
