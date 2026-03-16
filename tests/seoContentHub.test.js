import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetData } from './__mocks__/wix-data.js';
import {
  getContentHub,
  getPillarGuide,
  getPillarGuideSlugs,
  getHubSchema,
  getGuideSchema,
  getSitemapEntries,
} from '../src/backend/seoContentHub.web.js';

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

  it('guide slugs are unique', async () => {
    const result = await getContentHub();
    const slugs = result.hub.guides.map(g => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('guide titles are unique', async () => {
    const result = await getContentHub();
    const titles = result.hub.guides.map(g => g.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('all guide URLs use carolinafutons.com domain', async () => {
    const result = await getContentHub();
    for (const guide of result.hub.guides) {
      expect(guide.url).toMatch(/^https:\/\/www\.carolinafutons\.com\//);
    }
  });

  it('hub URL does not include a trailing guide slug', async () => {
    const result = await getContentHub();
    expect(result.hub.url).toBe('https://www.carolinafutons.com/buying-guides');
  });

  it('guideCount matches guides array length', async () => {
    const result = await getContentHub();
    expect(result.hub.guideCount).toBe(result.hub.guides.length);
  });

  it('guide descriptions are 50-200 chars (SEO snippet range)', async () => {
    const result = await getContentHub();
    for (const guide of result.hub.guides) {
      expect(guide.description.length).toBeGreaterThanOrEqual(50);
      expect(guide.description.length).toBeLessThanOrEqual(200);
    }
  });

  it('guide hero images are absolute URLs', async () => {
    const result = await getContentHub();
    for (const guide of result.hub.guides) {
      expect(guide.heroImage).toMatch(/^https:\/\//);
    }
  });

  it('hub metaDescription is 100-200 chars', async () => {
    const result = await getContentHub();
    expect(result.hub.metaDescription.length).toBeGreaterThanOrEqual(100);
    expect(result.hub.metaDescription.length).toBeLessThanOrEqual(200);
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

  it('returns null for null slug', async () => {
    const result = await getPillarGuide(null);
    expect(result.success).toBe(false);
  });

  it('guide URL matches slug', async () => {
    const result = await getPillarGuide('covers');
    expect(result.guide.url).toContain('/buying-guides/covers');
  });

  it('related guides do not include the guide itself', async () => {
    const result = await getPillarGuide('futon-frames');
    const relatedSlugs = result.relatedGuides.map(g => g.slug);
    expect(relatedSlugs).not.toContain('futon-frames');
  });

  it('guide has all expected fields', async () => {
    const result = await getPillarGuide('mattresses');
    const fields = ['slug', 'title', 'shortTitle', 'description', 'heroImage', 'category', 'url', 'publishDate', 'updatedDate'];
    for (const field of fields) {
      expect(result.guide).toHaveProperty(field);
      expect(result.guide[field]).toBeTruthy();
    }
  });

  it('each guide has 2-4 related guides', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getPillarGuide(slug);
      expect(result.relatedGuides.length).toBeGreaterThanOrEqual(2);
      expect(result.relatedGuides.length).toBeLessThanOrEqual(4);
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

  it('slugs are unique', async () => {
    const result = await getPillarGuideSlugs();
    expect(new Set(result.slugs).size).toBe(result.slugs.length);
  });

  it('slugs match getContentHub guide slugs', async () => {
    const slugResult = await getPillarGuideSlugs();
    const hubResult = await getContentHub();
    const hubSlugs = hubResult.hub.guides.map(g => g.slug);
    expect(slugResult.slugs.sort()).toEqual(hubSlugs.sort());
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

  it('ItemList positions are sequential 1-8', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.itemListSchema);
    for (let i = 0; i < schema.itemListElement.length; i++) {
      expect(schema.itemListElement[i].position).toBe(i + 1);
    }
  });

  it('CollectionPage mainEntity ItemList positions match', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.collectionSchema);
    const items = schema.mainEntity.itemListElement;
    for (let i = 0; i < items.length; i++) {
      expect(items[i].position).toBe(i + 1);
    }
  });

  it('all schemas are valid JSON', async () => {
    const result = await getHubSchema();
    expect(() => JSON.parse(result.collectionSchema)).not.toThrow();
    expect(() => JSON.parse(result.itemListSchema)).not.toThrow();
    expect(() => JSON.parse(result.breadcrumbSchema)).not.toThrow();
  });

  it('all schemas have @context schema.org', async () => {
    const result = await getHubSchema();
    for (const key of ['collectionSchema', 'itemListSchema', 'breadcrumbSchema']) {
      const schema = JSON.parse(result[key]);
      expect(schema['@context']).toBe('https://schema.org');
    }
  });

  it('publisher logo is an ImageObject', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.collectionSchema);
    expect(schema.publisher.logo['@type']).toBe('ImageObject');
    expect(schema.publisher.logo.url).toContain('logo.png');
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

  it('returns null for null slug', async () => {
    const result = await getGuideSchema(null);
    expect(result.success).toBe(false);
  });

  it('all 8 guides produce valid schemas', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getGuideSchema(slug);
      expect(result.success).toBe(true);
      expect(() => JSON.parse(result.breadcrumbSchema)).not.toThrow();
      expect(() => JSON.parse(result.navigationSchema)).not.toThrow();
    }
  });

  it('breadcrumb positions are sequential 1-3', async () => {
    const result = await getGuideSchema('pillows');
    const schema = JSON.parse(result.breadcrumbSchema);
    for (let i = 0; i < schema.itemListElement.length; i++) {
      expect(schema.itemListElement[i].position).toBe(i + 1);
    }
  });

  it('navigation hasPart items are WebPage type', async () => {
    const result = await getGuideSchema('storage');
    const schema = JSON.parse(result.navigationSchema);
    for (const part of schema.hasPart) {
      expect(part['@type']).toBe('WebPage');
      expect(part.name).toBeTruthy();
      expect(part.url).toMatch(/^https:\/\//);
    }
  });

  it('breadcrumb Home item links to site root', async () => {
    const result = await getGuideSchema('accessories');
    const schema = JSON.parse(result.breadcrumbSchema);
    expect(schema.itemListElement[0].item).toBe('https://www.carolinafutons.com');
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

  it('every entry has all required sitemap fields', async () => {
    const result = await getSitemapEntries();
    for (const entry of result.entries) {
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('lastmod');
      expect(entry).toHaveProperty('changefreq');
      expect(entry).toHaveProperty('priority');
      expect(entry).toHaveProperty('title');
    }
  });

  it('entry URLs are unique', async () => {
    const result = await getSitemapEntries();
    const urls = result.entries.map(e => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('entry lastmod dates are valid YYYY-MM-DD format', async () => {
    const result = await getSitemapEntries();
    for (const entry of result.entries) {
      expect(entry.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('guide entries contain guide slug in URL', async () => {
    const result = await getSitemapEntries();
    const guideEntries = result.entries.slice(1);
    const slugResult = await getPillarGuideSlugs();
    for (let i = 0; i < guideEntries.length; i++) {
      expect(guideEntries[i].url).toContain(slugResult.slugs[i]);
    }
  });

  it('priority values are between 0 and 1', async () => {
    const result = await getSitemapEntries();
    for (const entry of result.entries) {
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });
});
