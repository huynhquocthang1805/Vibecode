import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

import { chromium, expect } from '@playwright/test';

const fixture = JSON.parse(readFileSync('src/components/dashboard/reviewFixture.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: process.env.FRONTEND_REVIEW_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
const checks = [];
const fixtureChunks = new Set();
const insightRequests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/api/insights')) insightRequests.push(request.postDataJSON());
});
page.on('response', async (response) => {
  if (!response.url().includes('/_next/static/chunks/') || !response.url().endsWith('.js')) return;
  const source = await response.text().catch(() => '');
  if (source.includes('default|2026-10-03') && source.includes('28652')) fixtureChunks.add(response.url());
});
const dialog = page.getByRole('dialog');
try {
  await page.goto(process.env.FRONTEND_REVIEW_URL ?? 'http://localhost:3003', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Lưu 1 dòng', exact: true })).toBeEnabled();
  assert.equal(fixtureChunks.size, 0, 'Fixture must not load before preview');
  await expect(page.locator('.workspace-profile')).toContainText('Tất cả chiến dịch');
  await expect(page.locator('.workspace-profile')).not.toContainText('Minh Trường');
  await page.getByLabel('Lọc chiến dịch', { exact: true }).selectOption('default');
  await expect(page.locator('.workspace-profile')).toContainText('Chiến dịch chính');
  checks.push('R-05 campaign label follows selection; no personal identity');

  await page.getByRole('button', { name: 'Xem giao diện mẫu', exact: true }).click();
  await expect(page.getByTestId('kpi-value-orders')).toHaveText(String(fixture.trend.comparison.current.orders));
  await expect(page.locator('.chart-canvas svg')).toHaveCount(1);
  await expect.poll(() => fixtureChunks.size).toBe(1);
  await expect(page.getByRole('button', { name: 'Phân tích lại bằng AI' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Hiệu quả CTR/CPC/CPA', exact: true }).click();
  await expect(page.locator('.chart-canvas svg')).toHaveCount(1);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth), {
        message: `Overflow at ${width}px`,
      })
      .toBe(false);
  }
  checks.push('Preview fixture loads on click; small charts SVG; no overflow at 375/768/1440px');
  await page.getByRole('button', { name: 'Đóng bản xem trước', exact: true }).click();
  await page.getByRole('button', { name: 'Xem giao diện mẫu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đóng bản xem trước', exact: true })).toBeVisible();
  assert.equal(fixtureChunks.size, 1, 'Second preview reuses the loaded module');
  await page.getByRole('button', { name: 'Đóng bản xem trước', exact: true }).click();

  await page.getByRole('button', { name: 'Toàn bộ thời gian', exact: true }).click();
  await dialog.getByLabel('Từ ngày', { exact: true }).fill('2026-10-29');
  await dialog.getByLabel('Đến ngày', { exact: true }).fill('2026-10-31');
  await dialog.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  const form = page.getByTestId('entry-form');
  await form.getByRole('button', { name: 'Thêm dòng', exact: true }).click();
  await form.getByRole('button', { name: 'Thêm dòng', exact: true }).click();
  const rows = form.getByTestId('draft-row');
  const values = [
    ['2026-10-29', '10000', '200', '1000000', '10'],
    ['2026-10-30', '12000', '300', '1500000', '12'],
    ['2026-10-31', '9000', '180', '1200000', '6'],
  ];
  for (let i = 0; i < values.length; i++)
    for (let j = 0; j < 5; j++) await rows.nth(i).locator('input').nth(j).fill(values[i][j]);
  await form.getByRole('button', { name: 'Lưu 3 dòng', exact: true }).click();
  await expect(page.getByTestId('kpi-value-orders')).toHaveText('6');
  await expect(page.getByTestId('kpi-total-orders')).toContainText('Tổng kỳ đã chọn: 28');
  await expect(page.getByTestId('kpi-value-ctr')).toHaveText('2,00%');
  await expect(page.getByTestId('kpi-total-ctr')).toContainText('2,19%');
  checks.push('R-01 real input: current=6 orders/2.00% CTR; selected total=28 orders/2.19% CTR');
  await page.getByRole('button', { name: 'Xem báo cáo', exact: true }).click();
  await expect(dialog).toContainText('Tạo báo cáo chưa sẵn sàng');
  await expect(dialog.getByRole('button', { name: 'Sao chép', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'Bảng dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Sửa dòng 2026-10-31', exact: true }).click();
  await dialog.getByLabel('Lượt tiếp cận', { exact: true }).fill('-1');
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(dialog.getByLabel('Lượt tiếp cận', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody')).toContainText('9.000');
  await page.getByRole('tab', { name: 'Dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Dùng dữ liệu mẫu', exact: true }).click();
  await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await page.getByRole('button', { name: 'Xoá toàn bộ', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Xác nhận xoá', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
  checks.push(
    'Deferred dialogs: range, report dependency state, edit validation/Escape, demo cancel, typed clear guard',
  );

  await page.getByRole('button', { name: '29/10/2026 — 31/10/2026', exact: true }).click();
  await dialog.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await dialog.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  const entries = [];
  const firstDay = Date.UTC(2023, 10, 6);
  for (let i = 0; i < 1095; i++) {
    const date = new Date(firstDay + i * 86400000).toISOString().slice(0, 10);
    entries.push({ date, campaignId: 'default', reach: 10000 + (i % 7) * 100, clicks: 200, cost: 1000000, orders: 10 });
  }
  await page.getByLabel('Chọn file sao lưu JSON', { exact: true }).setInputFiles({
    name: 'frontend-1095-days.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ entries })),
  });
  await page.getByRole('tab', { name: 'Khối lượng', exact: true }).click();
  await expect(page.locator('.chart-canvas canvas')).toHaveCount(1, { timeout: 20000 });
  await expect(page.locator('.chart-canvas svg')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Hiệu quả CTR/CPC/CPA', exact: true }).click();
  await expect(page.locator('.chart-canvas canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Chuyển giao diện tối', exact: true }).click();
  await expect(page.locator('.chart-canvas canvas')).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  checks.push('1095 daily buckets: Canvas for both chart tabs, dark theme and 375px resize');
  assert.deepEqual(errors, []);
  const result = {
    checks,
    pageErrors: errors,
    fixtureChunks: [...fixtureChunks],
    knownRemaining: {
      insufficientInsightRequestsFromPageCaller: insightRequests.filter(
        (request) => !request?.trend?.dataQuality?.sufficient,
      ).length,
      report: 'AI-08 remains a dependency; copy/download disabled while unavailable',
    },
  };
  writeFileSync('handoffs/FD-10/browser-checks.json', JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  process.stderr.write(
    JSON.stringify(
      await page.evaluate(() => ({
        resources: performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.includes('chunks')),
        chart: document.querySelector('.chart-canvas')?.innerHTML.slice(0, 700),
      })),
      null,
      2,
    ) + '\n',
  );
  process.stderr.write(
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll('.chart-canvas, .echarts-for-react, .chart-canvas svg')].map((element) => ({
          tag: element.tagName,
          style: element.getAttribute('style'),
          width: element.getBoundingClientRect().width,
          scroll: element.scrollWidth,
        })),
      ),
      null,
      2,
    ) + '\n',
  );
  process.stderr.write(
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 30)
          .map((element) => ({
            tag: element.tagName,
            class: element.className?.baseVal ?? element.className,
            width: element.getBoundingClientRect().width,
            text: element.textContent?.slice(0, 90),
          })),
      ),
      null,
      2,
    ) + '\n',
  );
  await page.screenshot({ path: 'handoffs/FD-10/mobile-debug.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
