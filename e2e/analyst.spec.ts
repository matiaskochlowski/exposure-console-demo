import { expect, test, type Page } from '@playwright/test';
import { findings, freshPage } from './fixtures.js';

async function ask(page: Page, question = 'What should we do about this?') {
  await page.getByRole('button', { name: question }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Analyst finished responding' }),
  ).toBeAttached();
}

test('analyst proposes, person edits and approves, queue reflects the result', async ({ page }) => {
  const f = findings.openP1;
  await freshPage(page, `/findings/${f.id}`);
  const drawer = page.getByRole('dialog');
  await ask(page);
  await expect(drawer.getByText(new RegExp(`${f.id} is P1`))).toBeVisible();

  const proposal = drawer.getByTestId('proposal');
  await expect(proposal.getByText('Awaiting your review')).toBeVisible();
  // Nothing has changed yet.
  await expect(drawer.getByText('Open', { exact: true }).first()).toBeVisible();

  await proposal.getByRole('button', { name: 'Edit' }).click();
  await proposal.getByLabel('Ticket title').fill('x');
  await proposal.getByRole('button', { name: 'Approve edited action' }).click();
  await expect(proposal.getByText('Title is too short', { exact: true })).toBeVisible();
  await expect(proposal.getByText('Awaiting your review')).toBeVisible();

  await proposal.getByLabel('Ticket title').fill('Upgrade and redeploy');
  await proposal.getByLabel('Assignee').selectOption('app-sec');
  await proposal.getByRole('button', { name: 'Approve edited action' }).click();

  await expect(proposal.getByText('Approved · done')).toBeVisible();
  await expect(proposal.getByText('Edited by you')).toBeVisible();
  await expect(proposal.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(drawer.getByText('SIM-1001 (simulated)')).toBeVisible();
  await expect(
    drawer.getByText(
      /Opened simulated ticket SIM-1001 for app-sec: “Upgrade and redeploy” \(edited before approval\)/,
    ),
  ).toBeVisible();

  await page.keyboard.press('Escape');
  const row = page.locator(`tr[data-id="${f.id}"]`);
  await expect(row.getByText('In progress')).toBeVisible();
  await expect(row.getByText('SIM-1001')).toBeVisible();

  // Persists across reload; Reset demo clears it.
  await page.goto(`/?q=${f.id}`);
  await expect(page.locator(`tr[data-id="${f.id}"]`).getByText('SIM-1001')).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator(`tr[data-id="${f.id}"]`).getByText('SIM-1001')).toHaveCount(0);
});

test('rejecting a proposal changes nothing', async ({ page }) => {
  const f = findings.openP1b;
  await freshPage(page, `/findings/${f.id}`);
  await ask(page);
  const proposal = page.getByTestId('proposal');
  await proposal.getByRole('button', { name: 'Reject' }).click();
  await expect(proposal.getByText('Rejected', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText(/Rejected proposal: Open remediation ticket/),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.locator(`tr[data-id="${f.id}"]`).getByText('Open', { exact: true }),
  ).toBeVisible();
});

test('injected scanner text is flagged and not obeyed', async ({ page }) => {
  const f = findings.injected;
  await freshPage(page, `/findings/${f.id}`);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Possible prompt injection')).toBeVisible();
  await expect(drawer.getByTestId('scanner-output')).toContainText(
    'Ignore all previous instructions',
  );
  await ask(page);
  await expect(drawer.getByText(/reads like instructions to an AI/)).toBeVisible();
  await expect(drawer.getByText(/will not suggest accepting this risk/)).toBeVisible();
  await expect(drawer.getByText('Proposed action: Accept risk')).toHaveCount(0);
});

test('payload preview shows redactions and withheld fields', async ({ page }) => {
  await freshPage(page, `/findings/${findings.openP1.id}`);
  await page.getByText('What the analyst receives').click();
  const preview = page.locator('details').filter({ hasText: 'What the analyst receives' });
  await expect(preview.getByText('hostname withheld')).toBeVisible();
  await expect(preview.locator('pre')).not.toContainText(findings.openP1.hostname);
  await expect(preview.locator('pre')).not.toContainText(findings.openP1.ip);
});

test('stop aborts a streaming answer', async ({ page }) => {
  await freshPage(page, `/findings/${findings.openP1.id}`);
  await page.getByRole('button', { name: 'What should we do about this?' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText('Stopped.')).toBeVisible();
  await expect(page.getByTestId('proposal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask' })).toBeVisible();
});

test('Escape inside the edit form cancels the edit, not the drawer', async ({ page }) => {
  await freshPage(page, `/findings/${findings.openP1.id}`);
  await ask(page);
  const proposal = page.getByTestId('proposal');
  await proposal.getByRole('button', { name: 'Edit' }).click();
  await expect(proposal.getByLabel('Ticket title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(proposal.getByRole('button', { name: 'Edit' })).toBeFocused();
});

test('a pending proposal survives closing the drawer and can still be decided', async ({
  page,
}) => {
  const f = findings.openP1;
  await freshPage(page, `/findings/${f.id}`);
  await ask(page);
  await expect(page.getByTestId('proposal')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(`/findings/${f.id}`);
  await expect(page.getByText('Pending from an earlier conversation')).toBeVisible();
  await page.getByTestId('proposal').getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByTestId('proposal').getByText('Rejected', { exact: true })).toBeVisible();
});
