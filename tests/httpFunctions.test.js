import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import {
  get_health,
  get_productSitemap,
  get_facebookCatalogFeed,
  get_pinterestProductFeed,
  get_checkWishlistAlerts,
  get_triggerBrowseRecoveryCron,
  get_triggerCartRecoveryCron,
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

  it('includes dynamic product URLs from CMS', async () => {
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

const cronRequest = (key) => ({ query: { key } });

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
    const result = await get_checkWishlistAlerts({ query: {} });
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

  it('returns 403 with no query params', async () => {
    const result = await get_triggerBrowseRecoveryCron({ query: {} });
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
    const result = await get_triggerCartRecoveryCron({ query: {} });
    expect(result.status).toBe(403);
  });

  it('returns JSON with no-store cache', async () => {
    const result = await get_triggerCartRecoveryCron(cronRequest('test-cron-key-123'));
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
});
