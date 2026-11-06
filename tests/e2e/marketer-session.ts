/** QA-06: real elapsed 45-minute emulated-phone session, separate from the short CI suite. */
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { chromium, devices, expect } from '@playwright/test';

import { copyReport, enterRows, pasteRows, prepare, sevenDayAssertions, stubAi } from './helpers/dashboard';

async function run() {
  const smoke = process.argv.includes('--smoke');
  const durationMs = smoke ? 60_000 : 45 * 60 * 1000;
  // Playwright cleans test-results before each run: keep long-session evidence elsewhere.
  const output = process.env.QA_ARTIFACT_DIR ?? join(tmpdir(), 'vibecode-qa06', smoke ? 'smoke' : 'session');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.tracing.start({ screenshots: true, snapshots: true });
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const events: Array<{ elapsedMs: number; action: string; ok: boolean; detail?: string }> = [];
  async function step(action: string, operation: () => Promise<void>) {
    try {
      await operation();
      events.push({ elapsedMs: performance.now() - start, action, ok: true });
    } catch (error) {
      events.push({
        elapsedMs: performance.now() - start,
        action,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
      await page.keyboard.press('Escape').catch(() => {});
    }
    await writeFile(
      `${output}/progress.json`,
      JSON.stringify({ startedAt, elapsedMs: performance.now() - start, events, errors }, null, 2),
    );
    process.stdout.write(`${events.at(-1)?.ok ? 'PASS' : 'FAIL'} ${action}\n`);
  }
  try {
    await stubAi(page);
    await step('Nhập tay bảy ngày, KPI và biểu đồ', async () => {
      await prepare(page);
      await enterRows(page);
      await sevenDayAssertions(page);
    });
    await step('Dán một ngày từ Excel', async () => {
      await pasteRows(page, 'Ngày\tReach\tClick\tChi phí\tĐơn hàng\n2026-11-06\t1000\t20\t100000\t2');
    });
    await step('Cố ý nhập click > reach rồi sửa', async () => {
      await page.getByRole('tab', { name: 'Nhập số liệu', exact: true }).click();
      const inputs = page.getByTestId('draft-row').first().locator('input');
      await inputs.nth(1).fill('100');
      await inputs.nth(2).fill('101');
      await inputs.nth(2).blur();
      await expect(page.getByTestId('entry-form')).toContainText(/click không thể lớn hơn reach/i);
      await inputs.nth(2).fill('10');
      await inputs.nth(2).blur();
    });
    await step('Tạo và chuyển chiến dịch', async () => {
      await page.getByRole('tab', { name: 'Dữ liệu', exact: true }).click();
      await page.locator('#new-campaign').fill('QA Marketer');
      await page.getByRole('button', { name: 'Tạo chiến dịch', exact: true }).click();
      await page.locator('#campaign-filter').selectOption({ label: 'QA Marketer' });
      await page.locator('#campaign-filter').selectOption('all');
    });
    let cycle = 0;
    while (performance.now() - start < durationMs) {
      await step(`Vòng ${cycle}: tháng/quý và đọc dự báo`, async () => {
        const grain = cycle % 2 ? 'Tháng' : 'Quý';
        await page
          .getByRole('group', { name: 'Độ chi tiết thời gian' })
          .getByRole('button', { name: grain, exact: true })
          .click();
        await expect(page.getByRole('region', { name: 'Dự báo', exact: true }).locator('article')).toHaveCount(2);
      });
      if (cycle % 3 === 0)
        await step(`Vòng ${cycle}: Live x60`, async () => {
          await page.locator('#live-speed').selectOption('60');
          const toggle = page.getByRole('switch', { name: 'Live mô phỏng' });
          await toggle.click();
          try {
            await page.waitForTimeout(5000);
            await expect(toggle).toHaveAttribute('aria-checked', 'true');
          } finally {
            if ((await toggle.getAttribute('aria-checked')) === 'true') await toggle.click();
          }
        });
      if (cycle % 5 === 0)
        await step(`Vòng ${cycle}: AI và copy/paste báo cáo`, async () => {
          await page.getByRole('button', { name: 'Phân tích lại bằng AI' }).click();
          await expect(page.getByTestId('ai-insight').locator('article.suggestion')).toHaveCount(3);
          const report = await copyReport(page);
          // Paste into an isolated local composer, no outbound Zalo message.
          const composer = await context.newPage();
          try {
            await composer.setContent('<label>Bản nháp gửi Zalo<textarea></textarea></label>');
            await composer.locator('textarea').fill(report);
            // HTML textarea normalizes CRLF/CR to LF; preserve every other character and line.
            await expect(composer.locator('textarea')).toHaveValue(report.replace(/\r\n?/g, '\n'));
          } finally {
            await composer.close();
          }
        });
      if (cycle % 7 === 0)
        await step(`Vòng ${cycle}: reload và kiểm tra bố cục`, async () => {
          await page.reload();
          await expect(page.getByText('8 dòng', { exact: true })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
          await page.screenshot({ path: `${output}/phone-${cycle}.png`, fullPage: true });
        });
      cycle++;
      await page.waitForTimeout(Math.min(30000, Math.max(0, durationMs - (performance.now() - start))));
    }
  } finally {
    await context.tracing.stop({ path: `${output}/trace.zip` });
    await writeFile(
      `${output}/result.json`,
      JSON.stringify(
        {
          startedAt,
          endedAt: new Date().toISOString(),
          elapsedMs: performance.now() - start,
          requestedDurationMs: durationMs,
          events,
          errors,
          mode: 'Chromium iPhone 12 emulation; AI stub; local composer, no Zalo send',
        },
        null,
        2,
      ),
    );
    await browser.close();
    if (errors.length || events.some((event) => !event.ok)) process.exitCode = 1;
  }
}
void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
