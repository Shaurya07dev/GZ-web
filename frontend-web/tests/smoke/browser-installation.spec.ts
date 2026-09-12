import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

test('app loads, has expected title, no fatal page errors', async ({ page, browserName }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await dismissCookieConsent(page);
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();

  await expect(page).toHaveTitle(/GalleryZone/);
  await expect(page.locator('body')).toBeVisible();

  expect(pageErrors, `uncaught page errors on ${browserName}: ${pageErrors.join('; ')}`).toEqual([]);

  await page.screenshot({ path: `test-results/screenshots/smoke-${browserName}.png`, fullPage: true });
});
