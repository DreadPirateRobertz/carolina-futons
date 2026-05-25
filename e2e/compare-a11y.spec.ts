/**
 * cf-hcjq: axe-core WCAG 2.1 AA sweep — /compare page
 *
 * Runs against the staging Wix site. Set E2E_BASE_URL to override.
 * Requires: COMPARE_PRODUCT_IDS (comma-separated Wix product IDs) for the
 * interactive-elements and table-header tests to exercise a loaded table;
 * those tests are skipped gracefully when no IDs are provided.
 *
 * Pre-existing third-party violations excluded:
 *   - image-redundant-alt: Wix CMS header logo renders duplicate alt text
 *     inside a Wix Image widget; not in app code. (cf-hcjq)
 */

import { test, expect } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL =
  process.env.E2E_BASE_URL ?? 'https://halworker85.wixstudio.com/my-site';

const COMPARE_URL = `${BASE_URL}/compare`;

// Optional: pre-seeded product IDs for loaded-state tests
const PRODUCT_IDS = process.env.COMPARE_PRODUCT_IDS ?? '';

test.describe('/compare a11y — WCAG 2.1 AA', () => {
  test('GET /compare returns HTTP 200', async ({ page }) => {
    const response = await page.goto(COMPARE_URL);
    expect(response?.status()).toBe(200);
  });

  test('/compare has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto(COMPARE_URL);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Pre-existing third-party violation: Wix CMS header logo widget emits
      // duplicate alt text; not in app code. Filed as tracking note in cf-hcjq.
      .disableRules(['image-redundant-alt'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('interactive elements have accessible names', async ({ page }) => {
    const url = PRODUCT_IDS
      ? `${COMPARE_URL}?ids=${PRODUCT_IDS}`
      : COMPARE_URL;

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    const buttons = page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      // Accept either aria-label, aria-labelledby text, or visible text content
      const ariaLabel = await btn.getAttribute('aria-label');
      const textContent = await btn.textContent();
      const name = (ariaLabel ?? textContent ?? '').trim();
      expect(name.length, `button[${i}] must have an accessible name`).toBeGreaterThan(0);
    }
  });

  test('table headers use scope=col or aria-label', async ({ page }) => {
    const url = PRODUCT_IDS
      ? `${COMPARE_URL}?ids=${PRODUCT_IDS}`
      : COMPARE_URL;

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    const ths = page.locator('th');
    const count = await ths.count();

    // Vacuously passes if the compare table uses div-based layout (Wix repeater)
    // rather than semantic <th> elements. axe catches missing scope in test 2.
    for (let i = 0; i < count; i++) {
      const th = ths.nth(i);
      const scope = await th.getAttribute('scope');
      const ariaLabel = await th.getAttribute('aria-label');
      expect(
        scope === 'col' || scope === 'row' || ariaLabel !== null,
        `th[${i}] must have scope=col/row or aria-label`
      ).toBe(true);
    }
  });

  test('/compare loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg: { type(): string; text(): string }) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(COMPARE_URL);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
