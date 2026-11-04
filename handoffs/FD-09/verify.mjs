import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

import { chromium, expect } from '@playwright/test';

mkdirSync('docs/screens', { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  reducedMotion: 'reduce',
});
const errors = [];
const checks = [];
page.on('pageerror', (e) => errors.push(e.message));
// Không gọi provider thật khi kiểm thử giao diện.
await page.route('**/api/insights', (route) =>
  route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'TEST_PROVIDER_UNAVAILABLE' }),
  }),
);
try {
  await page.goto(process.argv[2] ?? 'http://localhost:3100');
  await page.getByRole('button', { name: 'Xem giao diện mẫu' }).click();
  await expect(page.getByRole('button', { name: 'Đóng bản xem trước' })).toBeVisible();
  await expect(page.locator('.chart-canvas svg').first()).toBeVisible();
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `docs/screens/FD-09-${width}.png`, fullPage: true });
    checks.push({ viewport: width, noOverflow: true });
  }
  await page.getByRole('button', { name: 'Đóng bản xem trước' }).click();
  await page.locator('.mobile-fab').click();
  const dialog = page.getByRole('dialog', { name: 'Nhập số liệu' });
  await expect(dialog).toBeVisible();
  const rect = await dialog.boundingBox();
  assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= 376, JSON.stringify(rect));
  const ids = await page.locator('input[id]').evaluateAll((els) => els.map((el) => el.id));
  assert.equal(new Set(ids).size, ids.length, 'Input ids must be unique across inline form and sheet');
  await dialog.getByLabel('Lượt tiếp cận').fill('1000');
  await dialog.getByLabel('Lượt click').fill('100');
  await dialog.getByLabel('Chi phí (₫)').fill('100000');
  await dialog.getByLabel('Đơn hàng', { exact: true }).fill('5');
  await page.screenshot({ path: 'docs/screens/FD-08-mobile-sheet.png' });
  await dialog.getByRole('button', { name: 'Lưu 1 dòng' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('kpi-value-orders')).toContainText('5');
  checks.push('Mobile sheet within viewport; unique input IDs; accessible labels; save updates real KPI');
  await page.getByRole('switch', { name: 'Live mô phỏng' }).click();
  await expect(page.getByTestId('kpi-value-reach')).not.toHaveText('1.000', { timeout: 10000 });
  await page.getByRole('switch', { name: 'Live mô phỏng' }).click();
  checks.push('Live simulator adds real data and stops via switch');
  await page.getByRole('tab', { name: 'Dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Dùng dữ liệu mẫu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nạp dữ liệu mẫu' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Dự báo', exact: true })
      .getByText(/Khoảng 80%/)
      .first(),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Tuần', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tuần', exact: true })).toHaveAttribute('aria-pressed', 'true');
  checks.push('Real demo nowcasts show 80% intervals; weekly grain switches through settings');
  await page.getByRole('button', { name: 'Chuyển giao diện tối' }).click();
  await page.screenshot({ path: 'docs/screens/FD-08-dark-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Xem giao diện mẫu' }).click();
  await expect(page.locator('.chart-canvas svg').first()).toBeVisible();
  await page.screenshot({ path: 'docs/screens/FD-08-dark-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync(
    'handoffs/FD-09/browser-checks.json',
    JSON.stringify(
      {
        checks,
        pageErrors: errors,
        url: process.argv[2] ?? 'http://localhost:3100',
        note: 'AI endpoint stubbed 503 to exercise fallback without calling provider; not Lighthouse/perf certification.',
      },
      null,
      2,
    ),
  );
  process.stdout.write(JSON.stringify({ checks, pageErrors: errors }) + '\n');
} finally {
  await browser.close();
}
