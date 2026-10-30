import { defineConfig, devices } from '@playwright/test';

// BASE_URL=https://<deploy> npm run test:e2e → chạy trên bản deploy, không tự bật server.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
// Máy/container có sẵn Chromium khác phiên bản: PW_CHROMIUM_PATH=/đường/dẫn/chromium
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    // viewport iPhone 12 (390×664, touch) nhưng chạy bằng Chromium cho đồng nhất CI
    { name: 'iphone-12', use: { ...devices['iPhone 12'], browserName: 'chromium' } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { AI_PROVIDER: 'stub', ALLOW_STUB: '1' },
      },
});
