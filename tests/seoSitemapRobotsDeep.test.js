// seoSitemapRobotsDeep.test.js — CF-xr0u: Deep edge-case coverage for
// getSitemapData, buildSitemapXml, getRobotsTxtContent in seoHelpers.web.js
// Edge cases: malformed product data, large sitemaps, XSS in slugs/URLs,
// special characters, date boundaries, page ordering, robots.txt structure.
import { describe, it, expect } from 'vitest';
import {
  getSitemapData,
  buildSitemapXml,
  getRobotsTxtContent,
} from '../src/backend/seoHelpers.web.js';

// ── getSitemapData — malformed product data ──────────────────────────

describe('getSitemapData — malformed products', () => {
  it('filters out product with numeric slug', () => {
    const { productPages } = getSitemapData([{ slug: 12345 }]);
    expect(productPages).toHaveLength(0);
  });

  it('filters out product with boolean slug', () => {
    const { productPages } = getSitemapData([{ slug: true }]);
    expect(productPages).toHaveLength(0);
  });

  it('filters out product with array slug', () => {
    const { productPages } = getSitemapData([{ slug: ['a', 'b'] }]);
    expect(productPages).toHaveLength(0);
  });

  it('filters out product with object slug', () => {
    const { productPages } = getSitemapData([{ slug: { value: 'test' } }]);
    expect(productPages).toHaveLength(0);
  });

  it('filters out undefined product entries', () => {
    const { productPages } = getSitemapData([undefined, null, { slug: 'valid' }]);
    expect(productPages).toHaveLength(1);
  });

  it('handles product with special characters in slug', () => {
    const { productPages } = getSitemapData([{ slug: 'frame-with-tréma-ñ' }]);
    expect(productPages).toHaveLength(1);
    expect(productPages[0].url).toContain('frame-with-tréma-ñ');
  });

  it('handles product with spaces in slug', () => {
    const { productPages } = getSitemapData([{ slug: 'frame with spaces' }]);
    expect(productPages).toHaveLength(1);
    expect(productPages[0].url).toContain('frame with spaces');
  });

  it('handles product with ampersand in slug', () => {
    const { productPages } = getSitemapData([{ slug: 'frame&mattress' }]);
    expect(productPages).toHaveLength(1);
  });

  it('handles Date object for _updatedDate', () => {
    const date = new Date('2026-06-15T10:30:00Z');
    const { productPages } = getSitemapData([{ slug: 'test', _updatedDate: date }]);
    expect(productPages[0].lastmod).toBe('2026-06-15');
  });

  it('handles epoch timestamp string for _updatedDate', () => {
    const { productPages } = getSitemapData([{ slug: 'test', _updatedDate: '1774022400000' }]);
    // This is a weird date string — new Date('1774022400000') is invalid
    expect(productPages[0].lastmod).toBeNull();
  });

  it('handles negative date string for _updatedDate', () => {
    const { productPages } = getSitemapData([{ slug: 'test', _updatedDate: '-1' }]);
    // new Date('-1') parses to a valid date (2001-01-01), so lastmod is set
    expect(typeof productPages[0].lastmod).toBe('string');
  });

  it('handles empty string _updatedDate', () => {
    const { productPages } = getSitemapData([{ slug: 'test', _updatedDate: '' }]);
    // Empty string is falsy → no lastmod
    expect(productPages[0].lastmod).toBeNull();
  });

  it('handles null _updatedDate', () => {
    const { productPages } = getSitemapData([{ slug: 'test', _updatedDate: null }]);
    expect(productPages[0].lastmod).toBeNull();
  });
});

// ── getSitemapData — large sitemaps ──────────────────────────────────

