import { expect, test } from '@playwright/test';
import { findings, freshPage, toggleFilter } from './fixtures.js';

test('loads 1.2k findings but renders one page of rows', async ({ page }) => {
  await freshPage(page);
  await expect(page.getByText(/1,200 of 1,200 findings/)).toBeVisible();
  await expect(page.locator('tbody tr[data-id]')).toHaveCount(50);
  await expect(page.getByRole('table', { name: 'Findings' })).toHaveAttribute(
    'aria-rowcount',
    '1201',
  );
  await expect(page.getByText('1–50 of 1,200')).toBeVisible();
});

test('pagination moves between pages, lives in the URL and resets on filter change', async ({
  page,
}) => {
  await freshPage(page);
  const nav = page.getByRole('navigation', { name: 'Pagination' });
  await expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('51–100 of 1,200')).toBeVisible();
  await expect(page.locator('tbody tr[data-id]').first()).toHaveAttribute('aria-rowindex', '52');
  await nav.getByRole('button', { name: 'Last page' }).click();
  await expect(page.getByText('1,151–1,200 of 1,200')).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await toggleFilter(page, 'Priority', 'P1');
  await expect(page).not.toHaveURL(/page=/);
  await page.goBack();
  await expect(page).toHaveURL(/page=24/);
});

test('filters live in the URL and survive back/forward', async ({ page }) => {
  await freshPage(page);
  await toggleFilter(page, 'Priority', 'P1');
  await expect(page).toHaveURL(/priority=P1/);
  await expect(page.getByRole('button', { name: 'Priority: P1' })).toBeVisible();
  const p1Count = await page.getByText(/of 1,200 findings/).textContent();

  await toggleFilter(page, 'Signals', 'Known exploited');
  await expect(page).toHaveURL(/kev=1/);

  await page.goBack();
  await expect(page).not.toHaveURL(/kev=1/);
  await expect(page.getByText(/of 1,200 findings/)).toHaveText(p1Count!);
  await page.goBack();
  await expect(page.getByText(/1,200 of 1,200 findings/)).toBeVisible();
});

test('search narrows to a single finding by id', async ({ page }) => {
  await freshPage(page);
  await page.getByRole('searchbox', { name: 'Search findings' }).fill(findings.openP1.id);
  await expect(page).toHaveURL(new RegExp(`q=${findings.openP1.id}`));
  await expect(page.getByText(/^1 of 1,200 findings/)).toBeVisible();
});

test('invalid URL filters fall back to defaults', async ({ page }) => {
  await freshPage(page, '/exposures?priority=P9&sort=drop_table&dir=up');
  await expect(page.getByText(/1,200 of 1,200 findings · sorted by risk/)).toBeVisible();
});

test('sorting is announced through aria-sort', async ({ page }) => {
  await freshPage(page);
  const cvss = page.getByRole('columnheader', { name: /CVSS/ });
  test.skip(!(await cvss.isVisible()), 'CVSS column hidden at this width');
  await cvss.getByRole('button', { name: 'CVSS', exact: true }).click();
  await expect(cvss).toHaveAttribute('aria-sort', 'descending');
  await cvss.getByRole('button', { name: 'CVSS', exact: true }).click();
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
  await expect(page).toHaveURL(/\/exposures\?priority=P1(&page=\d+)?$/);
  // Focus goes back to the row the drawer belonged to.
  await expect(page.locator(`tr[data-id="${findings.openP1.id}"]`)).toBeFocused();
});

test('keyboard only: Tab into the table, move with arrows, open with Enter @desktop-only', async ({
  page,
}) => {
  await freshPage(page);
  // Last header control before the table body; Tab must land on a row (roving tabindex).
  await page.getByRole('button', { name: 'What does Status mean?' }).focus();
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
  await expect(page.locator('tbody tr[data-index="49"]')).toBeFocused();
});

test('selection survives filtering and exports CSV', async ({ page }) => {
  await freshPage(page);
  await toggleFilter(page, 'Priority', 'P1');
  await page.getByRole('checkbox', { name: /Select all \d+ findings on this page/ }).check();
  const selectedText = await page.getByText(/\d+ selected/).textContent();
  await toggleFilter(page, 'Priority', 'P1');
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

test('filter dropdowns take several values and can be cleared', async ({ page }) => {
  await freshPage(page);
  await toggleFilter(page, 'Priority', 'P1');
  await toggleFilter(page, 'Priority', 'P2');
  await expect(page).toHaveURL(/priority=P1%2CP2/);
  await expect(page.getByRole('button', { name: 'Priority: P1, P2' })).toBeVisible();

  await page.getByRole('button', { name: /^Priority/ }).click();
  await page.getByRole('button', { name: 'Clear priority' }).click();
  await expect(page).not.toHaveURL(/priority=/);
});

test('domain filter shows coloured options and narrows the queue', async ({ page }) => {
  await freshPage(page);
  await toggleFilter(page, 'Domain', 'Payments');
  await expect(page).toHaveURL(/domain=payments/);
  await expect(page.getByRole('button', { name: 'Domain: Payments' })).toBeVisible();
  await expect(page.getByText(/^\d+ of 1,200 findings/)).not.toHaveText(/^1,200 of/);
});
