import { expect, test } from '@playwright/test';

import { enterRows, prepare } from './helpers/dashboard';

for (const [name, row] of [
  ['click lớn hơn reach', ['2026-11-05', '100', '101', '10000', '1']],
  ['số âm', ['2026-11-05', '-1', '0', '10000', '0']],
  ['ngày tương lai', ['2026-11-07', '100', '10', '10000', '1']],
] as const) {
  test(`QA-04: chặn ${name} và giữ nguyên kho dữ liệu`, async ({ page }) => {
    await prepare(page);
    await enterRows(page, [[...row]]);
    await expect(page.getByText('0 dòng', { exact: true })).toBeVisible();
    await expect(page.getByTestId('entry-form').locator('[aria-invalid="true"]').first()).toBeVisible();
  });
}
test('QA-04: đơn lớn hơn click có cảnh báo nhưng vẫn lưu', async ({ page }) => {
  await prepare(page);
  await enterRows(page, [['2026-11-05', '100', '1', '10000', '2']]);
  await expect(page.getByText('1 dòng', { exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-value-orders')).toHaveText('2');
});
