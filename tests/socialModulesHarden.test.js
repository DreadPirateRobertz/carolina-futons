import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';

// ── socialMediaKit imports ───────────────────────────────────────────
import {
  getShareUrls,
  getProductShareUrls,
  validateSocialMeta,
  checkProductSocialReadiness,
  getProductSocialMetaHtml,
} from '../src/backend/socialMediaKit.web.js';

// ── pinterestCatalogSync imports ─────────────────────────────────────
import {
  syncCatalogBatch,
  normalizePinterestImageUrl,
  mapProductToBoard,
  generatePinContent,
  validateCatalogProduct,
  getPinterestRateLimits,
} from '../src/backend/pinterestCatalogSync.web.js';

// ── socialProof imports ──────────────────────────────────────────────
import {
  getProductSocialProof,
  getCategorySocialProof,
} from '../src/backend/socialProof.web.js';

import { futonFrame, outdoorFrame, saleProduct, murphyBed } from './fixtures/products.js';

beforeEach(() => {
  __reset();
});

// ════════════════════════════════════════════════════════════════════
// socialMediaKit deep tests
// ════════════════════════════════════════════════════════════════════

// ── getShareUrls — special characters ────────────────────────────────

describe('getShareUrls — special characters and edge cases', () => {
  it('encodes ampersands in URL', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com/page?a=1&b=2',
      title: 'Test',
    });
    expect(urls.facebook).toContain(encodeURIComponent('https://example.com/page?a=1&b=2'));
  });

  it('encodes hash symbols in title', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: '#1 Best Futon',
    });
    expect(urls.twitter).toContain(encodeURIComponent('#1 Best Futon'));
  });

  it('handles emoji in title', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: '🛋️ Comfy Futon',
    });
    expect(urls.twitter).toBeDefined();
    expect(urls.twitter).toContain(encodeURIComponent('🛋️ Comfy Futon'));
  });

  it('handles very long URL (500 char limit via sanitize)', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(600);
    const urls = await getShareUrls({ url: longUrl, title: 'Test' });
    // sanitize truncates to 500, but URL is still usable
    expect(urls.facebook).toBeDefined();
    expect(typeof urls.facebook).toBe('string');
  });

  it('handles undefined description (no trailing %0A%0A)', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: 'Test',
      description: undefined,
    });
    expect(urls.email).not.toContain('%0A%0A');
  });

  it('handles missing title (encodes empty string)', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: '',
    });
    expect(urls.twitter).toContain('text=');
  });

  it('handles all parameters as empty strings', async () => {
    const urls = await getShareUrls({
      url: '',
      title: '',
      description: '',
      image: '',
    });
    expect(urls).toEqual({});
  });
});

// ── getProductShareUrls — edge cases ─────────────────────────────────

describe('getProductShareUrls — edge cases', () => {
  it('handles product with price 0', async () => {
    const product = { ...futonFrame, price: 0, formattedPrice: undefined };
    const urls = await getProductShareUrls(product);
    expect(urls.twitter).toContain(encodeURIComponent('$0.00'));
  });

  it('handles product with HTML in name', async () => {
    const product = { ...futonFrame, name: '<b>Bold</b> & "Quoted" Frame' };
    const urls = await getProductShareUrls(product);
    // Twitter text should still contain the name
    expect(urls.twitter).toBeDefined();
  });

  it('handles product with undefined price and formattedPrice', async () => {
    const product = { ...futonFrame, price: undefined, formattedPrice: undefined };
    const urls = await getProductShareUrls(product);
    expect(urls.twitter).toBeDefined();
  });
});

// ── validateSocialMeta — Pinterest product pin edge cases ────────────

describe('validateSocialMeta — Pinterest product pins', () => {
  it('checks product pin requirements when og:type is product', async () => {
    const meta = {
      'og:type': 'product',
      'og:title': 'Test',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': 'https://example.com/img.jpg',
    };
    const result = await validateSocialMeta(meta);
    // Missing product:price:amount, product:price:currency, product:availability
    expect(result.issues.some(i => i.includes('product:price:amount'))).toBe(true);
    expect(result.issues.some(i => i.includes('product:price:currency'))).toBe(true);
    expect(result.issues.some(i => i.includes('product:availability'))).toBe(true);
  });

  it('does not require product pin fields when og:type is not product', async () => {
    const meta = {
      'og:type': 'article',
      'og:title': 'Blog Post',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': 'https://example.com/img.jpg',
    };
    const result = await validateSocialMeta(meta);
    expect(result.issues.some(i => i.includes('product:price:amount'))).toBe(false);
  });
});

// ── checkProductSocialReadiness — edge cases ─────────────────────────

