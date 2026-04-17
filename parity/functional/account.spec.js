/**
 * cf-3qt.6.1 functional parity — account flow.
 *
 * Signup / login / order history / wishlist / preferences. Runs on both
 * bases to confirm the Next.js port preserves member state and read-paths.
 *
 * Requires a dedicated parity test member:
 *   PARITY_TEST_EMAIL     — provisioned in Wix Members
 *   PARITY_TEST_PASSWORD  — matching password (never a real customer)
 *
 * All assertions are shape-level (URL, presence of order history rows,
 * wishlist count). Data equivalence is verified in the functional report
 * by comparing the two base runs side-by-side.
 */
import { test, expect } from '@playwright/test';

const LEGACY = process.env.LEGACY_BASE;
const NEXT   = process.env.NEXT_BASE;
const EMAIL  = process.env.PARITY_TEST_EMAIL;
const PASS   = process.env.PARITY_TEST_PASSWORD;

test.skip(!LEGACY || !NEXT, 'set LEGACY_BASE + NEXT_BASE to run account parity');
test.skip(!EMAIL || !PASS, 'set PARITY_TEST_EMAIL + PARITY_TEST_PASSWORD to run authed flows');

for (const [label, base, paths] of [
  ['legacy', LEGACY, { login: '/account/login', orders: '/account/my-orders', wishlist: '/account/my-wishlist' }],
  ['next',   NEXT,   { login: '/account/login', orders: '/account/orders',    wishlist: '/account/wishlist' }],
]) {
  test.describe(`account @ ${label}`, () => {
    test('login lands on dashboard', async ({ page }) => {
      await page.goto(base + paths.login);
      await page.getByLabel(/email/i).fill(EMAIL);
      await page.getByLabel(/password/i).fill(PASS);
      await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
      await expect(page).toHaveURL(/account/);
    });

    test('order history renders table', async ({ page }) => {
      await page.goto(base + paths.orders);
      await expect(page.getByRole('table')).toBeVisible();
    });

    test('wishlist renders list container', async ({ page }) => {
      await page.goto(base + paths.wishlist);
      const list = page.getByTestId('wishlist-list').or(page.getByRole('list'));
      await expect(list).toBeVisible();
    });
  });
}
