import { describe, it, expect } from 'vitest';
import {
  getSitemapData,
  buildSitemapXml,
  getRobotsTxtContent,
} from '../src/backend/seoHelpers.web.js';

// ── getSitemapData ──────────────────────────────────────────────────

describe('getSitemapData', () => {
  it('returns static, category, and product page sections', () => {
    const data = getSitemapData([]);
    expect(data).toHaveProperty('staticPages');
    expect(data).toHaveProperty('categoryPages');
    expect(data).toHaveProperty('productPages');
  });

  it('includes all static pages with priorities', () => {
    const { staticPages } = getSitemapData([]);
    expect(staticPages.length).toBeGreaterThanOrEqual(8);
    const homePage = staticPages.find(p => p.url.endsWith('/'));
    expect(homePage).toBeDefined();
    // Home should be highest priority
    expect(homePage.priority).toBe('1.0');
    // All static pages should have changefreq
    staticPages.forEach(p => {
      expect(p.changefreq).toBeTruthy();
      expect(p.url).toContain('carolinafutons.com');
    });
  });

  it('includes all 11 category pages', () => {
    const { categoryPages } = getSitemapData([]);
    expect(categoryPages).toHaveLength(11);
    const slugs = categoryPages.map(c => c.slug);
    expect(slugs).toContain('futon-frames');
    expect(slugs).toContain('mattresses');
    expect(slugs).toContain('murphy-cabinet-beds');
    expect(slugs).toContain('platform-beds');
    expect(slugs).toContain('covers');
    expect(slugs).toContain('outdoor-furniture');
    expect(slugs).toContain('log-frames');
  });

  it('category pages have labels and correct priority', () => {
    const { categoryPages } = getSitemapData([]);
    categoryPages.forEach(c => {
      expect(c.label).toBeTruthy();
      expect(c.priority).toBe('0.8');
      expect(c.changefreq).toBe('weekly');
      expect(c.url).toContain(`carolinafutons.com/${c.slug}`);
    });
  });

  it('generates product page URLs from product slugs', () => {
    const products = [
      { slug: 'eureka-futon-frame' },
      { slug: 'monterey-futon-frame', _updatedDate: '2026-01-15' },
    ];
    const { productPages } = getSitemapData(products);
    expect(productPages).toHaveLength(2);
    expect(productPages[0].url).toContain('/product-page/eureka-futon-frame');
    expect(productPages[1].url).toContain('/product-page/monterey-futon-frame');
  });

  it('includes lastmod from _updatedDate string', () => {
    const products = [{ slug: 'test', _updatedDate: '2026-03-01T12:00:00Z' }];
    const { productPages } = getSitemapData(products);
    expect(productPages[0].lastmod).toBe('2026-03-01');
  });

  it('includes lastmod from _updatedDate Date object', () => {
    const products = [{ slug: 'test', _updatedDate: new Date('2026-02-20') }];
    const { productPages } = getSitemapData(products);
    expect(productPages[0].lastmod).toBe('2026-02-20');
  });

  it('sets lastmod to null when no _updatedDate', () => {
    const products = [{ slug: 'test' }];
    const { productPages } = getSitemapData(products);
    expect(productPages[0].lastmod).toBeNull();
  });

  it('handles invalid _updatedDate gracefully', () => {
    const products = [{ slug: 'test', _updatedDate: 'not-a-date' }];
    const { productPages } = getSitemapData(products);
    expect(productPages[0].lastmod).toBeNull();
  });

  it('filters out products with no slug', () => {
    const products = [{ slug: 'valid' }, { name: 'no-slug' }, { slug: '' }, null];
    const { productPages } = getSitemapData(products);
    expect(productPages).toHaveLength(1);
    expect(productPages[0].slug).toBe('valid');
  });

  it('handles undefined products param (defaults to empty)', () => {
    const data = getSitemapData();
    expect(data.productPages).toHaveLength(0);
    expect(data.staticPages.length).toBeGreaterThan(0);
  });

  it('handles non-array products param', () => {
    const data = getSitemapData('not-an-array');
    expect(data.productPages).toHaveLength(0);
  });

  it('product pages have correct priority and changefreq', () => {
    const products = [{ slug: 'test-product' }];
    const { productPages } = getSitemapData(products);
    expect(productPages[0].priority).toBe('0.7');
    expect(productPages[0].changefreq).toBe('weekly');
  });
});

// ── buildSitemapXml ─────────────────────────────────────────────────

