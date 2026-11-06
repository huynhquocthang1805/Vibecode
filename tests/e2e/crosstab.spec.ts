import { expect, test } from '@playwright/test';

import { enterRows, prepare } from './helpers/dashboard';

test('QA-04: nhập tab A hội tụ tab B và giữ sau reload', async ({ page, context }) => {
  await prepare(page);
  const other = await context.newPage();
  await prepare(other);
  await enterRows(page, [['2026-11-05', '1000', '20', '100000', '2']]);
  await expect(page.getByText('1 dòng', { exact: true })).toBeVisible();
  test.fail(!process.env.QA_VERIFY_FIXES, 'BUG-QA04-01: startCrossTabSync chưa được gọi trong app');
  await expect(other.getByText('1 dòng', { exact: true })).toBeVisible();
  await expect(other.getByTestId('kpi-value-orders')).toHaveText('2');
  await other.reload();
  await expect(other.getByText('1 dòng', { exact: true })).toBeVisible();
  await other.close();
});
