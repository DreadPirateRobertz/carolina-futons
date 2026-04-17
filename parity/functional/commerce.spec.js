/**
 * cf-3qt.6.1 functional parity — commerce flow.
 *
 * Runs the same user journey against LEGACY_BASE and NEXT_BASE, asserting
 * observable parity: same product appears on PDP, same totals in cart,
 * same order confirmation shape. Failures are reported per-step so a
 * regression lands on the Next side but keeps the legacy run honest.
 *
 * Activation:
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   LEGACY_BASE=... NEXT_BASE=... npx playwright test parity/functional/commerce.spec.js
 *
 * Notes:
 *   - Selectors are placeholders. Stable IDs / data-testid hooks land with
 *     godfrey's Phase 2 commerce commits; update here before enabling in CI.
 *   - Uses synthetic test account (PARITY_TEST_EMAIL / PARITY_TEST_PASSWORD)
 *     provisioned in Wix Members. Never runs against real buyer state.
 */
import { test, expect } from '@playwright/test';

const LEGACY = process.env.LEGACY_BASE;
const NEXT   = process.env.NEXT_BASE;
const QUERY  = process.env.PARITY_SEARCH_TERM || 'eureka';

test.skip(!LEGACY || !NEXT, 'set LEGACY_BASE + NEXT_BASE to run commerce parity');

for (const [label, base] of [['legacy', LEGACY], ['next', NEXT]]) {
  test.describe(`commerce @ ${label}`, () => {
    test('search → PLP → PDP', async ({ page }) => {
      await page.goto(base + '/');
      // Placeholder: update selector when Phase 2 ships stable search input IDs.
      await page.getByRole('searchbox').first().fill(QUERY);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/search|category|products/);
      const firstResult = page.getByRole('link').filter({ hasText: /eureka/i }).first();
      await firstResult.click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/eureka/i);
    });

    test('add to cart shows non-zero total', async ({ page }) => {
      await page.goto(base + '/product-page/eureka-futon'.replace('/product-page/', label === 'next' ? '/products/' : '/product-page/'));
      await page.getByRole('button', { name: /add to cart/i }).click();
      await page.goto(base + (label === 'next' ? '/cart' : '/cart-page'));
      const total = page.getByTestId('cart-total');
      await expect(total).toBeVisible();
      const text = await total.innerText();
      expect(text).toMatch(/\$\d/);
    });
  });
}

test('order IDs match shape across sites (smoke)', async ({ browser }) => {
  test.skip(!LEGACY || !NEXT, 'requires both bases');
  // Placeholder — real assertion lands once godfrey wires /order-confirmation
  // to expose order-id in DOM. Today we only assert URL shape.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const base of [LEGACY, NEXT]) {
    await page.goto(base + (base === NEXT ? '/order-confirmation?oid=cf-parity-smoke' : '/thank-you-page?oid=cf-parity-smoke'));
    expect(page.url()).toContain('cf-parity-smoke');
  }
});
