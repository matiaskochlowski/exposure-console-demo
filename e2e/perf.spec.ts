import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { freshPage } from './fixtures.js';

// Budget from docs/perf.md: filter-to-render ≤ 200 ms for 10k rows with 4× CPU throttling.
test('filter-to-render stays within budget under 4× CPU throttling @desktop-only', async ({
  page,
  browserName,
}, info) => {
  test.skip(
    browserName !== 'chromium' || info.project.name !== 'chromium',
    'CPU throttling needs Chromium DevTools protocol',
  );
  await freshPage(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const samples: number[] = [];
  for (const label of ['P1', 'P1', 'P2', 'P2', 'Known exploited', 'Known exploited']) {
    const ms = await page.evaluate(async (name) => {
      const status = document.querySelector('main [role="status"][aria-live="polite"]')!;
      const before = status.textContent;
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent === name)!;
      const start = performance.now();
      button.click();
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (status.textContent && status.textContent !== before) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(status, { childList: true, characterData: true, subtree: true });
      });
      // Wait for the frame that paints the result.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      return performance.now() - start;
    }, label);
    samples.push(ms);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const max = samples.at(-1)!;
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    'test-results/perf.json',
    JSON.stringify({ samples, median, max, throttle: 4 }, null, 2),
  );
  info.annotations.push({
    type: 'perf',
    description: `filter-to-render median ${median.toFixed(0)} ms, max ${max.toFixed(0)} ms (4× CPU)`,
  });
  expect(median).toBeLessThanOrEqual(200);
});
