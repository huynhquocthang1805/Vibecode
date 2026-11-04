/**
 * Gate G1 smoke (techlead, TL-06a) — 5 tính năng P0 chạy xuyên suốt như marketer.
 * Chạy: npm run test:e2e (tự build + start với AI_PROVIDER=stub) · BASE_URL=https://… để test bản deploy.
 * QA-04 (Nhân) tiếp quản và mở rộng thành 8 spec ở docs/08 §4.
 * `test.fail()` = phần G1 chưa đạt, đã ghi trong handoffs/GATE-G1.md. Đạt rồi → bỏ dòng `test.fail()`.
 */
import { expect, test, type Page } from '@playwright/test';

/** 3 ngày số liệu; KPI kỳ vọng tính tay: CTR 680/31.000 = 2,19% · CPC 3.700.000/680 = 5.441 ₫ · CPA 3.700.000/28 = 132.143 ₫ */
const ROWS = [
  ['2026-10-29', '10000', '200', '1000000', '10'],
  ['2026-10-30', '12000', '300', '1500000', '12'],
  ['2026-10-31', '9000', '180', '1200000', '6'],
] as const;

async function enterThreeDays(page: Page) {
  const form = page.getByTestId('entry-form');
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: /Thêm dòng/ }).click();
  await form.getByRole('button', { name: /Thêm dòng/ }).click();
  const rows = form.getByTestId('draft-row');
  await expect(rows).toHaveCount(3);
  for (let i = 0; i < ROWS.length; i++) {
    const inputs = rows.nth(i).locator('input');
    for (let j = 0; j < 5; j++) await inputs.nth(j).fill(ROWS[i]![j]!);
  }
  await form.getByRole('button', { name: /^Lưu 3 dòng/ }).click();
  await expect(page.getByText(/^3 dòng$/)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('F1 + F3: nhập 3 ngày → KPI tính đúng tỉ số của tổng; reload vẫn còn dữ liệu', async ({ page }) => {
  await expect(page.getByText(/^0 dòng$/)).toBeVisible();
  await enterThreeDays(page);
  const kpi = page.locator('section[aria-label="Chỉ số tổng quan"]');
  await expect(kpi).toContainText('2,19%');
  await expect(kpi).toContainText('5.441');
  await expect(kpi).toContainText('132.143');
  await page.reload();
  await expect(page.getByText(/^3 dòng$/)).toBeVisible();
});

test('F1: validation chặn click > reach ngay dưới ô', async ({ page }) => {
  const row = page.getByTestId('entry-form').getByTestId('draft-row').first();
  const inputs = row.locator('input');
  await inputs.nth(0).fill('2026-10-28');
  await inputs.nth(1).fill('100');
  await inputs.nth(2).fill('500');
  await inputs.nth(2).blur();
  await expect(page.getByTestId('entry-form')).toContainText(/click không thể lớn hơn reach/i);
});

test('F2: biểu đồ Reach · Chi phí · Đơn hàng hiển thị theo ngày', async ({ page }) => {
  await enterThreeDays(page);
  const chart = page.locator('section[aria-label="Biểu đồ"]');
  await expect(chart.locator('svg, canvas').first()).toBeVisible();
  await expect(chart).toContainText('31/10');
});

test('F4: AI nhận xét có đúng 3 gợi ý (provider stub ở E2E, fallback khi lỗi)', async ({ page }) => {
  await enterThreeDays(page);
  const card = page.getByTestId('ai-insight');
  await expect(card.locator('article.suggestion')).toHaveCount(3, { timeout: 20_000 });
  await expect(card).toContainText(/AI|Dự phòng/);
});

test('F4 · E26: trang chưa có dữ liệu không được gọi /api/insights', async ({ page }) => {
  test.fail(true, 'R-02 (AI-FIX-01): useInsights tự gọi khi trang trống → 400 BAD_REQUEST');
  const calls: number[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/insights')) calls.push(Date.now());
  });
  await page.reload();
  await page.waitForTimeout(2_000);
  expect(calls).toHaveLength(0);
});

test('F5: xuất báo cáo text → sao chép được', async ({ page, context, browserName }) => {
  test.fail(true, 'AI-08 (Thắng 2): buildReport chưa có → dialog báo "chưa sẵn sàng"');
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await enterThreeDays(page);
  await page.locator('#bao-cao').getByRole('button').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('chưa sẵn sàng');
  await dialog.getByRole('button', { name: /Sao chép/ }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/BÁO CÁO/i);
});

test('375px: không tràn ngang, không lỗi console', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
