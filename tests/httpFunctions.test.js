import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onUpdate, __setQueryError, __getLastFindOptions, __reset as resetData } from './__mocks__/wix-data.js';
import { hashRateLimitKey } from '../src/backend/utils/rateLimit.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { __setMember, __reset as resetMembers, currentMember as membersMock } from './__mocks__/wix-members-backend.js';
import { _resetActiveChallengesRateLimit, _resetRecordChallengeProgressRateLimit } from '../src/backend/gamificationEventReceiver.web.js';
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
  get_blogRssFeed,
  post_klaviyoWebhook,
  get_activeChallenges,
  post_challengeProgress,
  get_leaderboard,
  _resetLeaderboardRateLimit,
  get_cleanupRateLimitCron,
  get_badges,
  _resetBadgesRateLimit,
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

  it('returns 200 with static pages when wixData query fails (graceful degradation)', async () => {
    __setQueryError('Stores/Products', new Error('Wix Data unavailable'));
    const result = await get_productSitemap();
    expect(result.status).toBe(200);
    expect(result.body).toContain('<?xml version="1.0"');
    expect(result.body).toContain('<loc>https://www.carolinafutons.com/</loc>');
    // No product URLs when DB is down
    expect(result.body).not.toContain('/product-page/');
  });

  it('queries Stores/Products with suppressAuth to avoid permissions error in HTTP function context', async () => {
    await get_productSitemap();
    const opts = __getLastFindOptions('Stores/Products');
    expect(opts).toEqual({ suppressAuth: true });
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

  it('queries Stores/Products with suppressAuth (shared fetchAllProducts)', async () => {
    await get_facebookCatalogFeed();
    expect(__getLastFindOptions('Stores/Products')).toEqual({ suppressAuth: true });
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

  it('queries Stores/Products with suppressAuth (shared fetchAllProducts)', async () => {
    await get_pinterestProductFeed();
    expect(__getLastFindOptions('Stores/Products')).toEqual({ suppressAuth: true });
  });

  it('normalizes wix:image:// URIs in image_link to static.wixstatic.com CDN URLs', async () => {
    __seed('Stores/Products', [{
      _id: 'prod-wix',
      name: 'Wix Image Product',
      slug: 'wix-image-product',
      price: 499,
      discountedPrice: null,
      mainMedia: 'wix:image://v1/abc123.jpg/photo.jpg#originWidth=1200',
      description: 'Test product.',
      inStock: true,
      collections: ['futon-frames'],
      _updatedDate: new Date('2026-01-15'),
      mediaItems: [
        { src: 'wix:image://v1/main_abc123.jpg/photo.jpg' }, // index 0 — skipped
        { src: 'wix:image://v1/side_def456.jpg/side.jpg#w=800' },
        { src: 'wix:image://v1/back_ghi789.jpg/back.jpg#w=800' },
      ],
    }]);

    const result = await get_pinterestProductFeed();
    expect(result.status).toBe(200);
    // image_link for mainMedia must be a CDN URL, not the raw wix:image:// URI
    expect(result.body).toContain('https://static.wixstatic.com/media/abc123.jpg');
    // additional_image_link must also be normalized (mediaItems index 1+)
    expect(result.body).toContain('https://static.wixstatic.com/media/side_def456.jpg');
    expect(result.body).toContain('https://static.wixstatic.com/media/back_ghi789.jpg');
    // No raw wix:image:// URIs should leak into the feed — Pinterest would reject them
    expect(result.body).not.toContain('wix:image://');
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
  it('returns 200 with XML content type', async () => {
    const result = await get_googleShoppingFeed({});
    expect(result.status).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8');
  });

  it('returns body when generateFeed succeeds', async () => {
    const result = await get_googleShoppingFeed({});
    expect(result.status).toBe(200);
    expect(result.body).toBeTruthy();
  });

  it('sets public cache header with 1 hour max-age', async () => {
    const result = await get_googleShoppingFeed({});
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('public, max-age=3600');
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

  it('disallows thank-you page', () => {
    const result = get_robots();
    expect(result.body).toContain('Disallow: /thank-you');
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
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('includes schema array in response', async () => {
    __setSecrets({ FB_AUDIENCE_SECRET: 'test-audience-secret' });
    const result = await get_facebookCustomAudience({
      headers: { 'x-fb-audience-secret': 'test-audience-secret' },
    });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.schema).toEqual(['EMAIL', 'FN', 'LN', 'PHONE', 'CT', 'ST', 'ZIP', 'COUNTRY', 'VALUE']);
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
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, item }));
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
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].item.status).toBe('unsubscribed');
  });

  it('returns 200 without DB update for non-existent subscriber', async () => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
    __seed('NewsletterSubscribers', []);
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, item }));
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'unsubscribed', email: 'nobody@example.com' },
      ),
    );
    expect(result.status).toBe(200);
    expect(updates).toHaveLength(0);
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

