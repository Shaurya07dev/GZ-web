import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow } from '../support/overflow';
import { dismissCookieConsent, waitForMockData } from '../support/settle';

// Verifies the RESPONSIVE_AUDIT.md CRITICAL #1 fix (components/site-header.tsx:
// wishlist button now `hidden sm:inline-flex`, matching the search button next
// to it). Two things must hold everywhere: no horizontal overflow, and the
// wishlist icon's visibility matches Tailwind's sm breakpoint (640px) exactly
// — hidden below it, visible at/above it. The drawer link still carries the
// route at every width (untouched by this fix).

const AFFECTED_ROUTES = [
  { name: 'marketplace', path: '/marketplace' },
  { name: 'marketplace-detail', path: '/marketplace/monsoon-over-madurai' },
  { name: 'artist-profile', path: '/artists/devika-rao' },
  { name: 'checkout', path: '/checkout?artworkId=monsoon-over-madurai' },
  { name: 'verify-passport', path: '/verify/monsoon-over-madurai' },
  { name: 'transfer-accept-not-found', path: '/transfer/does-not-exist' },
];

type Band = 'mobile' | 'tablet' | 'desktop';
const ENGINES_FOR_BAND: Record<Band, string[]> = {
  mobile: ['chromium', 'webkit'],
  tablet: ['chromium'],
  desktop: ['chromium', 'firefox'],
};

// The task's "at minimum" list for section 1 — one matrix across all six
// affected routes, standard engine policy.
const STANDARD_WIDTHS: { width: number; band: Band }[] = [
  { width: 320, band: 'mobile' },
  { width: 360, band: 'mobile' },
  { width: 375, band: 'mobile' },
  { width: 390, band: 'mobile' },
  { width: 430, band: 'mobile' },
  { width: 480, band: 'mobile' },
  { width: 639, band: 'mobile' }, // one px below the sm breakpoint
  { width: 640, band: 'mobile' }, // exactly at the sm breakpoint
  { width: 768, band: 'tablet' },
  { width: 1024, band: 'desktop' },
];

for (const route of AFFECTED_ROUTES) {
  for (const { width, band } of STANDARD_WIDTHS) {
    test(`${route.name} @ ${width}px: no overflow, wishlist matches sm breakpoint`, async ({
      page,
      browserName,
    }) => {
      test.skip(!ENGINES_FOR_BAND[band].includes(browserName), `${browserName} not in policy for ${band}`);

      await dismissCookieConsent(page);
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(route.path);
      expect(response?.ok()).toBeTruthy();
      await waitForMockData(page);

      await assertNoHorizontalOverflow(page, `route=${route.path} width=${width}px browser=${browserName}`);

      const wishlist = page.locator('header').getByRole('button', { name: 'Wishlist' });
      const shouldBeVisible = width >= 640;
      await expect(
        wishlist,
        `wishlist icon visibility wrong at ${width}px (expected visible=${shouldBeVisible})`,
      ).toBeVisible({ visible: shouldBeVisible });
    });
  }
}

// Section 4: fine-grained sweep to catch a hidden failure between the widths
// above. One route is enough — this is a CSS breakpoint (sm:), which is
// engine-invariant, not a JS behavior difference; Chromium only.
const FINE_WIDTHS = [321, 330, 340, 350, 360, 375, 390, 402, 414, 430, 480, 512, 600, 639, 640];

for (const width of FINE_WIDTHS) {
  test(`marketplace @ ${width}px: fine-grained sm-breakpoint check`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'fine breakpoint sweep is Chromium-only (CSS breakpoint, engine-invariant)');

    await dismissCookieConsent(page);
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('/marketplace');
    expect(response?.ok()).toBeTruthy();
    await waitForMockData(page);

    await assertNoHorizontalOverflow(page, `route=/marketplace width=${width}px browser=${browserName}`);

    const wishlist = page.locator('header').getByRole('button', { name: 'Wishlist' });
    const shouldBeVisible = width >= 640;
    await expect(
      wishlist,
      `wishlist icon visibility wrong at ${width}px (expected visible=${shouldBeVisible})`,
    ).toBeVisible({ visible: shouldBeVisible });
  });
}
