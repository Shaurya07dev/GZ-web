import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow } from '../support/overflow';
import { signInAs } from '../support/auth';
import { P1_ROUTES } from '../support/routes';
import { dismissCookieConsent, waitForMockData } from '../support/settle';

// Phase 3/6: P1 route sweep. Representative widths only, per the task's own
// "don't blindly run every browser x every viewport x every route" — the
// full P0 fine-sweep already proved CSS breakpoints are engine-invariant in
// this codebase (0 hidden failures across 24 intermediate widths x 13
// routes), so P1 gets the named-device widths, not another intermediate
// sweep, unless a specific route turns out to be breakpoint-sensitive.
// Chromium only for the same reason p0-fine-sweep.spec.ts is: overflow is a
// CSS geometry fact, not an engine-rendering difference, confirmed already
// by header-breakpoint.spec.ts running the same check across all 3 engines
// with identical results.
const WIDTHS = [320, 390, 430, 768, 1024, 1280, 1440];

for (const route of P1_ROUTES) {
  for (const width of WIDTHS) {
    test(`${route.name} @ ${width}px: no overflow`, async ({ page, context, browserName, baseURL }) => {
      test.skip(browserName !== 'chromium', 'P1 overflow sweep is Chromium-only (engine-invariant CSS geometry, confirmed on P0)');

      if (route.role) {
        await signInAs(context, route.role, baseURL!);
      }

      await dismissCookieConsent(page);
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(route.path);
      expect(response?.ok()).toBeTruthy();
      await waitForMockData(page);

      await assertNoHorizontalOverflow(page, `route=${route.path} width=${width}px browser=${browserName}`);
    });
  }
}
