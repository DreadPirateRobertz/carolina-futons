/**
 * cf-3qt.6.1 functional parity — content flow.
 *
 * Blog read, contact form submit, FAQ expand/collapse. Hits both bases and
 * asserts the user-visible journey lands the same in both worlds.
 *
 * Contact submit uses PARITY_CONTACT_BYPASS=1 to route to the staging
 * endpoint — never posts to the production inbox. blaidd exposes the
 * staging endpoint in Phase 4.
 */
import { test, expect } from '@playwright/test';

const LEGACY = process.env.LEGACY_BASE;
const NEXT   = process.env.NEXT_BASE;

test.skip(!LEGACY || !NEXT, 'set LEGACY_BASE + NEXT_BASE to run content parity');

for (const [label, base, paths] of [
  ['legacy', LEGACY, { blogIndex: '/blog', blogPost: '/post/how-to-pick-a-futon', faq: '/faq', contact: '/contact' }],
  ['next',   NEXT,   { blogIndex: '/blog', blogPost: '/blog/how-to-pick-a-futon', faq: '/faq', contact: '/contact' }],
]) {
  test.describe(`content @ ${label}`, () => {
    test('blog index lists posts', async ({ page }) => {
      await page.goto(base + paths.blogIndex);
      const links = page.getByRole('article').or(page.locator('a[href*="/blog"], a[href*="/post"]'));
      await expect(links.first()).toBeVisible();
    });

    test('blog post renders H1 and body', async ({ page }) => {
      await page.goto(base + paths.blogPost);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('article').or(page.locator('main'))).toBeVisible();
    });

    test('FAQ items expand on click', async ({ page }) => {
      await page.goto(base + paths.faq);
      const firstItem = page.getByRole('button').filter({ hasText: /\?$/ }).first();
      await firstItem.click();
      await expect(page.getByRole('region').first()).toBeVisible();
    });

    test('contact form submits (staging endpoint)', async ({ page }) => {
      await page.goto(base + paths.contact);
      await page.getByLabel(/name/i).fill('Parity Bot');
      await page.getByLabel(/email/i).fill('parity@carolinafutons.test');
      await page.getByLabel(/message/i).fill('cf-3qt.6.1 content parity smoke — ignore.');
      // Bypass flag prevents production dispatch.
      await page.evaluate(() => window.__PARITY_CONTACT_BYPASS__ = true);
      await page.getByRole('button', { name: /send|submit/i }).click();
      await expect(page.getByText(/thank you|received|sent/i)).toBeVisible();
    });
  });
}
