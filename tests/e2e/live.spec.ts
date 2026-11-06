import { expect, test } from '@playwright/test';

import { enterRows, prepare } from './helpers/dashboard';

test('QA-04: live x60 tăng KPI hôm nay và cập nhật nowcast', async ({ page }) => {
  await prepare(page);
  await enterRows(page);
  const forecast = page.getByRole('region', { name: 'Dự báo', exact: true });
  await expect(forecast.locator('article')).toHaveCount(2);
  const previous = await forecast.locator('article').first().innerText();
  const reachBefore = Number((await page.getByTestId('kpi-value-reach').innerText()).replace(/\D/g, ''));
  await page.locator('#live-speed').selectOption('60');
  await page.getByRole('switch', { name: 'Live mô phỏng' }).click();
  try {
    await expect(page.getByText('8 dòng', { exact: true })).toBeVisible();
    await expect
      .poll(async () => Number((await page.getByTestId('kpi-value-reach').innerText()).replace(/\D/g, '')))
      .toBeGreaterThan(reachBefore);
    await expect.poll(() => forecast.locator('article').first().innerText(), { timeout: 15000 }).not.toBe(previous);
  } finally {
    await page.getByRole('switch', { name: 'Live mô phỏng' }).click();
  }
});
