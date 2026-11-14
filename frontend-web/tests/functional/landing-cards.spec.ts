import { test, expect } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// The home page's Certificate card: signed out it opens the explainer; an artist or a collector goes
// straight to their own COA and NFC page.

for (const [who, href] of [
  ['signed out', '/passport/certificate'],
  ['artist', '/dashboard/coa-nfc'],
  ['customer', '/account/coa-nfc'],
] as const) {
  test(`the Certificate card opens ${href} for ${who}`, async ({ page, baseURL }) => {
    await page.route('**/v1/**', (route) => route.abort());
    await dismissCookieConsent(page);
    if (who !== 'signed out') await signInAs(page.context(), who, baseURL!);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'View certificate' })).toHaveAttribute('href', href);
    // The other cards are not role-dependent.
    await expect(page.getByRole('link', { name: 'View history' })).toHaveAttribute('href', '/passport/provenance');
    await expect(page.getByRole('link', { name: 'Built to last' })).toHaveAttribute('href', '/passport/legacy');
  });
}