// ── Brand detection edge cases ───────────────────────────────────────

describe('Brand detection (detectBrandFromProduct)', () => {
  it('wall-hugger collection maps to Strata Furniture brand', async () => {
    __seed('Stores/Products', [{
      _id: 'wh-1', name: 'Wallhugger Futon', slug: 'wallhugger', price: 599,
      discountedPrice: null, mainMedia: 'https://example.com/wh.jpg',
      description: 'Wall hugger futon', inStock: true,
      collections: ['wall-huggers'], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('Strata Furniture');
  });

  it('unfinished collection maps to KD Frames brand', async () => {
    __seed('Stores/Products', [{
      _id: 'uf-1', name: 'Unfinished Futon', slug: 'unfinished-futon', price: 249,
      discountedPrice: null, mainMedia: 'https://example.com/uf.jpg',
      description: 'Unfinished frame', inStock: true,
      collections: ['unfinished-wood'], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('KD Frames');
  });

  it('murphy in product name maps to Arason Enterprises brand', async () => {
    __seed('Stores/Products', [{
      _id: 'murphy-name-1', name: 'Murphy Cabinet Bed Queen', slug: 'murphy-queen', price: 1899,
      discountedPrice: null, mainMedia: 'https://example.com/murphy.jpg',
      description: 'Cabinet bed', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('Arason Enterprises');
  });

  it('no matching collection maps to Night & Day Furniture brand', async () => {
    __seed('Stores/Products', [{
      _id: 'generic-1', name: 'Generic Product', slug: 'generic', price: 299,
      discountedPrice: null, mainMedia: 'https://example.com/gen.jpg',
      description: 'Generic', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('Night & Day Furniture');
  });

  it('cabinet bed in product name maps to Arason Enterprises brand', async () => {
    __seed('Stores/Products', [{
      _id: 'cab-1', name: 'Sagebrush Cabinet Bed', slug: 'sagebrush-cabinet', price: 1599,
      discountedPrice: null, mainMedia: 'https://example.com/cab.jpg',
      description: 'Cabinet bed', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('Arason Enterprises');
  });
});

// ── Google category detection ────────────────────────────────────────

describe('Google category detection (detectGoogleCategory)', () => {
  it('murphy collection maps to beds category (436)', async () => {
    __seed('Stores/Products', [{
      _id: 'gc-murphy', name: 'Murphy Bed', slug: 'murphy-gc', price: 1500,
      discountedPrice: null, mainMedia: 'https://example.com/m.jpg',
      description: 'Murphy', inStock: true,
      collections: ['murphy-cabinet-beds'], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('436');
  });

  it('mattresses collection maps to mattresses category (2462)', async () => {
    __seed('Stores/Products', [{
      _id: 'gc-mattress', name: 'Mattress', slug: 'mattress-gc', price: 350,
      discountedPrice: null, mainMedia: 'https://example.com/m.jpg',
      description: 'Mattress', inStock: true,
      collections: ['mattresses'], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('2462');
  });

  it('no matching collection defaults to futons category (4295)', async () => {
    __seed('Stores/Products', [{
      _id: 'gc-default', name: 'Standard Futon', slug: 'standard-futon', price: 450,
      discountedPrice: null, mainMedia: 'https://example.com/sf.jpg',
      description: 'Futon', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('4295');
  });
});

// ── Pinterest product type detection ────────────────────────────────

describe('Pinterest product type detection (detectProductType)', () => {
  it('platform collection maps to Platform Beds type', async () => {
    __seed('Stores/Products', [{
      _id: 'pin-platform', name: 'Platform Bed', slug: 'platform-gc', price: 800,
      discountedPrice: null, mainMedia: 'https://example.com/pb.jpg',
      description: 'Platform bed', inStock: true,
      collections: ['platform-beds'], _updatedDate: new Date(),
    }]);
    const result = await get_pinterestProductFeed();
    expect(result.body).toContain('Platform Beds');
  });

  it('casegood collection maps to Casegoods & Accessories type', async () => {
    __seed('Stores/Products', [{
      _id: 'pin-casegood', name: 'Futon Cover', slug: 'cover-gc', price: 80,
      discountedPrice: null, mainMedia: 'https://example.com/fc.jpg',
      description: 'Cover', inStock: true,
      collections: ['casegoods-accessories'], _updatedDate: new Date(),
    }]);
    const result = await get_pinterestProductFeed();
    expect(result.body).toContain('Casegoods & Accessories');
  });

  it('no matching collection defaults to Futon Frames type', async () => {
    __seed('Stores/Products', [{
      _id: 'pin-frame', name: 'Basic Futon', slug: 'basic-futon', price: 400,
      discountedPrice: null, mainMedia: 'https://example.com/bf.jpg',
      description: 'Basic futon', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_pinterestProductFeed();
    expect(result.body).toContain('Futon Frames');
  });

  it('product with no mediaItems has empty additional_image_link', async () => {
    __seed('Stores/Products', [{
      _id: 'pin-no-media', name: 'No Media Product', slug: 'no-media', price: 300,
      discountedPrice: null, mainMedia: 'https://example.com/nm.jpg',
      description: 'No extra media', inStock: true,
      collections: [], _updatedDate: new Date(),
      mediaItems: [],
    }]);
    const result = await get_pinterestProductFeed();
    expect(result.status).toBe(200);
    const lines = result.body.split('\n');
    // Should produce header + 1 data row
    expect(lines.length).toBe(2);
  });
});

// ── get_facebookCatalogFeed edge cases ──────────────────────────────

describe('get_facebookCatalogFeed edge cases', () => {
  it('product with null price outputs 0.00 USD', async () => {
    __seed('Stores/Products', [{
      _id: 'price-null', name: 'Free Item', slug: 'free-item', price: null,
      discountedPrice: null, mainMedia: 'https://example.com/fi.jpg',
      description: 'No price', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    expect(result.body).toContain('0.00 USD');
  });

  it('does not include sale_price column when product has no discount', async () => {
    __seed('Stores/Products', [{
      _id: 'no-discount', name: 'Full Price', slug: 'full-price', price: 500,
      discountedPrice: null, mainMedia: 'https://example.com/fp.jpg',
      description: 'Full price product', inStock: true,
      collections: [], _updatedDate: new Date(),
    }]);
    const result = await get_facebookCatalogFeed();
    // sale_price column is empty for no-discount products (tab-separated empty)
    expect(result.status).toBe(200);
    const lines = result.body.split('\n');
    const headerCols = lines[0].split('\t');
    const salePriceIdx = headerCols.indexOf('sale_price');
    const dataRow = lines[1].split('\t');
    expect(dataRow[salePriceIdx]).toBe('');
  });
});

// ── get_manifest additional fields ──────────────────────────────────

describe('get_manifest additional fields', () => {
  it('includes orientation field set to any', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.orientation).toBe('any');
  });

  it('includes lifestyle in categories', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.categories).toContain('lifestyle');
  });

  it('icons have purpose field for maskable support', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    for (const icon of manifest.icons) {
      expect(icon.purpose).toBeDefined();
      expect(icon.purpose).toContain('maskable');
    }
  });

  it('description field is non-empty', () => {
    const result = get_manifest();
    const manifest = JSON.parse(result.body);
    expect(manifest.description.length).toBeGreaterThan(0);
  });
});

// ── get_serviceWorker additional content ────────────────────────────

describe('get_serviceWorker additional content', () => {
  it('includes skipWaiting call in install handler', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain('skipWaiting');
  });

  it('includes clients.claim in activate handler', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain('clients.claim');
  });

  it('includes offline fallback URL /offline', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain('/offline');
  });

  it('includes navigate request handling for SPA routing', () => {
    const result = get_serviceWorker();
    expect(result.body).toContain("mode === 'navigate'");
  });
});

// ── post_klaviyoWebhook email normalization ──────────────────────────

describe('post_klaviyoWebhook email normalization', () => {
  const makeRequest = (headers, bodyObj) => ({
    headers,
    body: { async text() { return JSON.stringify(bodyObj); } },
  });

  beforeEach(() => {
    __setSecrets({ KLAVIYO_WEBHOOK_SECRET: 'klav-secret' });
  });

  it('normalizes email to lowercase before lookup', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub-upper', email: 'test@example.com', status: 'subscribed' },
    ]);
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, item }));
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'unsubscribed', email: 'TEST@EXAMPLE.COM' },
      ),
    );
    expect(result.status).toBe(200);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].item.status).toBe('unsubscribed');
  });

  it('sets unsubscribedAt date when processing unsubscribe', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub-2', email: 'user@test.com', status: 'subscribed' },
    ]);
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, item }));
    const before = new Date();
    await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'unsubscribed', email: 'user@test.com' },
      ),
    );
    const unsubscribedAt = updates[0]?.item?.unsubscribedAt;
    expect(unsubscribedAt).toBeDefined();
    expect(new Date(unsubscribedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('returns 200 and echoes event type for unknown event types', async () => {
    const result = await post_klaviyoWebhook(
      makeRequest(
        { 'x-klaviyo-webhook-secret': 'klav-secret' },
        { type: 'suppressed', email: 'x@y.com' },
      ),
    );
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).received).toBe('suppressed');
  });
});

// ── get_robots completeness ──────────────────────────────────────────

describe('get_robots completeness', () => {
  it('has User-agent: * directive', () => {
    const result = get_robots();
    expect(result.body).toContain('User-agent: *');
  });

  it('sitemap URLs use full canonical domain', () => {
    const result = get_robots();
    expect(result.body).toContain('https://www.carolinafutons.com/');
  });
});

// ── get_blogRssFeed ──────────────────────────────────────────────────

describe('get_blogRssFeed', () => {
  it('returns status 200', () => {
    const result = get_blogRssFeed();
    expect(result.status).toBe(200);
  });

  it('returns application/rss+xml content type', () => {
    const result = get_blogRssFeed();
    expect(result.headers['Content-Type']).toContain('application/rss+xml');
  });

  it('body starts with XML declaration', () => {
    const result = get_blogRssFeed();
    expect(result.body).toMatch(/^<\?xml version="1\.0"/);
  });

  it('body contains rss version 2.0 element', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('<rss version="2.0"');
  });

  it('body contains channel element', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('<channel>');
    expect(result.body).toContain('</channel>');
  });

  it('body contains feed title', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('Carolina Futons Blog');
  });

  it('body contains blog link', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('carolinafutons.com/blog');
  });

  it('body contains atom:link self-reference', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('rel="self"');
    expect(result.body).toContain('_functions/blogRssFeed');
  });

  it('body contains at least one item (real blog data)', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('<item>');
    expect(result.body).toContain('</item>');
  });

  it('items contain title, link, and guid', () => {
    const result = get_blogRssFeed();
    expect(result.body).toContain('<title>');
    expect(result.body).toContain('<link>');
    expect(result.body).toContain('<guid');
  });

  it('has Cache-Control header', () => {
    const result = get_blogRssFeed();
    expect(result.headers['Cache-Control']).toContain('max-age=3600');
  });

  it('closes with </rss>', () => {
    const result = get_blogRssFeed();
    expect(result.body.trimEnd()).toMatch(/<\/rss>$/);
  });
});

