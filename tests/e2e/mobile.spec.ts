import { expect, test } from '@playwright/test';

import { copyReport, enterRows, prepare, sevenDayAssertions } from './helpers/dashboard';

test('QA-04: happy path 375px không tràn ngang và không lỗi runtime', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 667 });
  await prepare(page);
  await enterRows(page);
  await sevenDayAssertions(page);
  await copyReport(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
