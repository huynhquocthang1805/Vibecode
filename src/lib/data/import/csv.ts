import Papa from 'papaparse';

import { autoMapHeaders } from './headers';

export interface ParsedCsv {
  rows: Record<string, string>[];
  headers: string[];
  encoding: string;
  delimiter: string;
}

function detectEncoding(bytes: Uint8Array): { encoding: string; decoded: string } {
  // Check BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = new TextDecoder('utf-8').decode(bytes.subarray(3));
    return { encoding: 'utf-8-bom', decoded: text };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
    return { encoding: 'utf-16le', decoded: text };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
    return { encoding: 'utf-16be', decoded: text };
  }

  // Thử utf-8 nghiêm ngặt
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { encoding: 'utf-8', decoded: text };
  } catch {
    // Thử windows-1258 (Excel tiếng Việt trên Windows)
    try {
      const text = new TextDecoder('windows-1258', { fatal: true }).decode(bytes);
      return { encoding: 'windows-1258', decoded: text };
    } catch {
      const text = new TextDecoder('utf-8').decode(bytes);
      return { encoding: 'utf-8', decoded: text };
    }
  }
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10);
  let commaScore = 0;
  let semiScore = 0;
  let tabScore = 0;

  for (const line of sample) {
    commaScore += (line.match(/,/g) ?? []).length;
    semiScore += (line.match(/;/g) ?? []).length;
    tabScore += (line.match(/\t/g) ?? []).length;
  }

  if (semiScore > commaScore && semiScore > tabScore) return ';';
  if (tabScore > commaScore && tabScore > semiScore) return '\t';
  return ',';
}

function findHeaderRow(lines: string[], delimiter: string): number {
  let bestRow = 0;
  let maxMatched = 0;

  const maxScan = Math.min(lines.length, 10);
  for (let i = 0; i < maxScan; i++) {
    const line = lines[i]!;
    const tokens = line.split(delimiter).map((t) => t.trim().replace(/^["']|["']$/g, ''));
    const matched = autoMapHeaders(tokens);
    const count = Object.keys(matched).length;
    if (count > maxMatched) {
      maxMatched = count;
      bestRow = i;
    }
  }

  return maxMatched >= 2 ? bestRow : 0;
}

/** Papaparse worker + chunk; nhận mã hoá/phân cách (docs/13 §6) */
export async function parseCsv(
  file: File,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<ParsedCsv> {
  if (signal?.aborted) {
    throw new Error('ABORTED');
  }

  const buffer = await file.arrayBuffer();
  if (signal?.aborted) {
    throw new Error('ABORTED');
  }

  const bytes = new Uint8Array(buffer);
  const { encoding, decoded } = detectEncoding(bytes);

  const cleanText = decoded.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    onProgress?.(100);
    return { rows: [], headers: [], encoding, delimiter: ',' };
  }

  const delimiter = detectDelimiter(lines);
  const headerIdx = findHeaderRow(lines, delimiter);
  const csvPayload = lines.slice(headerIdx).join('\n');

  onProgress?.(30);

  return new Promise<ParsedCsv>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('ABORTED'));
      return;
    }

    const abortHandler = () => {
      reject(new Error('ABORTED'));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    Papa.parse<Record<string, string>>(csvPayload, {
      delimiter,
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''),
      complete: (results) => {
        signal?.removeEventListener('abort', abortHandler);
        onProgress?.(100);

        const headers = results.meta.fields ?? [];
        resolve({
          rows: results.data,
          headers,
          encoding,
          delimiter,
        });
      },
      error: (err: unknown) => {
        signal?.removeEventListener('abort', abortHandler);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    });
  });
}