// ── GET /_functions/activeChallenges ─────────────────────────────────────────

const makeActiveChallengesRequest = (memberId) => ({
  query: memberId ? { memberId } : {},
});

describe('get_activeChallenges', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    _resetActiveChallengesRateLimit();
  });

  it('returns 400 when memberId is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await get_activeChallenges(makeActiveChallengesRequest(null));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/memberId/i);
  });

  it('returns 401 when no member is authenticated', async () => {
    // member is null (default from resetMembers)
    const result = await get_activeChallenges(makeActiveChallengesRequest('mem-1'));
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/auth/i);
  });

  it('returns 403 when authenticated member does not own the requested memberId', async () => {
    __setMember({ _id: 'mem-other' });
    const result = await get_activeChallenges(makeActiveChallengesRequest('mem-1'));
    expect(result.status).toBe(403);
    expect(JSON.parse(result.body).error).toMatch(/denied/i);
  });

  it('returns 200 with empty challenges when no active challenges exist', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await get_activeChallenges(makeActiveChallengesRequest('mem-1'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('challenges');
    expect(body.challenges).toEqual([]);
  });

  it('returns 200 with challenges for authenticated owner', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Order 3 Times', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date(Date.now() + 86400000), active: true },
    ]);
    const result = await get_activeChallenges(makeActiveChallengesRequest('mem-1'));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.challenges).toHaveLength(1);
    expect(body.challenges[0].challengeId).toBe('ch-1');
  });

  it('returns 429 after rate limit exceeded', async () => {
    __setMember({ _id: 'mem-rl' });
    for (let i = 0; i < 10; i++) {
      await get_activeChallenges(makeActiveChallengesRequest('mem-rl'));
    }
    const result = await get_activeChallenges(makeActiveChallengesRequest('mem-rl'));
    expect(result.status).toBe(429);
  });

  // cf-9lp.1: when the webMethod returns { challenges: [], error: 'internal_error' }
  // (the cf-tlt DB-failure shape), the HTTP endpoint MUST return 503, not 200 OK.
  // Prior behavior was 200 OK with the error body — generic REST consumers and
  // monitoring probes saw "success" when the backend had failed.
  describe('cf-9lp.1 503 on internal_error', () => {
    it('returns 503 when the webMethod surfaces error: "internal_error"', async () => {
      __setMember({ _id: 'mem-db-fail' });
      __setQueryError('Challenges', new Error('connection reset'));
      const result = await get_activeChallenges(makeActiveChallengesRequest('mem-db-fail'));
      expect(result.status).toBe(503);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('internal_error');
    });

    it('preserves 200 OK for empty-but-authed (no error field)', async () => {
      __setMember({ _id: 'mem-empty' });
      const result = await get_activeChallenges(makeActiveChallengesRequest('mem-empty'));
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.error).toBeUndefined();
      expect(body.challenges).toEqual([]);
    });
  });
});

