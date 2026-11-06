import { expect, test } from '@playwright/test';

import { loadCampaign2y, prepare } from './helpers/dashboard';

for (const [grain, expected] of [
  ['Tháng', 'Dự kiến cuối tháng'],
  ['Quý', 'Dự kiến cuối quý'],
] as const) {
  test(`QA-04: hai năm dữ liệu chuyển ${grain} có nowcast cuối kỳ`, async ({ page }) => {
    await prepare(page);
    await loadCampaign2y(page);
    const forecast = page.getByRole('region', { name: 'Dự báo', exact: true });
    const button = page
      .getByRole('group', { name: 'Độ chi tiết thời gian' })
      .getByRole('button', { name: grain, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(forecast).toContainText('Dự kiến cuối tháng', { timeout: 20000 });
    await expect(forecast).toContainText(expected);
    await expect(forecast.locator('progress').first()).toBeVisible();
  });
}
