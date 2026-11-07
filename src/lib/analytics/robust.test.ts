import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/domain/dates';
import { buildScenario } from '@/lib/data/samples/scenarios';

import { forecastMetric } from './forecast';
import { robustSeries, sliceAfterLongGap, trimLeadingZeros, winsorize } from './robust';

const START = '2026-08-01';
const TODAY = '2026-11-06';
const dates = (n: number, start = START) => Array.from({ length: n }, (_, i) => addDays(start, i));
const wave = (n: number, base = 100) => Array.from({ length: n }, (_, i) => base + ((i * 7) % 11) - 5);

describe('FC-10 · robust (docs/13 §5)', () => {
  it('winsorize: 1 ngày gõ nhầm ×100 bị kẹp về tham chiếu cùng thứ; dữ liệu thường không đổi', () => {
    const v = wave(30);
    v[20] = v[20]! * 100;
    const w = winsorize(v, dates(30));
    expect(w.clipped).toBe(1);
    expect(w.values[20]!).toBeLessThan(250); // tham chiếu ~100 + 125%
    expect(w.values.filter((x, i) => i !== 20)).toEqual(v.filter((_, i) => i !== 20));
  });

  it('winsorize: ngày gõ nhầm là ngày MỚI NHẤT vẫn bị kẹp (tham chiếu nhân quả)', () => {
    const v = wave(35);
    v[34] = v[34]! * 100;
    const w = winsorize(v, dates(35));
    expect(w.clipped).toBe(1);
    expect(w.values[34]!).toBeLessThan(250);
  });

  it('winsorize: chuỗi hằng + 1 đỉnh → kẹp (sàn 125%/5 đơn vị khi MAD = 0); < 3 điểm → không kẹp; không âm', () => {
    const w0 = winsorize([5, 5, 5, 5, 500], dates(5));
    expect(w0.clipped).toBe(1);
    expect(w0.values[4]!).toBeCloseTo(5 + 5 * 1.25, 6);
    expect(winsorize([1, 900], dates(2)).clipped).toBe(0);
    const w = winsorize([0, 0, 1, 100, 102, 98, 101, 99, 0], dates(9));
    expect(Math.min(...w.values)).toBeGreaterThanOrEqual(0);
  });

  it('winsorize: ngày giảm/0 giữ nguyên (có thể là tạm dừng thật); lệch độ dài ngày → không xử lý', () => {
    const v = wave(28);
    v[25] = 0;
    expect(winsorize(v, dates(28)).values[25]).toBe(0);
    expect(winsorize(v, dates(27)).clipped).toBe(0);
  });

  it('review FC-10: mùa vụ cuối tuần (bộ "weekend") KHÔNG bị kẹp — trước: 12/42 ngày bị cắt', () => {
    const rows = buildScenario('weekend', TODAY);
    for (const k of ['reach', 'clicks', 'cost', 'orders'] as const) {
      expect(winsorize(rows.map((r) => r[k]), rows.map((r) => r.date)).clipped, k).toBe(0);
    }
  });

  it('review FC-10: chiến dịch mới tăng ×20 trong 90 ngày KHÔNG bị kẹp, dự báo bám mức mới', () => {
    const n = 90;
    const v = Array.from({ length: n }, (_, i) => Math.round(200 * 20 ** (i / (n - 1))));
    expect(winsorize(v, dates(n)).clipped).toBe(0);
    const f = forecastMetric(v, dates(n), 'orders', 7);
    expect(f.points[0]!.mean).toBeGreaterThan(v[n - 1]! * 0.9);
  });

  it('winsorize: đợt tăng NHIỀU ngày liền (Tết, sale 5 ngày ×4) là thật → không kẹp; 1 ngày lẻ ×4 → kẹp', () => {
    const v = wave(42);
    for (let i = 30; i < 35; i++) v[i] = v[i]! * 4;
    expect(winsorize(v, dates(42)).clipped).toBe(0);
    const one = wave(42);
    one[30] = one[30]! * 4;
    expect(winsorize(one, dates(42)).clipped).toBe(1);
  });

  it('winsorize: đơn ít (0–2/ngày) không bị kẹp nhờ sàn tuyệt đối 5 đơn vị', () => {
    const v = Array.from({ length: 60 }, (_, i) => [0, 1, 0, 2, 1, 0, 0][i % 7]! + (i % 11 === 0 ? 4 : 0));
    expect(winsorize(v, dates(60)).clipped).toBe(0);
  });

  it('bỏ 0 đầu chuỗi (chưa chạy); chuỗi toàn 0 giữ nguyên', () => {
    const t = trimLeadingZeros([0, 0, 0, 4, 5, 0, 6], dates(7));
    expect(t.removed).toBe(3);
    expect(t.values).toEqual([4, 5, 0, 6]);
    expect(t.dates[0]).toBe(addDays(START, 3));
    expect(trimLeadingZeros([0, 0, 0], dates(3)).removed).toBe(0);
  });

  it('khoảng trống > 28 ngày → chỉ giữ đoạn sau khoảng trống CUỐI; ≤ 28 ngày → giữ nguyên', () => {
    const d = [...dates(10), ...dates(10, '2026-09-20'), ...dates(8, '2026-10-29')];
    const v = d.map((_, i) => i + 1);
    const s = sliceAfterLongGap(v, d);
    expect(s.cut).toBe(true);
    expect(s.dates[0]).toBe('2026-10-29');
    expect(s.values).toHaveLength(8);
    const short = [...dates(10), ...dates(10, addDays(START, 10 + 28))]; // trống đúng 28 ngày
    expect(sliceAfterLongGap(short.map(() => 1), short).cut).toBe(false);
  });

  it('robustSeries: đúng thứ tự bỏ 0 → cắt khoảng trống → winsorize', () => {
    const r = robustSeries([0, 0, ...wave(30)], dates(32));
    expect(r.leadingZeros).toBe(2);
    expect(r.cutAtGap).toBe(false);
    expect(r.values).toHaveLength(30);
  });
});

