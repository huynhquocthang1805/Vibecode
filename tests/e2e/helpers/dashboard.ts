import { expect, type Page } from '@playwright/test';

import { enforceGuardrails } from '../../../src/lib/ai/guardrails';
import { StubProvider } from '../../../src/lib/ai/provider/stub';
import { insightRequestSchema } from '../../../src/lib/ai/schemas';
import { addDays } from '../../../src/lib/domain/dates';

export const TODAY = '2026-11-06';
export const SEVEN_ROWS = Array.from({ length: 7 }, (_, i) => [addDays(TODAY, i - 7), '1000', '20', '100000', '2']);

// Inputs and KPI values have test IDs. Remaining controls use accessible roles/labels until owners add IDs.
export async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T05:00:00Z`));
  // On deploy, intercept only AI to avoid paid/non-deterministic calls. Local exercises the real stub route.
  if (process.env.BASE_URL && !new URL(process.env.BASE_URL).hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
    await stubAi(page);
  }
  await page.goto('/');
  await expect(page.getByTestId('entry-form')).toBeVisible();
}

export async function stubAi(page: Page) {
  await page.route('**/api/insights', async (route) => {
    const req = insightRequestSchema.parse(route.request().postDataJSON());
    const raw = await new StubProvider().generateJson('', '', {}, { timeoutMs: 15000, temperature: 0 });
    const result = enforceGuardrails(raw, req, { modelName: 'qa-e2e-stub' });
    if (!result.ok) throw new Error(result.reason);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result.value) });
  });
}

export async function enterRows(page: Page, data = SEVEN_ROWS) {
  await page.getByRole('tab', { name: 'Nhập số liệu', exact: true }).click();
  const form = page.getByTestId('entry-form');
  for (let i = 1; i < data.length; i++) await form.getByRole('button', { name: 'Thêm dòng', exact: true }).click();
  for (const [i, row] of data.entries()) {
    const inputs = form.getByTestId('draft-row').nth(i).locator('input');
    for (const [j, value] of row.entries()) await inputs.nth(j).fill(value);
    // Finish field validation before clicking a button that may move when a warning is inserted.
    await inputs.last().blur();
  }
  await form.getByRole('button', { name: `Lưu ${data.length} dòng`, exact: true }).click();
}

export async function sevenDayAssertions(page: Page) {
  await expect(page.getByText('7 dòng', { exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-total-reach')).toContainText('7.000');
  await expect(page.getByTestId('kpi-value-ctr')).toHaveText('2,00%');
  await expect(page.getByTestId('kpi-value-cpc')).toContainText('5.000');
  await expect(page.getByTestId('kpi-value-cpa')).toContainText('50.000');
  await expect(page.getByRole('region', { name: 'Biểu đồ', exact: true })).toContainText('7 kỳ');
  await expect(page.getByTestId('ai-insight').locator('article.suggestion')).toHaveCount(3, { timeout: 25000 });
}

export async function copyReport(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#bao-cao').getByRole('button').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Sao chép/ }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/BÁO CÁO/i);
  await page.keyboard.press('Escape');
  return text;
}

export async function pasteRows(page: Page, text: string, expected = 1) {
  await page.getByRole('tab', { name: 'Import CSV / Dán Excel' }).click();
  await page.getByRole('button', { name: 'Dán từ Excel / Google Sheets' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#paste-text').fill(text);
  await dialog.getByRole('button', { name: 'Xem trước bảng' }).click();
  await dialog.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText(`Đã nhận ${expected} dòng`);
  await page.keyboard.press('Escape');
}

export async function loadCampaign2y(page: Page) {
  await page.getByRole('tab', { name: 'Dữ liệu', exact: true }).click();
  await page.getByLabel('Bộ dữ liệu mẫu').selectOption('campaign-2y');
  await page.getByRole('button', { name: 'Dùng dữ liệu mẫu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nạp dữ liệu mẫu' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
