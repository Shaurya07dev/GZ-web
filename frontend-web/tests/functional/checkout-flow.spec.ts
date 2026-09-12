import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// Phase 6 functional testing: the full checkout funnel — the highest-value
// flow in the app (real money path in production, even though the gateway
// is a documented in-app simulation right now). Three wizard steps (Address
// -> Review -> Confirm), a payment dialog, then an in-place "Order placed"
// success state (no URL redirect — confirmed live, same pattern as
// register's "Check your email" state). Every step's exact content was
// walked through live before writing this, not assumed.

test('full checkout: address -> review -> confirm -> pay -> order placed', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/checkout?artworkId=monsoon-over-madurai');

  // Step 1: Address — can't proceed without picking one.
  await expect(page.getByRole('button', { name: 'Continue to review' })).toBeDisabled();
  await page.getByRole('radio', { name: /12 MG Road/ }).click();
  const continueToReview = page.getByRole('button', { name: 'Continue to review' });
  await expect(continueToReview).toBeEnabled();
  await continueToReview.click();

  // Step 2: Review — real order total must be present, not just a heading.
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.getByText('Monsoon Over Madurai').first()).toBeVisible();
  await expect(page.getByText('₹25,900').first()).toBeVisible(); // Total
  await page.getByRole('button', { name: 'Continue to confirm' }).click();

  // Step 3: Confirm — opens the payment simulation dialog.
  await expect(page.getByRole('heading', { name: 'Ready to place your order' })).toBeVisible();
  await page.getByRole('button', { name: /^Pay ₹/ }).click();

  const paymentDialog = page.getByRole('dialog', { name: /Razorpay/ });
  await expect(paymentDialog).toBeVisible();
  await paymentDialog.getByRole('button', { name: /^Pay ₹/ }).click();

  // Completing payment shows an in-place success state — no URL change,
  // confirmed live (this isn't a missed redirect, it's how the flow works).
  await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('₹25,900')).toBeVisible();
  await expect(page.getByText(/simulated payment/)).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/);
});

test('checkout wizard: Back button returns to the previous step without losing the address', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/checkout?artworkId=monsoon-over-madurai');

  await page.getByRole('radio', { name: /12 MG Road/ }).click();
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Where should we deliver this?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /12 MG Road/ })).toBeChecked();
});
