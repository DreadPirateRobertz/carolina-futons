import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData } from '../__mocks__/wix-data.js';
import {
  getContentHub,
  getPillarGuide,
  getPillarGuideSlugs,
  getHubSchema,
  getGuideSchema,
  getSitemapEntries,
} from '../../src/backend/seoContentHub.web.js';

beforeEach(() => {
  resetData();
});

// ── getContentHub ─────────────────────────────────────────────────────

describe('getContentHub', () => {
  it('returns all 8 pillar guides', async () => {
    const result = await getContentHub();
    expect(result.success).toBe(true);
    expect(result.hub.guideCount).toBe(8);
    expect(result.hub.guides).toHaveLength(8);
  });

  it('includes hub metadata', async () => {
    const result = await getContentHub();
    expect(result.hub.title).toContain('Buying Guides');
    expect(result.hub.metaDescription).toBeTruthy();
    expect(result.hub.url).toContain('/buying-guides');
  });

  it('each guide has required fields', async () => {
    const result = await getContentHub();
    for (const guide of result.hub.guides) {
      expect(guide.slug).toBeTruthy();
      expect(guide.title).toBeTruthy();
      expect(guide.shortTitle).toBeTruthy();
      expect(guide.description).toBeTruthy();
      expect(guide.heroImage).toBeTruthy();
      expect(guide.url).toContain('/buying-guides/');
      expect(guide.publishDate).toBeTruthy();
    }
  });

  it('covers all 8 categories', async () => {
    const result = await getContentHub();
    const slugs = result.hub.guides.map(g => g.slug);
    expect(slugs).toContain('futon-frames');
    expect(slugs).toContain('mattresses');
    expect(slugs).toContain('covers');
    expect(slugs).toContain('pillows');
    expect(slugs).toContain('storage');
    expect(slugs).toContain('outdoor');
    expect(slugs).toContain('accessories');
    expect(slugs).toContain('bundle-deals');
  });
});

// ── getPillarGuide ────────────────────────────────────────────────────

describe('getPillarGuide', () => {
  it('returns guide with related guides', async () => {
    const result = await getPillarGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guide.slug).toBe('futon-frames');
    expect(result.guide.title).toContain('Futon Frame');
    expect(result.relatedGuides.length).toBeGreaterThan(0);
  });

  it('related guides have correct structure', async () => {
    const result = await getPillarGuide('mattresses');
    expect(result.relatedGuides.length).toBeGreaterThan(0);
    for (const related of result.relatedGuides) {
      expect(related.slug).toBeTruthy();
      expect(related.title).toBeTruthy();
      expect(related.url).toContain('/buying-guides/');
    }
  });

  it('returns null for unknown slug', async () => {
    const result = await getPillarGuide('nonexistent');
    expect(result.success).toBe(true);
    expect(result.guide).toBeNull();
    expect(result.relatedGuides).toHaveLength(0);
  });

  it('requires a slug', async () => {
    const result = await getPillarGuide('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('slug');
  });

  it('sanitizes slug input', async () => {
    const result = await getPillarGuide('<script>alert(1)</script>');
    expect(result.success).toBe(true);
    expect(result.guide).toBeNull();
  });

  it('returns related guides for each category', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getPillarGuide(slug);
      expect(result.success).toBe(true);
      expect(result.guide).not.toBeNull();
      expect(result.relatedGuides.length).toBeGreaterThan(0);
    }
  });
});

// ── getPillarGuideSlugs ───────────────────────────────────────────────

