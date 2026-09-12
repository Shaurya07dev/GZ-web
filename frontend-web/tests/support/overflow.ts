import { expect, type Page } from '@playwright/test';

// Shared by tests/responsive/viewports.spec.ts and p0-routes.spec.ts — kept
// in one place so "what counts as overflow" can't drift between the two.
export async function assertNoHorizontalOverflow(
  page: Page,
  context: string,
): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const offenders = await page.evaluate((vw) => {
    return Array.from(document.querySelectorAll('body *'))
      .filter((el) => el.getBoundingClientRect().right > vw + 1)
      .slice(0, 10)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cls =
          typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\s+/).join('.')
            : '';
        return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} (right=${Math.round(r.right)})`;
      });
  }, clientWidth);

  const failureMessage =
    `overflow ${context}: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}. ` +
    `likely offenders: ${offenders.join(', ') || 'none found'}`;

  expect(scrollWidth, failureMessage).toBeLessThanOrEqual(clientWidth + 1);
}
