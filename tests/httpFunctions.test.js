import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import {
  get_health,
  get_productSitemap,
  get_blogSitemap,
  get_facebookCatalogFeed,
  get_pinterestProductFeed,
  get_checkWishlistAlerts,
  get_triggerBrowseRecoveryCron,
  get_triggerCartRecoveryCron,
  get_processEmailQueueCron,
  get_triggerReengagementCron,
} from '../src/backend/http-functions.js';

const sampleProducts = [
  {
    _id: 'prod-1',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon-frame',
    price: 499,
    discountedPrice: null,
    mainMedia: 'https://example.com/eureka.jpg',
    description: 'Solid hardwood futon frame.',
    inStock: true,
    collections: ['futon-frames'],
    _updatedDate: new Date('2026-01-15'),
  },
  {
    _id: 'prod-2',
    name: 'Moonshadow Futon Mattress',
    slug: 'moonshadow-futon-mattress',
    price: 349,
    discountedPrice: 299,
    mainMedia: 'https://example.com/moonshadow.jpg',
    description: '<p>Premium innerspring mattress.</p>',
    inStock: true,
    collections: ['mattresses'],
    _updatedDate: new Date('2026-02-01'),
    mediaItems: [
      { src: 'https://example.com/moon-1.jpg' },
      { src: 'https://example.com/moon-2.jpg' },
    ],
  },
  {
    _id: 'prod-3',
    name: 'Sagebrush Murphy Cabinet Bed',
    slug: 'sagebrush-murphy-cabinet-bed',
    price: 1899,
    discountedPrice: null,
    mainMedia: 'https://example.com/sagebrush.jpg',
    description: 'Queen Murphy cabinet bed.',
    inStock: false,
    collections: ['murphy-cabinet-beds'],
    _updatedDate: new Date('2026-02-10'),
  },
];

beforeEach(() => {
  __seed('Stores/Products', sampleProducts);

  // Mock secrets and fetch for googleMerchantFeed dependency
  __setSecrets({});
  __setHandler(() => ({
    ok: true,
    async json() { return {}; },
    async text() { return ''; },
  }));
});

// ── get_health ──────────────────────────────────────────────────────

