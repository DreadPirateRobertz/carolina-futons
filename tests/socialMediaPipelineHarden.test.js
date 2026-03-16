/**
 * Social media pipeline hardening tests — CF-mbrj
 * Covers remaining uncovered branches, error paths, and edge cases across:
 *   socialMediaKit.web.js, socialProof.web.js, pinterestRichPins.web.js,
 *   pinterestCatalogSync.web.js, facebookCatalog.web.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';
import {
  getShareUrls,
  getProductShareUrls,
  validateSocialMeta,
  checkProductSocialReadiness,
  getProductSocialMetaHtml,
} from '../src/backend/socialMediaKit.web.js';
import {
  getProductSocialProof,
  getCategorySocialProof,
  getSocialProofConfig,
} from '../src/backend/socialProof.web.js';
import {
  getProductPinData,
  getGuidePinData,
  getPinterestMetaTags,
  validatePinMarkup,
} from '../src/backend/pinterestRichPins.web.js';
import {
  validateCatalogProduct,
  auditCatalog,
  getCatalogSyncStatus,
  mapProductToBoard,
  generatePinContent,
  getBoardStructure,
} from '../src/backend/pinterestCatalogSync.web.js';
import {
  buildCapiEvent,
  buildProductSetParams,
  getEnhancedCatalogFields,
  exportCustomerAudienceData,
} from '../src/backend/facebookCatalog.web.js';

beforeEach(() => {
  __reset();
});

// ══════════════════════════════════════════════════════════════════════
// socialMediaKit.web.js — remaining branches
// ══════════════════════════════════════════════════════════════════════

describe('socialMediaKit edge cases', () => {
  it('getShareUrls — email includes description when provided', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: 'Title',
      description: 'Desc text',
    });
    expect(urls.email).toContain('Desc%20text');
    expect(urls.email).toContain('%0A%0A');
  });

  it('getShareUrls — email omits description prefix when empty', async () => {
    const urls = await getShareUrls({
      url: 'https://example.com',
      title: 'Title',
      description: '',
    });
    expect(urls.email).not.toContain('%0A%0A');
  });

  it('getProductShareUrls — uses formattedPrice when available', async () => {
    const urls = await getProductShareUrls({
      slug: 'test-product',
      name: 'Test',
      formattedPrice: '$199.00',
      price: 199,
    });
    expect(urls.twitter).toContain(encodeURIComponent('$199.00'));
  });

  it('getProductShareUrls — falls back to price.toFixed(2)', async () => {
    const urls = await getProductShareUrls({
      slug: 'test-product',
      name: 'Test',
      price: 199,
    });
    expect(urls.twitter).toContain(encodeURIComponent('$199.00'));
  });

  it('getProductShareUrls — uses default image when mainMedia missing', async () => {
    const urls = await getProductShareUrls({
      slug: 'test-product',
      name: 'Test',
      price: 100,
    });
    expect(urls.pinterest).toContain(encodeURIComponent('https://www.carolinafutons.com/og-default.jpg'));
  });

  it('checkProductSocialReadiness — strips HTML from description', async () => {
    const result = await checkProductSocialReadiness({
      slug: 'html-product',
      name: 'HTML Product',
      description: '<p>A <b>bold</b> description</p>',
      price: 100,
      inStock: true,
    });
    expect(result.meta['og:description']).not.toContain('<');
    expect(result.meta['og:description']).toContain('bold');
  });

  it('checkProductSocialReadiness — uses fallback description when empty', async () => {
    const result = await checkProductSocialReadiness({
      slug: 'no-desc',
      name: 'No Desc Product',
      description: '',
      price: 100,
    });
    expect(result.meta['og:description']).toContain('Shop');
    expect(result.meta['og:description']).toContain('No Desc Product');
  });

  it('checkProductSocialReadiness — marks OOS when inStock is false', async () => {
    const result = await checkProductSocialReadiness({
      slug: 'oos',
      name: 'OOS Product',
      price: 50,
      inStock: false,
    });
    expect(result.meta['product:availability']).toBe('oos');
  });

  it('validateSocialMeta — long og:description warning', async () => {
    const meta = {
      'og:title': 'T',
      'og:description': 'x'.repeat(201),
      'og:image': 'https://img.com/a.jpg',
      'og:url': 'https://example.com',
      'og:type': 'product',
    };
    const result = await validateSocialMeta(meta);
    expect(result.issues).toContainEqual(
      expect.stringContaining('og:description exceeds 200')
    );
  });

  it('validateSocialMeta — validates Pinterest product tags when og:type is product', async () => {
    const meta = {
      'og:type': 'product',
      'og:title': 'T',
      'og:description': 'D',
      'og:url': 'https://example.com',
      'og:image': 'https://img.com/a.jpg',
      // Missing product:price:amount, currency, availability
    };
    const result = await validateSocialMeta(meta);
    expect(result.issues).toContainEqual(
      expect.stringContaining('product:price:amount')
    );
  });

  it('getProductSocialMetaHtml — uses name attr for twitter: tags', async () => {
    const html = await getProductSocialMetaHtml({
      slug: 'test',
      name: 'Test',
      price: 100,
    });
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('property="og:type"');
  });

  it('getProductSocialMetaHtml — escapes ampersands and quotes', async () => {
    const html = await getProductSocialMetaHtml({
      slug: 'test',
      name: 'Test & "Quoted"',
      price: 100,
    });
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });
});

// ══════════════════════════════════════════════════════════════════════
// socialProof.web.js — error paths and helper edge cases
// ══════════════════════════════════════════════════════════════════════

describe('socialProof edge cases', () => {
  it('getProductSocialProof — handles query error gracefully', async () => {
    __setQueryError('Orders', new Error('DB timeout'));
    const result = await getProductSocialProof('prod-123');
    expect(result.notifications).toEqual([]);
    expect(result.config).toBeDefined();
  });

  it('getCategorySocialProof — handles query error gracefully', async () => {
    __setQueryError('InventoryLevels', new Error('DB fail'));
    const result = await getCategorySocialProof('futon-frames');
    expect(result.recentSalesCount).toBe(0);
    expect(result.lowStockProducts).toEqual([]);
  });

  it('getProductSocialProof — no stock notification when stock is 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-zero', quantity: 0 },
    ]);
    const result = await getProductSocialProof('prod-zero');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('getProductSocialProof — no stock notification when stock is null', async () => {
    // No inventory records = null stock level
    const result = await getProductSocialProof('prod-no-inv');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('getProductSocialProof — popularity notification for >=5 views', async () => {
    __seed('ProductAnalytics', Array.from({ length: 8 }, (_, i) => ({
      _id: `pa-${i}`,
      productId: 'prod-pop',
      timestamp: new Date(),
    })));
    const result = await getProductSocialProof('prod-pop');
    const pop = result.notifications.find(n => n.type === 'popularity');
    expect(pop).toBeDefined();
    expect(pop.message).toContain('people viewed this');
  });

  it('getProductSocialProof — no popularity for <5 views', async () => {
    __seed('ProductAnalytics', [
      { _id: 'pa-1', productId: 'prod-few', timestamp: new Date() },
    ]);
    const result = await getProductSocialProof('prod-few');
    const pop = result.notifications.find(n => n.type === 'popularity');
    expect(pop).toBeUndefined();
  });

  it('getProductSocialProof — purchase message without city', async () => {
    const recentDate = new Date();
    __seed('Orders', [{
      _id: 'ord-nocity',
      _createdDate: recentDate,
      billingInfo: { firstName: 'Alex' },
      lineItems: [{ productId: 'prod-nc', name: 'Frame' }],
    }]);
    const result = await getProductSocialProof('prod-nc', 'Frame');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Alex');
    expect(purchase.message).not.toContain('from');
  });

  it('getProductSocialProof — purchase uses shippingInfo city when billing city missing', async () => {
    const recentDate = new Date();
    __seed('Orders', [{
      _id: 'ord-shipcity',
      _createdDate: recentDate,
      billingInfo: { firstName: 'Bob' },
      shippingInfo: { city: 'raleigh' },
      lineItems: [{ productId: 'prod-sc', name: 'Mattress' }],
    }]);
    const result = await getProductSocialProof('prod-sc', 'Mattress');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Raleigh');
  });

  it('getCategorySocialProof — uses "This item" for missing productName', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-anon', productId: 'prod-anon', quantity: 2 },
    ]);
    const result = await getCategorySocialProof('some-category');
    const item = result.lowStockProducts.find(p => p.productId === 'prod-anon');
    expect(item).toBeDefined();
    expect(item.productName).toBe('This item');
  });

  it('getSocialProofConfig — returns proper config', async () => {
    const config = await getSocialProofConfig();
    expect(config.maxPerSession).toBe(5);
    expect(config.position).toBe('bottom-left');
  });
});

// ══════════════════════════════════════════════════════════════════════
// pinterestRichPins.web.js — catch blocks, validation edge cases
// ══════════════════════════════════════════════════════════════════════

describe('pinterestRichPins edge cases', () => {
  it('getProductPinData — uses default brand when not provided', async () => {
    const result = await getProductPinData({
      name: 'Test Frame',
      slug: 'test-frame',
      price: 100,
    });
    expect(result.success).toBe(true);
    expect(result.meta['product:brand']).toBe('Carolina Futons');
  });

  it('getProductPinData — omits category when empty', async () => {
    const result = await getProductPinData({
      name: 'Frame',
      slug: 'frame',
      price: 50,
    });
    expect(result.meta['product:category']).toBeUndefined();
  });

  it('getProductPinData — includes category when provided', async () => {
    const result = await getProductPinData({
      name: 'Frame',
      slug: 'frame',
      price: 50,
      category: 'futon-frames',
    });
    expect(result.meta['product:category']).toBe('futon-frames');
  });

  it('getProductPinData — uses SITE_URL when no slug', async () => {
    const result = await getProductPinData({
      name: 'No Slug',
      price: 50,
    });
    expect(result.meta['og:url']).toBe('https://www.carolinafutons.com');
  });

  it('getProductPinData — clamps negative price to 0', async () => {
    const result = await getProductPinData({
      name: 'Negative',
      slug: 'neg',
      price: -10,
    });
    expect(result.meta['product:price:amount']).toBe('0.00');
  });

  it('getGuidePinData — uses SITE_NAME as default author', async () => {
    const result = await getGuidePinData({
      title: 'Buying Guide',
      slug: 'guide-1',
    });
    expect(result.meta['article:author']).toBe('Carolina Futons');
  });

  it('getGuidePinData — uses fallback URL when no slug', async () => {
    const result = await getGuidePinData({
      title: 'Guide No Slug',
    });
    expect(result.meta['og:url']).toBe('https://www.carolinafutons.com/buying-guides');
  });

  it('getPinterestMetaTags — skips null/undefined/empty content values', async () => {
    const result = await getPinterestMetaTags({
      'og:title': 'Test',
      'og:empty': '',
      'og:none': null,
      'og:undef': undefined,
    });
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]).toContain('Test');
  });

  it('getPinterestMetaTags — escapes quotes in content', async () => {
    const result = await getPinterestMetaTags({
      'og:title': 'Test "Product" Name',
    });
    expect(result.tags[0]).toContain('&quot;');
    expect(result.tags[0]).not.toContain('content="Test "');
  });

  it('validatePinMarkup — reports invalid availability value', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'T',
      'og:description': 'D',
      'og:url': 'https://x.com',
      'og:image': 'https://x.com/img.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '100.00',
      'product:price:currency': 'USD',
      'product:availability': 'discontinued',
    });
    expect(result.errors).toContainEqual(
      expect.stringContaining('instock, oos, or preorder')
    );
  });

  it('validatePinMarkup — accepts preorder availability', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'T',
      'og:description': 'D',
      'og:url': 'https://x.com',
      'og:image': 'https://x.com/img.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '100.00',
      'product:price:currency': 'USD',
      'product:availability': 'preorder',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validatePinMarkup — reports non-absolute image URL', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'T',
      'og:description': 'D',
      'og:url': 'https://x.com',
      'og:image': '/images/local.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '100.00',
      'product:price:currency': 'USD',
      'product:availability': 'instock',
    });
    expect(result.errors).toContainEqual(
      expect.stringContaining('absolute URL')
    );
  });

  it('validatePinMarkup — article type checks og:type and author', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product', // Wrong type for article
      'og:title': 'T',
      'og:description': 'D',
      'og:url': 'https://x.com',
      'og:image': 'https://x.com/img.jpg',
      'og:site_name': 'Test',
    }, 'article');
    expect(result.errors).toContainEqual(
      expect.stringContaining('og:type must be "article"')
    );
    expect(result.errors).toContainEqual(
      expect.stringContaining('article:author')
    );
  });

  it('validatePinMarkup — reports zero or negative price', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'T',
      'og:description': 'D',
      'og:url': 'https://x.com',
      'og:image': 'https://x.com/img.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '0',
      'product:price:currency': 'USD',
      'product:availability': 'instock',
    });
    expect(result.errors).toContainEqual(
      expect.stringContaining('positive number')
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// pinterestCatalogSync.web.js — board rules, catch blocks, edge cases
// ══════════════════════════════════════════════════════════════════════

describe('pinterestCatalogSync edge cases', () => {
  it('mapProductToBoard — sale with clearance collection but no discountedPrice goes to default', async () => {
    const result = await mapProductToBoard({
      name: 'Sale Item',
      collections: ['clearance'],
      // No discountedPrice — sale rule requires it
    });
    // Without discountedPrice, the sale rule is skipped, no other rule matches 'clearance'
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('mapProductToBoard — handles collection objects with id property', async () => {
    const result = await mapProductToBoard({
      name: 'Murphy Bed',
      collections: [{ id: 'murphy-cabinet-beds' }],
    });
    expect(result.board).toBe('Murphy & Cabinet Beds');
  });

  it('mapProductToBoard — mattress maps to Small Space Solutions', async () => {
    const result = await mapProductToBoard({
      name: 'Futon Mattress',
      collections: ['mattress'],
    });
    expect(result.board).toBe('Small Space Solutions');
  });

  it('mapProductToBoard — casegood maps to Small Space Solutions', async () => {
    const result = await mapProductToBoard({
      name: 'Side Table',
      collections: ['casegoods-accessories'],
    });
    expect(result.board).toBe('Small Space Solutions');
  });

  it('mapProductToBoard — wall-hugger maps to Futon Living Rooms', async () => {
    const result = await mapProductToBoard({
      name: 'Wall Hugger Frame',
      collections: ['wall-hugger-frames'],
    });
    expect(result.board).toBe('Futon Living Rooms');
  });

  it('generatePinContent — truncates long descriptions', async () => {
    // sanitize caps description at 300 chars, but a long name pushes total over 500
    const longName = 'X'.repeat(150);
    const result = await generatePinContent({
      name: longName,
      slug: 'frame',
      price: 100,
      description: 'D'.repeat(500), // sanitized to 300
      collections: [],
    });
    expect(result.description.length).toBeLessThanOrEqual(500);
    expect(result.description).toMatch(/\.\.\.$/);
  });

  it('generatePinContent — adds category hashtags from collections', async () => {
    const result = await generatePinContent({
      name: 'Frame',
      slug: 'frame',
      price: 100,
      collections: ['futon-frames', 'wall-huggers'],
    });
    expect(result.hashtags).toContain('#FutonLiving');
    expect(result.hashtags).toContain('#FutonFrame');
    expect(result.hashtags).toContain('#WallHugger');
    expect(result.hashtags).toContain('#CarolinaFutons');
  });

  it('generatePinContent — deduplicates hashtags', async () => {
    const result = await generatePinContent({
      name: 'Frame',
      slug: 'frame',
      price: 100,
      collections: ['futon-frames', 'wall-huggers'],
    });
    const uniqueTags = new Set(result.hashtags);
    expect(uniqueTags.size).toBe(result.hashtags.length);
  });

  it('generatePinContent — uses SITE_URL when no slug', async () => {
    const result = await generatePinContent({
      name: 'Frame',
      price: 100,
    });
    expect(result.link).toMatch(/^https:\/\/www\.carolinafutons\.com\?utm_source=pinterest/);
  });

  it('validateCatalogProduct — warns on relative image URL', async () => {
    const result = await validateCatalogProduct({
      name: 'Frame',
      slug: 'frame',
      price: 100,
      mainMedia: '/images/frame.jpg',
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'mainMedia', type: 'format' })
    );
  });

  it('validateCatalogProduct — warns on long product name', async () => {
    const result = await validateCatalogProduct({
      name: 'A'.repeat(160),
      slug: 'long-name',
      price: 100,
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'name', type: 'length' })
    );
  });

  it('validateCatalogProduct — warns on long description', async () => {
    const result = await validateCatalogProduct({
      name: 'Frame',
      slug: 'frame',
      price: 100,
      description: 'B'.repeat(501),
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: 'description', type: 'length' })
    );
  });

  it('auditCatalog — returns zero counts for empty catalog', async () => {
    __seed('Stores/Products', []);
    const result = await auditCatalog();
    expect(result.success).toBe(true);
    expect(result.totalProducts).toBe(0);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it('auditCatalog — counts warnings from valid products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Frame', slug: 'frame', price: 100 }, // valid, missing description warning
    ]);
    const result = await auditCatalog();
    expect(result.validCount).toBe(1);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('getCatalogSyncStatus — returns health score', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Frame 1', slug: 'f1', price: 100 },
      { _id: 'p2', name: 'Frame 2', slug: 'f2', price: 200 },
      { _id: 'p3', name: '', slug: 'f3', price: 0 }, // invalid
    ]);
    const result = await getCatalogSyncStatus();
    expect(result.success).toBe(true);
    expect(result.healthScore).toBe(67); // 2/3 = 66.7 rounds to 67
    expect(result.feedFormat).toBe('TSV');
  });
});

// ══════════════════════════════════════════════════════════════════════
// facebookCatalog.web.js — normalizeUserData, detectBrand, error paths
// ══════════════════════════════════════════════════════════════════════

describe('facebookCatalog edge cases', () => {
  it('buildCapiEvent — normalizes phone number (strips non-digits)', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Frame', price: 100 },
      userInfo: { phone: '+1 (919) 555-1234' },
    });
    expect(event.user_data.ph).toBe('19195551234');
  });

  it('buildCapiEvent — normalizes city to lowercase', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Frame', price: 100 },
      userInfo: { city: 'Raleigh' },
    });
    expect(event.user_data.ct).toBe('raleigh');
  });

  it('buildCapiEvent — normalizes state to lowercase', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Frame', price: 100 },
      userInfo: { state: 'NC' },
    });
    expect(event.user_data.st).toBe('nc');
  });

  it('buildCapiEvent — preserves zip as-is (trimmed)', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Frame', price: 100 },
      userInfo: { zip: ' 27601 ' },
    });
    expect(event.user_data.zp).toBe('27601');
  });

  it('buildCapiEvent — skips empty user data fields', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Frame', price: 100 },
      userInfo: { email: '', phone: '', firstName: '  ' },
    });
    expect(event.user_data).toEqual({});
  });

  it('buildCapiEvent — normalizes lastName to lowercase', () => {
    const event = buildCapiEvent('Search', {
      query: 'futon',
      userInfo: { lastName: 'SMITH' },
    });
    expect(event.user_data.ln).toBe('smith');
  });

  it('buildCapiEvent — handles non-string user data fields', () => {
    const event = buildCapiEvent('Search', {
      query: 'futon',
      userInfo: { email: 123, phone: null, firstName: undefined },
    });
    expect(event.user_data).toEqual({});
  });

  it('buildCapiEvent — Purchase extracts user data from order when not provided', () => {
    const event = buildCapiEvent('Purchase', {
      order: {
        _id: 'ord-1',
        buyerInfo: { email: 'buyer@example.com' },
        billingInfo: { firstName: 'Joe', lastName: 'Doe', phone: '5551234' },
        lineItems: [{ productId: 'p1' }],
        totals: { total: 100 },
      },
    });
    expect(event.user_data.em).toBe('buyer@example.com');
    expect(event.user_data.fn).toBe('joe');
    expect(event.user_data.ln).toBe('doe');
    expect(event.user_data.ph).toBe('5551234');
  });

  it('buildCapiEvent — Purchase uses provided userInfo over order', () => {
    const event = buildCapiEvent('Purchase', {
      order: {
        _id: 'ord-1',
        buyerInfo: { email: 'buyer@example.com' },
        lineItems: [],
        totals: { total: 50 },
      },
      userInfo: { email: 'override@example.com' },
    });
    expect(event.user_data.em).toBe('override@example.com');
  });

  it('buildCapiEvent — AddToCart uses quantity', () => {
    const event = buildCapiEvent('AddToCart', {
      product: { _id: 'p1', name: 'Frame', price: 200 },
      quantity: 3,
    });
    expect(event.custom_data.num_items).toBe(3);
  });

  it('buildCapiEvent — AddToCart defaults quantity to 1', () => {
    const event = buildCapiEvent('AddToCart', {
      product: { _id: 'p1', name: 'Frame', price: 200 },
    });
    expect(event.custom_data.num_items).toBe(1);
  });

  it('getEnhancedCatalogFields — detects Strata Furniture brand for wall-hugger', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Frame',
      price: 300,
      collections: ['wall-hugger-frames'],
    });
    expect(fields.custom_label_1).toBe('Strata Furniture');
  });

  it('getEnhancedCatalogFields — detects KD Frames brand for unfinished', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Raw Frame',
      price: 200,
      collections: ['unfinished-wood'],
    });
    expect(fields.custom_label_1).toBe('KD Frames');
  });

  it('getEnhancedCatalogFields — detects Otis Bed brand for mattress', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Futon Mattress',
      price: 150,
      collections: ['mattresses'],
    });
    expect(fields.custom_label_1).toBe('Otis Bed');
  });

  it('getEnhancedCatalogFields — detects Arason brand from product name', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Murphy Bed System',
      price: 1500,
      collections: [],
    });
    expect(fields.custom_label_1).toBe('Arason Enterprises');
  });

  it('getEnhancedCatalogFields — detects cabinet bed brand from name', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Essex Cabinet Bed',
      price: 2000,
      collections: [],
    });
    expect(fields.custom_label_1).toBe('Arason Enterprises');
  });

  it('getEnhancedCatalogFields — uses options.color for color field', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Frame',
      price: 100,
      options: { color: 'Cherry' },
    });
    expect(fields.color).toBe('cherry');
  });

  it('getEnhancedCatalogFields — sets material field', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Frame',
      price: 100,
      material: 'Hardwood',
    });
    expect(fields.material).toBe('hardwood');
  });

  it('getEnhancedCatalogFields — detects Murphy product type from collections', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Bed',
      price: 100,
      collections: ['murphy-cabinet-beds'],
    });
    expect(fields.product_type).toBe('Bedroom > Murphy Cabinet Beds');
  });

  it('getEnhancedCatalogFields — detects Futon Mattresses product type', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Mattress',
      price: 100,
      collections: ['mattresses'],
    });
    expect(fields.product_type).toBe('Bedroom > Futon Mattresses');
  });

  it('getEnhancedCatalogFields — detects Platform Beds product type', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Platform',
      price: 100,
      collections: ['platform-beds'],
    });
    expect(fields.product_type).toBe('Bedroom > Platform Beds');
  });

  it('getEnhancedCatalogFields — detects Casegoods product type', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p1',
      name: 'Drawer',
      price: 100,
      collections: ['casegoods-accessories'],
    });
    expect(fields.product_type).toBe('Bedroom > Casegoods & Accessories');
  });

  it('getEnhancedCatalogFields — price bucket under-200', () => {
    const fields = getEnhancedCatalogFields({ _id: 'p1', name: 'F', price: 99 });
    expect(fields.custom_label_0).toBe('under-200');
  });

  it('getEnhancedCatalogFields — price bucket 200-500', () => {
    const fields = getEnhancedCatalogFields({ _id: 'p1', name: 'F', price: 300 });
    expect(fields.custom_label_0).toBe('200-500');
  });

  it('getEnhancedCatalogFields — price bucket 500-1000', () => {
    const fields = getEnhancedCatalogFields({ _id: 'p1', name: 'F', price: 750 });
    expect(fields.custom_label_0).toBe('500-1000');
  });

  it('getEnhancedCatalogFields — price bucket over-1000', () => {
    const fields = getEnhancedCatalogFields({ _id: 'p1', name: 'F', price: 1500 });
    expect(fields.custom_label_0).toBe('over-1000');
  });

  it('exportCustomerAudienceData — aggregates order value for same email', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'ord-1',
        buyerInfo: { email: 'jane@example.com' },
        billingInfo: { firstName: 'Jane', lastName: 'Doe' },
        shippingInfo: { shipmentDetails: { address: { city: 'Durham', subdivision: 'NC', postalCode: '27701', country: 'US' } } },
        totals: { total: 100 },
      },
      {
        _id: 'ord-2',
        buyerInfo: { email: 'Jane@Example.com' }, // Same email, different case
        billingInfo: { firstName: 'Jane', lastName: 'Doe' },
        totals: { total: 200 },
      },
    ]);
    const result = await exportCustomerAudienceData();
    expect(result.success).toBe(true);
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe('jane@example.com');
    expect(result.customers[0].value).toBe(300);
    expect(result.customers[0].fn).toBe('jane');
    expect(result.customers[0].ct).toBe('durham');
  });

  it('exportCustomerAudienceData — skips orders without email', async () => {
    __seed('Stores/Orders', [
      { _id: 'ord-noemail', buyerInfo: {}, totals: { total: 50 } },
    ]);
    const result = await exportCustomerAudienceData();
    expect(result.customers).toHaveLength(0);
  });

  it('exportCustomerAudienceData — handles query error', async () => {
    __setQueryError('Stores/Orders', new Error('DB crash'));
    const result = await exportCustomerAudienceData();
    expect(result.success).toBe(false);
    expect(result.customers).toEqual([]);
  });
});
