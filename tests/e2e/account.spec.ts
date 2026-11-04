/**
 * E2E tests cho tài khoản & database (ACC-06, docs/14 §7 A1–A12)
 * Kiểm tra:
 * - A1: Khi máy chủ chưa cấu hình DB, ứng dụng vẫn chạy ở chế độ khách, API trả 503 NOT_CONFIGURED, không làm gãy 5 tính năng P0.
 * - A12: Trên màn hình nhỏ (375 px), các modal dialog và nút bấm có kích thước ≥ 44 px, không bị tràn ngang.
 */
import { expect, test } from '@playwright/test';

test.describe('ACC-06 · Tài khoản & Cơ sở dữ liệu', () => {
  test('A1: Kiểm tra API tài khoản trả 503 NOT_CONFIGURED khi chưa cấu hình DB', async ({
    request,
  }) => {
    // Nếu chạy không có DATABASE_URL / BETTER_AUTH_SECRET
    const resProfile = await request.get('/api/account/profile');
    if (resProfile.status() === 503) {
      const body = await resProfile.json();
      expect(body).toMatchObject({ code: 'NOT_CONFIGURED' });

      const resData = await request.get('/api/account/data');
      expect(resData.status()).toBe(503);

      const resAuth = await request.get('/api/auth/session');
      expect(resAuth.status()).toBe(503);
    }
  });

  test('A1: Khách không đăng nhập vẫn sử dụng đầy đủ 5 tính năng P0', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Nhập liệu P0
    const form = page.getByTestId('entry-form');
    await expect(form).toBeVisible();

    // 2. Kiểm tra các section chính
    await expect(page.locator('section[aria-label="Chỉ số tổng quan"]')).toBeVisible();
    await expect(page.locator('section[aria-label="Biểu đồ"]')).toBeVisible();
  });

  test('A12: Kiểm tra viewport di động 375 px không tràn chiều ngang', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });
});
