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
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/socialMediaKit.web.js');
});

// ── getShareUrls ───────────────────────────────────────────────────

describe('getShareUrls', () => {
  it('returns empty for no URL', async () => {
    const r = await mod.getShareUrls({ url: '', title: 'Test' });
    expect(r).toEqual({});
  });

  it('generates all platform URLs', async () => {
    const r = await mod.getShareUrls({ url: 'https://example.com', title: 'Test' });
    expect(r.facebook).toContain('facebook.com/sharer');
    expect(r.twitter).toContain('twitter.com/intent/tweet');
    expect(r.pinterest).toContain('pinterest.com/pin');
    expect(r.email).toContain('mailto:');
    expect(r.linkedin).toContain('linkedin.com');
  });

  it('encodes URL in share links', async () => {
    const r = await mod.getShareUrls({ url: 'https://example.com/path?q=1', title: 'Test' });
    expect(r.facebook).toContain(encodeURIComponent('https://example.com/path?q=1'));
  });

  it('includes image in Pinterest URL when provided', async () => {
    const r = await mod.getShareUrls({ url: 'https://example.com', title: 'Test', image: 'https://img.jpg' });
    expect(r.pinterest).toContain(encodeURIComponent('https://img.jpg'));
  });
});

// ── getProductShareUrls ────────────────────────────────────────────

describe('getProductShareUrls', () => {
  it('returns empty for null product', async () => {
    const r = await mod.getProductShareUrls(null);
    expect(r).toEqual({});
  });

  it('returns empty for product without slug', async () => {
    const r = await mod.getProductShareUrls({ name: 'Test' });
    expect(r).toEqual({});
  });

  it('generates product URLs', async () => {
    const r = await mod.getProductShareUrls({ slug: 'test-futon', name: 'Test Futon', price: 499 });
    expect(r.productUrl).toContain('/product-page/test-futon');
    expect(r.facebook).toContain('facebook.com');
    expect(r.twitter).toContain('499');
  });

  it('uses formattedPrice when available', async () => {
    const r = await mod.getProductShareUrls({ slug: 'test', name: 'Test', formattedPrice: '$499.00', price: 499 });
    expect(r.email).toContain('499');
  });
});

// ── validateSocialMeta ─────────────────────────────────────────────

describe('validateSocialMeta', () => {
  it('returns zero score for null meta', async () => {
    const r = await mod.validateSocialMeta(null);
    expect(r.score).toBe(0);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('returns perfect OG score with all tags', async () => {
    const meta = {
      'og:title': 'Test', 'og:description': 'Desc', 'og:image': 'https://img.jpg',
      'og:url': 'https://example.com', 'og:type': 'product',
    };
    const r = await mod.validateSocialMeta(meta);
    expect(r.platforms.facebook.score).toBe(5);
    expect(r.platforms.facebook.ready).toBe(true);
  });

  it('reports missing OG tags', async () => {
    const r = await mod.validateSocialMeta({});
    expect(r.issues.some(i => i.includes('og:title'))).toBe(true);
  });

  it('validates Twitter Card tags', async () => {
    const meta = {
      'twitter:card': 'summary_large_image', 'twitter:title': 'T',
      'twitter:description': 'D', 'twitter:image': 'https://img.jpg',
    };
    const r = await mod.validateSocialMeta(meta);
    expect(r.platforms.twitter.score).toBe(4);
    expect(r.platforms.twitter.ready).toBe(true);
  });

  it('warns about long og:title', async () => {
    const meta = { 'og:title': 'A'.repeat(100) };
    const r = await mod.validateSocialMeta(meta);
    expect(r.issues.some(i => i.includes('95 chars'))).toBe(true);
  });

  it('warns about invalid twitter:card value', async () => {
    const meta = { 'twitter:card': 'invalid' };
    const r = await mod.validateSocialMeta(meta);
    expect(r.issues.some(i => i.includes('invalid value'))).toBe(true);
  });

  it('warns about non-absolute og:image', async () => {
    const meta = { 'og:image': '/relative.jpg' };
    const r = await mod.validateSocialMeta(meta);
    expect(r.issues.some(i => i.includes('absolute URL'))).toBe(true);
  });
});

// ── checkProductSocialReadiness ────────────────────────────────────

describe('checkProductSocialReadiness', () => {
  it('returns not ready for null product', async () => {
    const r = await mod.checkProductSocialReadiness(null);
    expect(r.ready).toBe(false);
    expect(r.score).toBe(0);
  });

  it('returns ready for complete product', async () => {
    const r = await mod.checkProductSocialReadiness({
      slug: 'test-futon', name: 'Test Futon', price: 499,
      mainMedia: 'https://cdn.example.com/img.jpg', inStock: true,
      description: 'A great futon for your living room',
    });
    expect(r.ready).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(14);
    expect(r.meta['og:type']).toBe('product');
    expect(r.meta['product:price:amount']).toBe('499.00');
  });

  it('generates proper meta tags', async () => {
    const r = await mod.checkProductSocialReadiness({ slug: 'test', name: 'Test', price: 100 });
    expect(r.meta['og:url']).toContain('/product-page/test');
    expect(r.meta['twitter:card']).toBe('summary_large_image');
    expect(r.meta['product:price:currency']).toBe('USD');
  });
});

// ── getProductSocialMetaHtml ───────────────────────────────────────

describe('getProductSocialMetaHtml', () => {
  it('returns empty for null product', async () => {
    const r = await mod.getProductSocialMetaHtml(null);
    expect(r).toBe('');
  });

  it('generates meta tag HTML', async () => {
    const r = await mod.getProductSocialMetaHtml({ slug: 'test', name: 'Test Futon', price: 100 });
    expect(r).toContain('<meta property="og:title"');
    expect(r).toContain('<meta name="twitter:card"');
    expect(r).toContain('content=');
  });

  it('escapes HTML in content', async () => {
    const r = await mod.getProductSocialMetaHtml({ slug: 'test', name: 'Test "Futon" & More', price: 100 });
    expect(r).toContain('&amp;');
    expect(r).toContain('&quot;');
  });
});

// ── getFeedStatus ──────────────────────────────────────────────────

describe('getFeedStatus', () => {
  it('returns all feed endpoints', async () => {
    const r = await mod.getFeedStatus();
    expect(r.googleShopping).toBeTruthy();
    expect(r.facebookCatalog).toBeTruthy();
    expect(r.pinterestCatalog).toBeTruthy();
    expect(r.sitemap).toBeTruthy();
  });

  it('all feeds are configured', async () => {
    const r = await mod.getFeedStatus();
    expect(r.googleShopping.configured).toBe(true);
    expect(r.facebookCatalog.configured).toBe(true);
  });
});
