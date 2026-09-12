import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// Phase 6 functional testing: artwork detail page interactions. Two real
// findings while discovering these selectors, worth recording so the next
// person doesn't repeat the confusion: (1) "Add to wishlist" (icon-only,
// exact accessible name) matches 3 elements on this page — the related-
// artworks rail's card toggles, not the main artwork's own action, which
// is a *text* button labeled "Wishlist" (`aria-pressed` toggling to
// "Wishlisted"). (2) The header also has an icon-only "Wishlist" button
// (links to /account/wishlist) with no visible text — `exact: true` +
// `hasText` together uniquely resolve to the main panel's button and
// exclude both of those.

test('image lightbox: opens on "View full size", closes on Escape', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/marketplace/monsoon-over-madurai');

  const dialog = page.getByRole('dialog', { name: /Full size view/ });
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'View full size' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('image lightbox: closes on its own Close button', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/marketplace/monsoon-over-madurai');

  await page.getByRole('button', { name: 'View full size' }).click();
  const dialog = page.getByRole('dialog', { name: /Full size view/ });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('wishlist toggle on the main artwork reflects real state, not just a click', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/marketplace/monsoon-over-madurai');

  const wishlistBtn = page.getByRole('button', { name: 'Wishlist', exact: true }).filter({ hasText: 'Wishlist' });
  await expect(wishlistBtn).toHaveAttribute('aria-pressed', 'false');

  await wishlistBtn.click();
  await expect(page.getByRole('button', { name: 'Wishlisted' })).toHaveAttribute('aria-pressed', 'true');

  // Toggling back off actually works too, not a one-way action.
  await page.getByRole('button', { name: 'Wishlisted' }).click();
  await expect(wishlistBtn).toHaveAttribute('aria-pressed', 'false');
});
