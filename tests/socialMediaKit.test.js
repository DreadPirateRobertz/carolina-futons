import { describe, it, expect } from 'vitest';
import { futonFrame, murphyBed, outdoorFrame } from './fixtures/products.js';
import {
  getShareUrls,
  getProductShareUrls,
  validateSocialMeta,
  checkProductSocialReadiness,
  getProductSocialMetaHtml,
  getFeedStatus,
} from '../src/backend/socialMediaKit.web.js';

// ── getShareUrls ────────────────────────────────────────────────────

describe('getShareUrls', () => {
  it('generates share URLs for all platforms', async () => {
    const urls = await getShareUrls({
      url: 'https://www.carolinafutons.com/product-page/eureka',
      title: 'Eureka Futon Frame',
    });

    expect(urls).toHaveProperty('facebook');
    expect(urls).toHaveProperty('twitter');
    expect(urls).toHaveProperty('pinterest');
    expect(urls).toHaveProperty('email');
    expect(urls).toHaveProperty('linkedin');
  });

  it('encodes URL components properly', async () => {
    const urls = await getShareUrls({
      url: 'https://www.carolinafutons.com/product-page/test product',
      title: 'Test & Product',
    });

    expect(urls.facebook).toContain(encodeURIComponent('https://www.carolinafutons.com/product-page/test product'));
    expect(urls.twitter).toContain(encodeURIComponent('Test & Product'));
  });

  it('includes Pinterest media param when image provided', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: 'Test',
      image: 'https://example.com/img.jpg',
    });

    expect(urls.pinterest).toContain('media=');
  });

  it('omits Pinterest media param when no image', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: 'Test',
    });

    expect(urls.pinterest).not.toContain('media=');
  });

  it('returns empty object when no URL', async () => {
    const urls = await getShareUrls({ url: '', title: 'Test' });
    expect(urls).toEqual({});
  });

  it('generates valid mailto link with description', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: 'Test',
      description: 'A description',
    });

    expect(urls.email).toContain('mailto:?');
    expect(urls.email).toContain('subject=');
    expect(urls.email).toContain('body=');
  });
});

// ── getProductShareUrls ─────────────────────────────────────────────

describe('getProductShareUrls', () => {
  it('generates product-specific share URLs', async () => {
    const urls = await getProductShareUrls(futonFrame);

    expect(urls.facebook).toContain('carolinafutons.com');
    expect(urls.twitter).toContain('Eureka');
    expect(urls.pinterest).toContain('eureka-futon-frame');
    expect(urls.productUrl).toBe('https://www.carolinafutons.com/product-page/eureka-futon-frame');
  });

  it('includes price in Twitter text', async () => {
    const urls = await getProductShareUrls(futonFrame);
    expect(urls.twitter).toContain(encodeURIComponent('$499.00'));
  });

  it('includes product image in Pinterest URL', async () => {
    const urls = await getProductShareUrls(futonFrame);
    expect(urls.pinterest).toContain(encodeURIComponent('https://example.com/eureka.jpg'));
  });

  it('returns empty object for null product', async () => {
    const urls = await getProductShareUrls(null);
    expect(urls).toEqual({});
  });

  it('returns empty object for product without slug', async () => {
    const urls = await getProductShareUrls({ name: 'Test' });
    expect(urls).toEqual({});
  });

  it('includes LinkedIn share URL', async () => {
    const urls = await getProductShareUrls(futonFrame);
    expect(urls.linkedin).toContain('linkedin.com');
  });
});

// ── validateSocialMeta ──────────────────────────────────────────────

describe('validateSocialMeta', () => {
  const completeMeta = {
    'og:type': 'product',
    'og:title': 'Eureka Futon Frame | Carolina Futons',
    'og:description': 'Solid hardwood futon frame.',
    'og:url': 'https://www.carolinafutons.com/product-page/eureka',
    'og:image': 'https://example.com/eureka.jpg',
    'og:site_name': 'Carolina Futons',
    'twitter:card': 'summary_large_image',
    'twitter:title': 'Eureka Futon Frame | Carolina Futons',
    'twitter:description': 'Solid hardwood futon frame.',
    'twitter:image': 'https://example.com/eureka.jpg',
    'product:price:amount': '499.00',
    'product:price:currency': 'USD',
    'product:availability': 'instock',
  };

  it('returns perfect score for complete meta', async () => {
    const result = await validateSocialMeta(completeMeta);
    expect(result.score).toBe(15);
    expect(result.issues).toHaveLength(0);
    expect(result.platforms.facebook.ready).toBe(true);
    expect(result.platforms.twitter.ready).toBe(true);
    expect(result.platforms.pinterest.ready).toBe(true);
  });

  it('identifies missing OG tags', async () => {
    const partial = { 'og:title': 'Test', 'og:description': 'Desc' };
    const result = await validateSocialMeta(partial);
    expect(result.platforms.facebook.ready).toBe(false);
    expect(result.issues.some(i => i.includes('og:image'))).toBe(true);
  });

  it('identifies missing Twitter tags', async () => {
    const partial = { 'og:title': 'T', 'og:description': 'D', 'og:image': 'https://i.com', 'og:url': 'https://u.com', 'og:type': 'product' };
    const result = await validateSocialMeta(partial);
    expect(result.platforms.twitter.ready).toBe(false);
  });

  it('warns about long og:title', async () => {
    const meta = { ...completeMeta, 'og:title': 'X'.repeat(100) };
    const result = await validateSocialMeta(meta);
    expect(result.issues.some(i => i.includes('og:title exceeds 95'))).toBe(true);
  });

  it('warns about non-absolute og:image', async () => {
    const meta = { ...completeMeta, 'og:image': '/relative/path.jpg' };
    const result = await validateSocialMeta(meta);
    expect(result.issues.some(i => i.includes('absolute URL'))).toBe(true);
  });

  it('warns about invalid twitter:card value', async () => {
    const meta = { ...completeMeta, 'twitter:card': 'invalid_type' };
    const result = await validateSocialMeta(meta);
    expect(result.issues.some(i => i.includes('twitter:card has invalid value'))).toBe(true);
  });

  it('returns zero score for null meta', async () => {
    const result = await validateSocialMeta(null);
    expect(result.score).toBe(0);
    expect(result.issues).toContain('No meta tags provided');
  });

  it('returns platform-level scores', async () => {
    const result = await validateSocialMeta(completeMeta);
    expect(result.platforms.facebook.maxScore).toBe(5);
    expect(result.platforms.twitter.maxScore).toBe(4);
    expect(result.platforms.pinterest.maxScore).toBe(6);
  });
});

