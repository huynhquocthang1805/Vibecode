import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';

import { generate } from '../../scripts/gen-mock';
import { applyDelta, buildRollups, getRollupChecksum } from '../../src/lib/data/aggregate';
import { decodeState, DEFAULT_SETTINGS, encodeState } from '../../src/lib/data/storage/codec';
import { createAnalyticsEngine } from '../../src/lib/workers/analytics.worker';
import { CONTRACT_VERSION, type DailyEntry, type PersistedState } from '../../src/types/domain';

export const TODAY = '2026-11-06';
export const options = { today: TODAY, endDate: '2026-11-05', seed: 20261106, profile: 'stress' as const };
export function state(entries: DailyEntry[]): PersistedState {
  return {
    v: CONTRACT_VERSION,
    entries,
    settings: { ...DEFAULT_SETTINGS, range: { from: entries[0]!.date, to: entries.at(-1)!.date } },
    campaigns: [...new Set(entries.map((e) => e.campaignId))].map((id) => ({ id, name: id, createdAt: 0 })),
  };
}
export function median(samples: number[]) {
  assert.equal(samples.length, 5);
  return [...samples].sort((a, b) => a - b)[2]!;
}

async function run() {
  const large = generate(100000, { ...options, campaignCount: 100 });
  const medium = state(generate(50000, { ...options, campaignCount: 100 }));
  const twoYears = generate(2190, { ...options, campaignCount: 3 });
  const encoded = encodeState(medium);
  const measurements: Array<{ name: string; samplesMs: number[]; medianMs: number; budgetMs: number; pass: boolean }> =
    [];
  async function measure(
    name: string,
    budgetMs: number,
    operation: () => unknown | Promise<unknown>,
    setup?: () => unknown | Promise<unknown>,
  ) {
    await setup?.();
    await operation(); // one warm-up, excluded
    const samplesMs: number[] = [];
    for (let i = 0; i < 5; i++) {
      await setup?.();
      const start = performance.now();
      await operation();
      samplesMs.push(performance.now() - start);
    }
    const medianMs = median(samplesMs);
    measurements.push({ name, samplesMs, medianMs, budgetMs, pass: medianMs < budgetMs });
  }
  await measure('buildRollups 100k (Node, same worker function)', 300, () => {
    assert.equal(getRollupChecksum(buildRollups(large)).rows, 100000);
  });
  let index = buildRollups(large);
  const old = large[0]!;
  const changed = { ...old, reach: old.reach + 1 };
  await measure(
    'applyDelta replace 1 row',
    2,
    () => {
      index = applyDelta(index, { added: [changed], removed: [old] });
    },
    () => {
      index = buildRollups(large);
    },
  );
  const engine = createAnalyticsEngine();
  await measure(
    'full snapshot 2y, cold forecast cache',
    150,
    async () => {
      const snapshot = await engine.snapshot({ campaignId: 'all', grain: 'day', today: TODAY, horizonDays: 30 });
      assert.equal(snapshot.forecasts.length, 4);
      assert.equal(snapshot.nowcasts.length, 2);
    },
    () => engine.init(twoYears),
  );
  await measure('encode + decode 50k', 200, () => {
    assert.equal(decodeState(encodeState(medium)).entries.length, 50000);
  });
  const result = {
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      totalMemoryBytes: totalmem(),
    },
    seed: options.seed,
    warmups: 1,
    runs: 5,
    measurements,
    codec: {
      utf8Bytes: Buffer.byteLength(encoded, 'utf8'),
      utf16Bytes: Buffer.byteLength(encoded, 'utf16le'),
      budgetBytes: 3.5 * 1024 * 1024,
      pass: Buffer.byteLength(encoded, 'utf16le') <= 3.5 * 1024 * 1024,
    },
  };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/qa05-node.json', JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
// Importable helpers for the browser benchmark without starting the CPU run.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/tests/perf/benchmark.ts')) {
  void run().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
