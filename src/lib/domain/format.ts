const intFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

const shortDecimalFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const pctFormatterCache = new Map<number, Intl.NumberFormat>();

function getPctFormatter(digits: number): Intl.NumberFormat {
  let fmt = pctFormatterCache.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    pctFormatterCache.set(digits, fmt);
  }
  return fmt;
}

/** 125400 → "125.400"; null → "—" */
export function fmtInt(n: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return '—';
  }
  return intFormatter.format(Math.round(n));
}

/** → "18.500.000 ₫" */
export function fmtVnd(n: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return '—';
  }
  return `${intFormatter.format(Math.round(n))} ₫`;
}

/** → "18,5tr", "1,2 tỷ" */
export function fmtVndShort(n: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return '—';
  }
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return `${sign}${shortDecimalFormatter.format(val)} tỷ`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}${shortDecimalFormatter.format(val)}tr`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}${shortDecimalFormatter.format(val)}k`;
  }
  return fmtVnd(n);
}

/** 0.0256 → "2,56%" */
export function fmtPct(ratio: number | null, digits: number = 2): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return '—';
  }
  const pct = ratio * 100;
  const fmt = getPctFormatter(digits);
  return `${fmt.format(pct)}%`;
}

/** 12.3 → "▲ 12,3%" */
export function fmtDelta(pct: number | null): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return '—';
  }
  if (pct === 0) {
    return '0,0%';
  }
  const fmt = getPctFormatter(1);
  if (pct > 0) {
    return `▲ ${fmt.format(pct)}%`;
  }
  return `▼ ${fmt.format(Math.abs(pct))}%`;
}