describe('getPillarGuideSlugs', () => {
  it('returns all 8 slugs', async () => {
    const result = await getPillarGuideSlugs();
    expect(result.success).toBe(true);
    expect(result.slugs).toHaveLength(8);
  });

  it('slugs are valid URL-safe strings', async () => {
    const result = await getPillarGuideSlugs();
    for (const slug of result.slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

// ── getHubSchema ──────────────────────────────────────────────────────

describe('getHubSchema', () => {
  it('returns valid CollectionPage JSON-LD', async () => {
    const result = await getHubSchema();
    expect(result.success).toBe(true);

    const schema = JSON.parse(result.collectionSchema);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('CollectionPage');
    expect(schema.name).toContain('Buying Guides');
    expect(schema.publisher.name).toBe('Carolina Futons');
    expect(schema.mainEntity['@type']).toBe('ItemList');
    expect(schema.mainEntity.numberOfItems).toBe(8);
  });

  it('returns valid ItemList JSON-LD', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.itemListSchema);
    expect(schema['@type']).toBe('ItemList');
    expect(schema.itemListElement).toHaveLength(8);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[0]['@type']).toBe('ListItem');
  });

  it('returns valid BreadcrumbList JSON-LD for hub', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.breadcrumbSchema);
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].name).toBe('Home');
    expect(schema.itemListElement[1].name).toBe('Buying Guides');
  });

  it('ItemList entries have URLs and names', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.itemListSchema);
    for (const item of schema.itemListElement) {
      expect(item.url).toContain('carolinafutons.com/buying-guides/');
      expect(item.name).toBeTruthy();
      expect(item.image).toBeTruthy();
    }
  });
});

// ── getGuideSchema ────────────────────────────────────────────────────

describe('getGuideSchema', () => {
  it('returns breadcrumb with 3 levels for guide page', async () => {
    const result = await getGuideSchema('futon-frames');
    expect(result.success).toBe(true);

    const schema = JSON.parse(result.breadcrumbSchema);
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[0].name).toBe('Home');
    expect(schema.itemListElement[1].name).toBe('Buying Guides');
    expect(schema.itemListElement[2].name).toBe('Futon Frames');
  });

  it('returns SiteNavigationElement with related guides', async () => {
    const result = await getGuideSchema('mattresses');
    const schema = JSON.parse(result.navigationSchema);
    expect(schema['@type']).toBe('SiteNavigationElement');
    expect(schema.hasPart.length).toBeGreaterThan(0);
    for (const part of schema.hasPart) {
      expect(part['@type']).toBe('WebPage');
      expect(part.url).toContain('/buying-guides/');
    }
  });

  it('returns empty strings for unknown slug', async () => {
    const result = await getGuideSchema('nonexistent');
    expect(result.success).toBe(true);
    expect(result.breadcrumbSchema).toBe('');
    expect(result.navigationSchema).toBe('');
  });

  it('requires a slug', async () => {
    const result = await getGuideSchema('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('slug');
  });

  it('generates correct breadcrumb for each category', async () => {
    const cases = [
      { slug: 'covers', shortTitle: 'Covers' },
      { slug: 'outdoor', shortTitle: 'Outdoor' },
      { slug: 'bundle-deals', shortTitle: 'Bundle Deals' },
    ];

    for (const { slug, shortTitle } of cases) {
      const result = await getGuideSchema(slug);
      const schema = JSON.parse(result.breadcrumbSchema);
      expect(schema.itemListElement[2].name).toBe(shortTitle);
      expect(schema.itemListElement[2].item).toContain(slug);
    }
  });
});

// ── getSitemapEntries ─────────────────────────────────────────────────

describe('getSitemapEntries', () => {
  it('returns 9 entries (1 hub + 8 guides)', async () => {
    const result = await getSitemapEntries();
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(9);
  });

  it('hub entry has highest priority', async () => {
    const result = await getSitemapEntries();
    const hub = result.entries[0];
    expect(hub.url).toContain('/buying-guides');
    expect(hub.url).not.toContain('/buying-guides/');
    expect(hub.priority).toBe(0.9);
    expect(hub.changefreq).toBe('weekly');
  });

  it('guide entries have correct priority', async () => {
    const result = await getSitemapEntries();
    const guides = result.entries.slice(1);
    for (const entry of guides) {
      expect(entry.priority).toBe(0.8);
      expect(entry.changefreq).toBe('monthly');
      expect(entry.lastmod).toBeTruthy();
      expect(entry.title).toBeTruthy();
    }
  });

  it('all URLs are absolute', async () => {
    const result = await getSitemapEntries();
    for (const entry of result.entries) {
      expect(entry.url).toMatch(/^https:\/\//);
    }
  });

  it('hub lastmod is the most recent guide date', async () => {
    const result = await getSitemapEntries();
    const hub = result.entries[0];
    expect(hub.lastmod).toBe('2026-02-20');
  });
});