// ── POST /_functions/challengeProgress ───────────────────────────────────────

const makeChallengeProgressRequest = (bodyObj) => ({
  body: {
    async json() { return bodyObj; },
  },
});

describe('post_challengeProgress', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    _resetRecordChallengeProgressRateLimit();
  });

  it('returns 400 when memberId is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await post_challengeProgress(makeChallengeProgressRequest({ challengeId: 'ch-1' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/memberId/i);
  });

  it('returns 400 when challengeId is missing', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await post_challengeProgress(makeChallengeProgressRequest({ memberId: 'mem-1' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/challengeId/i);
  });

  it('returns 401 when no member is authenticated', async () => {
    const result = await post_challengeProgress(makeChallengeProgressRequest({ memberId: 'mem-1', challengeId: 'ch-1' }));
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/auth/i);
  });

  it('returns 403 when authenticated member does not own the requested memberId', async () => {
    __setMember({ _id: 'mem-other' });
    const result = await post_challengeProgress(makeChallengeProgressRequest({ memberId: 'mem-1', challengeId: 'ch-1' }));
    expect(result.status).toBe(403);
    expect(JSON.parse(result.body).error).toMatch(/denied/i);
  });

  it('returns 200 with success on valid progress record', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Order 3 Times', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date(Date.now() + 86400000), active: true },
    ]);
    const result = await post_challengeProgress(makeChallengeProgressRequest({ memberId: 'mem-1', challengeId: 'ch-1' }));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.newProgress).toBe(1);
  });

  it('returns 429 after rate limit exceeded', async () => {
    __setMember({ _id: 'mem-rl' });
    __seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Order 3 Times', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date(Date.now() + 86400000), active: true },
    ]);
    for (let i = 0; i < 20; i++) {
      await post_challengeProgress(makeChallengeProgressRequest({ memberId: 'mem-rl', challengeId: 'ch-1' }));
    }
    const result = await post_challengeProgress(makeChallengeProgressRequest({ memberId: 'mem-rl', challengeId: 'ch-1' }));
    expect(result.status).toBe(429);
  });
});

