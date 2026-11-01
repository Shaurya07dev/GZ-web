import { test, expect, type Page } from '@playwright/test';
import { signInAs } from '../support/auth';
import { dismissCookieConsent } from '../support/settle';

// The notification bell. The list is a summary (a long message is cut to a few lines); selecting a notification
// opens all of it, with its exact time. The page it points to is one more tap, on "Open". The API is stubbed.

const CORS = { 'access-control-allow-origin': '*' };

const LONG =
  'Your piece "Monsoon Over Madurai" was returned by the curation team. The photographs are too dark to judge the ' +
  'colour of the sky, and the stated dimensions (24 x 36 in) do not match the frame in the second photo. Please retake ' +
  'the photos in daylight, measure the canvas without the frame, and submit it again. Last line of the reason.';

const note = (id: string, over: Record<string, unknown> = {}) => ({
  id, title: 'Title', body: 'Short.', url: null, read: false, createdAt: '2026-11-01T12:00:00.000Z', ...over,
});

/** The dialog that opens a notification in full. Not getByRole('dialog'): the bell's own popover has that role too. */
const reader = (page: Page) => page.locator('[data-slot="dialog-content"]');

async function json(page: Page, pattern: string, body: unknown, method?: string) {
  await page.route(pattern, (route) => {
    if (method && route.request().method() !== method) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
}

/** Opens an artist page with the given notifications; returns the ids the page marked as read. */
async function openWith(page: Page, baseURL: string, items: unknown[], unreadCount: number): Promise<string[]> {
  const marked: string[] = [];
  // Anything not stubbed below fails fast instead of reaching a real API.
  await page.route('**/v1/**', (route) => route.abort());
  await dismissCookieConsent(page);
  await signInAs(page.context(), 'artist', baseURL);
  await json(page, '**/v1/auth/me', { uid: 'artist1', role: 'artist', status: 'active', name: 'Meera Kulkarni', email: 'meera@example.in', phone: null, roleGrants: [] });
  await json(page, '**/v1/artist/artworks', { artworks: [] }, 'GET');
  await json(page, '**/v1/artist/coa/requests', []);
  await json(page, '**/v1/notifications', { items, unreadCount }, 'GET');
  await page.route('**/v1/notifications/*/read', (route) => {
    marked.push(new URL(route.request().url()).pathname.split('/').at(-2)!);
    return route.fulfill({ status: 204, headers: CORS });
  });
  await page.goto('/dashboard/coa-nfc');
  return marked;
}

test('selecting a notification opens all of it, and "Open" goes to its page', async ({ page, baseURL }) => {
  const marked = await openWith(page, baseURL!, [note('n1', { title: 'Monsoon Over Madurai was returned', body: LONG, url: '/dashboard/artworks' })], 1);

  await page.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
  const row = page.getByRole('button', { name: /Monsoon Over Madurai was returned/ });
  // The list is a summary: the message is cut there.
  expect(await row.locator('p').evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  await row.click();

  // The whole message is readable, with its exact time, and it is marked read.
  const dialog = reader(page);
  await expect(dialog.getByRole('heading', { name: 'Monsoon Over Madurai was returned' })).toBeVisible();
  await expect(dialog).toContainText('Last line of the reason.');
  await expect(dialog).toContainText('1 Nov 2026');
  await expect.poll(() => marked).toEqual(['n1']);
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toHaveCount(0);

  await dialog.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/dashboard\/artworks$/);
});

test('a notification with no page still opens in full, and closing returns to the bell', async ({ page, baseURL }) => {
  const marked = await openWith(page, baseURL!, [note('n2', { title: 'Payout sent', body: 'Rs 9,500 is on its way.\nIt reaches your bank in 1 to 2 working days.', read: true })], 0);

  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  await bell.click();
  await page.getByRole('button', { name: /Payout sent/ }).click();

  const dialog = reader(page);
  await expect(dialog).toContainText('It reaches your bank in 1 to 2 working days.');
  // Nowhere to go from here, and nothing to mark: it was already read.
  await expect(dialog.getByRole('link', { name: 'Open' })).toHaveCount(0);
  expect(marked).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(bell).toBeFocused();
});
