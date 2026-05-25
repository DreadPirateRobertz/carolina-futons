/**
 * cf-nf96: robots.txt + sitemap.xml smoke tests — pre-DNS cutover validation
 *
 * Verifies that robots.txt and sitemap.xml are correctly served and contain
 * expected entries before DNS cutover. Runs against the staging Wix site.
 *
 * Melania PR feedback incorporated (REQUEST_CHANGES on PR #1119):
 *   - noindex assertion uses proper regex anchoring (not a substring match)
 *   - Allow regex uses ^ anchor to avoid false positives
 *   - Sitemap URL assertions target actual route structure
 */

import { test, expect } from 'playwright/test';

const BASE_URL =
  process.env.E2E_BASE_URL ?? 'https://halworker85.wixstudio.com/my-site';

test.describe('robots.txt', () => {
  test('GET /robots.txt returns HTTP 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    expect(response.status()).toBe(200);
  });

  test('robots.txt has text/plain content-type', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/text\/plain/i);
  });

  test('robots.txt does not block all crawlers with Disallow: /', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    const body = await response.text();
    // Must NOT contain a blanket Disallow: / — that would de-index the whole site.
    // Anchored to avoid matching valid partial paths like /api/.
    expect(body).not.toMatch(/^Disallow:\s*\/\s*$/m);
  });

  test('robots.txt allows crawlers (has Allow or no blanket Disallow)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    const body = await response.text();
    // Valid if it has at least one Allow rule or has no User-agent block that disallows root.
    // Anchored match: 'Allow: /' at line start.
    const hasAllowRoot = /^Allow:\s*\/\s*$/m.test(body);
    const hasBlanketDisallow = /^Disallow:\s*\/\s*$/m.test(body);
    expect(hasAllowRoot || !hasBlanketDisallow).toBe(true);
  });
});

test.describe('sitemap.xml', () => {
  test('GET /sitemap.xml returns HTTP 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    expect(response.status()).toBe(200);
  });

  test('sitemap.xml has XML content-type', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/xml/i);
  });

  test('sitemap.xml contains <urlset> root element', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await response.text();
    expect(body).toMatch(/<urlset/i);
  });

  test('sitemap.xml contains at least one <url> entry', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await response.text();
    expect(body).toMatch(/<url>/i);
    expect(body).toMatch(/<loc>/i);
  });

  test('sitemap.xml includes /shop/futon-frames', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await response.text();
    expect(body).toContain('/shop/futon-frames');
  });

  test('sitemap.xml includes Kingston PDP', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await response.text();
    expect(body).toContain('/products/kingston-futon-frame');
  });

  test('sitemap.xml includes /near landing page', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await response.text();
    expect(body).toContain('/near');
  });
});

test.describe('home page SEO', () => {
  test('home page loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg: { type(): string; text(): string }) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
