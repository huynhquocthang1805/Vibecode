/** QA-07: inspect only source and client JS; never read environment files or real secrets. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const canary = 'QA_PUBLIC_BUNDLE_CANARY_20261106';
async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.env')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.isFile() && /\.(?:[cm]?js|tsx?)$/.test(entry.name)) result.push(path);
  }
  return result;
}
async function run() {
  const chunks = await files('.next/static');
  if (!chunks.length) throw new Error('Build production with the documented fake canary first');
  const sources = [...(await files('src')), 'next.config.ts'];
  const findings: Array<{ path: string; rule: string }> = [];
  for (const path of chunks) {
    if ((await readFile(path, 'utf8')).includes(canary))
      findings.push({ path: relative('.', path), rule: 'fake-server-key-in-client' });
  }
  for (const path of [...sources, ...chunks]) {
    if (/NEXT_PUBLIC_[A-Z0-9_]*KEY[A-Z0-9_]*/.test(await readFile(path, 'utf8')))
      findings.push({ path: relative('.', path), rule: 'public-key-variable' });
  }
  const result = {
    measuredAt: new Date().toISOString(),
    clientChunks: chunks.length,
    sourceFiles: sources.length,
    findings,
    scope: 'Known fake canary only; source and client JS; no .env files or actual production credentials',
  };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/qa07-bundle.json', JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
}
void run().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
