// blogNewsletterSitemap.test.js — CF-uj18: Blog→newsletter integration + blog sitemap entries
// TDD: tests first for blog_published event orchestration and blog sitemap inclusion.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';
import { __setSecrets, __reset as __resetSecrets } from 'wix-secrets-backend';

import {
  triggerManualOrchestration,
  triggerEventOrchestration,
  previewOrchestration,
} from '../src/backend/contentOrchestrator.web.js';

import {
  getSitemapData,
  buildSitemapXml,
  getRobotsTxtContent,
} from '../src/backend/seoHelpers.web.js';

import {
  getBlogSlugs,
  getAllBlogPosts,
} from '../src/backend/blogContent.js';

const EVENT_SECRET = 'test-event-secret';

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setMember({ _id: 'admin-1' });
  __setRoles([{ title: 'Admin' }]);
  __setSecrets({ CONTENT_EVENT_KEY: EVENT_SECRET });
  __seed('OrchestrationConfig', [{
    _id: 'config-1',
    enableNewsletter: true,
    enableSocialStory: true,
    enableCatalogSync: true,
    enableEmail: true,
    enableBlogNewsletter: true,
  }]);
});

// ── blog_published event orchestration ──────────────────────────────

describe('blog_published event orchestration', () => {
  const blogData = {
    productId: 'blog-best-futons',
    productName: 'Best Futons for Everyday Sleeping',
    productCategory: 'blog',
    imageUrl: 'https://example.com/blog-hero.jpg',
  };

  it('accepts blog_published as a valid event type', async () => {
    const result = await triggerManualOrchestration('blog_published', blogData);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBeGreaterThan(0);
  });

  it('schedules newsletter action for blog_published', async () => {
    const result = await triggerManualOrchestration('blog_published', blogData);
    expect(result.success).toBe(true);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).toContain('newsletter');
  });

  it('does NOT schedule catalog_sync for blog_published', async () => {
    const result = await triggerManualOrchestration('blog_published', blogData);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).not.toContain('catalog_sync');
  });

  it('schedules social_story for blog_published', async () => {
    const result = await triggerManualOrchestration('blog_published', blogData);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).toContain('social_story');
  });

  it('works via event-triggered (secret-auth) path', async () => {
    __setMember(null);
    __setRoles([]);
    const result = await triggerEventOrchestration(EVENT_SECRET, 'blog_published', blogData);
    expect(result.success).toBe(true);
    expect(result.scheduled.length).toBeGreaterThan(0);
  });

  it('preview shows planned actions for blog_published', async () => {
    const result = await previewOrchestration('blog_published', blogData);
    expect(result.success).toBe(true);
    expect(result.planned.length).toBeGreaterThan(0);
    expect(result.planned.some(a => a.contentType === 'newsletter')).toBe(true);
  });

  it('idempotent — duplicate blog_published is skipped', async () => {
    await triggerManualOrchestration('blog_published', blogData);
    const r2 = await triggerManualOrchestration('blog_published', blogData);
    expect(r2.scheduled.length).toBe(0);
    expect(r2.skipped).toBeGreaterThan(0);
  });

  it('inserts CMS entries with correct eventType', async () => {
    const inserts = [];
    __onInsert((collection, item) => {
      if (collection === 'ContentSchedule') inserts.push(item);
    });
    await triggerManualOrchestration('blog_published', blogData);
    expect(inserts.length).toBeGreaterThan(0);
    for (const item of inserts) {
      expect(item.eventType).toBe('blog_published');
    }
  });

  it('blog_published has lower priority than back_in_stock', async () => {
    const inserts = [];
    __onInsert((collection, item) => {
      if (collection === 'ContentSchedule') inserts.push(item);
    });
    await triggerManualOrchestration('blog_published', blogData);
    // blog_published should have priority 5 (lower urgency than seasonal=4)
    for (const item of inserts) {
      expect(item.priority).toBeGreaterThanOrEqual(4);
    }
  });

  it('respects enableNewsletter config toggle', async () => {
    __seed('OrchestrationConfig', [{
      _id: 'config-1',
      enableNewsletter: false,
      enableSocialStory: true,
      enableCatalogSync: true,
      enableEmail: true,
      enableBlogNewsletter: true,
    }]);
    const result = await triggerManualOrchestration('blog_published', blogData);
    const types = result.scheduled.map(s => s.contentType);
    expect(types).not.toContain('newsletter');
  });

  it('payload includes blog-specific data', async () => {
    const inserts = [];
    __onInsert((collection, item) => {
      if (collection === 'ContentSchedule') inserts.push(item);
    });
    await triggerManualOrchestration('blog_published', blogData);
    const newsletter = inserts.find(i => i.contentType === 'newsletter');
    expect(newsletter).toBeDefined();
    const payload = JSON.parse(newsletter.payload);
    expect(payload.productCategory).toBe('blog');
    expect(payload.imageUrl).toBe('https://example.com/blog-hero.jpg');
  });
});