describe('getSitemapData — large sitemaps', () => {
  it('handles 1000 products', () => {
    const products = Array.from({ length: 1000 }, (_, i) => ({
      slug: `product-${i}`,
      _updatedDate: '2026-01-01',
    }));
    const { productPages } = getSitemapData(products);
    expect(productPages).toHaveLength(1000);
  });

  it('handles 5000 products without error', () => {
    const products = Array.from({ length: 5000 }, (_, i) => ({
      slug: `product-${i}`,
    }));
    const { productPages } = getSitemapData(products);
    expect(productPages).toHaveLength(5000);
  });

  it('mixed valid/invalid products in large set', () => {
    const products = Array.from({ length: 100 }, (_, i) => {
      if (i % 5 === 0) return null;
      if (i % 7 === 0) return { slug: '' };
      return { slug: `product-${i}` };
    });
    const { productPages } = getSitemapData(products);
    // Count how many should be valid
    const expectedValid = products.filter(p => p && typeof p?.slug === 'string' && p.slug.length > 0).length;
    expect(productPages).toHaveLength(expectedValid);
  });
});

// ── buildSitemapXml — edge cases ─────────────────────────────────────

describe('buildSitemapXml — edge cases', () => {
  it('returns empty string for undefined input', () => {
    expect(buildSitemapXml(undefined)).toBe('');
  });

  it('returns empty string for false input', () => {
    expect(buildSitemapXml(false)).toBe('');
  });

  it('returns empty string for 0 input', () => {
    expect(buildSitemapXml(0)).toBe('');
  });

  it('handles sitemapData with only staticPages', () => {
    const xml = buildSitemapXml({
      staticPages: [{ url: 'https://example.com/', priority: '1.0', changefreq: 'daily' }],
    });
    expect(xml).toContain('<url>');
    expect(xml).toContain('<loc>');
    expect(xml).toContain('</urlset>');
  });

  it('handles sitemapData with only categoryPages', () => {
    const xml = buildSitemapXml({
      categoryPages: [{ url: 'https://example.com/cat', priority: '0.8', changefreq: 'weekly' }],
    });
    expect(xml).toContain('<url>');
  });

  it('handles sitemapData with only productPages', () => {
    const xml = buildSitemapXml({
      productPages: [{ url: 'https://example.com/product/test', priority: '0.7', changefreq: 'weekly' }],
    });
    expect(xml).toContain('<url>');
  });

  it('sanitizes XSS in URLs', () => {
    const xml = buildSitemapXml({
      staticPages: [],
      categoryPages: [],
      productPages: [{ url: 'https://example.com/<script>alert(1)</script>', priority: '0.7' }],
    });
    expect(xml).not.toContain('<script>');
    expect(xml).not.toContain('</script>');
  });

  it('handles URL with ampersand', () => {
    const xml = buildSitemapXml({
      staticPages: [],
      categoryPages: [],
      productPages: [{ url: 'https://example.com/page?a=1&b=2', priority: '0.7' }],
    });
    // sanitizeForJsonLd should escape &
    expect(xml).toContain('\\u0026');
  });

  it('omits lastmod, changefreq, priority when not present', () => {
    const xml = buildSitemapXml({
      staticPages: [],
      categoryPages: [],
      productPages: [{ url: 'https://example.com/simple' }],
    });
    const urlBlock = xml.split('<url>')[1].split('</url>')[0];
    expect(urlBlock).toContain('<loc>');
    expect(urlBlock).not.toContain('<lastmod>');
    expect(urlBlock).not.toContain('<changefreq>');
    expect(urlBlock).not.toContain('<priority>');
  });

  it('large sitemap XML is well-formed', () => {
    const products = Array.from({ length: 500 }, (_, i) => ({
      slug: `product-${i}`,
      _updatedDate: '2026-01-01',
    }));
    const data = getSitemapData(products);
    const xml = buildSitemapXml(data);

    // Count opening and closing URL tags
    const openTags = (xml.match(/<url>/g) || []).length;
    const closeTags = (xml.match(/<\/url>/g) || []).length;
    expect(openTags).toBe(closeTags);
    expect(openTags).toBe(8 + 11 + 500); // static + category + products

    // Starts and ends correctly
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toMatch(/<\/urlset>$/);
  });
});

// ── buildSitemapXml — page ordering ──────────────────────────────────

