/**
 * @file sitemapEnhancer.test.js
 * @description Tests for sitemapEnhancer.web.js — CF-z5jm
 * Covers: pure helper functions (formatLastmod, getPriority, buildImageEntry,
 * buildProductEntry, buildSitemapXml, escapeXml) and the getProductSitemapEntries
 * webMethod.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';

import {
  formatLastmod,
  getPriority,
  buildImageEntry,
  buildProductEntry,
  buildSitemapXml,
  escapeXml,
  getProductSitemapEntries,
} from '../src/backend/sitemapEnhancer.web.js';

const SITE = 'https://www.carolinafutons.com';

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Monterey Futon Frame',
    slug: 'monterey-futon-frame',
    mainMedia: 'https://static.wixstatic.com/media/monterey.jpg',
    visible: true,
    _updatedDate: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  __reset();
  __seed('Stores/Products', []);
});

// ── formatLastmod ─────────────────────────────────────────────────────────────

describe('formatLastmod', () => {
  it('formats an ISO string to YYYY-MM-DD', () => {
    expect(formatLastmod('2026-03-15T10:00:00Z')).toBe('2026-03-15');
  });

  it('formats a Date object', () => {
    expect(formatLastmod(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });

  it('returns empty string for null', () => {
    expect(formatLastmod(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatLastmod(undefined)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatLastmod('not-a-date')).toBe('');
  });
});

// ── getPriority ───────────────────────────────────────────────────────────────

describe('getPriority', () => {
  it('returns 1.0 for home', () => {
    expect(getPriority('home')).toBe(1.0);
  });

  it('returns 0.8 for product', () => {
    expect(getPriority('product')).toBe(0.8);
  });

  it('returns 0.8 for category', () => {
    expect(getPriority('category')).toBe(0.8);
  });

  it('returns 0.7 for blog', () => {
    expect(getPriority('blog')).toBe(0.7);
  });

  it('returns 0.6 for guide', () => {
    expect(getPriority('guide')).toBe(0.6);
  });

  it('returns 0.5 for static', () => {
    expect(getPriority('static')).toBe(0.5);
  });

  it('returns 0.5 for unknown page type', () => {
    expect(getPriority('unknown')).toBe(0.5);
  });
});

// ── buildImageEntry ───────────────────────────────────────────────────────────

describe('buildImageEntry', () => {
  it('returns an image entry object for a valid HTTPS URL', () => {
    const entry = buildImageEntry('https://example.com/img.jpg', 'My Product');
    expect(entry).not.toBeNull();
    expect(entry.url).toBe('https://example.com/img.jpg');
    expect(entry.title).toBe('My Product');
  });

  it('returns null for empty URL', () => {
    expect(buildImageEntry('')).toBeNull();
    expect(buildImageEntry(null)).toBeNull();
  });

  it('returns null for non-HTTPS URL', () => {
    expect(buildImageEntry('ftp://example.com/img.jpg')).toBeNull();
    expect(buildImageEntry('wix:image://v1/abc')).toBeNull();
  });

  it('sets caption when provided', () => {
    const entry = buildImageEntry('https://example.com/img.jpg', 'Title', 'A caption');
    expect(entry.caption).toBe('A caption');
  });

  it('defaults title and caption to empty strings', () => {
    const entry = buildImageEntry('https://example.com/img.jpg');
    expect(entry.title).toBe('');
    expect(entry.caption).toBe('');
  });
});

// ── buildProductEntry ─────────────────────────────────────────────────────────

describe('buildProductEntry', () => {
  it('builds loc from product slug and site URL', () => {
    const entry = buildProductEntry(makeProduct({ slug: 'monterey-futon' }), SITE);
    expect(entry.loc).toBe(`${SITE}/product-page/monterey-futon`);
  });

  it('sets lastmod from _updatedDate', () => {
    const entry = buildProductEntry(makeProduct({ _updatedDate: '2026-03-15T10:00:00Z' }), SITE);
    expect(entry.lastmod).toBe('2026-03-15');
  });

  it('falls back to _createdDate when _updatedDate is absent', () => {
    const entry = buildProductEntry(makeProduct({ _updatedDate: null, _createdDate: '2026-01-01T00:00:00Z' }), SITE);
    expect(entry.lastmod).toBe('2026-01-01');
  });

  it('sets lastmod to empty string when no date available', () => {
    const entry = buildProductEntry(makeProduct({ _updatedDate: null, _createdDate: null }), SITE);
    expect(entry.lastmod).toBe('');
  });

  it('sets priority to 0.8 (product priority)', () => {
    const entry = buildProductEntry(makeProduct(), SITE);
    expect(entry.priority).toBe(0.8);
  });

  it('sets changefreq to weekly', () => {
    const entry = buildProductEntry(makeProduct(), SITE);
    expect(entry.changefreq).toBe('weekly');
  });

  it('includes image entry for mainMedia HTTPS URL', () => {
    const entry = buildProductEntry(makeProduct({
      mainMedia: 'https://static.wixstatic.com/media/img.jpg',
    }), SITE);
    expect(entry.images).toHaveLength(1);
    expect(entry.images[0].url).toBe('https://static.wixstatic.com/media/img.jpg');
  });

  it('includes no images when mainMedia is empty', () => {
    const entry = buildProductEntry(makeProduct({ mainMedia: '' }), SITE);
    expect(entry.images).toHaveLength(0);
  });

  it('includes additional mediaItems (up to 5 extra)', () => {
    const entry = buildProductEntry(makeProduct({
      mainMedia: 'https://example.com/main.jpg',
      mediaItems: [
        'https://example.com/main.jpg',
        'https://example.com/side.jpg',
        'https://example.com/back.jpg',
      ],
    }), SITE);
    // 1 main + 2 additional
    expect(entry.images).toHaveLength(3);
  });

  it('caps additional images at 5 extra', () => {
    const extra = Array.from({ length: 10 }, (_, i) => `https://example.com/img${i}.jpg`);
    const entry = buildProductEntry(makeProduct({
      mainMedia: 'https://example.com/main.jpg',
      mediaItems: ['https://example.com/main.jpg', ...extra],
    }), SITE);
    expect(entry.images.length).toBeLessThanOrEqual(6); // 1 main + 5 extra
  });
});

// ── escapeXml ─────────────────────────────────────────────────────────────────

describe('escapeXml', () => {
  it('escapes & to &amp;', () => {
    expect(escapeXml('Futon & Frame')).toBe('Futon &amp; Frame');
  });

  it('escapes < and > to &lt; and &gt;', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapes double-quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('returns empty string for null', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml('')).toBe('');
  });
});

// ── buildSitemapXml ───────────────────────────────────────────────────────────

describe('buildSitemapXml', () => {
  it('generates valid XML declaration and urlset wrapper', () => {
    const xml = buildSitemapXml([{ loc: `${SITE}/`, priority: 1.0, changefreq: 'daily' }]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('</urlset>');
  });

  it('adds image namespace when any entry has images', () => {
    const entries = [{
      loc: `${SITE}/product-page/test`,
      priority: 0.8,
      changefreq: 'weekly',
      images: [{ url: 'https://example.com/img.jpg', title: 'Test', caption: '' }],
    }];
    const xml = buildSitemapXml(entries);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  it('omits image namespace when no entry has images', () => {
    const xml = buildSitemapXml([{ loc: `${SITE}/`, priority: 1.0, changefreq: 'daily', images: [] }]);
    expect(xml).not.toContain('xmlns:image');
  });

  it('includes image:image block with loc and title', () => {
    const entries = [{
      loc: `${SITE}/product-page/test`,
      priority: 0.8,
      changefreq: 'weekly',
      images: [{ url: 'https://example.com/img.jpg', title: 'My Futon', caption: '' }],
    }];
    const xml = buildSitemapXml(entries);
    expect(xml).toContain('<image:image>');
    expect(xml).toContain('<image:loc>https://example.com/img.jpg</image:loc>');
    expect(xml).toContain('<image:title>My Futon</image:title>');
  });

  it('includes lastmod tag when set', () => {
    const xml = buildSitemapXml([{ loc: `${SITE}/`, lastmod: '2026-03-15', priority: 1.0, changefreq: 'daily' }]);
    expect(xml).toContain('<lastmod>2026-03-15</lastmod>');
  });

  it('omits lastmod tag when empty', () => {
    const xml = buildSitemapXml([{ loc: `${SITE}/`, lastmod: '', priority: 1.0, changefreq: 'daily' }]);
    expect(xml).not.toContain('<lastmod>');
  });

  it('formats priority to one decimal place', () => {
    const xml = buildSitemapXml([{ loc: `${SITE}/`, priority: 0.8, changefreq: 'weekly' }]);
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('escapes special characters in loc', () => {
    const xml = buildSitemapXml([{ loc: `${SITE}/page?a=1&b=2`, priority: 0.5, changefreq: 'monthly' }]);
    expect(xml).toContain('&amp;');
  });

  it('produces empty urlset for empty entries array', () => {
    const xml = buildSitemapXml([]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<url>');
  });
});

// ── getProductSitemapEntries webMethod ────────────────────────────────────────

describe('getProductSitemapEntries', () => {
  it('returns success:true with entries and xml for seeded products', async () => {
    __seed('Stores/Products', [makeProduct()]);
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.xml).toContain('<?xml');
    expect(result.count).toBe(1);
  });

  it('each entry has loc, priority, and changefreq', async () => {
    __seed('Stores/Products', [makeProduct({ slug: 'monterey' })]);
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    const entry = result.entries[0];
    expect(entry.loc).toContain('monterey');
    expect(entry.priority).toBe(0.8);
    expect(entry.changefreq).toBe('weekly');
  });

  it('includes lastmod from _updatedDate', async () => {
    __seed('Stores/Products', [makeProduct({ _updatedDate: '2026-03-20T00:00:00Z' })]);
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.entries[0].lastmod).toBe('2026-03-20');
  });

  it('includes image entries when product has mainMedia', async () => {
    __seed('Stores/Products', [makeProduct({
      mainMedia: 'https://static.wixstatic.com/media/test.jpg',
    })]);
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.entries[0].images.length).toBeGreaterThan(0);
  });

  it('excludes images when includeImages=false', async () => {
    __seed('Stores/Products', [makeProduct({
      mainMedia: 'https://static.wixstatic.com/media/test.jpg',
    })]);
    const result = await getProductSitemapEntries({ siteUrl: SITE, includeImages: false });
    expect(result.entries[0].images).toHaveLength(0);
  });

  it('image namespace present in XML when images exist', async () => {
    __seed('Stores/Products', [makeProduct({
      mainMedia: 'https://static.wixstatic.com/media/test.jpg',
    })]);
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.xml).toContain('xmlns:image');
  });

  it('returns empty entries for empty product catalog', async () => {
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('returns error on DB query failure', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.entries).toHaveLength(0);
  });

  it('handles products with no slug by falling back to _id', async () => {
    __seed('Stores/Products', [makeProduct({ slug: undefined, _id: 'fallback-id' })]);
    const result = await getProductSitemapEntries({ siteUrl: SITE });
    expect(result.entries[0].loc).toContain('fallback-id');
  });
});