// ── GET /_functions/leaderboard ───────────────────────────────────────────────

const makeLeaderboardRequest = ({ limit, period } = {}) => {
  const query = {};
  if (limit !== undefined) query.limit = String(limit);
  if (period !== undefined) query.period = period;
  return { query };
};

describe('get_leaderboard', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    _resetLeaderboardRateLimit();
  });

  it('returns 200 with entries for valid request', async () => {
    __setMember({ _id: 'mem-1' });
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-1', nickname: 'Alice', points: 500, tier: 'Silver', lastActivityDate: new Date() },
    ]);
    __seed('MemberGamificationPreferences', [
      { _id: 'p-1', memberId: 'mem-1', leaderboardOptIn: true },
    ]);
    const result = await get_leaderboard(makeLeaderboardRequest());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('entries');
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].memberId).toBe('mem-1');
  });

  it('returns 400 on invalid period param', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await get_leaderboard(makeLeaderboardRequest({ period: 'monthly' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/period/i);
  });

  it('returns 400 on limit > 50', async () => {
    __setMember({ _id: 'mem-1' });
    const result = await get_leaderboard(makeLeaderboardRequest({ limit: 51 }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/limit/i);
  });

  it('returns 401 when no member is authenticated', async () => {
    const result = await get_leaderboard(makeLeaderboardRequest());
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body).error).toMatch(/auth/i);
  });

  it('returns 500 on service error', async () => {
    membersMock.getMember.mockRejectedValueOnce(new Error('Service unavailable'));
    const result = await get_leaderboard(makeLeaderboardRequest());
    expect(result.status).toBe(500);
  });

  it('returns 429 after rate limit exceeded', async () => {
    __setMember({ _id: 'mem-rl' });
    for (let i = 0; i < 30; i++) {
      await get_leaderboard(makeLeaderboardRequest());
    }
    const result = await get_leaderboard(makeLeaderboardRequest());
    expect(result.status).toBe(429);
  });
});

// ── GET /_functions/leaderboard?type=points|streak (public) ───────────────────

const makePublicLeaderboardRequest = ({ type, limit } = {}) => {
  const query = {};
  if (type !== undefined) query.type = type;
  if (limit !== undefined) query.limit = String(limit);
  return { query };
};

const POINTS_MEMBERS = [
  { _id: 'mp-1', memberId: 'mem-1', displayName: 'Alice', totalPoints: 500, currentStreakDays: 7, tier: 'silver' },
  { _id: 'mp-2', memberId: 'mem-2', displayName: 'Bob',   totalPoints: 300, currentStreakDays: 3, tier: 'bronze' },
  { _id: 'mp-3', memberId: 'mem-3', displayName: 'Carol', totalPoints: 100, currentStreakDays: 12, tier: 'bronze' },
];

