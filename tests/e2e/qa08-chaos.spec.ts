import { expect, test } from '@playwright/test';

import type { ManifestPayload } from '../../src/lib/data/storage/partitionCodec';
import { enterRows, prepare } from './helpers/dashboard';

for (const withoutChannel of [false, true]) {
  test(`QA-08: hai tab ghi đồng thời, ${withoutChannel ? 'fallback storage event' : 'BroadcastChannel'}, reload giữ cả hai`, async ({
    page,
    context,
  }) => {
    if (withoutChannel)
      await context.addInitScript(() => {
        Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
      });
    await prepare(page);
    const other = await context.newPage();
    await prepare(other);
    await Promise.all([
      enterRows(page, [['2026-11-05', '1000', '20', '100000', '2']]),
      enterRows(other, [['2026-11-06', '2000', '40', '200000', '4']]),
    ]);
    for (const tab of [page, other]) {
      await expect(tab.getByText('2 dòng', { exact: true })).toBeVisible();
      await expect(tab.getByTestId('kpi-total-reach')).toContainText('3.000');
    }
    // A third page reads the committed storage after both tabs flush on navigation.
    await page.reload();
    await other.reload();
    const reader = await context.newPage();
    await prepare(reader);
    await expect(reader.getByText('2 dòng', { exact: true })).toBeVisible();
    await expect(reader.getByTestId('kpi-total-reach')).toContainText('3.000');
  });
}

test('QA-08 E49: mất partition năm cũ vẫn mở trang, giữ năm lành và báo lỗi lưu trữ', async ({ page }) => {
  await prepare(page);
  await enterRows(page, [
    ['2025-11-05', '1000', '20', '100000', '2'],
    ['2026-11-05', '2000', '40', '200000', '4'],
  ]);
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('kpi-dash:v1'));
      return raw ? Object.keys((JSON.parse(raw) as ManifestPayload).parts ?? {}) : [];
    })
    .toEqual(['2025', '2026']);
  await page.evaluate(() => {
    const raw = localStorage.getItem('kpi-dash:v1');
    if (!raw) throw new Error('Missing committed manifest');
    const manifest = JSON.parse(raw) as ManifestPayload;
    localStorage.removeItem(`kpi-dash:v1:p:2025:${manifest.parts['2025']!.gen}`);
  });
  await page.reload();
  await expect(page.getByTestId('entry-form')).toBeVisible();
  await expect(page.getByText('1 dòng', { exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-total-reach')).toContainText('2.000');
  test.fail(!process.env.QA_VERIFY_FIXES, 'BUG-QA08-06: lỗi partition khi hydration không tới banner người dùng');
  await expect(page.getByRole('alert').filter({ hasText: /2025/ }).first()).toBeVisible();
});
