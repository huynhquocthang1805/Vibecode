import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';

import { generate } from '../../scripts/gen-mock';
import { addDays } from '../../src/lib/domain/dates';
import { fmtInt } from '../../src/lib/domain/format';
import { LIMITS } from '../../src/types/domain';
import { prepare, stubAi } from '../e2e/helpers/dashboard';
import { median, options, state, TODAY } from './benchmark';
import { seed } from './browser';
import type {} from './qa08-module-browser';

const output = process.env.QA_ARTIFACT_DIR ?? join(tmpdir(), 'vibecode-qa08', 'scale');
async function run() {
  await mkdir(output, { recursive: true });
  const compiled = await build({
    entryPoints: ['tests/perf/qa08-module-browser.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    tsconfig: 'tsconfig.json',
  });
  const browser = await chromium.launch();
  const results: unknown[] = [];
  try {
    for (const count of [50000, LIMITS.MAX_ROWS_TOTAL]) {
      const data = state(generate(count, { ...options, today: addDays(TODAY, 1), endDate: TODAY, campaignCount: 100 }));
      const context = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'http://localhost:3000' });
      try {
        const page = await context.newPage();
        const modules = await context.newPage();
        await modules.route('**/qa08-harness', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<main>QA isolated module benchmark</main>' }),
        );
        await modules.goto('/qa08-harness');
        await modules.addScriptTag({ content: compiled.outputFiles[0]!.text });
        const kind = count === 50000 ? 'localStorage' : 'indexedDB';
        await modules.evaluate(({ data, kind }) => window.qa08Module.setup(data, kind), { data, kind } as const);
        const cdp = await context.newCDPSession(modules);
        await cdp.send('Performance.enable');
        const snapshots: number[] = [],
          storageCpu: number[] = [],
          storageWall: number[] = [];
        for (let i = 0; i < 5; i++) {
          snapshots.push(await modules.evaluate(() => window.qa08Module.tick()));
          const before = (await cdp.send('Performance.getMetrics')).metrics.find(
            (metric) => metric.name === 'TaskDuration',
          )!.value;
          storageWall.push(await modules.evaluate(() => window.qa08Module.save()));
          const after = (await cdp.send('Performance.getMetrics')).metrics.find(
            (metric) => metric.name === 'TaskDuration',
          )!.value;
          storageCpu.push((after - before) * 1000);
        }
        const durability = await modules.evaluate(() => window.qa08Module.verify());
        await modules.close();

        const startup: number[] = [],
          update: number[] = [],
          csvTimes: number[] = [],
          longTasks: number[] = [],
          commits: number[] = [];
        await stubAi(page);
        await prepare(page);
        for (let i = 0; i < 5; i++) {
          await seed(page, data);
          const expected = fmtInt(data.entries.reduce((sum, row) => sum + row.reach, 0));
          const started = Date.now();
          await page.reload();
          await expect(page.getByTestId('kpi-total-reach')).toContainText(expected, { timeout: 60000 });
          startup.push(Date.now() - started);
          const form = page.getByTestId('entry-form');
          await form.locator('select').selectOption(data.campaigns[0]!.id);
          const inputs = form.getByTestId('draft-row').first().locator('input');
          for (const [j, value] of [TODAY, '1000', '20', '100000', '2'].entries()) await inputs.nth(j).fill(value);
          await inputs.last().blur();
          await form.getByRole('button', { name: 'Lưu 1 dòng', exact: true }).click();
          const button = page.getByRole('dialog').getByRole('button', { name: 'Cộng dồn', exact: true });
          await button.evaluate((element) => element.setAttribute('data-qa-save', '1'));
          const nextReach = fmtInt(data.entries.reduce((sum, row) => sum + row.reach, 1000));
          await page.evaluate(`document.querySelector('[data-qa-save]').addEventListener('click', () => {
            const start = performance.now();
            const observer = new MutationObserver(() => {
              if (document.querySelector('[data-testid="kpi-total-reach"]').textContent.includes('${nextReach}')) {
                observer.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => { window.qaUpdateMs = performance.now() - start; }));
              }
            }); observer.observe(document.body, { subtree:true, childList:true, characterData:true });
          }, { once:true })`);
          await button.click();
          await expect
            .poll(() => page.evaluate(() => (window as unknown as { qaUpdateMs?: number }).qaUpdateMs), {
              timeout: 20000,
            })
            .toBeGreaterThan(0);
          update.push(await page.evaluate(() => (window as unknown as { qaUpdateMs: number }).qaUpdateMs));
        }
        await context.close();
        // Each CSV run starts empty. One selected campaign collapses 100 rows/date; report that limitation.
        const csv = [
          'Ngày,Reach,Click,Chi phí,Đơn hàng',
          ...data.entries.map((row) => `${row.date},${row.reach},${row.clicks},${row.cost},${row.orders}`),
        ].join('\n');
        for (let i = 0; i < 5; i++) {
          const csvContext = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'http://localhost:3000' });
          try {
            const csvPage = await csvContext.newPage();
            await stubAi(csvPage);
            await prepare(csvPage);
            await csvPage.getByRole('tab', { name: 'Import CSV / Dán Excel' }).click();
            await csvPage.getByRole('button', { name: 'Nhập file CSV' }).click();
            await csvPage.evaluate(
              `window.qaTasks=[]; window.qaObserver=new PerformanceObserver(list=>window.qaTasks.push(...list.getEntries().map(e=>e.duration)));window.qaObserver.observe({type:'longtask'});`,
            );
            const start = Date.now();
            const dialog = csvPage.getByRole('dialog');
            await dialog
              .getByLabel('Chọn file CSV', { exact: true })
              .setInputFiles({ name: 'scale.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
            await dialog.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
            await expect(dialog.getByRole('status')).toContainText('Đã nhận', { timeout: 60000 });
            csvTimes.push(Date.now() - start);
            commits.push(Number(/Đã nhận (\d+) dòng/.exec(await dialog.getByRole('status').innerText())?.[1]));
            await csvPage.waitForTimeout(500);
            longTasks.push(
              await csvPage.evaluate(() => Math.max(0, ...(window as unknown as { qaTasks: number[] }).qaTasks)),
            );
          } finally {
            await csvContext.close();
          }
        }
        const result = {
          count,
          kind,
          startup,
          startupMedian: median(startup),
          update,
          updateMedian: median(update),
          snapshots,
          snapshotMedian: median(snapshots),
          storageCpu,
          storageCpuMedian: median(storageCpu),
          storageWall,
          storageWallMedian: median(storageWall),
          durability,
          csvTimes,
          csvMedian: median(csvTimes),
          longTasks,
          longTaskMedian: median(longTasks),
          committedCsvRows: commits,
        };
        results.push(result);
        await writeFile(join(output, `${count}.json`), JSON.stringify(result, null, 2));
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } finally {
        await context.close();
      }
    }
    await writeFile(
      join(output, 'result.json'),
      JSON.stringify({ measuredAt: new Date().toISOString(), browser: browser.version(), results }, null, 2),
    );
  } finally {
    await browser.close();
  }
}
void run().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