describe('checkProductSocialReadiness — edge cases', () => {
  it('handles product with missing slug', async () => {
    const product = { ...futonFrame, slug: undefined };
    const result = await checkProductSocialReadiness(product);
    expect(result.meta['og:url']).toContain('product-page/');
  });

  it('handles product with price 0', async () => {
    const product = { ...futonFrame, price: 0 };
    const result = await checkProductSocialReadiness(product);
    expect(result.meta['product:price:amount']).toBe('0.00');
  });

  it('uses instock for product without explicit inStock field', async () => {
    const product = { ...futonFrame };
    delete product.inStock;
    const result = await checkProductSocialReadiness(product);
    // inStock !== false → 'instock'
    expect(result.meta['product:availability']).toBe('instock');
  });
});

// ── getProductSocialMetaHtml — XSS safety ────────────────────────────

describe('getProductSocialMetaHtml — edge cases', () => {
  it('passes raw product name into meta content (no HTML escaping)', async () => {
    const product = { ...futonFrame, name: 'Frame <script>alert(1)</script>' };
    const html = await getProductSocialMetaHtml(product);
    // Note: function does NOT escape HTML — documents current behavior
    expect(html).toContain('og:title');
    expect(html).toContain('Frame');
  });

  it('skips meta tags with empty content', async () => {
    const product = { ...futonFrame, description: '', mainMedia: '' };
    const html = await getProductSocialMetaHtml(product);
    // Should still generate valid meta tags for non-empty fields
    expect(html).toContain('og:type');
  });
});

// ════════════════════════════════════════════════════════════════════
// pinterestCatalogSync deep tests
// ════════════════════════════════════════════════════════════════════

// ── syncCatalogBatch — batch recovery ────────────────────────────────

describe('syncCatalogBatch — batch recovery', () => {
  const validProduct = {
    _id: 'prod-001', name: 'Eureka Futon Frame', slug: 'eureka-futon-frame',
    description: 'Solid hardwood.', price: 599.99, inStock: true,
    mainMedia: 'https://www.carolinafutons.com/images/eureka.jpg',
    collections: ['futon-frames'],
  };

  it('processes valid products and skips invalid ones', async () => {
    const products = [
      validProduct,
      { _id: 'bad', name: '', slug: '', price: 0 },
      { ...validProduct, _id: 'prod-002', slug: 'other-frame' },
    ];
    const result = await syncCatalogBatch(products);
    expect(result.success).toBe(true);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(3);
  });

  it('returns success=false when all products fail', async () => {
    const products = [
      { _id: 'bad-1', name: '', slug: '', price: 0 },
      { _id: 'bad-2', name: '', slug: '', price: -1 },
    ];
    const result = await syncCatalogBatch(products);
    expect(result.success).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(2);
  });

  it('returns success=true for empty array', async () => {
    const result = await syncCatalogBatch([]);
    expect(result.success).toBe(true);
    expect(result.total).toBe(0);
  });

  it('returns error for non-array input', async () => {
    const result = await syncCatalogBatch('not-array');
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual('Input must be an array');
  });

  it('includes board mapping in results', async () => {
    const result = await syncCatalogBatch([validProduct]);
    expect(result.results[0].board).toBe('Futon Living Rooms');
  });

  it('includes pin content in results', async () => {
    const result = await syncCatalogBatch([validProduct]);
    expect(result.results[0].pinTitle).toBeTruthy();
    expect(result.results[0].pinDescription).toBeTruthy();
    expect(result.results[0].pinLink).toContain('utm_source=pinterest');
  });

  it('includes hashtags in results', async () => {
    const result = await syncCatalogBatch([validProduct]);
    expect(result.results[0].hashtags).toContain('#CarolinaFutons');
  });

  it('includes image issues when present', async () => {
    const httpProduct = {
      ...validProduct,
      mainMedia: 'http://example.com/img.jpg',
    };
    const result = await syncCatalogBatch([httpProduct]);
    expect(result.results[0].imageIssues.length).toBeGreaterThan(0);
  });

  it('captures product-level errors with product details', async () => {
    const result = await syncCatalogBatch([
      { _id: 'fail-prod', name: 'Failing Product', slug: '', price: 0 },
    ]);
    expect(result.errors[0].productId).toBe('fail-prod');
    expect(result.errors[0].productName).toBe('Failing Product');
  });
});

// ── normalizePinterestImageUrl — edge cases ──────────────────────────