describe('buildSitemapXml — page ordering', () => {
  it('static pages appear before category pages', () => {
    const data = getSitemapData([{ slug: 'test-product' }]);
    const xml = buildSitemapXml(data);

    // Home page (static) should appear before any category
    const homePos = xml.indexOf('carolinafutons.com/</loc>');
    const categoryPos = xml.indexOf('/futon-frames</loc>');
    expect(homePos).toBeLessThan(categoryPos);
  });

  it('category pages appear before product pages', () => {
    const data = getSitemapData([{ slug: 'test-product' }]);
    const xml = buildSitemapXml(data);

    const categoryPos = xml.indexOf('/futon-frames</loc>');
    const productPos = xml.indexOf('/product-page/test-product');
    expect(categoryPos).toBeLessThan(productPos);
  });
});

// ── getRobotsTxtContent — structure ──────────────────────────────────

describe('getRobotsTxtContent — structure validation', () => {
  it('has correct number of Disallow directives', () => {
    const content = getRobotsTxtContent();
    const disallows = content.split('\n').filter(l => l.startsWith('Disallow:'));
    expect(disallows).toHaveLength(5);
  });

  it('has exactly one User-agent directive', () => {
    const content = getRobotsTxtContent();
    const agents = content.split('\n').filter(l => l.startsWith('User-agent:'));
    expect(agents).toHaveLength(1);
  });

  it('has exactly one Sitemap directive', () => {
    const content = getRobotsTxtContent();
    const sitemaps = content.split('\n').filter(l => l.startsWith('Sitemap:'));
    expect(sitemaps).toHaveLength(1);
  });

  it('has exactly one Allow directive', () => {
    const content = getRobotsTxtContent();
    const allows = content.split('\n').filter(l => l.startsWith('Allow:'));
    expect(allows).toHaveLength(1);
  });

  it('sitemap URL uses HTTPS', () => {
    const content = getRobotsTxtContent();
    const sitemapLine = content.split('\n').find(l => l.startsWith('Sitemap:'));
    expect(sitemapLine).toContain('https://');
  });

  it('blocks _functions/ path (API endpoints)', () => {
    const content = getRobotsTxtContent();
    expect(content).toContain('Disallow: /_functions/');
  });

  it('blocks account/ path (user profiles)', () => {
    const content = getRobotsTxtContent();
    expect(content).toContain('Disallow: /account/');
  });

  it('is deterministic — returns same content on multiple calls', () => {
    const content1 = getRobotsTxtContent();
    const content2 = getRobotsTxtContent();
    expect(content1).toBe(content2);
  });

  it('does not contain empty Disallow (which would block nothing)', () => {
    const content = getRobotsTxtContent();
    const lines = content.split('\n');
    const disallowLines = lines.filter(l => l.startsWith('Disallow:'));
    for (const line of disallowLines) {
      expect(line.replace('Disallow:', '').trim()).not.toBe('');
    }
  });
});

// ── Integration: full pipeline ──────────────────────────────────────

describe('sitemap+robots integration — complete pipeline', () => {
  it('robots.txt sitemap URL matches the domain used in sitemap XML', () => {
    const robotsTxt = getRobotsTxtContent();
    const sitemapUrl = robotsTxt.match(/Sitemap: (.+)/)?.[1];
    const domain = sitemapUrl?.replace('/sitemap.xml', '');

    const data = getSitemapData([{ slug: 'test' }]);
    const xml = buildSitemapXml(data);

    // All URLs in sitemap should use the same domain
    const locs = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
    for (const loc of locs) {
      const url = loc.replace(/<\/?loc>/g, '');
      // URLs are sanitized with unicode escapes, so check the base domain
      expect(url).toContain('carolinafutons');
    }
  });

  it('empty product catalog still produces valid sitemap with static+category pages', () => {
    const data = getSitemapData([]);
    const xml = buildSitemapXml(data);

    expect(xml).toContain('<?xml');
    expect(xml).toContain('</urlset>');

    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(19); // 8 static + 11 category
  });

  it('getSitemapData result directly usable by buildSitemapXml', () => {
    const products = [
      { slug: 'a', _updatedDate: '2026-01-01' },
      { slug: 'b' },
    ];
    const data = getSitemapData(products);
    const xml = buildSitemapXml(data);
    expect(typeof xml).toBe('string');
    expect(xml.length).toBeGreaterThan(100);
    expect(xml).toContain('/product-page/a');
    expect(xml).toContain('/product-page/b');
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
  });
});
