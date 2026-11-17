import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// Admin broadcasts: one message typed once, sent to every artist, every aggregator, or both. The API is
// stubbed, so this covers what the screen shows and sends; delivery itself is the backend's job
// (packages/db/src/broadcasts.ts, checked by broadcasts.check.ts).

const CORS = { 'access-control-allow-origin': '*' };

async function json(page: Page, pattern: string, body: unknown) {
  await page.route(pattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }),
  );
}

test('an admin writes one message, picks artists and aggregators, confirms, and it is sent', async ({ page, baseURL }) => {
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await page.addInitScript(() => window.localStorage.setItem('gz_tour_completed_admin', 'seen'));
  await signInAs(page.context(), 'admin', baseURL!);
  await json(page, '**/v1/auth/me', { uid: 'admin1', role: 'admin', status: 'active', name: 'Priya Sharma', email: 'admin@example.in', phone: null, roleGrants: [] });
  await json(page, '**/v1/admin/broadcasts/reach', { artist: 12, aggregator: 3 });

  let sent: unknown[] = [];
  let posted: unknown = null;
  await page.route('**/v1/admin/broadcasts', async (route) => {
    const headers = CORS;
    if (route.request().method() === 'POST') {
      posted = route.request().postDataJSON();
      sent = [{ id: 'b1', title: 'Maintenance on Sunday', body: 'The site is down 2 to 3 am.', audiences: ['artist', 'aggregator'], url: null, sentByName: 'Priya Sharma', sentAt: '2026-11-14T10:00:00.000Z', recipientCount: 15 }];
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ id: 'b1', recipientCount: 15 }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ broadcasts: sent }) });
  });

  await page.goto('/admin/broadcasts');
  const send = page.getByRole('button', { name: 'Review and send' });
  await expect(send).toBeDisabled();
  await expect(page.getByText('Nothing sent yet')).toBeVisible();

  // Audience: each choice shows how many people it reaches, and both add up.
  const audience = page.getByRole('group', { name: 'Send to' });
  await audience.getByText('Artists').click();
  await expect(page.getByText('Reaches 12 people.')).toBeVisible();
  await audience.getByText('Aggregators').click();
  await expect(page.getByText('Reaches 15 people.')).toBeVisible();

  await page.getByLabel('Title').fill('Maintenance on Sunday');
  await page.getByLabel('Message', { exact: true }).fill('The site is down 2 to 3 am.');
  await expect(page.getByText('How it will look')).toBeVisible();

  // A link that is not a page on this site is refused before anything is sent.
  await page.getByLabel(/Page to open/).fill('https://example.com');
  await expect(send).toBeDisabled();
  await page.getByLabel(/Page to open/).fill('');

  await send.click();
  await expect(page.getByText('Send to 15 people?')).toBeVisible();
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect.poll(() => posted).toEqual({ audiences: ['artist', 'aggregator'], title: 'Maintenance on Sunday', body: 'The site is down 2 to 3 am.', url: null });
  await expect(page.getByRole('table').getByText('Maintenance on Sunday')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('');
});
