/** E48: ten real elapsed minutes per scale; artifacts outside Playwright's cleaned output. */
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium, expect } from '@playwright/test';

import { generate } from '../../scripts/gen-mock';
import { safeDiv } from '../../src/lib/domain/kpi';
import { addDays } from '../../src/lib/domain/dates';
import { LIMITS } from '../../src/types/domain';
import { stubAi } from '../e2e/helpers/dashboard';
import { options, state, TODAY } from './benchmark';
import { seed } from './browser';

const output = process.env.QA_ARTIFACT_DIR ?? join(tmpdir(), 'vibecode-qa08', 'live');
const durationMs = process.argv.includes('--smoke') ? 20000 : 10 * 60 * 1000;

async function deadline<T>(operation: Promise<T>, label: string, timeoutMs = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const lifecycle: Array<{ event: string; at: string }> = [];
  browser.on('disconnected', () => lifecycle.push({ event: 'browser disconnected', at: new Date().toISOString() }));
  try {
    const results = await Promise.all(
      [50000, LIMITS.MAX_ROWS_TOTAL].map(async (count) => {
        const context = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'http://localhost:3000' });
        const page = await context.newPage();
        const errors: string[] = [];
        const samplingErrors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('crash', () => errors.push(`page crash at ${new Date().toISOString()}`));
        await context.addInitScript(`(() => {
        const commits = [];
        const durations = [];
        window.qaLive = { commits, durations };
        const transaction = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
          const tx = transaction.apply(this, args);
          if (tx.mode === 'readwrite' && Array.from(tx.objectStoreNames).includes('entries')) {
            const start = performance.now();
            tx.addEventListener('complete', () => { commits.push(performance.now()); durations.push(performance.now() - start); });
          }
          return tx;
        };
      })()`);
        try {
          await stubAi(page);
          // Date must advance: fixed Date would artificially starve PERSIST_MAX_WAIT_MS.
          await page.clock.setSystemTime(new Date(`${TODAY}T05:00:00Z`));
          await page.goto('/');
          const data = state(
            generate(count, { ...options, today: addDays(TODAY, 1), endDate: TODAY, campaignCount: 100 }),
          );
          await seed(page, data);
          await page.reload();
          await expect(page.getByTestId('kpi-total-reach')).toContainText(
            new Intl.NumberFormat('vi-VN').format(data.entries.reduce((sum, entry) => sum + entry.reach, 0)),
            { timeout: 60000 },
          );
          await expect(
            page.getByText(`${new Intl.NumberFormat('vi-VN').format(count)} dòng`, { exact: true }),
          ).toBeVisible();
          const reachBefore = Number((await page.getByTestId('kpi-total-reach').innerText()).replace(/\D/g, ''));
          await page.locator('#live-speed').selectOption('60');
          const toggle = page.getByRole('switch', { name: 'Live mô phỏng' });
          await toggle.click();
          const cdp = await context.newCDPSession(page);
          await delay(15000); // real wall time; a busy renderer must not stall the timer
          await deadline(cdp.send('HeapProfiler.collectGarbage'), 'initial GC', 60000);
          const initialHeap = await deadline(cdp.send('Runtime.getHeapUsage'), 'initial heap');
          const start = performance.now();
          const pageStart = await deadline(
            page.evaluate(() => window.performance.now()),
            'start clock',
          );
          const samples: Array<{ elapsedMs: number; usedHeap: number; commits: number }> = [];
          process.stdout.write(`${count}: starting ${durationMs}ms Live observation\n`);
          while (performance.now() - start < durationMs) {
            await delay(Math.min(10000, Math.max(1, durationMs - (performance.now() - start))));
            try {
              const heap = await deadline(cdp.send('Runtime.getHeapUsage'), 'sample heap');
              const commits = await deadline(
                page.evaluate(() => (window as unknown as { qaLive: { commits: number[] } }).qaLive.commits.length),
                'sample commits',
              );
              samples.push({ elapsedMs: performance.now() - start, usedHeap: heap.usedSize, commits });
            } catch (error: unknown) {
              samplingErrors.push(String(error));
              if (!browser.isConnected() || page.isClosed()) throw error;
            }
            await writeFile(
              join(output, `${count}-progress.json`),
              JSON.stringify(
                { count, durationMs, elapsedMs: performance.now() - start, samples, errors, samplingErrors, lifecycle },
                null,
                2,
              ),
            );
          }
          const pageEnd = await deadline(
            page.evaluate(() => window.performance.now()),
            'end clock',
          );
          await toggle.click();
          await delay(3000);
          await deadline(cdp.send('HeapProfiler.collectGarbage'), 'final GC', 60000);
          const finalHeap = await deadline(cdp.send('Runtime.getHeapUsage'), 'final heap');
          const writes = await deadline(
            page.evaluate(() => (window as unknown as { qaLive: { commits: number[]; durations: number[] } }).qaLive),
            'commit history',
          );
          const during = writes.commits.filter((at) => at >= pageStart && at <= pageEnd);
          const gaps = [pageStart, ...during, pageEnd]
            .slice(1)
            .map((at, i) => at - [pageStart, ...during, pageEnd][i]!);
          const growth = safeDiv(finalHeap.usedSize - initialHeap.usedSize, initialHeap.usedSize);
          const reachAfter = Number((await page.getByTestId('kpi-total-reach').innerText()).replace(/\D/g, ''));
          expect(reachAfter).toBeGreaterThan(reachBefore);
          const result = {
            count,
            durationMs,
            elapsedMs: performance.now() - start,
            backend: 'IndexedDB',
            initialRetainedHeap: initialHeap.usedSize,
            finalRetainedHeap: finalHeap.usedSize,
            retainedGrowthRatio: growth,
            heapWithinTenPercent: growth !== null && Math.abs(growth) <= 0.1,
            commitCount: during.length,
            maxCommitGapMs: Math.max(...gaps),
            persistBudgetMs: LIMITS.PERSIST_MAX_WAIT_MS,
            persistWithinBudget: Math.max(...gaps) <= LIMITS.PERSIST_MAX_WAIT_MS,
            reachBefore,
            reachAfter,
            samples,
            writes,
            errors,
            samplingErrors,
            lifecycle,
            note: '50k and 200k run concurrently in separate guest contexts; GC only before/after; 15s warmup; no AI provider; Date advances.',
          };
          await writeFile(join(output, `${count}-result.json`), JSON.stringify(result, null, 2));
          await page.screenshot({ path: join(output, `${count}-end.png`), fullPage: true });
          process.stdout.write(
            `${count}: ${JSON.stringify({ elapsedMs: result.elapsedMs, commitCount: result.commitCount, maxCommitGapMs: result.maxCommitGapMs, retainedGrowthRatio: growth, errors })}\n`,
          );
          return result;
        } catch (error: unknown) {
          errors.push(String(error));
          await writeFile(
            join(output, `${count}-failure.json`),
            JSON.stringify({ count, durationMs, errors, samplingErrors, lifecycle }, null, 2),
          );
          process.stderr.write(`${count}: ${String(error)}\n`);
          return { errors };
        } finally {
          await context.close();
        }
      }),
    );
    if (results.some((result) => result.errors.length)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
void run().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
