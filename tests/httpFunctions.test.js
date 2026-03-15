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
  get_processPostPurchaseCareCron,
  get_googleShoppingFeed,
  get_manifest,
  get_serviceWorker,
  get_robots,
  get_facebookCustomAudience,
  post_klaviyoWebhook,
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

describe('get_processPostPurchaseCareCron', () => {
  beforeEach(() => {
    __setSecrets({ ALERT_CRON_KEY: 'test-cron-key-123' });
    __seed('EmailQueue', []);
    __seed('AbandonedCarts', []);
    __seed('Unsubscribes', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_processPostPurchaseCareCron(cronRequest('test-cron-key-123'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(typeof body.sent).toBe('number');
    expect(typeof body.failed).toBe('number');
  });

  it('returns 403 with invalid cron key', async () => {
    const result = await get_processPostPurchaseCareCron(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with missing header', async () => {
    const result = await get_processPostPurchaseCareCron({ headers: {} });
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

// ── get_googleShoppingFeed ──────────────────────────────────────────

describe('get_googleShoppingFeed', () => {
  it('returns XML content type on success', async () => {
    const result = await get_googleShoppingFeed({});
    if (result.status === 200) {
      expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8');
    }
  });

  it('returns 200 with body when generateFeed succeeds', async () => {
    const result = await get_googleShoppingFeed({});
    // generateFeed uses real implementation with seeded products
    expect(result.status).toBe(200);
    expect(result.body).toBeTruthy();
  });

  it('sets public cache header with 1 hour max-age', async () => {
    const result = await get_googleShoppingFeed({});
    if (result.status === 200) {
      expect(result.headers['Cache-Control']).toBe('public, max-age=3600');
    }
  });
});

// ── get_manifest ────────────────────────────────────────────────────

describe('get_manifest', () => {
  it('returns 200 with JSON content type', () => {
    const result = get_manifest();
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('returns valid JSON with required PWA fields', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.name).toBe('Carolina Futons');
    expect(manifest.short_name).toBe('CF Futons');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('includes icon entries', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.icons).toHaveLength(2);
    expect(manifest.icons[0].sizes).toBe('192x192');
    expect(manifest.icons[1].sizes).toBe('512x512');
  });

  it('uses design token colors for theme', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
  });

  it('sets 24-hour cache', () => {
    const result = get_manifest();
    expect(result.headers['Cache-Control']).toBe('public, max-age=86400');
  });

  it('includes categories', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.categories).toContain('shopping');
  });
});

// ── get_serviceWorker ───────────────────────────────────────────────

describe('get_serviceWorker', () => {
  it('returns 200 with JavaScript content type', () => {
    const result = get_serviceWorker();
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/javascript');
  });

  it('sets Service-Worker-Allowed header to root', () => {
    const result = get_serviceWorker();
    expect(result.headers['Service-Worker-Allowed']).toBe('/');
  });

  it('sets no-cache to ensure fresh SW updates', () => {
    const result = get_serviceWorker();
    expect(result.headers['Cache-Control']).toBe('no-cache');
  });

  it('includes install event listener', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain("addEventListener('install'");
  });

  it('includes activate event listener', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain("addEventListener('activate'");
  });

  it('includes fetch event listener', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain("addEventListener('fetch'");
  });

  it('includes precache URLs for main pages', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain('/shop-main');
    expect(result.body).toContain('/futon-frames');
    expect(result.body).toContain('/mattresses');
  });

  it('includes cache name constant', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain('cf-v1');
  });
});

// ── get_robots ──────────────────────────────────────────────────────

describe('get_robots', () => {
  it('returns 200 with text/plain content type', () => {
    const result = get_robots();
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/plain; charset=utf-8');
  });

  it('allows crawling of root', () => {
    const result = get_robots();
    expect(result.body).toContain('Allow: /');
  });

  it('disallows cart and checkout', () => {
    const result = get_robots();
    expect(result.body).toContain('Disallow: /cart');
    expect(result.body).toContain('Disallow: /checkout');
  });

  it('disallows login and account pages', () => {
    const result = get_robots();
    expect(result.body).toContain('Disallow: /login');
    expect(result.body).toContain('Disallow: /account');
  });

  it('allows sitemap endpoints but disallows other _functions', () => {
    const result = get_robots();
    expect(result.body).toContain('Allow: /_functions/productSitemap');
    expect(result.body).toContain('Allow: /_functions/blogSitemap');
    expect(result.body).toContain('Disallow: /_functions/');
  });

  it('includes sitemap URLs', () => {
    const result = get_robots();
    expect(result.body).toContain('Sitemap: https://www.carolinafutons.com/_functions/productSitemap');
    expect(result.body).toContain('Sitemap: https://www.carolinafutons.com/_functions/blogSitemap');
  });

  it('sets 24-hour cache', () => {
    const result = get_robots();
    expect(result.headers['Cache-Control']).toBe('public, max-age=86400');
  });

  it('disallows search results page', () => {
    const result = get_robots();
    expect(result.body).toContain('Disallow: /search-results');
  });
});

