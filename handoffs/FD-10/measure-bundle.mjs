import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const base = process.env.FRONTEND_REVIEW_URL ?? 'http://localhost:3003';
const html = await (await fetch(base)).text();
const scripts = new Map(
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((match) => [match[1], /\bnomodule\b/i.test(match[0])]),
);
const chunks = await Promise.all(
  [...scripts].map(async ([path, legacyOnly]) => {
    const response = await fetch(new URL(path, base));
    if (!response.ok) throw new Error(`Cannot read chunk: HTTP ${response.status}`);
    const source = await response.text();
    return {
      path,
      legacyOnly,
      gzipBytes: gzipSync(source).length,
      reviewFixture: source.includes('default|2026-10-03') && source.includes('28652'),
    };
  }),
);
const result = {
  modernInitialScriptGzipBytes: chunks
    .filter((chunk) => !chunk.legacyOnly)
    .reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
  allScriptGzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
  chunks,
};
const output = process.argv[2];
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
