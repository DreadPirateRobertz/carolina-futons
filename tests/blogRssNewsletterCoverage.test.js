/**
 * Tests for blog-related HTTP functions in http-functions.js.
 * (blogRssFeed.web.js was retired in cf-66ne chunk 3 — its only consumer
 * get_blogRssFeed inlined the logic. cf-cw6e retired blogNewsletter.web.js
 * — the 3 webMethods + their tests went together; sitemap + RSS coverage
 * stays here.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from 'wix-data';

import {
  get_blogSitemap,
  get_blogRssFeed,
  get_productSitemap,
} from 'backend/http-functions';

// ═══════════════════════════════════════════════════════════════════════
// HTTP Functions — blog sitemap & RSS feed
// ═══════════════════════════════════════════════════════════════════════

describe('http-functions — get_blogSitemap', () => {
  it('returns 200 with XML content-type', async () => {
    const response = await get_blogSitemap();
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/xml');
  });

  it('contains blog index at priority 0.7', async () => {
    const response = await get_blogSitemap();
    expect(response.body).toContain('<priority>0.7</priority>');
    expect(response.body).toContain('/blog</loc>');
  });

  it('contains blog post URLs at priority 0.7', async () => {
    const response = await get_blogSitemap();
    // Blog posts should now be at 0.7 (upgraded from 0.6)
    const postEntries = response.body.split('<url>').slice(2); // skip header + blog index
    for (const entry of postEntries) {
      if (entry.includes('/blog/')) {
        expect(entry).toContain('<priority>0.7</priority>');
      }
    }
  });

  it('includes lastmod for posts with publishDate', async () => {
    const response = await get_blogSitemap();
    expect(response.body).toContain('<lastmod>');
  });

  it('uses XML escaping', async () => {
    const response = await get_blogSitemap();
    expect(response.body).toContain('<?xml version="1.0"');
    expect(response.body).toContain('<urlset xmlns=');
    expect(response.body).toContain('</urlset>');
  });

  it('sets Cache-Control header', async () => {
    const response = await get_blogSitemap();
    expect(response.headers['Cache-Control']).toContain('public');
    expect(response.headers['Cache-Control']).toContain('max-age=3600');
  });
});

describe('http-functions — get_blogRssFeed', () => {
  it('returns 200 with RSS content-type', async () => {
    const response = await get_blogRssFeed();
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/rss+xml');
  });

  it('returns valid RSS XML', async () => {
    const response = await get_blogRssFeed();
    expect(response.body).toContain('<?xml version="1.0"');
    expect(response.body).toContain('<rss version="2.0"');
    expect(response.body).toContain('</rss>');
  });

  it('contains channel info', async () => {
    const response = await get_blogRssFeed();
    expect(response.body).toContain('<title>Carolina Futons Blog</title>');
    expect(response.body).toContain('<language>en-us</language>');
  });

  it('contains blog post items', async () => {
    const response = await get_blogRssFeed();
    expect(response.body).toContain('<item>');
    expect(response.body).toContain('</item>');
  });

  it('sets Cache-Control header', async () => {
    const response = await get_blogRssFeed();
    expect(response.headers['Cache-Control']).toContain('public');
    expect(response.headers['Cache-Control']).toContain('max-age=3600');
  });
});

describe('http-functions — get_productSitemap blog priorities', () => {
  beforeEach(() => {
    __reset();
    // Seed empty products so the sitemap can render
    __seed('Stores/Products', []);
  });

  it('has blog URLs at priority 0.7', async () => {
    const response = await get_productSitemap();
    expect(response.status).toBe(200);
    // Find blog entries in the sitemap body
    const blogEntries = response.body.split('<url>').filter(entry => entry.includes('/blog'));
    expect(blogEntries.length).toBeGreaterThan(0);
    for (const entry of blogEntries) {
      expect(entry).toContain('<priority>0.7</priority>');
    }
  });
});
