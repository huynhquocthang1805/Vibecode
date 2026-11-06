import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';

import { chromium, expect, type Page } from '@playwright/test';

import { generate } from '../../scripts/gen-mock';
import { fmtInt } from '../../src/lib/domain/format';
import { type PersistedState } from '../../src/types/domain';
import { prepare, stubAi } from '../e2e/helpers/dashboard';
import { median, options, state } from './benchmark';

export async function seed(page: Page, data: PersistedState) {
  await page.evaluate(async (payload) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('kpi-dash-db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('date', 'date');
        entries.createIndex('campaignId', 'campaignId');
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['entries', 'meta'], 'readwrite');
        const entries = tx.objectStore('entries');
        entries.clear();
        for (const entry of payload.entries) entries.put(entry);
        for (const [key, value] of Object.entries({
          campaigns: payload.campaigns,
          settings: payload.settings,
          version: payload.v,
        }))
          tx.objectStore('meta').put({ key, value });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem('kpi-dash:active-storage', 'indexedDB');
    localStorage.setItem('kpi-dash:v1:settings', JSON.stringify(payload.settings));
  }, data);
}

async function run() {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
  // 50k/200k work is performed in fresh guest contexts; never send load to an API/provider.
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
  const measurements: Array<{ name: string; samples: number[]; median: number; budget: number; pass: boolean }> = [];
  const problems: string[] = [];
  const add = (name: string, samples: number[], budget: number) =>
    measurements.push({ name, samples, median: median(samples), budget, pass: median(samples) < budget });
  try {
    const html = await (await fetch(baseURL)).text();
    const scripts = [
      ...new Set(
        [...html.matchAll(/<script\b[^>]*>/gi)].flatMap(([tag]) => {
          const src = /\bsrc="([^"]+)"/.exec(tag)?.[1];
          return src && !/nomodule/i.test(tag) ? [new URL(src, baseURL).href] : [];
        }),
      ),
    ];
    let firstLoadGzip = 0;
    for (const src of scripts)
      firstLoadGzip += gzipSync(Buffer.from(await (await fetch(src)).arrayBuffer())).byteLength;
    if (scripts.length === 0) throw new Error('No initial script tags found');

    for (const count of [50000, 200000]) {
      const data = state(generate(count, { ...options, campaignCount: 100 }));
      const expectedReach = fmtInt(data.entries.reduce((sum, row) => sum + row.reach, 0));
      const samples: number[] = [];
      const context = await browser.newContext({ baseURL });
      try {
        const page = await context.newPage();
        await stubAi(page);
        await prepare(page);
        await seed(page, data);
        for (let i = 0; i < 5; i++) {
          const started = performance.now();
          await page.reload();
          await expect(page.getByTestId('kpi-total-reach')).toContainText(expectedReach, { timeout: 60000 });
          await expect(page.getByText(`${fmtInt(count)} dòng`, { exact: true })).toBeVisible();
          samples.push(performance.now() - started);
          process.stdout.write(`startup ${count} run ${i + 1}: ${samples.at(-1)}ms\n`);
        }
      } finally {
        await context.close();
      }
      add(`startup ${count} IndexedDB → KPI (warm HTTP cache)`, samples, count === 50000 ? 1200 : 4000);
    }

    const renderSamples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({ baseURL });
      try {
        const page = await context.newPage();
        await stubAi(page);
        await prepare(page);
        const data = state(generate(1095, { ...options, campaignCount: 1 }));
        data.settings.grain = 'quarter';
        await seed(page, data);
        await page.reload();
        const chart = page.getByRole('region', { name: 'Biểu đồ', exact: true });
        await expect(chart.locator('canvas,svg').first()).toBeVisible();
        const dayButton = page
          .getByRole('group', { name: 'Độ chi tiết thời gian' })
          .getByRole('button', { name: 'Ngày', exact: true });
        await dayButton.scrollIntoViewIfNeeded();
        await dayButton.evaluate((button) => {
          button.addEventListener(
            'click',
            () => {
              const started = performance.now();
              const paintTimer = setInterval(() => {
                const chart = document.querySelector('section[aria-label="Biểu đồ"]');
                if (chart?.textContent?.includes('1095 kỳ') && chart.querySelector('canvas')) {
                  clearInterval(paintTimer);
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                      Object.assign(window, { qaChartMs: performance.now() - started });
                    }),
                  );
                }
              }, 16);
            },
            { once: true },
          );
        });
        await dayButton.click();
        await page.waitForFunction(() => typeof (window as unknown as { qaChartMs?: number }).qaChartMs === 'number');
        await expect(chart).toContainText('1095 kỳ');
        await expect(chart.locator('canvas').first()).toBeVisible();
        renderSamples.push(await page.evaluate(() => (window as unknown as { qaChartMs: number }).qaChartMs));
        process.stdout.write(`render run ${i + 1}: ${renderSamples.at(-1)}ms\n`);
      } finally {
        await context.close();
      }
    }
    add('switch quarter → 3y daily chart, includes snapshot + two animation frames', renderSamples, 500);

    const importSamples: number[] = [];
    const maxLongTasks: number[] = [];
    const committed: number[] = [];
    const data = generate(50000, { ...options, campaignCount: 100 });
    const csv = [
      'Ngày,Reach,Click,Chi phí,Đơn hàng',
      ...data.map((row) => `${row.date},${row.reach},${row.clicks},${row.cost},${row.orders}`),
    ].join('\n');
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({ baseURL });
      try {
        const page = await context.newPage();
        await stubAi(page);
        await prepare(page);
        await page.getByRole('tab', { name: 'Import CSV / Dán Excel' }).click();
        await page.getByRole('button', { name: 'Nhập file CSV' }).click();
        await page.evaluate(() => {
          const durations: number[] = [];
          const observer = new PerformanceObserver((list) => {
            durations.push(...list.getEntries().map((entry) => entry.duration));
          });
          observer.observe({ type: 'longtask' });
          Object.assign(window, { qaLongTasks: durations, qaObserver: observer });
        });
        const started = performance.now();
        const dialog = page.getByRole('dialog');
        await dialog
          .getByLabel('Chọn file CSV', { exact: true })
          .setInputFiles({ name: 'qa50k.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await dialog.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText('Đã nhận', { timeout: 60000 });
        importSamples.push(performance.now() - started);
        const report = await dialog.getByRole('status').innerText();
        committed.push(Number(/Đã nhận (\d+) dòng/.exec(report)?.[1]));
        await page.waitForTimeout(500); // drain observer callbacks; not part of import time
        maxLongTasks.push(
          await page.evaluate(() => {
            const measured = window as unknown as { qaLongTasks: number[]; qaObserver: PerformanceObserver };
            measured.qaLongTasks.push(...measured.qaObserver.takeRecords().map((entry) => entry.duration));
            measured.qaObserver.disconnect();
            return Math.max(0, ...measured.qaLongTasks);
          }),
        );
      } finally {
        await context.close();
      }
    }
    add('CSV 50k input rows → commit report (one selected campaign)', importSamples, 3000);
    add('largest observed main-thread Long Task during 50k CSV import', maxLongTasks, 50);
    const result = {
      measuredAt: new Date().toISOString(),
      baseURL,
      browser: browser.version(),
      runs: 5,
      measurements,
      firstLoad: {
        scriptCount: scripts.length,
        gzipBytes: firstLoadGzip,
        budgetBytes: 250 * 1024,
        pass: firstLoadGzip < 250 * 1024,
      },
      csv: {
        inputRows: 50000,
        committedRows: committed,
        note: 'UI assigns one campaign; 100 rows/day collapse to 500 dates. This is 50k input throughput, not 50k unique committed entries.',
      },
      problems,
    };
    await mkdir('test-results', { recursive: true });
    const reportName = new URL(baseURL).hostname.match(/^(localhost|127\.0\.0\.1)$/) ? 'qa05-browser' : 'qa05-deploy';
    await writeFile(`test-results/${reportName}.json`, JSON.stringify(result, null, 2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/tests/perf/browser.ts'))
  void run().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
