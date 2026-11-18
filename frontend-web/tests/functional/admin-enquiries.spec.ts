import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// The admin's inbox for the Get in touch form: filter by what a message is about, and mark it handled.
// The API is stubbed; saving and listing themselves are the backend's (packages/db/src/enquiries.ts).

const CORS = { 'access-control-allow-origin': '*' };
const json = (page: Page, pattern: string | RegExp, body: unknown) =>
  page.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }));

const rows = [
  { id: 'e1', type: 'advertisement', name: 'Asha Rao', email: 'asha@example.in', senderRole: 'collector', message: 'Rates for a banner on the marketplace?', status: 'new', createdAt: '2026-11-17T10:00:00.000Z', handledAt: null },
  { id: 'e2', type: 'support', name: 'Dev Mehta', email: 'dev@example.in', senderRole: 'artist', message: 'My photo upload keeps failing.', status: 'new', createdAt: '2026-11-17T09:00:00.000Z', handledAt: null },
  { id: 'e3', type: 'support', name: 'Old Hand', email: 'old@example.in', senderRole: 'aggregator', message: 'Thanks, sorted.', status: 'handled', createdAt: '2026-11-10T09:00:00.000Z', handledAt: '2026-11-11T09:00:00.000Z' },
];

test('an admin reads enquiries, filters by type and status, and marks one handled', async ({ page, baseURL }) => {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.addInitScript(() => window.localStorage.setItem('gz_tour_completed_admin', 'seen'));
  await signInAs(page.context(), 'admin', baseURL!);
  await json(page, '**/v1/auth/me', { uid: 'admin1', role: 'admin', status: 'active', name: 'Priya Sharma', email: 'admin@example.in', phone: null, roleGrants: [] });

  const asked: string[] = [];
  const patched: unknown[] = [];
  await page.route(/\/v1\/admin\/enquiries(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    asked.push(url.search);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const shown = rows.filter((r) => (!type || r.type === type) && (!status || r.status === status));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({ enquiries: shown, waiting: { advertisement: 1, collaboration: 0, general: 0, support: 1 } }),
    });
  });
  await page.route(/\/v1\/admin\/enquiries\/e1$/, (route) => {
    patched.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'e1', status: 'handled' }) });
  });

  await page.goto('/admin/enquiries');
  // What is still waiting, by default.
  // (the table and the phone-width list both carry each message, so look at the first.)
  await expect(page.getByText('Rates for a banner on the marketplace?').first()).toBeVisible();
  await expect(page.getByText('My photo upload keeps failing.').first()).toBeVisible();
  await expect(page.getByText('Thanks, sorted.')).toHaveCount(0);

  const byKind = page.getByRole('group', { name: 'Filter by what the message is about' });
  const byStatus = page.getByRole('group', { name: 'Filter by status' });

  // Filter by what it is about: the server is asked, and only that kind is listed.
  await byKind.getByRole('button', { name: /^Support/ }).click();
  await expect(page.getByText('Rates for a banner on the marketplace?')).toHaveCount(0);
  await expect(page.getByText('My photo upload keeps failing.').first()).toBeVisible();
  expect(asked.some((q) => q.includes('type=support'))).toBe(true);

  // Handled ones are one switch away.
  await byStatus.getByRole('button', { name: 'Handled' }).click();
  await expect(page.getByText('Thanks, sorted.').first()).toBeVisible();

  // Mark one handled.
  await byKind.getByRole('button', { name: 'All types' }).click();
  await byStatus.getByRole('button', { name: /^Waiting/ }).click();
  await page.getByRole('row', { name: /Asha Rao/ }).getByRole('button', { name: 'Mark handled' }).click();
  await expect.poll(() => patched.length).toBe(1);
  expect(patched[0]).toEqual({ status: 'handled' });
});
