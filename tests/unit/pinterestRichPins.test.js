import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData } from '../__mocks__/wix-data.js';
import {
  getProductPinData,
  getGuidePinData,
  getPinterestMetaTags,
  validatePinMarkup,
} from '../../src/backend/pinterestRichPins.web.js';

beforeEach(() => {
  resetData();
});

// ── getProductPinData ─────────────────────────────────────────────────

describe('getProductPinData', () => {
  it('generates complete product pin metadata', async () => {
    const result = await getProductPinData({
      name: 'Eureka Futon Frame',
      slug: 'eureka-futon-frame',
      description: 'Solid hardwood futon frame with wall hugger design.',
      image: 'https://www.carolinafutons.com/images/eureka.jpg',
      price: 599.99,
      inStock: true,
      brand: 'Night & Day Furniture',
      category: 'futon-frames',
      sku: 'NDF-EUREKA-001',
    });

    expect(result.success).toBe(true);
    expect(result.meta['og:type']).toBe('product');
    expect(result.meta['og:title']).toBe('Eureka Futon Frame');
    expect(result.meta['og:url']).toContain('/product-page/eureka-futon-frame');
    expect(result.meta['product:price:amount']).toBe('599.99');
    expect(result.meta['product:price:currency']).toBe('USD');
    expect(result.meta['product:availability']).toBe('instock');
    expect(result.meta['product:brand']).toBe('Night & Day Furniture');
    expect(result.meta['pinterest-rich-pin']).toBe('true');
  });

  it('includes sale price when on sale', async () => {
    const result = await getProductPinData({
      name: 'Vienna Futon Frame',
      slug: 'vienna-futon-frame',
      price: 699.99,
      salePrice: 549.99,
      inStock: true,
    });

    expect(result.success).toBe(true);
    expect(result.meta['product:sale_price:amount']).toBe('549.99');
    expect(result.meta['product:sale_price:currency']).toBe('USD');
  });

  it('does not include sale price when higher than regular price', async () => {
    const result = await getProductPinData({
      name: 'Test Frame',
      slug: 'test',
      price: 100,
      salePrice: 150,
      inStock: true,
    });

    expect(result.success).toBe(true);
    expect(result.meta['product:sale_price:amount']).toBeUndefined();
  });

  it('marks out of stock products', async () => {
    const result = await getProductPinData({
      name: 'Discontinued Frame',
      slug: 'discontinued',
      price: 399.99,
      inStock: false,
    });

    expect(result.meta['product:availability']).toBe('oos');
  });

  it('defaults brand to Carolina Futons', async () => {
    const result = await getProductPinData({
      name: 'Generic Product',
      slug: 'generic',
      price: 99,
    });

    expect(result.meta['product:brand']).toBe('Carolina Futons');
  });

  it('requires product data with name', async () => {
    const result = await getProductPinData(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('requires product name', async () => {
    const result = await getProductPinData({ slug: 'test', price: 99 });
    expect(result.success).toBe(false);
  });

  it('sanitizes HTML in product fields', async () => {
    const result = await getProductPinData({
      name: '<script>alert(1)</script>Clean Frame',
      slug: 'clean-frame',
      description: '<img onerror=x>Nice frame',
      price: 299,
    });

    expect(result.success).toBe(true);
    expect(result.meta['og:title']).not.toContain('<script>');
    expect(result.meta['og:description']).not.toContain('<img');
  });

  it('uses default image when none provided', async () => {
    const result = await getProductPinData({
      name: 'No Image Product',
      slug: 'no-image',
      price: 199,
    });

    expect(result.meta['og:image']).toContain('og-default.jpg');
  });

  it('includes category when provided', async () => {
    const result = await getProductPinData({
      name: 'Test',
      slug: 'test',
      price: 99,
      category: 'mattresses',
    });

    expect(result.meta['product:category']).toBe('mattresses');
  });
});

// ── getGuidePinData ───────────────────────────────────────────────────

describe('getGuidePinData', () => {
  it('generates article pin metadata for a guide', async () => {
    const result = await getGuidePinData({
      slug: 'futon-frames',
      title: 'The Complete Futon Frame Buying Guide',
      description: 'Everything you need to know before buying a futon frame.',
      heroImage: 'https://www.carolinafutons.com/guides/frames-hero.jpg',
      publishDate: '2026-02-20',
    });

    expect(result.success).toBe(true);
    expect(result.meta['og:type']).toBe('article');
    expect(result.meta['og:title']).toContain('Futon Frame');
    expect(result.meta['og:url']).toContain('/buying-guides/futon-frames');
    expect(result.meta['article:published_time']).toBe('2026-02-20');
    expect(result.meta['article:author']).toBe('Carolina Futons');
    expect(result.meta['pinterest-rich-pin']).toBe('true');
  });

  it('requires guide data with title', async () => {
    const result = await getGuidePinData(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('title');
  });

  it('uses default image when none provided', async () => {
    const result = await getGuidePinData({
      slug: 'test',
      title: 'Test Guide',
    });

    expect(result.meta['og:image']).toContain('og-default.jpg');
  });

  it('handles custom author', async () => {
    const result = await getGuidePinData({
      slug: 'expert-picks',
      title: 'Expert Futon Picks',
      author: 'Carolina Futons Design Team',
    });

    expect(result.meta['article:author']).toBe('Carolina Futons Design Team');
  });

  it('omits publish date when not provided', async () => {
    const result = await getGuidePinData({
      slug: 'test',
      title: 'Test Guide',
    });

    expect(result.meta['article:published_time']).toBeUndefined();
  });
});

// ── getPinterestMetaTags ──────────────────────────────────────────────

describe('getPinterestMetaTags', () => {
  it('converts meta object to HTML meta tags', async () => {
    const result = await getPinterestMetaTags({
      'og:type': 'product',
      'og:title': 'Test Product',
      'og:url': 'https://example.com/test',
    });

    expect(result.success).toBe(true);
    expect(result.tags).toHaveLength(3);
    expect(result.tags[0]).toContain('<meta property="og:type"');
    expect(result.tags[0]).toContain('content="product"');
    expect(result.tagString).toContain('\n');
  });

  it('skips empty or null values', async () => {
    const result = await getPinterestMetaTags({
      'og:type': 'product',
      'og:title': '',
      'og:description': null,
      'og:url': 'https://example.com',
    });

    expect(result.tags).toHaveLength(2);
  });

  it('requires meta object', async () => {
    const result = await getPinterestMetaTags(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Meta object');
  });

  it('sanitizes meta tag content', async () => {
    const result = await getPinterestMetaTags({
      'og:title': '<script>alert(1)</script>Clean Title',
    });

    expect(result.tags[0]).not.toContain('<script>');
  });

  it('handles product pin meta end-to-end', async () => {
    const pinData = await getProductPinData({
      name: 'Eureka Frame',
      slug: 'eureka',
      price: 599,
      inStock: true,
    });
    const tags = await getPinterestMetaTags(pinData.meta);

    expect(tags.success).toBe(true);
    expect(tags.tags.length).toBeGreaterThan(5);
    expect(tags.tagString).toContain('og:type');
    expect(tags.tagString).toContain('product:price:amount');
  });
});

// ── validatePinMarkup ─────────────────────────────────────────────────

describe('validatePinMarkup', () => {
  it('validates complete product pin markup', async () => {
    const pinData = await getProductPinData({
      name: 'Eureka Frame',
      slug: 'eureka',
      description: 'Great frame',
      image: 'https://example.com/img.jpg',
      price: 599,
      inStock: true,
    });

    const result = await validatePinMarkup(pinData.meta, 'product');
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing required OG fields', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'Test',
    }, 'product');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('og:description'))).toBe(true);
  });

  it('detects missing product-specific fields', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'Test',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': 'https://example.com/img.jpg',
      'og:site_name': 'Test Site',
    }, 'product');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('product:price:amount'))).toBe(true);
  });

  it('validates article pin markup', async () => {
    const guideData = await getGuidePinData({
      slug: 'frames',
      title: 'Frame Guide',
      description: 'Guide desc',
      heroImage: 'https://example.com/img.jpg',
    });

    const result = await validatePinMarkup(guideData.meta, 'article');
    expect(result.valid).toBe(true);
  });

  it('detects wrong og:type for article pins', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'Guide',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': 'https://example.com/img.jpg',
      'og:site_name': 'Test',
      'article:author': 'Author',
    }, 'article');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('og:type must be "article"'))).toBe(true);
  });

  it('detects invalid image URL', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'Test',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': '/relative/path.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '99.99',
      'product:price:currency': 'USD',
      'product:availability': 'instock',
    }, 'product');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('absolute URL'))).toBe(true);
  });

  it('detects invalid availability value', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'Test',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': 'https://example.com/img.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '99.99',
      'product:price:currency': 'USD',
      'product:availability': 'sold_out',
    }, 'product');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('availability'))).toBe(true);
  });

  it('requires meta object', async () => {
    const result = await validatePinMarkup(null);
    expect(result.success).toBe(false);
  });

  it('detects zero or negative price', async () => {
    const result = await validatePinMarkup({
      'og:type': 'product',
      'og:title': 'Test',
      'og:description': 'Desc',
      'og:url': 'https://example.com',
      'og:image': 'https://example.com/img.jpg',
      'og:site_name': 'Test',
      'product:price:amount': '0',
      'product:price:currency': 'USD',
      'product:availability': 'instock',
    }, 'product');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('positive number'))).toBe(true);
  });
});
