import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// Phase 6 functional testing: login and register forms — the actual
// conversion funnel. Every real selector/behavior here was confirmed live
// against the dev server before being written (not guessed): the email
// field is a `combobox` role (not plain textbox), password has a working
// show/hide toggle, register shows an in-place "Check your email" success
// state rather than redirecting (there's no account to redirect into until
// the email is verified), and the "Demo X" buttons on /register are a
// one-click full sign-in shortcut, not a form autofill.
//
// The email field uses pressSequentially(), not fill(): confirmed live
// that WebKit silently drops fill()'s value on this specific input
// (empty afterward, no error) while real keystroke-by-keystroke typing
// works correctly on all three engines — a Playwright/WebKit quirk with
// this input, not an app bug (a real person typing their email in Safari
// is unaffected, only scripted value-injection is).

test.describe('Login form', () => {
  test('valid credentials sign in and redirect to the role dashboard', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/login');

    await page.getByRole('combobox', { name: 'Email Address' }).pressSequentially('artist@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/dashboard$/);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'gz_session')?.value).toBe('artist');
  });

  test('password show/hide toggle actually changes the input type', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/login');

    const pwField = page.getByRole('textbox', { name: 'Password' });
    await pwField.fill('password123');
    await expect(pwField).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pwField).toHaveAttribute('type', 'text');
  });

  test('"Simulate invalid credentials" produces a real error and blocks sign-in', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/login');

    await page.getByRole('combobox', { name: 'Email Address' }).pressSequentially('artist@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    // Scoped to the visible styled checkbox — base-ui's Checkbox also
    // renders a hidden native <input> mirror with the same accessible
    // name, which getByLabel() would match too (strict-mode violation).
    await page.getByRole('checkbox', { name: 'Simulate invalid credentials' }).click();
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Register form', () => {
  test('empty submit shows field-specific validation, not a silent no-op', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/register?role=artist');

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Name is too short')).toBeVisible();
    await expect(page.getByText('Invalid email address')).toBeVisible();
    await expect(page.getByText('Enter a 10-digit phone number')).toBeVisible();
    await expect(page.getByText('At least 8 characters')).toBeVisible();
    await expect(page.getByText('You must accept the Terms')).toBeVisible();
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(4);
    await expect(page).toHaveURL(/\/register/);
  });

  test('valid submission shows the email-verification success state', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/register?role=artist');

    await page.getByRole('textbox', { name: 'Full name' }).fill('Test Artist Name');
    await page.getByRole('combobox', { name: 'Email Address' }).pressSequentially('testartist@example.com');
    await page.getByRole('textbox', { name: 'Phone number' }).fill('9876543210');
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('checkbox', { name: 'I agree to the Terms of Service' }).click();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText('testartist@example.com')).toBeVisible();
  });

  test('"Demo Artist" is a one-click sign-in shortcut into the artist dashboard', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/register?role=artist');

    await page.getByRole('button', { name: 'Demo Artist' }).click();

    await page.waitForURL(/\/dashboard$/);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'gz_session')?.value).toBe('artist');
  });
});
