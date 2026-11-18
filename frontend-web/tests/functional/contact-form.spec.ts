import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// One "Get in touch" form (client, 18 Nov 2026): a kind of message (advertisement, collaboration, general question,
// support), and a button elsewhere on the site can open it with the kind already chosen. The API is stubbed.

const cors = { 'access-control-allow-origin': '*' };
const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });

test('Get in touch is one form with a kind of message; a button can open it with the kind chosen; it really sends', async ({ page }) => {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  let posted: Record<string, unknown> | null = null;
  await page.route('**/v1/contact', (route) => {
    posted = route.request().postDataJSON();
    return route.fulfill(ok({ id: 'e1' }));
  });

  // "Advertise with us" opens it with Advertisement already chosen.
  await page.goto('/contact?type=advertisement');
  const kinds = page.getByRole('radiogroup', { name: 'What is this about?' });
  await expect(kinds.getByRole('radio', { name: 'Advertisement' })).toHaveAttribute('aria-checked', 'true');
  // The four kinds the client named, and nothing else.
  await expect(kinds.getByRole('radio')).toHaveText(['General question', 'Support', 'Advertisement', 'Collaboration']);

  const send = page.getByRole('button', { name: 'Send message' });
  await expect(send).toBeDisabled(); // not until we also say who we are
  await page.getByLabel('Full name').fill('Meera Kulkarni');
  await page.getByLabel('Email address').fill('meera@example.in');
  await page.getByRole('radiogroup', { name: 'I am a...' }).getByRole('radio', { name: 'Artist' }).click();
  await page.getByLabel('Message').fill('We run a frame shop in Pune and would like to advertise.');
  await send.click();

  await expect(page.getByRole('heading', { name: 'Message sent.' })).toBeVisible();
  expect(posted).toMatchObject({
    type: 'advertisement',
    name: 'Meera Kulkarni',
    email: 'meera@example.in',
    senderRole: 'artist',
    message: 'We run a frame shop in Pune and would like to advertise.',
    website: '',
  });
});

test('a refused message says so instead of pretending it was sent', async ({ page }) => {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.route('**/v1/contact', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'about:blank', title: 'Enter a valid email address', status: 400, code: 'enquiry_refused' }) }),
  );
  await page.goto('/contact?type=support');
  await page.getByLabel('Full name').fill('Meera');
  await page.getByLabel('Email address').fill('meera@example.in');
  await page.getByRole('radiogroup', { name: 'I am a...' }).getByRole('radio', { name: 'Collector' }).click();
  await page.getByLabel('Message').fill('Help please.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText('Enter a valid email address');
  await expect(page.getByRole('heading', { name: 'Message sent.' })).toHaveCount(0);
});

test('every Collaboration, Support and Contact link in the footer goes to that one form', async ({ page }) => {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  const to = (name: string) => footer.getByRole('link', { name, exact: true }).first().getAttribute('href');
  expect(await to('Collaborations')).toBe('/contact?type=collaboration');
  expect(await to('Artist Support')).toBe('/contact?type=support');
  expect(await to('Collector Support')).toBe('/contact?type=support');
  expect(await to('Contact')).toBe('/contact?type=general');
});
