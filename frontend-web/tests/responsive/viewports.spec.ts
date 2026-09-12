import { test, expect } from '@playwright/test';
import { assertNoHorizontalOverflow } from '../support/overflow';
import { dismissCookieConsent } from '../support/settle';

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const ROUTE = '/';

for (const viewport of VIEWPORTS) {
  test(`renders without horizontal overflow at ${viewport.width}px`, async ({ page, browserName }) => {
    await dismissCookieConsent(page);
    await page.setViewportSize(viewport);
    const response = await page.goto(ROUTE);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();

    await assertNoHorizontalOverflow(page, `route=${ROUTE} viewport=${viewport.width}px browser=${browserName}`);

    await page.screenshot({
      path: `test-results/screenshots/viewport-${viewport.width}-${browserName}.png`,
      fullPage: true,
    });
  });
}