describe('buildSitemapXml', () => {
  it('returns valid XML with urlset root', () => {
    const data = getSitemapData([]);
    const xml = buildSitemapXml(data);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('includes loc elements for all pages', () => {
    const data = getSitemapData([{ slug: 'test-product' }]);
    const xml = buildSitemapXml(data);
    // Should have entries for static + category + product pages
    const locCount = (xml.match(/<loc>/g) || []).length;
    // 9 static + 11 category + 1 product + 17 blog = 38
    expect(locCount).toBe(38);
  });

  it('includes lastmod when present', () => {
    const data = getSitemapData([{ slug: 'test', _updatedDate: '2026-01-01' }]);
    const xml = buildSitemapXml(data);
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
  });

  it('omits lastmod when null', () => {
    const data = getSitemapData([{ slug: 'test' }]);
    const xml = buildSitemapXml(data);
    // Product entry should not have lastmod
    const productSection = xml.split('product-page/test')[1];
    expect(productSection).not.toContain('<lastmod>');
  });

  it('includes priority and changefreq', () => {
    const data = getSitemapData([]);
    const xml = buildSitemapXml(data);
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<changefreq>monthly</changefreq>');
  });

  it('returns empty string for null input', () => {
    expect(buildSitemapXml(null)).toBe('');
  });

  it('handles empty page arrays', () => {
    const xml = buildSitemapXml({ staticPages: [], categoryPages: [], productPages: [] });
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<url>');
  });

  it('handles missing page arrays', () => {
    const xml = buildSitemapXml({});
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<url>');
  });

  it('sanitizes URLs through sanitizeForJsonLd', () => {
    const data = {
      staticPages: [{ url: 'https://example.com/test<script>', priority: '0.5', changefreq: 'monthly' }],
      categoryPages: [],
      productPages: [],
    };
    const xml = buildSitemapXml(data);
    // sanitizeForJsonLd strips script tags / XSS vectors
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('<loc>');
  });
});

// ── getRobotsTxtContent ─────────────────────────────────────────────

describe('getRobotsTxtContent', () => {
  it('starts with User-agent: * and Allow: /', () => {
    const content = getRobotsTxtContent();
    const lines = content.split('\n');
    expect(lines[0]).toBe('User-agent: *');
    expect(lines[1]).toBe('Allow: /');
  });

  it('blocks admin and private paths', () => {
    const content = getRobotsTxtContent();
    expect(content).toContain('Disallow: /admin');
    expect(content).toContain('Disallow: /members-only');
    expect(content).toContain('Disallow: /api');
    expect(content).toContain('Disallow: /_functions/');
    expect(content).toContain('Disallow: /account/');
  });

  it('includes sitemap URL', () => {
    const content = getRobotsTxtContent();
    expect(content).toContain('Sitemap: https://www.carolinafutons.com/sitemap.xml');
  });

  it('returns plain text (no HTML or XML tags)', () => {
    const content = getRobotsTxtContent();
    expect(content).not.toContain('<');
    expect(content).not.toContain('>');
  });
});

// ── Integration: sitemap pipeline ───────────────────────────────────

describe('sitemap pipeline integration', () => {
  it('getSitemapData → buildSitemapXml produces valid XML for real-world product set', () => {
    const products = [
      { slug: 'eureka-futon-frame', _updatedDate: '2026-01-10' },
      { slug: 'monterey-futon-frame', _updatedDate: new Date('2026-02-15') },
      { slug: 'phoenix-futon-frame' },
      { slug: 'bristol-futon-cover', _updatedDate: '2026-03-01T08:30:00Z' },
    ];
    const data = getSitemapData(products);
    const xml = buildSitemapXml(data);

    // Should be valid XML structure
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain('</urlset>');

    // All product URLs present
    expect(xml).toContain('/product-page/eureka-futon-frame');
    expect(xml).toContain('/product-page/monterey-futon-frame');
    expect(xml).toContain('/product-page/phoenix-futon-frame');
    expect(xml).toContain('/product-page/bristol-futon-cover');

    // Category URLs present
    expect(xml).toContain('/futon-frames');
    expect(xml).toContain('/mattresses');
    expect(xml).toContain('/murphy-cabinet-beds');

    // Static page URLs present
    expect(xml).toContain('carolinafutons.com/</loc>');
    expect(xml).toContain('/shop-main');
    expect(xml).toContain('/blog');
  });

  it('total URL count matches static + category + product count', () => {
    const products = Array.from({ length: 5 }, (_, i) => ({ slug: `product-${i}` }));
    const data = getSitemapData(products);
    const xml = buildSitemapXml(data);
    const urlCount = (xml.match(/<url>/g) || []).length;
    // 9 static + 11 categories + 5 products + 17 blog = 42
    expect(urlCount).toBe(42);
  });
});
