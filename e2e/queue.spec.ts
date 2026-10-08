import { expect, test } from '@playwright/test';
import { findings, freshPage } from './fixtures.ts';

test('loads 10k findings but renders only a window of rows', async ({ page }) => {
  await freshPage(page);
  await expect(page.getByText(/10,000 of 10,000 findings/)).toBeVisible();
  const rendered = await page.locator('tbody tr[data-id]').count();
  expect(rendered).toBeGreaterThan(5);
  expect(rendered).toBeLessThanOrEqual(40);
  await expect(page.getByRole('table', { name: 'Findings' })).toHaveAttribute(
    'aria-rowcount',
    '10001',
  );
});

test('filters live in the URL and survive back/forward', async ({ page }) => {
  await freshPage(page);
  await page.getByRole('button', { name: 'P1', exact: true }).click();
  await expect(page).toHaveURL(/priority=P1/);
  await expect(page.getByRole('button', { name: 'P1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const p1Count = await page.getByText(/of 10,000 findings/).textContent();

  await page.getByRole('button', { name: 'Known exploited' }).click();
  await expect(page).toHaveURL(/kev=1/);

  await page.goBack();
  await expect(page).not.toHaveURL(/kev=1/);
  await expect(page.getByText(/of 10,000 findings/)).toHaveText(p1Count!);
  await page.goBack();
  await expect(page.getByText(/10,000 of 10,000 findings/)).toBeVisible();
});

test('search narrows to a single finding by id', async ({ page }) => {
  await freshPage(page);
  await page.getByRole('searchbox', { name: 'Search findings' }).fill(findings.openP1.id);
  await expect(page).toHaveURL(new RegExp(`q=${findings.openP1.id}`));
  await expect(page.getByText(/^1 of 10,000 findings/)).toBeVisible();
});

test('invalid URL filters fall back to defaults', async ({ page }) => {
  await freshPage(page, '/?priority=P9&sort=drop_table&dir=up');
  await expect(page.getByText(/10,000 of 10,000 findings · sorted by risk/)).toBeVisible();
});

test('sorting is announced through aria-sort', async ({ page }) => {
  await freshPage(page);
  const cvss = page.getByRole('columnheader', { name: /CVSS/ });
  test.skip(!(await cvss.isVisible()), 'CVSS column hidden at this width');
  await cvss.getByRole('button').click();
  await expect(cvss).toHaveAttribute('aria-sort', 'descending');
  await cvss.getByRole('button').click();
  await expect(cvss).toHaveAttribute('aria-sort', 'ascending');
});

test('deep link opens the drawer after a reload, Escape closes it', async ({ page }) => {
  await freshPage(page, `/findings/${findings.openP1.id}?priority=P1`);
  const drawer = page.getByRole('dialog', { name: findings.openP1.title });
  await expect(drawer).toBeVisible();
  await page.reload();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/\?priority=P1$/);
  // Focus goes back to the row the drawer belonged to.
  await expect(page.locator(`tr[data-id="${findings.openP1.id}"]`)).toBeFocused();
});

test('keyboard only: Tab into the table, move with arrows, open with Enter @desktop-only', async ({
  page,
}) => {
  await freshPage(page);
  // Last control before the table body; Tab must land on a row (roving tabindex).
  await page.getByRole('columnheader', { name: 'First seen' }).getByRole('button').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('tbody tr[data-index="0"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const third = page.locator('tbody tr[data-index="2"]');
  await expect(third).toBeFocused();
  const id = await third.getAttribute('data-id');
  await page.keyboard.press('Space');
  await expect(third.getByRole('checkbox')).toBeChecked();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/findings/${id}`));
  await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(third).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('tbody tr[data-index="9999"]')).toBeFocused();
});

test('Tab still reaches the table after scrolling the focused row out of view @desktop-only', async ({
  page,
}) => {
  await freshPage(page);
  await page.locator('tbody tr[data-index="0"]').focus();
  await page.getByTestId('queue-scroll').evaluate((el) => (el.scrollTop = 200_000));
  await expect(page.locator('tbody tr[data-index="0"]')).toHaveCount(0);
  await page.getByRole('columnheader', { name: 'First seen' }).getByRole('button').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('tbody tr:focus')).toHaveCount(1);
});

test('selection survives filtering and exports CSV', async ({ page }) => {
  await freshPage(page);
  await page.getByRole('button', { name: 'P1', exact: true }).click();
  await page.getByRole('checkbox', { name: /Select all \d+ matching findings/ }).check();
  const selectedText = await page.getByText(/\d+ selected/).textContent();
  await page.getByRole('button', { name: 'P1', exact: true }).click();
  await expect(page.getByText(/\d+ selected/)).toHaveText(selectedText!);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^findings-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('unknown routes and unknown findings are handled', async ({ page }) => {
  await freshPage(page, `/findings/DEMO-2026-99999`);
  await expect(page.getByRole('dialog', { name: 'Finding not found' })).toBeVisible();
  await page.goto('/no/such/page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
