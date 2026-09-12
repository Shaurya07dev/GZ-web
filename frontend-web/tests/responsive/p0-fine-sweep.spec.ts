import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow } from '../support/overflow';
import { signInAs } from '../support/auth';
import { P0_ROUTES } from '../support/routes';
import { dismissCookieConsent, waitForMockData } from '../support/settle';

// Phase 3: catch layouts that only work at the named device widths already
// covered by p0-routes.spec.ts, by testing the gaps between them. Chromium
// only — overflow is a CSS layout/geometry fact, not an engine-rendering
// difference (the header's sm: breakpoint fired identically on Chromium,
// Firefox and WebKit in header-breakpoint.spec.ts), so one engine is enough
// coverage for "is there a hidden breakpoint bug between these widths" and
// the other two engines' worth of runtime is better spent elsewhere.
const FINE_WIDTHS = [
  321, 330, 340, 350, 360, 375, 389, 402, 414, 430, 437, 480, 512, 600, 611,
  639, 640, 713, 768, 799, 820, 873, 947, 1024,
];

for (const route of P0_ROUTES) {
  for (const width of FINE_WIDTHS) {
    test(`${route.name} @ ${width}px: no overflow (fine sweep)`, async ({
      page,
      context,
      browserName,
      baseURL,
    }) => {
      test.skip(browserName !== 'chromium', 'fine overflow sweep is Chromium-only (engine-invariant CSS geometry)');

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
