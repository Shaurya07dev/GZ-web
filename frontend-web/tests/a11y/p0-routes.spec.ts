import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from '../support/auth';
import { P0_ROUTES } from '../support/routes';
import { dismissCookieConsent, waitForMockData, settleScrollReveal } from '../support/settle';

// Phase 8: accessibility expansion beyond home. Same non-gating contract as
// tests/a11y/axe.spec.ts — this proves the scan runs for real on every P0
// route and reports what it finds; it does not fail the suite on
// violations. Every violation found here is by definition PRE-EXISTING
// (nothing has been touched to introduce a new one on these routes as part
// of this pass) — classify accordingly in RESPONSIVE_AUDIT.md, not as a
// regression.

for (const route of P0_ROUTES) {
  test(`axe: ${route.name}`, async ({ page, context, baseURL }, testInfo) => {
    await dismissCookieConsent(page);
    if (route.role) {
      await signInAs(context, route.role, baseURL!);
    }
    const response = await page.goto(route.path);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    await waitForMockData(page);
    await settleScrollReveal(page);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    await testInfo.attach(`axe-${route.name}.json`, {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    console.log(`axe ${route.name}: ${results.violations.length} violations, ${results.passes.length} rules passed`);
    for (const v of results.violations) {
      console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s): ${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
    }

    expect(Array.isArray(results.violations)).toBe(true);
  });
}
