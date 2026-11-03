import { test, expect } from '@playwright/test';
import { signInAs, type SessionRole } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// "Contact GalleryZone" on the Support page of each portal: GalleryZone is reached by email only.
// There is no phone number to call (owner, 31 Oct 2026), and no tel: link.

const PAGES: { role: SessionRole; path: string }[] = [
  { role: 'artist', path: '/dashboard/support' },
  { role: 'aggregator', path: '/aggregator/support' },
  { role: 'customer', path: '/account/support' },
];

for (const { role, path } of PAGES) {
  test(`${role} support: contact is by email, with no phone number`, async ({ page, baseURL }) => {
    // Anything not stubbed below fails fast instead of reaching a real API.
    await page.route('**/v1/**', (route) => route.abort());
    await dismissCookieConsent(page);
    await signInAs(page.context(), role, baseURL!);
    await page.route('**/v1/auth/me', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ uid: `${role}1`, role, status: 'active', name: 'Meera Kulkarni', email: 'meera@example.in', phone: null, roleGrants: [] }),
      }));
    await page.goto(path);

    await expect(page.getByRole('heading', { name: 'Contact GalleryZone' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'galleryzone@zohomail.in' })).toBeVisible();
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('94929');
  });
}
