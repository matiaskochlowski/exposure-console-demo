import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { generateFindings, INJECTED_SCANNER_TEXT } from '../src/shared/generate.js';
import { priorityFor, riskScore } from '../src/shared/risk.js';

// Same deterministic dataset the app loads, so tests can pick findings by property.
const rows = generateFindings().map((f) => ({ ...f, priority: priorityFor(riskScore(f)) }));

export const findings = {
  /** Open P1 without a ticket: the analyst proposes opening one. */
  openP1: rows.find((f) => f.status === 'open' && f.priority === 'P1')!,
  /** Another open P1, used for the reject path. */
  openP1b: rows.filter((f) => f.status === 'open' && f.priority === 'P1')[1]!,
  injected: rows.find((f) => f.scannerText === INJECTED_SCANNER_TEXT[0])!,
};

/** Fresh state for every test: no persisted actions, intro dismissed, reduced motion. */
export async function freshPage(page: Page, path = '/exposures') {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      localStorage.setItem('exposure-console:intro-dismissed', '1');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page.getByRole('table', { name: 'Findings' })).toBeVisible();
}

export async function expectNoA11yViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(', ')}`,
  );
  expect(summary, `axe violations in state "${state}"`).toEqual([]);
}

/** Open a filter dropdown (e.g. Priority) and tick or untick one option, then close it again. */
export async function toggleFilter(page: Page, group: string, option: string) {
  await page.getByRole('button', { name: new RegExp(`^${group}`) }).click();
  await page.getByRole('group', { name: group }).locator('label', { hasText: option }).click();
  await page.keyboard.press('Escape');
}