describe('FC-10 · forecastMetric bền vững', () => {
  it('1 ngày chi phí ×100 không làm dự báo "bay" (trước: trung bình dự báo vọt lên)', () => {
    const v = wave(35, 1_000_000);
    const clean = forecastMetric(v, dates(35), 'cost', 7);
    const dirty = [...v];
    dirty[30] = dirty[30]! * 100;
    const f = forecastMetric(dirty, dates(35), 'cost', 7);
    const mean = (x: typeof f) => x.points.reduce((a, p) => a + p.mean, 0) / x.points.length;
    expect(mean(f)).toBeLessThan(mean(clean) * 1.2);
    for (const p of f.points) for (const k of ['mean', 'lo80', 'hi80', 'lo95', 'hi95'] as const) expect(Number.isFinite(p[k])).toBe(true);
  });

  it('nghỉ 2 tháng rồi chạy lại 10 ngày → dự báo theo mức MỚI, không nội suy qua khoảng trống', () => {
    const d = [...dates(40), ...dates(10, '2026-11-01')];
    const v = [...Array(40).fill(1000), ...Array(10).fill(200)];
    const f = forecastMetric(v, d, 'reach', 7);
    expect(f.points[0]!.date).toBe('2026-11-11');
    for (const p of f.points) expect(p.mean).toBeLessThan(400);
  });

  it('đoạn sau khoảng trống < 7 ngày → baseline naive theo mức mới (không bỏ trống dự báo)', () => {
    const d = [...dates(40), ...dates(3, '2026-11-01')];
    const v = [...Array(40).fill(1000), 210, 200, 205];
    const f = forecastMetric(v, d, 'reach', 5);
    expect(f.model).toBe('naive');
    expect(f.points).toHaveLength(5);
    expect(f.points[0]!.mean).toBe(205);
    expect(f.points[0]!.date).toBe('2026-11-04');
  });

  it('chuỗi toàn 0 / hằng số → dự báo hằng, hữu hạn, không NaN', () => {
    for (const v of [Array(20).fill(0), Array(20).fill(42)]) {
      const f = forecastMetric(v, dates(20), 'orders', 7);
      expect(f.points).toHaveLength(7);
      for (const p of f.points) {
        expect(Number.isFinite(p.mean)).toBe(true);
        expect(p.mean).toBeCloseTo(v[0], 6);
      }
    }
  });

  it('review FC-10: robust chỉ trên cửa sổ 365 ngày — khoảng trống & ngày nhầm cũ hơn không đổi kết quả', () => {
    const d = [...dates(40, '2024-01-01'), ...dates(480, '2024-04-01')]; // trống ~50 ngày, rồi 480 ngày
    const v = d.map((_, i) => 1000 + ((i * 7) % 11) * 10);
    v[45] = v[45]! * 100; // gõ nhầm từ > 1 năm trước
    const full = forecastMetric(v, d, 'reach', 7);
    const last = forecastMetric(v.slice(-365), d.slice(-365), 'reach', 7);
    expect(full.points.map((p) => p.mean)).toEqual(last.points.map((p) => p.mean));
  });

  it('vẫn từ chối đầu vào hỏng TRƯỚC khi xử lý robust (ngày trùng, NaN)', () => {
    expect(() => forecastMetric([1, 2], ['2026-01-01', '2026-01-01'], 'orders', 7)).toThrow(RangeError);
    expect(() => forecastMetric([NaN, 1], dates(2), 'orders', 7)).toThrow(RangeError);
  });
});
