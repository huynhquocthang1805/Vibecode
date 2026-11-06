import { test } from '@playwright/test';

import { copyReport, enterRows, prepare, sevenDayAssertions } from './helpers/dashboard';

test('QA-04: nhập bảy ngày → KPI, bảy kỳ, ba gợi ý và clipboard báo cáo', async ({ page }) => {
  await prepare(page);
  await enterRows(page);
  await sevenDayAssertions(page);
  await copyReport(page);
});