// ── Blog sitemap entries ────────────────────────────────────────────

describe('getSitemapData with blog posts', () => {
  it('includes blogPages in sitemap data', () => {
    const data = getSitemapData([]);
    expect(data.blogPages).toBeDefined();
    expect(Array.isArray(data.blogPages)).toBe(true);
  });

  it('blog pages have correct URL format', () => {
    const data = getSitemapData([]);
    expect(data.blogPages.length).toBeGreaterThan(0);
    for (const page of data.blogPages) {
      expect(page.url).toMatch(/\/blog\//);
      expect(page.url).toMatch(/^https:\/\/www\.carolinafutons\.com\/blog\//);
    }
  });

  it('blog pages have priority 0.7', () => {
    const data = getSitemapData([]);
    for (const page of data.blogPages) {
      expect(page.priority).toBe('0.7');
    }
  });

  it('blog pages have weekly changefreq', () => {
    const data = getSitemapData([]);
    for (const page of data.blogPages) {
      expect(page.changefreq).toBe('weekly');
    }
  });

  it('includes all blog post slugs from blogContent', () => {
    const data = getSitemapData([]);
    const slugs = getBlogSlugs();
    const blogSlugs = data.blogPages.map(p => {
      const parts = p.url.split('/blog/');
      return parts[parts.length - 1];
    });
    // All 14 original blog posts should be present
    for (const slug of slugs.slice(0, 14)) {
      expect(blogSlugs).toContain(slug);
    }
  });

  it('blog pages include title from blog post data', () => {
    const data = getSitemapData([]);
    const firstBlog = data.blogPages.find(p => p.url.includes('best-futons-for-everyday-sleeping'));
    expect(firstBlog).toBeDefined();
    expect(firstBlog.title).toBe('Best Futons for Everyday Sleeping: A Complete Guide');
  });
});

describe('buildSitemapXml with blog pages', () => {
  it('includes blog page URLs in XML output', () => {
    const data = getSitemapData([]);
    const xml = buildSitemapXml(data);
    expect(xml).toContain('/blog/best-futons-for-everyday-sleeping');
    expect(xml).toContain('<priority>0.7</priority>');
  });

  it('blog pages appear in XML alongside static and product pages', () => {
    const data = getSitemapData([
      { slug: 'monterey-futon-frame', _updatedDate: '2026-03-01' },
    ]);
    const xml = buildSitemapXml(data);
    // Static pages
    expect(xml).toContain('https://www.carolinafutons.com/');
    // Product pages
    expect(xml).toContain('/product-page/monterey-futon-frame');
    // Blog pages
    expect(xml).toContain('/blog/best-futons-for-everyday-sleeping');
  });
});

// ── robots.txt ──────────────────────────────────────────────────────

describe('getRobotsTxtContent', () => {
  it('returns valid robots.txt with sitemap reference', () => {
    const robots = getRobotsTxtContent();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap:');
    expect(robots).toContain('sitemap.xml');
  });

  it('blocks admin and API paths', () => {
    const robots = getRobotsTxtContent();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api');
    expect(robots).toContain('Disallow: /_functions/');
  });
});