describe('get_leaderboard — public (type=points)', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    __seed('MemberPoints', POINTS_MEMBERS);
    __seed('LeaderboardPublicRateLimit', []); // fresh rate limit bucket each test
  });

  it('returns 200 with members array sorted by totalPoints descending', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.type).toBe('points');
    expect(body.members).toHaveLength(3);
    expect(body.members[0].totalPoints).toBeGreaterThanOrEqual(body.members[1].totalPoints);
    expect(body.members[1].totalPoints).toBeGreaterThanOrEqual(body.members[2].totalPoints);
  });

  it('returns all required fields per member', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    const { members } = JSON.parse(result.body);
    const m = members[0];
    expect(m).toHaveProperty('memberId');
    expect(m).toHaveProperty('displayName');
    expect(m).toHaveProperty('totalPoints');
    expect(m).toHaveProperty('currentStreakDays');
    expect(m).toHaveProperty('tier');
    expect(m).toHaveProperty('badgeId');
  });

  it('includes badgeId from MemberBadges (latest per member)', async () => {
    __seed('MemberBadges', [
      { _id: 'b-1', memberId: 'mem-1', badgeId: 'week_wanderer', _createdDate: new Date('2026-01-01') },
      { _id: 'b-2', memberId: 'mem-1', badgeId: 'top_reviewer',  _createdDate: new Date('2026-02-01') },
    ]);
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    const { members } = JSON.parse(result.body);
    const alice = members.find(m => m.memberId === 'mem-1');
    expect(alice.badgeId).toBe('top_reviewer');
  });

  it('sets badgeId to null when member has no badge', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    const { members } = JSON.parse(result.body);
    expect(members[0].badgeId).toBeNull();
  });

  it('uses suppressAuth: true for MemberPoints query', async () => {
    await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(__getLastFindOptions('MemberPoints')).toEqual({ suppressAuth: true });
  });

  it('respects limit param', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points', limit: 2 }));
    const { members, limit } = JSON.parse(result.body);
    expect(members).toHaveLength(2);
    expect(limit).toBe(2);
  });

  it('returns 400 for limit > 50', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points', limit: 51 }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/limit/i);
  });

  it('returns 400 for invalid type', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'invalid' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/type/i);
  });

  it('does not require authentication (no member set)', async () => {
    // resetMembers() already called in beforeEach — no member set
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(result.status).toBe(200);
  });

  it('returns 500 on MemberPoints query error', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError('MemberPoints', new Error('DB failure'));
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(result.status).toBe(500);
  });

  it('uses suppressAuth: true for MemberBadges query', async () => {
    __seed('MemberBadges', [
      { _id: 'b-1', memberId: 'mem-1', badgeId: 'explorer', _createdDate: new Date() },
    ]);
    await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(__getLastFindOptions('MemberBadges')).toEqual({ suppressAuth: true });
  });

  it('returns Cache-Control: public, max-age=60 on successful response', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('public, max-age=60');
  });

  it('returns 429 when global rate limit is exceeded (60 req/min)', async () => {
    // Seed the rate limit bucket at max count within the window
    __seed('LeaderboardPublicRateLimit', [{
      _id: 'rl-global', key: hashRateLimitKey('global'), count: 60,
      windowStart: new Date(Date.now() - 30_000), // 30s ago — still in window
    }]);
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'points' }));
    expect(result.status).toBe(429);
    expect(JSON.parse(result.body).error).toMatch(/rate limit/i);
  });
});

describe('get_leaderboard — public (type=streak)', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    __seed('MemberPoints', POINTS_MEMBERS);
    __seed('LeaderboardPublicRateLimit', []);
  });

  it('returns 200 with members sorted by currentStreakDays descending', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'streak' }));
    expect(result.status).toBe(200);
    const { members, type } = JSON.parse(result.body);
    expect(type).toBe('streak');
    expect(members[0].currentStreakDays).toBeGreaterThanOrEqual(members[1].currentStreakDays);
    expect(members[1].currentStreakDays).toBeGreaterThanOrEqual(members[2].currentStreakDays);
  });

  it('returns correct top member by streak', async () => {
    const result = await get_leaderboard(makePublicLeaderboardRequest({ type: 'streak' }));
    const { members } = JSON.parse(result.body);
    // Carol has highest streak (12 days)
    expect(members[0].memberId).toBe('mem-3');
  });
});

// ── GET /_functions/cleanupRateLimitCron ──────────────────────────────────────

