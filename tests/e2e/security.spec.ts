import { expect, test } from '@playwright/test';

import { prepare } from './helpers/dashboard';

test('QA-07: tên chiến dịch chứa HTML hiển thị nguyên văn, không chạy XSS sau reload', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await prepare(page);
  const name = '<img src=x onerror=alert(1)>';
  await page.getByRole('tab', { name: 'Dữ liệu', exact: true }).click();
  await page.locator('#new-campaign').fill(name);
  await page.getByRole('button', { name: 'Tạo chiến dịch', exact: true }).click();
  await page.locator('#campaign-filter').selectOption({ label: name });
  await expect(page.locator('#campaign-filter option:checked')).toHaveText(name);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await page.waitForTimeout(750); // store persistence debounce
  await page.reload();
  await expect(page.locator('#campaign-filter option:checked')).toHaveText(name);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});
