---
name: a11y-audit
description: Audit a screen or component for WCAG 2.2 AA issues (semantics, keyboard path, focus, names, contrast, motion) and fix them. Use before merging UI changes or when the a11y-auditor subagent reports findings.
---

# Accessibility audit

1. **Automated pass** — run `npx playwright test e2e/a11y.spec.ts`. Note every violation with rule id
   and selector. Automated checks find roughly a third of real issues; continue manually.
2. **Keyboard path** — Tab through the screen: is every control reachable, in visual order, with a
   visible focus ring? Can every action be done without a mouse? Escape closes overlays and focus
   returns to the trigger.
3. **Names & roles** — every control has an accessible name; icons-only buttons have `aria-label`;
   tables have headers; live updates (sort, streaming text, toasts) are announced politely.
4. **Contrast & motion** — text ≥ 4.5:1 (check both themes via tokens), `prefers-reduced-motion`
   disables non-essential animation.
5. **Fix** the issues, add a regression assertion (RTL role query or Playwright keyboard step), and
   record anything you could not verify (e.g. screen reader output) in the PR description.
