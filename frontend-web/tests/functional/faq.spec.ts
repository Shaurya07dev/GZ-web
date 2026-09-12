import { test, expect } from '@playwright/test';
import { dismissCookieConsent } from '../support/settle';

// Phase 6 functional testing: FAQ page — Tabs (General/Artists/Buyers) and
// an Accordion of Q&A items nested inside each tab panel.

test('FAQ tabs switch selection and actually swap the visible content', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/faq');

  const generalTab = page.getByRole('tab', { name: 'General' });
  const artistsTab = page.getByRole('tab', { name: 'Artists' });
  await expect(generalTab).toHaveAttribute('aria-selected', 'true');
  await expect(artistsTab).toHaveAttribute('aria-selected', 'false');

  const generalPanelText = await page.getByRole('tabpanel').textContent();

  await artistsTab.click();
  await expect(artistsTab).toHaveAttribute('aria-selected', 'true');
  await expect(generalTab).toHaveAttribute('aria-selected', 'false');

  const artistsPanelText = await page.getByRole('tabpanel').textContent();
  expect(artistsPanelText).not.toBe(generalPanelText);
  await expect(page.getByText('How can I list my artwork?')).toBeVisible();
});

test('FAQ accordion item expands to reveal its answer and collapses again', async ({ page }) => {
  await dismissCookieConsent(page);
  await page.goto('/faq');

  const question = page.getByRole('button', { name: 'What is GalleryZone?' });
  await expect(question).toHaveAttribute('aria-expanded', 'false');

  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'true');

  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'false');
});
