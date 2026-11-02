import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: process.env.FRONTEND_REVIEW_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.message));
const directory = 'handoffs/FD-01-MVP/screens';
mkdirSync(directory, { recursive: true });
try {
  await page.goto(process.env.FRONTEND_REVIEW_URL ?? 'http://localhost:3002', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await expect(page.getByRole('button', { name: 'Lưu 1 dòng', exact: true })).toBeEnabled();
  await page.screenshot({ path: `${directory}/desktop-empty.png`, fullPage: true });
  await page.getByRole('button', { name: 'Xem giao diện mẫu', exact: true }).click();
  await page.locator('.chart-canvas svg').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${directory}/desktop-preview.png`, fullPage: true });
  await page.getByRole('button', { name: 'Chuyển giao diện tối', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${directory}/desktop-dark.png`, fullPage: true });
  await page.getByRole('button', { name: 'Chuyển giao diện sáng', exact: true }).click();
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1080 });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `Overflow at ${width}px`);
    checks.push(`No horizontal overflow: ${width}px`);
    if (width === 375 || width === 768)
      await page.screenshot({
        path: `${directory}/${width === 375 ? 'mobile' : 'tablet'}-preview.png`,
        fullPage: true,
      });
  }
  await page.getByRole('tab', { name: 'Hiệu quả CTR/CPC/CPA', exact: true }).click();
  await page.locator('.chart-canvas svg').first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${directory}/desktop-ratios.png`, fullPage: true });
  await page.getByRole('button', { name: 'Đóng bản xem trước', exact: true }).click();
  await page.getByRole('button', { name: 'Toàn bộ thời gian', exact: true }).click();
  await page.getByLabel('Từ ngày', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Đến ngày', { exact: true }).fill('2026-10-31');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: '01/10/2026 — 31/10/2026', exact: true }).click();
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  checks.push('Date range selection and reset');
  await page.getByLabel('Ngày ghi nhận', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Lượt tiếp cận', { exact: true }).fill('10.000');
  await page.getByLabel('Lượt click', { exact: true }).fill('250');
  await page.getByLabel('Chi phí (₫)', { exact: true }).fill('1.500.000');
  await page.getByLabel('Đơn hàng', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Lưu 1 dòng', exact: true }).click();
  await page.getByRole('tab', { name: 'Bảng dữ liệu', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  checks.push('Save validated row to store');
  await page.getByRole('button', { name: 'Sửa dòng 2026-11-01', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Lượt tiếp cận', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Lượt tiếp cận', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr')).toContainText('10.000');
  checks.push('Invalid edit blocked; Escape preserves data');
  await page.getByRole('button', { name: 'Xoá dòng 2026-11-01', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  checks.push('Delete and undo');
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Bảng dữ liệu', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  checks.push('Persistence after reload');
  await page.getByRole('tab', { name: 'Dữ liệu', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất backup', exact: true }).click();
  const backup = await downloadEvent;
  assert.match(backup.suggestedFilename(), /^kpi-backup-.*\.json$/);
  checks.push('Backup download');
  await page.getByRole('button', { name: 'Xoá toàn bộ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xác nhận xoá', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Huỷ', exact: true }).click();
  checks.push('Destructive action requires typed confirmation');
  const backupPath = await backup.path();
  assert.ok(backupPath);
  await page.getByRole('button', { name: 'Xoá toàn bộ', exact: true }).click();
  await page.getByLabel('Nhập XOÁ', { exact: true }).fill('XOÁ');
  await page.getByRole('button', { name: 'Xác nhận xoá', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Chọn file sao lưu JSON', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('tab', { name: 'Bảng dữ liệu', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  checks.push('Backup restores saved row after confirmed clear');
  await page.getByRole('tab', { name: 'Import CSV / Dán Excel', exact: true }).click();
  await page.getByRole('button', { name: 'Dán từ Excel / Google Sheets', exact: true }).click();
  await page
    .getByLabel('Nội dung bảng', { exact: true })
    .fill('Ngày\tReach\tClick\tChi phí\tĐơn hàng\n2026-11-01\t1000\t10\t10000\t1');
  await page.getByRole('button', { name: 'Xem trước bảng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('chưa sẵn sàng');
  checks.push('Unavailable import dependency handled without crash');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Xem báo cáo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sao chép', exact: true })).toBeDisabled();
  checks.push('Unavailable report dependency handled without fabricated report');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  checks.push('No page errors or hydration mismatches');
  const result = { passed: true, checks, errors };
  writeFileSync('handoffs/FD-01-MVP/browser-checks.json', JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png`, fullPage: true });
  writeFileSync('handoffs/FD-01-MVP/failure.txt', await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
