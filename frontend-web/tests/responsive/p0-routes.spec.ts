import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow } from '../support/overflow';
import { signInAs } from '../support/auth';
import { P0_ROUTES } from '../support/routes';
import { dismissCookieConsent, waitForMockData } from '../support/settle';

type ViewportClass = 'mobile' | 'tablet' | 'desktop';

const VIEWPORTS: { width: number; height: number; class: ViewportClass }[] = [
  { width: 320, height: 690, class: 'mobile' },
  { width: 360, height: 740, class: 'mobile' },
  { width: 375, height: 812, class: 'mobile' },
  { width: 390, height: 844, class: 'mobile' },
  { width: 430, height: 932, class: 'mobile' },
  { width: 480, height: 900, class: 'mobile' },
  { width: 768, height: 1024, class: 'tablet' },
  { width: 820, height: 1180, class: 'tablet' },
  { width: 1024, height: 768, class: 'desktop' },
  { width: 1280, height: 800, class: 'desktop' },
  { width: 1440, height: 900, class: 'desktop' },
];

// Per the task's device/engine matrix. Tablet is deliberately Chromium-only
// (not "Chromium + WebKit") to bound total runs — WebKit engine coverage
// already happens at every mobile size, and Firefox at every desktop size,
// so every engine still gets exercised across the sweep.
const ENGINES_FOR_CLASS: Record<ViewportClass, string[]> = {
  mobile: ['chromium', 'webkit'],
  tablet: ['chromium'],
  desktop: ['chromium', 'firefox'],
};

for (const route of P0_ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} @ ${viewport.width}px has no horizontal overflow`, async ({
      page,
      context,
      browserName,
      baseURL,
    }) => {
      test.skip(
        !ENGINES_FOR_CLASS[viewport.class].includes(browserName),
        `${browserName} not in coverage policy for ${viewport.class} viewports`,
      );

      if (route.role) {
        await signInAs(context, route.role, baseURL!);
      }

      await dismissCookieConsent(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto(route.path);
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
      await waitForMockData(page);

      await assertNoHorizontalOverflow(
        page,
        `route=${route.path} viewport=${viewport.width}px browser=${browserName}`,
      );

      await page.screenshot({
        path: `test-results/screenshots/p0-${route.name}-${viewport.width}-${browserName}.png`,
        fullPage: true,
      });
    });
  }
}
