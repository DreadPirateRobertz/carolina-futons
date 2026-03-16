import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateSlug: (slug) => {
    if (!slug || typeof slug !== 'string') return null;
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return clean || null;
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/pinterestRichPins.web.js');
});

// ── getProductPinData ────────────────────────────────────────────

describe('getProductPinData', () => {
  it('rejects null product', async () => {
    const r = await mod.getProductPinData(null);
    expect(r.success).toBe(false);
    expect(r.meta).toBeNull();
  });

  it('rejects product without name', async () => {
    const r = await mod.getProductPinData({ slug: 'test' });
    expect(r.success).toBe(false);
  });

  it('generates complete product pin metadata', async () => {
    const r = await mod.getProductPinData({
      name: 'Classic Futon Frame', slug: 'classic-futon-frame',
      description: 'A timeless design', price: 499, inStock: true,
      image: 'https://cdn.example.com/futon.jpg', brand: 'Night & Day',
      sku: 'FF-001', category: 'Futon Frames',
    });
    expect(r.success).toBe(true);
    expect(r.meta['og:type']).toBe('product');
    expect(r.meta['og:title']).toBe('Classic Futon Frame');
    expect(r.meta['og:url']).toContain('/product-page/classic-futon-frame');
    expect(r.meta['product:price:amount']).toBe('499.00');
    expect(r.meta['product:price:currency']).toBe('USD');
    expect(r.meta['product:availability']).toBe('instock');
    expect(r.meta['product:brand']).toBe('Night & Day');
    expect(r.meta['pinterest-rich-pin']).toBe('true');
  });

  it('includes sale price when lower', async () => {
    const r = await mod.getProductPinData({ name: 'Futon', price: 500, salePrice: 399 });
    expect(r.meta['product:sale_price:amount']).toBe('399.00');
  });

  it('omits sale price when not lower', async () => {
    const r = await mod.getProductPinData({ name: 'Futon', price: 500, salePrice: 600 });
    expect(r.meta['product:sale_price:amount']).toBeUndefined();
  });

  it('defaults inStock to true', async () => {
    const r = await mod.getProductPinData({ name: 'Futon', price: 100 });
    expect(r.meta['product:availability']).toBe('instock');
  });

  it('marks out of stock', async () => {
    const r = await mod.getProductPinData({ name: 'Futon', price: 100, inStock: false });
    expect(r.meta['product:availability']).toBe('oos');
  });
});

// ── getGuidePinData ──────────────────────────────────────────────

describe('getGuidePinData', () => {
  it('rejects null guide', async () => {
    const r = await mod.getGuidePinData(null);
    expect(r.success).toBe(false);
    expect(r.meta).toBeNull();
  });

  it('generates article pin metadata', async () => {
    const r = await mod.getGuidePinData({
      title: 'Best Futons 2026', slug: 'best-futons-2026',
      description: 'Our top picks', heroImage: 'https://cdn.example.com/hero.jpg',
      publishDate: '2026-01-15', author: 'Carolina Futons Team',
    });
    expect(r.success).toBe(true);
    expect(r.meta['og:type']).toBe('article');
    expect(r.meta['og:url']).toContain('/buying-guides/best-futons-2026');
    expect(r.meta['article:author']).toBe('Carolina Futons Team');
    expect(r.meta['article:published_time']).toBe('2026-01-15');
  });

  it('omits publish date when not provided', async () => {
    const r = await mod.getGuidePinData({ title: 'Guide' });
    expect(r.meta['article:published_time']).toBeUndefined();
  });
});

// ── getPinterestMetaTags ─────────────────────────────────────────

describe('getPinterestMetaTags', () => {
  it('rejects null meta', async () => {
    const r = await mod.getPinterestMetaTags(null);
    expect(r.success).toBe(false);
  });

  it('generates meta tag HTML', async () => {
    const r = await mod.getPinterestMetaTags({
      'og:title': 'Test Product', 'og:type': 'product',
    });
    expect(r.success).toBe(true);
    expect(r.tags).toHaveLength(2);
    expect(r.tags[0]).toContain('<meta property="og:title"');
    expect(r.tagString).toContain('og:type');
  });

  it('skips empty values', async () => {
    const r = await mod.getPinterestMetaTags({ 'og:title': 'Test', 'og:image': '' });
    expect(r.tags).toHaveLength(1);
  });
});

// ── validatePinMarkup ────────────────────────────────────────────

describe('validatePinMarkup', () => {
  it('rejects null meta', async () => {
    const r = await mod.validatePinMarkup(null);
    expect(r.success).toBe(false);
  });

  it('validates complete product pin', async () => {
    const meta = {
      'og:type': 'product', 'og:title': 'Futon', 'og:description': 'A futon',
      'og:url': 'https://example.com', 'og:image': 'https://img.jpg', 'og:site_name': 'CF',
      'product:price:amount': '499.00', 'product:price:currency': 'USD',
      'product:availability': 'instock',
    };
    const r = await mod.validatePinMarkup(meta, 'product');
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('reports missing product fields', async () => {
    const r = await mod.validatePinMarkup({}, 'product');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('validates article pin', async () => {
    const meta = {
      'og:type': 'article', 'og:title': 'Guide', 'og:description': 'A guide',
      'og:url': 'https://example.com', 'og:image': 'https://img.jpg', 'og:site_name': 'CF',
      'article:author': 'Author',
    };
    const r = await mod.validatePinMarkup(meta, 'article');
    expect(r.valid).toBe(true);
  });

  it('reports invalid price', async () => {
    const meta = {
      'og:type': 'product', 'og:title': 'F', 'og:description': 'D',
      'og:url': 'u', 'og:image': 'https://i.jpg', 'og:site_name': 'S',
      'product:price:amount': '0', 'product:price:currency': 'USD',
      'product:availability': 'instock',
    };
    const r = await mod.validatePinMarkup(meta, 'product');
    expect(r.errors.some(e => e.includes('positive number'))).toBe(true);
  });

  it('reports non-absolute image URL', async () => {
    const meta = {
      'og:type': 'product', 'og:title': 'F', 'og:description': 'D',
      'og:url': 'u', 'og:image': '/relative.jpg', 'og:site_name': 'S',
      'product:price:amount': '10', 'product:price:currency': 'USD',
      'product:availability': 'instock',
    };
    const r = await mod.validatePinMarkup(meta);
    expect(r.errors.some(e => e.includes('absolute URL'))).toBe(true);
  });
});