// ── checkProductSocialReadiness ─────────────────────────────────────

describe('checkProductSocialReadiness', () => {
  it('returns ready=true for a complete product', async () => {
    const result = await checkProductSocialReadiness(futonFrame);
    expect(result.ready).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(14);
    expect(result.meta).toHaveProperty('og:type', 'product');
    expect(result.meta).toHaveProperty('twitter:card', 'summary_large_image');
  });

  it('includes product URL in meta', async () => {
    const result = await checkProductSocialReadiness(futonFrame);
    expect(result.meta['og:url']).toContain('eureka-futon-frame');
  });

  it('includes price in meta', async () => {
    const result = await checkProductSocialReadiness(futonFrame);
    expect(result.meta['product:price:amount']).toBe('499.00');
    expect(result.meta['product:price:currency']).toBe('USD');
  });

  it('shows instock for in-stock product', async () => {
    const result = await checkProductSocialReadiness(futonFrame);
    expect(result.meta['product:availability']).toBe('instock');
  });

  it('shows oos for out-of-stock product', async () => {
    const result = await checkProductSocialReadiness(outdoorFrame);
    expect(result.meta['product:availability']).toBe('oos');
  });

  it('returns not ready for null product', async () => {
    const result = await checkProductSocialReadiness(null);
    expect(result.ready).toBe(false);
    expect(result.score).toBe(0);
  });

  it('returns issues array', async () => {
    const result = await checkProductSocialReadiness(futonFrame);
    expect(Array.isArray(result.issues)).toBe(true);
  });
});

// ── getProductSocialMetaHtml ────────────────────────────────────────

describe('getProductSocialMetaHtml', () => {
  it('returns HTML meta tag string', async () => {
    const html = await getProductSocialMetaHtml(futonFrame);
    expect(html).toContain('<meta');
    expect(html).toContain('og:type');
    expect(html).toContain('twitter:card');
  });

  it('uses property attr for OG tags and name for Twitter', async () => {
    const html = await getProductSocialMetaHtml(futonFrame);
    expect(html).toContain('property="og:type"');
    expect(html).toContain('name="twitter:card"');
  });

  it('escapes HTML entities in content', async () => {
    const product = {
      ...futonFrame,
      name: 'Frame "Special" & <New>',
      slug: 'test-frame',
    };
    const html = await getProductSocialMetaHtml(product);
    // Should not contain raw & (unescaped) — all & should be &amp;
    // Check that raw special chars are escaped
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    // Should not contain raw < or > in content attributes
    expect(html).not.toContain('content="Frame "Special"');
  });

  it('returns empty string for null product', async () => {
    const html = await getProductSocialMetaHtml(null);
    expect(html).toBe('');
  });
});

// ── getFeedStatus ───────────────────────────────────────────────────

describe('getFeedStatus', () => {
  it('returns status for all feed endpoints', async () => {
    const status = await getFeedStatus();
    expect(status).toHaveProperty('googleShopping');
    expect(status).toHaveProperty('facebookCatalog');
    expect(status).toHaveProperty('pinterestCatalog');
    expect(status).toHaveProperty('sitemap');
  });

  it('includes endpoint URLs', async () => {
    const status = await getFeedStatus();
    expect(status.googleShopping.endpoint).toContain('googleShoppingFeed');
    expect(status.facebookCatalog.endpoint).toContain('facebookCatalogFeed');
    expect(status.pinterestCatalog.endpoint).toContain('pinterestProductFeed');
  });

  it('shows all feeds as configured', async () => {
    const status = await getFeedStatus();
    expect(status.googleShopping.configured).toBe(true);
    expect(status.facebookCatalog.configured).toBe(true);
    expect(status.pinterestCatalog.configured).toBe(true);
    expect(status.sitemap.configured).toBe(true);
  });
});