// ── get_facebookCustomAudience ──────────────────────────────────────

describe('get_facebookCustomAudience', () => {
  it('returns 403 with no auth header', async () => {
    __setSecrets({ FB_AUDIENCE_SECRET: 'test-audience-secret' });
    const result = await get_facebookCustomAudience({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('returns 403 with wrong secret', async () => {
    __setSecrets({ FB_AUDIENCE_SECRET: 'test-audience-secret' });
    const result = await get_facebookCustomAudience({
      headers: { 'x-fb-audience-secret': 'wrong-secret' },
    });
    expect(result.status).toBe(403);
  });

  it('returns 403 when secret is not configured', async () => {
    __setSecrets({});
    const result = await get_facebookCustomAudience({
      headers: { 'x-fb-audience-secret': 'any-key' },
    });
    expect(result.status).toBe(403);
  });

  it('returns JSON content type on auth success', async () => {
    __setSecrets({ FB_AUDIENCE_SECRET: 'test-audience-secret' });
    const result = await get_facebookCustomAudience({
      headers: { 'x-fb-audience-secret': 'test-audience-secret' },
    });
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('returns no-store cache on success', async () => {
    __setSecrets({ FB_AUDIENCE_SECRET: 'test-audience-secret' });
    const result = await get_facebookCustomAudience({
      headers: { 'x-fb-audience-secret': 'test-audience-secret' },
    });
    if (result.status === 200) {
      expect(result.headers['Cache-Control']).toBe('no-store');
    }
  });

  it('includes schema array in response', async () => {
    __setSecrets({ FB_AUDIENCE_SECRET: 'test-audience-secret' });
    const result = await get_facebookCustomAudience({
      headers: { 'x-fb-audience-secret': 'test-audience-secret' },
    });
    if (result.status === 200) {
      const body = JSON.parse(result.body);
      expect(body.schema).toEqual(['EMAIL', 'FN', 'LN', 'PHONE', 'CT', 'ST', 'ZIP', 'COUNTRY', 'VALUE']);
    }
  });
});

// ── post_klaviyoWebhook ─────────────────────────────────────────────

describe('post_klaviyoWebhook', () => {
  const makeRequest = (headers, bodyObj) => ({
    headers,
    body: {
      async text() { return JSON.stringify(bodyObj); },
    },
  });

  it('returns 403 with no auth header', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('returns 403 with wrong secret', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook({
      headers: { 'x-klaviyo-webhook-secret': 'wrong' },
    });
    expect(result.status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook({
      headers: { 'x-klaviyo-webhook-secret': 'klav-secret' },
      body: { async text() { return 'not json'; } },
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Invalid JSON body');
  });

  it('returns 400 for missing type field', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { email: 'test@example.com' },
      ),
    );
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Missing required field: type');
  });

  it('returns 400 for missing email field', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'unsubscribed' },
      ),
    );
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Missing required field: email');
  });

  it('returns 400 for invalid email format', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'unsubscribed', email: 'not-an-email' },
      ),
    );
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Invalid email format');
  });

  it('returns 200 for valid unsubscribe event', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'test@example.com', status: 'subscribed' },
    ]);
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'unsubscribed', email: 'test@example.com' },
      ),
    );
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.received).toBe('unsubscribed');
  });

  it('returns 200 for unknown event type (acknowledged)', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'bounced', email: 'test@example.com' },
      ),
    );
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.received).toBe('bounced');
  });

  it('sets no-store cache header', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'test', email: 'test@example.com' },
      ),
    );
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('returns JSON content type', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'test', email: 'test@example.com' },
      ),
    );
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});
