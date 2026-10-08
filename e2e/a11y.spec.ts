import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, findings, freshPage } from './fixtures.ts';

// Automated checks cover a subset of WCAG; keyboard paths are in queue.spec.ts and manual
// screen-reader notes live in docs/BUILD-LOG.md.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test('queue (default and filtered)', async ({ page }) => {
      await freshPage(page);
      await expectNoA11yViolations(page, 'queue default');
      await page.getByRole('button', { name: 'P1', exact: true }).click();
      await page.getByRole('button', { name: 'Known exploited' }).click();
      await expectNoA11yViolations(page, 'queue filtered');
    });

    test('drawer with analyst answer and pending proposal', async ({ page }) => {
      await freshPage(page, `/findings/${findings.openP1.id}`);
      await expectNoA11yViolations(page, 'drawer open');
      await page.getByRole('button', { name: 'What should we do about this?' }).click();
      await expect(page.getByTestId('proposal')).toBeVisible();
      await page.getByTestId('proposal').getByRole('button', { name: 'Edit' }).click();
      await expectNoA11yViolations(page, 'proposal editing');
    });

    test('injection warning', async ({ page }) => {
      await freshPage(page, `/findings/${findings.injected.id}`);
      await expectNoA11yViolations(page, 'injection warning');
    });
  });
}