describe('normalizePinterestImageUrl — edge cases', () => {
  it('converts wix:image URI to HTTPS static URL', async () => {
    const result = await normalizePinterestImageUrl('wix:image://v1/abc123/filename.jpg#originWidth=800&originHeight=600');
    expect(result.url).toContain('https://static.wixstatic.com/media/abc123');
    expect(result.valid).toBe(true);
  });

  it('converts HTTP to HTTPS with warning', async () => {
    const result = await normalizePinterestImageUrl('http://example.com/img.jpg');
    expect(result.url).toBe('https://example.com/img.jpg');
    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(expect.stringContaining('HTTPS'));
  });

  it('rejects non-URL string', async () => {
    const result = await normalizePinterestImageUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining('absolute HTTPS'));
  });

  it('returns empty for null input', async () => {
    const result = await normalizePinterestImageUrl(null);
    expect(result.url).toBe('');
    expect(result.valid).toBe(false);
  });

  it('returns empty for empty string', async () => {
    const result = await normalizePinterestImageUrl('');
    expect(result.url).toBe('');
    expect(result.valid).toBe(false);
  });

  it('accepts valid HTTPS URL', async () => {
    const result = await normalizePinterestImageUrl('https://example.com/img.jpg');
    expect(result.url).toBe('https://example.com/img.jpg');
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('handles number input', async () => {
    const result = await normalizePinterestImageUrl(12345);
    expect(result.valid).toBe(false);
  });
});

// ── mapProductToBoard — edge cases ───────────────────────────────────

describe('mapProductToBoard — edge cases', () => {
  it('handles collection objects instead of strings', async () => {
    const result = await mapProductToBoard({
      _id: 'p1', name: 'Test',
      collections: [{ id: 'murphy-cabinet-beds' }],
    });
    expect(result.board).toBe('Murphy & Cabinet Beds');
  });

  it('sale item without discountedPrice maps to content board', async () => {
    const result = await mapProductToBoard({
      _id: 'p1', name: 'Test',
      collections: ['sales', 'futon-frames'],
      // no discountedPrice — sale rule requires it
    });
    // Without discountedPrice, sale rule is skipped, futon rule matches
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('handles clearance collection with discount', async () => {
    const result = await mapProductToBoard({
      _id: 'p1', name: 'Test',
      discountedPrice: 200,
      collections: ['clearance'],
    });
    expect(result.board).toBe('Sale & Clearance');
  });

  it('handles mixed string and object collections', async () => {
    const result = await mapProductToBoard({
      _id: 'p1', name: 'Test',
      collections: ['futon-frames', { id: 'wall-huggers' }],
    });
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('handles undefined collections', async () => {
    const product = { _id: 'p1', name: 'Test' };
    const result = await mapProductToBoard(product);
    expect(result.success).toBe(true);
    expect(result.board).toBe('Futon Living Rooms');
  });
});

// ── generatePinContent — edge cases ──────────────────────────────────

describe('generatePinContent — edge cases', () => {
  it('shows sale price with was-price when discounted', async () => {
    const result = await generatePinContent({
      name: 'Sale Frame', slug: 'sale-frame',
      price: 500, discountedPrice: 350,
    });
    expect(result.description).toContain('$350.00');
    expect(result.description).toContain('was $500.00');
  });

  it('does not show was-price when discount >= original', async () => {
    const result = await generatePinContent({
      name: 'Same Price', slug: 'same', price: 300, discountedPrice: 300,
    });
    expect(result.description).not.toContain('was');
  });

  it('generates fallback link when no slug', async () => {
    const result = await generatePinContent({
      name: 'No Slug Frame', price: 100,
    });
    expect(result.link).toContain('carolinafutons.com');
    expect(result.link).toContain('utm_source=pinterest');
    expect(result.link).not.toContain('product-page/');
  });

  it('deduplicates hashtags from multiple matching collections', async () => {
    const result = await generatePinContent({
      name: 'Multi Collection', slug: 'multi',
      price: 100,
      collections: ['futon-frames', 'wall-huggers'],
    });
    const uniqueTags = new Set(result.hashtags);
    expect(uniqueTags.size).toBe(result.hashtags.length);
  });

  it('includes base hashtags even with no matching collections', async () => {
    const result = await generatePinContent({
      name: 'Unknown Collection', slug: 'unknown',
      price: 100, collections: ['some-random-collection'],
    });
    expect(result.hashtags).toContain('#CarolinaFutons');
    expect(result.hashtags).toContain('#HandcraftedFurniture');
    expect(result.hashtags).toContain('#NCFurniture');
  });
});

// ── getPinterestRateLimits ───────────────────────────────────────────

describe('getPinterestRateLimits', () => {
  it('returns rate limit configuration', async () => {
    const limits = await getPinterestRateLimits();
    expect(limits.catalogFeedRefresh).toBe(6);
    expect(limits.pinCreation).toBe(50);
    expect(limits.boardPins).toBe(200);
  });

  it('returns a copy (not mutable reference)', async () => {
    const limits1 = await getPinterestRateLimits();
    limits1.pinCreation = 999;
    const limits2 = await getPinterestRateLimits();
    expect(limits2.pinCreation).toBe(50);
  });
});

// ════════════════════════════════════════════════════════════════════
// socialProof deep tests
// ════════════════════════════════════════════════════════════════════

// ── getProductSocialProof — empty/stale data ─────────────────────────

describe('getProductSocialProof — empty and stale data', () => {
  it('returns empty notifications when all data sources are empty', async () => {
    const result = await getProductSocialProof('prod-empty');
    expect(result.notifications).toEqual([]);
    expect(result.config).toBeDefined();
  });

  it('does not show purchase for orders older than 48 hours', async () => {
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 50);
    __seed('Orders', [{
      _id: 'ord-old', _createdDate: oldDate,
      billingInfo: { firstName: 'Old' },
      lineItems: [{ productId: 'prod-stale', name: 'Frame' }],
    }]);
    const result = await getProductSocialProof('prod-stale');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeUndefined();
  });

  it('returns notifications when inventory is null (no InventoryLevels rows)', async () => {
    const result = await getProductSocialProof('prod-no-inventory');
    // null stock level → no low_stock notification
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('handles product with exactly threshold stock (5)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-threshold', quantity: 5 },
    ]);
    const result = await getProductSocialProof('prod-threshold');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.urgency).toBe('medium');
  });

  it('handles product with exactly 2 stock (high urgency)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-urgent', quantity: 2 },
    ]);
    const result = await getProductSocialProof('prod-urgent');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock.urgency).toBe('high');
  });

  it('returns multiple notification types when all signals present', async () => {
    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 1);

    __seed('Orders', [{
      _id: 'ord-1', _createdDate: recentDate,
      billingInfo: { firstName: 'Alice', city: 'Durham' },
      lineItems: [{ productId: 'prod-all', name: 'Queen Frame' }],
    }]);
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-all', quantity: 3 },
    ]);
    const analytics = [];
    for (let i = 0; i < 10; i++) {
      analytics.push({ _id: `pa-${i}`, productId: 'prod-all', timestamp: recentDate });
    }
    __seed('ProductAnalytics', analytics);
    const reviews = [];
    for (let i = 0; i < 6; i++) {
      reviews.push({ _id: `rev-${i}`, productId: 'prod-all', status: 'approved', rating: 5 });
    }
    __seed('Reviews', reviews);

    const result = await getProductSocialProof('prod-all', 'Queen Frame');
    expect(result.notifications.length).toBe(4);
    expect(result.notifications[0].type).toBe('recent_purchase');
    expect(result.notifications[1].type).toBe('low_stock');
    expect(result.notifications[2].type).toBe('popularity');
    expect(result.notifications[3].type).toBe('review_count');
  });

  it('uses shipping city when billing city is missing', async () => {
    const recentDate = new Date();
    __seed('Orders', [{
      _id: 'ord-1', _createdDate: recentDate,
      billingInfo: { firstName: 'Bob' },
      shippingInfo: { city: 'chapel hill' },
      lineItems: [{ productId: 'prod-ship', name: 'Frame' }],
    }]);
    const result = await getProductSocialProof('prod-ship');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase.message).toContain('Chapel Hill');
  });

  it('omits city when both billing and shipping city missing', async () => {
    const recentDate = new Date();
    __seed('Orders', [{
      _id: 'ord-1', _createdDate: recentDate,
      billingInfo: { firstName: 'No City' },
      lineItems: [{ productId: 'prod-nocity', name: 'Frame' }],
    }]);
    const result = await getProductSocialProof('prod-nocity');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase.message).not.toContain('from');
  });

  it('handles reviews with missing ratings', async () => {
    const reviews = [];
    for (let i = 0; i < 6; i++) {
      reviews.push({
        _id: `rev-${i}`, productId: 'prod-norating',
        status: 'approved', rating: i < 3 ? undefined : 4,
      });
    }
    __seed('Reviews', reviews);
    const result = await getProductSocialProof('prod-norating');
    const reviewNotif = result.notifications.find(n => n.type === 'review_count');
    expect(reviewNotif).toBeDefined();
    // 3 ratings of 0 (undefined→0) + 3 ratings of 4 = average 2.0
    expect(reviewNotif.message).toContain('2');
  });
});

// ── getCategorySocialProof — edge cases ──────────────────────────────

describe('getCategorySocialProof — edge cases', () => {
  it('handles empty string categorySlug', async () => {
    const result = await getCategorySocialProof('');
    expect(result.recentSalesCount).toBe(0);
    expect(result.lowStockProducts).toEqual([]);
  });

  it('uses default productName "This item" when name missing', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p1', quantity: 2 },
    ]);
    const result = await getCategorySocialProof('futons');
    expect(result.lowStockProducts[0].productName).toBe('This item');
  });

  it('handles database error gracefully', async () => {
    __setQueryError('InventoryLevels', new Error('DB down'));
    const result = await getCategorySocialProof('futons');
    expect(result.recentSalesCount).toBe(0);
    expect(result.lowStockProducts).toEqual([]);
    expect(result.config).toBeDefined();
  });
});
