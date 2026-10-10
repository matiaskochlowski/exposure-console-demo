import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, findings } from './fixtures.js';

/** Like freshPage, but for pages without the findings table. */
async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      localStorage.setItem('exposure-console:intro-dismissed', '1');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
}

/** The sidebar launcher (the top bar on mobile); only one is visible at a time. */
const launcher = (page: Page) => page.getByRole('button', { name: 'Ask the assistant' });

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test('overview, glossary and activity pages have no axe violations', async ({ page }) => {
      await open(page, '/');
      await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Fix first' })).toBeVisible();
      await expectNoA11yViolations(page, 'overview');
      await page.getByRole('button', { name: 'What does Priority (P1–P4) mean?' }).first().click();
      await expect(page.getByRole('dialog', { name: 'Priority (P1–P4)' })).toBeVisible();
      await expectNoA11yViolations(page, 'concept popover');
      // One Escape closes the popover; the trigger's tooltip must not swallow it.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Priority (P1–P4)' })).toBeHidden();

      await page.goto('/glossary');
      await expect(page.getByRole('heading', { name: 'Glossary', level: 1 })).toBeVisible();
      await expectNoA11yViolations(page, 'glossary');

      await page.goto('/activity');
      await expect(page.getByText('No activity yet')).toBeVisible();
      await expectNoA11yViolations(page, 'activity');
    });

    test('concepts chat', async ({ page }) => {
      await open(page, '/');
      await launcher(page).click();
      const chat = page.getByRole('dialog', { name: 'Ask the assistant' });
      await expect(chat.getByRole('textbox', { name: 'Ask about a concept' })).toBeFocused();
      await expectNoA11yViolations(page, 'chat open');
    });
  });
}

test('overview stat cards and Fix first link into the queue', async ({ page }) => {
  await open(page, '/');
  // The whole card is the click target (a stretched link), so click its body text, not the link box.
  await expect(page.getByRole('link', { name: /View in queue.*P1, fix first/ })).toBeAttached();
  await page.getByText(/Highest risk score: exploitable/).click({ force: true });
  await expect(page).toHaveURL(/\/exposures\?priority=P1&status=open%2Cin_progress$/);
  await expect(page.getByRole('table', { name: 'Findings' })).toBeVisible();

  await page.goto('/');
  const first = page.getByRole('region', { name: 'Fix first' }).getByRole('link').nth(1);
  await first.click();
  await expect(page).toHaveURL(/\/exposures\/findings\/DEMO-\d{4}-\d{5}$/);
  await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
});

test('weekly chart has a table view', async ({ page }) => {
  await open(page, '/');
  await page.getByText('Show as table').click();
  await expect(page.getByRole('table', { name: 'New exposures per week' })).toBeVisible();
});

test('the chat answers concept questions locally and closes with Escape', async ({ page }) => {
  const modelCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) modelCalls.push(r.url());
  });
  await open(page, '/');
  await launcher(page).click();
  const chat = page.getByRole('dialog', { name: 'Ask the assistant' });
  await chat.getByRole('button', { name: 'What is EPSS?' }).click();
  await expect(chat.getByText(/EPSS: .*within 30 days/)).toBeVisible();
  await chat.getByRole('textbox', { name: 'Ask about a concept' }).fill('should I patch tonight?');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByText(/ask its AI analyst/)).toBeVisible();
  expect(modelCalls).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(chat).toBeHidden();
  await expect(launcher(page)).toBeFocused();
});

test('a table header hint explains the term and can ask the assistant', async ({ page }) => {
  await open(page, '/exposures');
  await page.getByRole('button', { name: 'What does Status mean?' }).click();
  const popover = page.getByRole('dialog', { name: 'Status' });
  await expect(popover.getByText(/Risk accepted means/)).toBeVisible();
  await popover.getByRole('button', { name: 'Ask the assistant' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Ask the assistant' }).getByText(/Status: Open means/),
  ).toBeVisible();
});

test('inside a finding, "What does this mean?" asks that finding\'s analyst', async ({ page }) => {
  await open(page, `/exposures/findings/${findings.openP1.id}`);
  const drawer = page.getByRole('dialog', { name: findings.openP1.title });
  await drawer.getByRole('button', { name: 'What does EPSS mean?' }).click();
  await page
    .getByRole('dialog', { name: 'EPSS' })
    .getByRole('button', { name: 'Ask the analyst' })
    .click();
  await expect(drawer.getByText('What is EPSS?')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Analyst finished responding' }),
  ).toBeAttached();
});

test('legacy /findings/:id links redirect into the exposures queue', async ({ page }) => {
  await open(page, `/findings/${findings.openP1.id}?priority=P1`);
  await expect(page).toHaveURL(
    new RegExp(`/exposures/findings/${findings.openP1.id}\\?priority=P1$`),
  );
  await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
});

test('glossary deep links focus the term', async ({ page }) => {
  await open(page, '/glossary#kev');
  await expect(page.locator('#kev')).toBeFocused();
});

test('sidebar collapses to icons, keeps link names and remembers it @desktop-only', async ({
  page,
}) => {
  await open(page, '/');
  const sidebar = page.getByTestId('sidebar');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(sidebar.getByText('Exposure Console')).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Exposures' })).toBeVisible();
  await sidebar.getByRole('link', { name: 'Activity' }).focus();
  await expect(page.getByRole('tooltip', { name: /Audit trail/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
});

test('a malformed or unknown glossary hash does not break the page', async ({ page }) => {
  await open(page, '/glossary#%E0%A4%A');
  await expect(page.getByRole('heading', { name: 'Glossary', level: 1 })).toBeVisible();
  await page.goto('/glossary#not-a-term');
  await expect(page.getByRole('heading', { name: 'Glossary', level: 1 })).toBeVisible();
});

test('a drawer hint question keeps the typed draft', async ({ page }) => {
  await open(page, `/exposures/findings/${findings.openP1.id}`);
  const drawer = page.getByRole('dialog', { name: findings.openP1.title });
  const input = drawer.getByRole('textbox', { name: /Ask the analyst about/ });
  await input.fill('my own draft');
  await drawer.getByRole('button', { name: 'What does CVSS mean?' }).click();
  await page
    .getByRole('dialog', { name: 'CVSS' })
    .getByRole('button', { name: 'Ask the analyst' })
    .click();
  await expect(drawer.getByText('What is CVSS?')).toBeVisible();
  await expect(input).toHaveValue('my own draft');
});

test('Escape closes the drawer even while a hint tooltip is showing', async ({ page }) => {
  await open(page, `/exposures/findings/${findings.openP1.id}`);
  const drawer = page.getByRole('dialog', { name: findings.openP1.title });
  await drawer.getByRole('button', { name: 'What does CVSS mean?' }).hover();
  await expect(page.getByRole('tooltip', { name: /Technical severity/ })).toBeVisible();
  // Focus is elsewhere in the drawer, so this Escape belongs to the drawer.
  await drawer.getByRole('button', { name: 'Close details' }).focus();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});
