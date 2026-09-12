import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissCookieConsent, waitForMockData, settleScrollReveal } from '../support/settle';

test('axe scan runs against the home page and reports violations', async ({ page }, testInfo) => {
  // Without this, whether the cookie-consent banner (and its two buttons) is
  // in the DOM at scan time is a hydration-timing race — see settle.ts. An
  // a11y result should not depend on how that race happened to resolve.
  await dismissCookieConsent(page);
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await waitForMockData(page);
  await settleScrollReveal(page);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  await testInfo.attach('axe-results.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  console.log(`axe: ${results.violations.length} violations, ${results.passes.length} rules passed`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s): ${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  }

  // This proves the tool runs end-to-end; it is not a gate on pre-existing
  // violations, so it never fails the run — it only has to execute and report.
  expect(Array.isArray(results.violations)).toBe(true);
});