describe('get_cleanupRateLimitCron', () => {
  const CRON_KEY = 'test-cron-key-abc';
  const staleTime = Date.now() - 25 * 3600_000; // 25h ago — definitely stale
  const freshTime = Date.now() - 1 * 3600_000;  // 1h ago — still within TTL

  function makeStaleRecord(collection, id, key) {
    return { _id: id, key, count: 5, windowStart: new Date(staleTime) };
  }

  beforeEach(() => {
    resetData();
    __setSecrets({ ALERT_CRON_KEY: CRON_KEY });
    __seed('GamificationActionRateLimit', []);
    __seed('GamificationDailyCap', []);
  });

  it('returns 200 with valid cron key', async () => {
    const result = await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.pruned).toEqual({ actionLimit: 0, dailyCap: 0 });
  });

  it('returns 403 with wrong cron key', async () => {
    const result = await get_cleanupRateLimitCron(cronRequest('wrong-key'));
    expect(result.status).toBe(403);
  });

  it('returns 403 with no auth header', async () => {
    const result = await get_cleanupRateLimitCron({ headers: {} });
    expect(result.status).toBe(403);
  });

  it('prunes stale records from GamificationActionRateLimit', async () => {
    __seed('GamificationActionRateLimit', [
      makeStaleRecord('GamificationActionRateLimit', 'rl-1', 'mem-1:add_to_cart'),
      makeStaleRecord('GamificationActionRateLimit', 'rl-2', 'mem-2:add_to_cart'),
    ]);
    const result = await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    const body = JSON.parse(result.body);
    expect(body.pruned.actionLimit).toBe(2);
  });

  it('prunes stale records from GamificationDailyCap', async () => {
    __seed('GamificationDailyCap', [
      makeStaleRecord('GamificationDailyCap', 'dc-1', 'mem-1'),
    ]);
    const result = await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    const body = JSON.parse(result.body);
    expect(body.pruned.dailyCap).toBe(1);
  });

  it('does not prune fresh records', async () => {
    __seed('GamificationActionRateLimit', [
      { _id: 'fresh-1', key: 'mem-1:spin', count: 2, windowStart: new Date(freshTime) },
    ]);
    __seed('GamificationDailyCap', [
      { _id: 'fresh-2', key: 'mem-1', count: 10, windowStart: new Date(freshTime) },
    ]);
    const result = await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    const body = JSON.parse(result.body);
    expect(body.pruned.actionLimit).toBe(0);
    expect(body.pruned.dailyCap).toBe(0);
  });

  it('prunes stale but preserves fresh records in the same collection', async () => {
    __seed('GamificationDailyCap', [
      { _id: 'stale-1', key: 'mem-stale', count: 3, windowStart: new Date(staleTime) },
      { _id: 'fresh-1', key: 'mem-fresh', count: 7, windowStart: new Date(freshTime) },
    ]);
    await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    const { __getInserted } = await import('./__mocks__/wix-data.js');
    const remaining = __getInserted('GamificationDailyCap');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe('mem-fresh');
  });

  it('returns correct pruned counts when both collections have stale records', async () => {
    __seed('GamificationActionRateLimit', [
      makeStaleRecord('GamificationActionRateLimit', 'a1', 'u1:cart'),
      makeStaleRecord('GamificationActionRateLimit', 'a2', 'u2:cart'),
      makeStaleRecord('GamificationActionRateLimit', 'a3', 'u3:spin'),
    ]);
    __seed('GamificationDailyCap', [
      makeStaleRecord('GamificationDailyCap', 'd1', 'u1'),
    ]);
    const result = await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    const { pruned } = JSON.parse(result.body);
    expect(pruned.actionLimit).toBe(3);
    expect(pruned.dailyCap).toBe(1);
  });

  it('returns 500 on DB error', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError('GamificationActionRateLimit', new Error('DB down'));
    const result = await get_cleanupRateLimitCron(cronRequest(CRON_KEY));
    expect(result.status).toBe(500);
  });
});

// ── get_badges ────────────────────────────────────────────────────────────────