describe('get_health', () => {
  it('returns 200 with ok status', () => {
    const result = get_health();
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('returns JSON content type', () => {
    const result = get_health();
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

// ── get_productSitemap ──────────────────────────────────────────────

describe('get_productSitemap', () => {
  it('returns XML with sitemap namespace', async () => {
    const result = await get_productSitemap();
    expect(result.status).toBe(200);
    expect(result.body).toContain('<?xml version="1.0"');
    expect(result.body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('includes static pages', async () => {
    const result = await get_productSitemap();
    expect(result.body).toContain('<loc>https://www.carolinafutons.com/</loc>');
    expect(result.body).toContain('/futon-frames</loc>');
    expect(result.body).toContain('/mattresses</loc>');
    expect(result.body).toContain('/murphy-cabinet-beds</loc>');
  });

  it('includes dynamic product URLs from CMS with URL-encoded slugs', async () => {
    const result = await get_productSitemap();
    expect(result.body).toContain('/product-page/eureka-futon-frame</loc>');
    expect(result.body).toContain('/product-page/moonshadow-futon-mattress</loc>');
    expect(result.body).toContain('/product-page/sagebrush-murphy-cabinet-bed</loc>');
  });

  it('includes lastmod from product update date', async () => {
    const result = await get_productSitemap();
    expect(result.body).toContain('<lastmod>2026-01-15</lastmod>');
  });

  it('sets XML content type header', async () => {
    const result = await get_productSitemap();
    expect(result.headers['Content-Type']).toContain('application/xml');
  });

  it('handles empty product list gracefully', async () => {
    __seed('Stores/Products', []);
    const result = await get_productSitemap();
    expect(result.status).toBe(200);
    // Should still have static pages
    expect(result.body).toContain('<loc>https://www.carolinafutons.com/</loc>');
  });
});

// ── get_blogSitemap ─────────────────────────────────────────────────

describe('get_blogSitemap', () => {
  it('returns XML with sitemap namespace', async () => {
    const result = await get_blogSitemap();
    expect(result.status).toBe(200);
    expect(result.body).toContain('<?xml version="1.0"');
    expect(result.body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('includes blog index page', async () => {
    const result = await get_blogSitemap();
    expect(result.body).toContain('<loc>https://www.carolinafutons.com/blog</loc>');
  });

  it('includes all pillar blog post URLs', async () => {
    const result = await get_blogSitemap();
    expect(result.body).toContain('/blog/best-futons-for-everyday-sleeping</loc>');
    expect(result.body).toContain('/blog/futon-frame-buying-guide</loc>');
    expect(result.body).toContain('/blog/how-to-choose-futon-mattress</loc>');
    expect(result.body).toContain('/blog/murphy-bed-vs-futon</loc>');
    expect(result.body).toContain('/blog/futon-care-guide</loc>');
    expect(result.body).toContain('/blog/futon-vs-sofa-bed</loc>');
    expect(result.body).toContain('/blog/small-space-furniture-guide</loc>');
    expect(result.body).toContain('/blog/platform-bed-guide</loc>');
  });

  it('includes lastmod from publishDate', async () => {
    const result = await get_blogSitemap();
    expect(result.body).toContain('<lastmod>2026-02-20</lastmod>');
  });

  it('sets XML content type with 1-hour cache', async () => {
    const result = await get_blogSitemap();
    expect(result.headers['Content-Type']).toContain('application/xml');
    expect(result.headers['Cache-Control']).toContain('max-age=3600');
  });

  it('sets blog posts at priority 0.6 and blog index at 0.7', async () => {
    const result = await get_blogSitemap();
    // Blog index should be higher priority
    const indexMatch = result.body.match(/<url>\s*<loc>[^<]*\/blog<\/loc>[\s\S]*?<priority>([\d.]+)<\/priority>/);
    expect(indexMatch).toBeTruthy();
    expect(indexMatch[1]).toBe('0.7');
  });

  it('escapes XML special characters in blog URLs', async () => {
    const result = await get_blogSitemap();
    // All URLs should be properly escaped — no raw & or < in loc elements
    expect(result.body).not.toMatch(/<loc>[^<]*[<>][^<]*<\/loc>/);
  });
});

// ── get_facebookCatalogFeed ─────────────────────────────────────────

describe('get_facebookCatalogFeed', () => {
  it('returns TSV with correct headers', async () => {
    const result = await get_facebookCatalogFeed();
    expect(result.status).toBe(200);
    const lines = result.body.split('\n');
    const headers = lines[0].split('\t');
    expect(headers).toContain('id');
    expect(headers).toContain('title');
    expect(headers).toContain('price');
    expect(headers).toContain('availability');
    expect(headers).toContain('brand');
  });

  it('includes product rows', async () => {
    const result = await get_facebookCatalogFeed();
    const lines = result.body.split('\n');
    // Header + 3 products
    expect(lines.length).toBe(4);
  });

  it('formats price with currency', async () => {
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('499.00 USD');
  });

  it('includes sale price for discounted products', async () => {
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('299.00 USD');
  });

  it('detects brand from collections', async () => {
    const result = await get_facebookCatalogFeed();
    // mattress collection -> Otis Bed
    expect(result.body).toContain('Otis Bed');
  });

  it('strips HTML from description', async () => {
    const result = await get_facebookCatalogFeed();
    expect(result.body).not.toContain('<p>');
    expect(result.body).toContain('Premium innerspring mattress.');
  });

  it('marks out-of-stock availability', async () => {
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('out of stock');
  });

  it('sets TSV content type header', async () => {
    const result = await get_facebookCatalogFeed();
    expect(result.headers['Content-Type']).toContain('text/tab-separated-values');
  });
});

// ── get_pinterestProductFeed ────────────────────────────────────────

describe('get_pinterestProductFeed', () => {
  it('returns TSV with Pinterest-specific headers', async () => {
    const result = await get_pinterestProductFeed();
    expect(result.status).toBe(200);
    const headers = result.body.split('\n')[0].split('\t');
    expect(headers).toContain('product_type');
    expect(headers).toContain('additional_image_link');
    expect(headers).toContain('google_product_category');
  });

  it('includes product rows', async () => {
    const result = await get_pinterestProductFeed();
    const lines = result.body.split('\n');
    expect(lines.length).toBe(4); // header + 3 products
  });

  it('detects product type from collections', async () => {
    const result = await get_pinterestProductFeed();
    // murphy-cabinet-beds -> Murphy Cabinet Beds
    expect(result.body).toContain('Murphy Cabinet Beds');
    // mattresses -> Futon Mattresses
    expect(result.body).toContain('Futon Mattresses');
  });

  it('includes additional image links (skips first, which is mainMedia)', async () => {
    const result = await get_pinterestProductFeed();
    // slice(1, 5) skips index 0 (mainMedia duplicate), includes index 1+
    expect(result.body).toContain('https://example.com/moon-2.jpg');
  });

  it('generates correct product URLs', async () => {
    const result = await get_pinterestProductFeed();
    expect(result.body).toContain('carolinafutons.com/product-page/eureka-futon-frame');
  });

  it('handles empty product list', async () => {
    __seed('Stores/Products', []);
    const result = await get_pinterestProductFeed();
    expect(result.status).toBe(200);
    const lines = result.body.split('\n');
    expect(lines.length).toBe(1); // only header
  });
});

// ── Cron Endpoint Auth Tests ────────────────────────────────────────

const cronRequest = (key) => ({ headers: { 'x-cron-secret': key } });

describe('get_checkWishlistAlerts', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'test-cron-key-123' });
    __seed('PriceSnapshots', []);
    __seed('WishlistItems', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('test-cron-key-123'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('returns 403 with invalid cron key', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with missing key', async () => {
    const result = await get_checkWishlistAlerts({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('returns JSON content type', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('test-cron-key-123'));
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('returns no-store cache control', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('test-cron-key-123'));
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
});

describe('get_triggerBrowseRecoveryCron', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'test-cron-key-123' });
    __seed('BrowseSessions', []);
    __seed('BrowseRecoveryEmails', []);
    __seed('Unsubscribes', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_triggerBrowseRecoveryCron(cronRequest('test-cron-key-123'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(typeof body.triggered).toBe('number');
    expect(typeof body.skipped).toBe('number');
  });

  it('returns 403 with invalid cron key', async () => {
    const result = await get_triggerBrowseRecoveryCron(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with no auth header', async () => {
    const result = await get_triggerBrowseRecoveryCron({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('returns JSON with no-store cache', async () => {
    const result = await get_triggerBrowseRecoveryCron(cronRequest('test-cron-key-123'));
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
});

describe('get_triggerCartRecoveryCron', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'test-cron-key-123' });
    __seed('AbandonedCarts', []);
    __seed('AbandonedCartEmails', []);
    __seed('Unsubscribes', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_triggerCartRecoveryCron(cronRequest('test-cron-key-123'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('returns 403 with invalid cron key', async () => {
    const result = await get_triggerCartRecoveryCron(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with missing key', async () => {
    const result = await get_triggerCartRecoveryCron({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('returns JSON with no-store cache', async () => {
    const result = await get_triggerCartRecoveryCron(cronRequest('test-cron-key-123'));
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
});

// ── Security: XSS in Sitemap (slug injection) ────────────────────────

describe('Sitemap XSS prevention', () => {
  it('URL-encodes malicious slugs to prevent XML injection', async () => {
    __seed('Stores/Products', [{
      _id: 'xss-1',
      name: 'XSS Test',
      slug: '"><script>alert(1)</script>',
      price: 100,
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }]);
    const result = await get_productSitemap();
    expect(result.body).not.toContain('<script>');
    expect(result.body).toContain(encodeURIComponent('"><script>alert(1)</script>'));
  });

  it('escapes XML special characters in sitemap loc values', async () => {
    __seed('Stores/Products', [{
      _id: 'xml-1',
      name: 'XML Escape Test',
      slug: 'test&product<name>',
      price: 100,
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }]);
    const result = await get_productSitemap();
    // After encodeURIComponent + escapeXml, raw & and < should not appear unescaped
    expect(result.body).not.toMatch(/<loc>[^<]*[<>][^<]*<\/loc>/);
  });

  it('handles empty slug gracefully', async () => {
    __seed('Stores/Products', [{
      _id: 'empty-slug',
      name: 'No Slug',
      slug: '',
      price: 100,
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }]);
    const result = await get_productSitemap();
    expect(result.status).toBe(200);
    expect(result.body).toContain('/product-page/</loc>');
  });

  it('handles null _updatedDate without error', async () => {
    __seed('Stores/Products', [{
      _id: 'no-date',
      name: 'No Date',
      slug: 'no-date',
      price: 100,
      inStock: true,
      collections: [],
      _updatedDate: null,
    }]);
    const result = await get_productSitemap();
    expect(result.status).toBe(200);
    expect(result.body).toContain('/product-page/no-date</loc>');
  });
});

// ── Security: HTML Entity XSS in Feed Descriptions ──────────────────

describe('Feed description XSS prevention', () => {
  const xssProducts = [
    {
      _id: 'entity-xss',
      name: 'Entity XSS Product',
      slug: 'entity-xss',
      price: 299,
      discountedPrice: null,
      mainMedia: 'https://example.com/img.jpg',
      description: 'Nice product &#60;script&#62;alert("xss")&#60;/script&#62; with features',
      inStock: true,
      collections: ['futon-frames'],
      _updatedDate: new Date(),
    },
  ];

  it('strips entity-encoded script tags from Facebook feed', async () => {
    __seed('Stores/Products', xssProducts);
    const result = await get_facebookCatalogFeed();
    expect(result.body).not.toContain('<script>');
    expect(result.body).not.toContain('&#60;script');
    expect(result.body).toContain('Nice product');
  });

  it('strips entity-encoded script tags from Pinterest feed', async () => {
    __seed('Stores/Products', xssProducts);
    const result = await get_pinterestProductFeed();
    expect(result.body).not.toContain('<script>');
    expect(result.body).not.toContain('&#60;script');
    expect(result.body).toContain('Nice product');
  });

  it('strips hex entity-encoded tags from feeds', async () => {
    __seed('Stores/Products', [{
      _id: 'hex-xss',
      name: 'Hex Entity Test',
      slug: 'hex-entity',
      price: 199,
      discountedPrice: null,
      mainMedia: 'https://example.com/img.jpg',
      description: 'Test &#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e; end',
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).not.toContain('<script>');
    expect(result.body).toContain('Test');
  });

  it('handles named HTML entities (&lt; &gt;) in descriptions', async () => {
    __seed('Stores/Products', [{
      _id: 'named-xss',
      name: 'Named Entity',
      slug: 'named-entity',
      price: 99,
      discountedPrice: null,
      mainMedia: 'https://example.com/img.jpg',
      description: 'Compare &lt;script&gt;alert(1)&lt;/script&gt; end',
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).not.toContain('<script>');
    expect(result.body).toContain('Compare');
  });

  it('handles null/undefined descriptions without error', async () => {
    __seed('Stores/Products', [{
      _id: 'null-desc',
      name: 'No Description',
      slug: 'no-desc',
      price: 99,
      discountedPrice: null,
      mainMedia: 'https://example.com/img.jpg',
      description: null,
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.status).toBe(200);
  });
});

// ── Security: Constant-Time Secret Comparison ───────────────────────

describe('Cron endpoint timing-safe auth', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'correct-key-abc123' });
    __seed('PriceSnapshots', []);
    __seed('WishlistItems', []);
    __seed('BrowseSessions', []);
    __seed('BrowseRecoveryEmails', []);
    __seed('AbandonedCarts', []);
    __seed('AbandonedCartEmails', []);
    __seed('Unsubscribes', []);
    __seed('EmailQueue', []);
  });

  it('rejects key with same prefix but different suffix', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('correct-key-abc12X'));
    expect(result.status).toBe(403);
  });

  it('rejects key with same length but different content', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('xxxxxxx-xxx-xxxxxx'));
    expect(result.status).toBe(403);
  });

  it('rejects empty string key', async () => {
    const result = await get_checkWishlistAlerts(cronRequest(''));
    expect(result.status).toBe(403);
  });

  it('rejects null/undefined key', async () => {
    const result = await get_checkWishlistAlerts({ headers: { 'x-cron-secret': null } });
    expect(result.status).toBe(403);
  });

  it('rejects missing x-cron-secret header', async () => {
    const result = await get_checkWishlistAlerts({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('accepts exact correct key', async () => {
    const result = await get_checkWishlistAlerts(cronRequest('correct-key-abc123'));
    expect(result.status).toBe(200);
  });
});

// ── New Cron Endpoints Auth Tests ───────────────────────────────────

describe('get_processEmailQueueCron', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'test-cron-key-123' });
    __seed('EmailQueue', []);
    __seed('AbandonedCarts', []);
    __seed('Unsubscribes', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_processEmailQueueCron(cronRequest('test-cron-key-123'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(typeof body.sent).toBe('number');
    expect(typeof body.failed).toBe('number');
    expect(typeof body.cancelled).toBe('number');
  });

  it('returns 403 with invalid cron key', async () => {
    const result = await get_processEmailQueueCron(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with missing key', async () => {
    const result = await get_processEmailQueueCron({ headers: {} });
    expect(result.status).toBe(403);
  });
});

describe('get_triggerReengagementCron', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'test-cron-key-123' });
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_triggerReengagementCron(cronRequest('test-cron-key-123'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(typeof body.contacted).toBe('number');
  });

  it('returns 403 with invalid cron key', async () => {
    const result = await get_triggerReengagementCron(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with missing key', async () => {
    const result = await get_triggerReengagementCron({ headers: {} });
    expect(result.status).toBe(403);
  });
});

// ── Feed Pagination (catalog > 200 products) ─────────────────────────

describe('Feed pagination (fetchAllProducts)', () => {
  it('facebook feed includes products beyond the 200 limit', async () => {
    // Create 205 products to exceed old 200 limit
    const manyProducts = Array.from({ length: 205 }, (_, i) => ({
      _id: `bulk-${i}`,
      name: `Product ${i}`,
      slug: `product-${i}`,
      price: 100 + i,
      discountedPrice: null,
      mainMedia: 'https://example.com/img.jpg',
      description: `Description for product ${i}`,
      inStock: true,
      collections: ['futon-frames'],
      _updatedDate: new Date(),
    }));
    __seed('Stores/Products', manyProducts);

    const result = await get_facebookCatalogFeed();
    const lines = result.body.split('\n');
    // header + 205 product rows
    expect(lines.length).toBe(206);
    expect(result.body).toContain('Product 204');
  });

  it('sitemap includes products beyond the 200 limit', async () => {
    const manyProducts = Array.from({ length: 205 }, (_, i) => ({
      _id: `sitemap-${i}`,
      name: `Sitemap Product ${i}`,
      slug: `sitemap-product-${i}`,
      price: 100,
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }));
    __seed('Stores/Products', manyProducts);

    const result = await get_productSitemap();
    expect(result.body).toContain('sitemap-product-204');
  });

  it('pinterest feed includes products beyond the 200 limit', async () => {
    const manyProducts = Array.from({ length: 205 }, (_, i) => ({
      _id: `pin-${i}`,
      name: `Pin Product ${i}`,
      slug: `pin-product-${i}`,
      price: 100,
      discountedPrice: null,
      mainMedia: 'https://example.com/img.jpg',
      description: `Pin desc ${i}`,
      inStock: true,
      collections: [],
      _updatedDate: new Date(),
    }));
    __seed('Stores/Products', manyProducts);

    const result = await get_pinterestProductFeed();
    const lines = result.body.split('\n');
    expect(lines.length).toBe(206);
    expect(result.body).toContain('Pin Product 204');
  });

  it('handles empty catalog for all feeds', async () => {
    __seed('Stores/Products', []);
    const [sitemap, fb, pin] = await Promise.all([
      get_productSitemap(),
      get_facebookCatalogFeed(),
      get_pinterestProductFeed(),
    ]);
    expect(sitemap.status).toBe(200);
    expect(fb.status).toBe(200);
    expect(pin.status).toBe(200);
  });
});

// ── Feed URL encoding in product links ──────────────────────────────

describe('Feed URL encoding', () => {
  const specialSlugProducts = [{
    _id: 'special-slug',
    name: 'Special Slug Product',
    slug: 'product with spaces & special<chars>',
    price: 299,
    discountedPrice: null,
    mainMedia: 'https://example.com/img.jpg',
    description: 'Test product',
    inStock: true,
    collections: [],
    _updatedDate: new Date(),
  }];

  it('URL-encodes slugs in Facebook feed links', async () => {
    __seed('Stores/Products', specialSlugProducts);
    const result = await get_facebookCatalogFeed();
    expect(result.body).not.toContain('product with spaces');
    expect(result.body).toContain(encodeURIComponent('product with spaces & special<chars>'));
  });

  it('URL-encodes slugs in Pinterest feed links', async () => {
    __seed('Stores/Products', specialSlugProducts);
    const result = await get_pinterestProductFeed();
    expect(result.body).not.toContain('product with spaces');
    expect(result.body).toContain(encodeURIComponent('product with spaces & special<chars>'));
  });
});