describe('get_badges', () => {
  function badgesRequest(memberId) {
    return { query: memberId !== undefined ? { memberId } : {} };
  }

  const MEMBER_ID = 'member-abc';

  const CATALOG_ITEMS = [
    { _id: 'badge-gold', name: 'Gold Star', iconUrl: 'https://cdn.example.com/gold.png', tier: 'gold' },
    { _id: 'badge-silver', name: 'Silver Shield', iconUrl: 'https://cdn.example.com/silver.png', tier: 'silver' },
  ];

  function memberBadge(id, memberId, badgeId, createdDate) {
    return { _id: id, memberId, badgeId, _createdDate: new Date(createdDate) };
  }

  beforeEach(() => {
    resetData();
    _resetBadgesRateLimit();
    __seed('MemberBadges', []);
    __seed('Badges', []);
    __seed('BadgesPublicRateLimit', []);
  });

  it('returns 400 when memberId is missing', async () => {
    const res = await get_badges(badgesRequest());
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/memberId/i);
  });

  it('returns 400 when memberId contains invalid characters', async () => {
    const res = await get_badges(badgesRequest('mem<script>'));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/memberId/i);
  });

  it('returns 400 when memberId is whitespace-only', async () => {
    const res = await get_badges(badgesRequest('   '));
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty badges array when member has no badges', async () => {
    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.memberId).toBe(MEMBER_ID);
    expect(body.badges).toEqual([]);
    expect(body.totalCount).toBe(0);
  });

  it('returns 200 with badge list when member has earned badges', async () => {
    __seed('MemberBadges', [
      memberBadge(`${MEMBER_ID}_badge-gold`, MEMBER_ID, 'badge-gold', '2026-01-10T00:00:00Z'),
      memberBadge(`${MEMBER_ID}_badge-silver`, MEMBER_ID, 'badge-silver', '2026-01-05T00:00:00Z'),
    ]);
    __seed('Badges', CATALOG_ITEMS);

    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.memberId).toBe(MEMBER_ID);
    expect(body.totalCount).toBe(2);
    expect(body.badges).toHaveLength(2);

    const gold = body.badges.find(b => b.id === 'badge-gold');
    expect(gold.name).toBe('Gold Star');
    expect(gold.iconUrl).toBe('https://cdn.example.com/gold.png');
    expect(gold.tier).toBe('gold');
    expect(gold.earnedAt).toBeDefined();
  });

  it('falls back to badgeId as name when catalog entry is missing', async () => {
    __seed('MemberBadges', [
      memberBadge(`${MEMBER_ID}_badge-unknown`, MEMBER_ID, 'badge-unknown', '2026-01-01T00:00:00Z'),
    ]);
    // Badges catalog intentionally empty

    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.badges[0].id).toBe('badge-unknown');
    expect(body.badges[0].name).toBe('badge-unknown');
    expect(body.badges[0].iconUrl).toBeNull();
    expect(body.badges[0].tier).toBeNull();
  });

  it('returns badges sorted descending by earnedAt', async () => {
    __seed('MemberBadges', [
      memberBadge(`${MEMBER_ID}_badge-silver`, MEMBER_ID, 'badge-silver', '2026-01-05T00:00:00Z'),
      memberBadge(`${MEMBER_ID}_badge-gold`, MEMBER_ID, 'badge-gold', '2026-01-10T00:00:00Z'),
    ]);
    __seed('Badges', CATALOG_ITEMS);

    const res = await get_badges(badgesRequest(MEMBER_ID));
    const body = JSON.parse(res.body);
    // descending by _createdDate — gold (Jan 10) should come before silver (Jan 5)
    expect(body.badges[0].id).toBe('badge-gold');
    expect(body.badges[1].id).toBe('badge-silver');
  });

  it('includes Cache-Control: public, max-age=30 header on success', async () => {
    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(200);
    const headers = res.headers || {};
    const cacheControl = headers['Cache-Control'] || headers['cache-control'] || '';
    expect(cacheControl).toMatch(/public/);
    expect(cacheControl).toMatch(/max-age=30/);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    __seed('BadgesPublicRateLimit', [
      { _id: `rl-${MEMBER_ID}`, key: hashRateLimitKey(MEMBER_ID), count: 30, windowStart: new Date(Date.now() - 5_000) },
    ]);
    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body).error).toMatch(/rate limit/i);
  });

  it('allows request when rate limit count is below the max', async () => {
    __seed('BadgesPublicRateLimit', [
      { _id: `rl-${MEMBER_ID}`, key: hashRateLimitKey(MEMBER_ID), count: 29, windowStart: new Date(Date.now() - 5_000) },
    ]);
    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(200);
  });

  it('uses suppressAuth on MemberBadges and Badges queries', async () => {
    const { __getLastFindOptions } = await import('./__mocks__/wix-data.js');
    __seed('MemberBadges', [
      memberBadge(`${MEMBER_ID}_badge-gold`, MEMBER_ID, 'badge-gold', '2026-01-10T00:00:00Z'),
    ]);
    __seed('Badges', CATALOG_ITEMS);

    await get_badges(badgesRequest(MEMBER_ID));

    const memberBadgesFindOpts = __getLastFindOptions('MemberBadges');
    const badgesFindOpts = __getLastFindOptions('Badges');
    expect(memberBadgesFindOpts?.suppressAuth).toBe(true);
    expect(badgesFindOpts?.suppressAuth).toBe(true);
  });

  it('returns 500 on DB error', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setQueryError('MemberBadges', new Error('DB timeout'));
    const res = await get_badges(badgesRequest(MEMBER_ID));
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/internal server error/i);
  });
});
