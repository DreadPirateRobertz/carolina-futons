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
  validateSlug: (s) => s && typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100) : null,
}));

const mod = await import('../src/backend/seoContentHub.web.js');
const {
  getContentHub,
  getPillarGuide,
  getPillarGuideSlugs,
  getHubSchema,
  getGuideSchema,
  getSitemapEntries,
} = mod;

const SITE_URL = 'https://www.carolinafutons.com';
const HUB_PATH = '/buying-guides';
const ALL_SLUGS = [
  'futon-frames', 'mattresses', 'covers', 'pillows',
  'storage', 'outdoor', 'accessories', 'bundle-deals',
];

// ═════════════════════════════════════════════════════════════════════
// getContentHub
// ═════════════════════════════════════════════════════════════════════
describe('getContentHub', () => {
  it('returns success: true', async () => {
    const result = await getContentHub();
    expect(result.success).toBe(true);
  });

  it('returns hub object with title and metaDescription', async () => {
    const { hub } = await getContentHub();
    expect(hub.title).toContain('Buying Guides');
    expect(hub.metaDescription).toBeTruthy();
  });

  it('returns hub URL pointing to /buying-guides', async () => {
    const { hub } = await getContentHub();
    expect(hub.url).toBe(`${SITE_URL}${HUB_PATH}`);
  });

  it('returns exactly 8 guides', async () => {
    const { hub } = await getContentHub();
    expect(hub.guides).toHaveLength(8);
    expect(hub.guideCount).toBe(8);
  });

  it('each guide has required fields', async () => {
    const { hub } = await getContentHub();
    for (const g of hub.guides) {
      expect(g).toHaveProperty('slug');
      expect(g).toHaveProperty('title');
      expect(g).toHaveProperty('shortTitle');
      expect(g).toHaveProperty('description');
      expect(g).toHaveProperty('heroImage');
      expect(g).toHaveProperty('category');
      expect(g).toHaveProperty('url');
      expect(g).toHaveProperty('publishDate');
      expect(g).toHaveProperty('updatedDate');
    }
  });

  it('guide URLs follow expected pattern', async () => {
    const { hub } = await getContentHub();
    for (const g of hub.guides) {
      expect(g.url).toBe(`${SITE_URL}${HUB_PATH}/${g.slug}`);
    }
  });

  it('does not include relatedSlugs or priority in guide objects', async () => {
    const { hub } = await getContentHub();
    for (const g of hub.guides) {
      expect(g).not.toHaveProperty('relatedSlugs');
      expect(g).not.toHaveProperty('priority');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// getPillarGuide
// ═════════════════════════════════════════════════════════════════════
describe('getPillarGuide', () => {
  it('returns a valid guide for known slug', async () => {
    const result = await getPillarGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guide).not.toBeNull();
    expect(result.guide.slug).toBe('futon-frames');
  });

  it('returns related guides for cross-linking', async () => {
    const result = await getPillarGuide('futon-frames');
    expect(result.relatedGuides.length).toBeGreaterThan(0);
    // futon-frames relates to mattresses, covers, accessories
    const relSlugs = result.relatedGuides.map(g => g.slug);
    expect(relSlugs).toContain('mattresses');
    expect(relSlugs).toContain('covers');
    expect(relSlugs).toContain('accessories');
  });

  it('related guides have url, title, shortTitle, description, heroImage', async () => {
    const result = await getPillarGuide('mattresses');
    for (const rg of result.relatedGuides) {
      expect(rg).toHaveProperty('slug');
      expect(rg).toHaveProperty('title');
      expect(rg).toHaveProperty('shortTitle');
      expect(rg).toHaveProperty('description');
      expect(rg).toHaveProperty('heroImage');
      expect(rg).toHaveProperty('url');
    }
  });

  it('related guides do not include category or dates', async () => {
    const result = await getPillarGuide('covers');
    for (const rg of result.relatedGuides) {
      expect(rg).not.toHaveProperty('category');
      expect(rg).not.toHaveProperty('publishDate');
      expect(rg).not.toHaveProperty('updatedDate');
    }
  });

  it('returns null guide for unknown slug', async () => {
    const result = await getPillarGuide('nonexistent-guide');
    expect(result.success).toBe(true);
    expect(result.guide).toBeNull();
    expect(result.relatedGuides).toEqual([]);
  });

  it('returns error for empty slug', async () => {
    const result = await getPillarGuide('');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.guide).toBeNull();
  });

  it('returns error for null slug', async () => {
    const result = await getPillarGuide(null);
    expect(result.success).toBe(false);
    expect(result.guide).toBeNull();
  });

  it('guide object has correct URL', async () => {
    const result = await getPillarGuide('storage');
    expect(result.guide.url).toBe(`${SITE_URL}${HUB_PATH}/storage`);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getPillarGuideSlugs
// ═════════════════════════════════════════════════════════════════════
describe('getPillarGuideSlugs', () => {
  it('returns success: true', async () => {
    const result = await getPillarGuideSlugs();
    expect(result.success).toBe(true);
  });

  it('returns all 8 slugs', async () => {
    const result = await getPillarGuideSlugs();
    expect(result.slugs).toHaveLength(8);
  });

  it('includes all expected slugs', async () => {
    const result = await getPillarGuideSlugs();
    for (const slug of ALL_SLUGS) {
      expect(result.slugs).toContain(slug);
    }
  });

  it('slugs are strings', async () => {
    const result = await getPillarGuideSlugs();
    for (const slug of result.slugs) {
      expect(typeof slug).toBe('string');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// getHubSchema
// ═════════════════════════════════════════════════════════════════════
describe('getHubSchema', () => {
  it('returns success: true', async () => {
    const result = await getHubSchema();
    expect(result.success).toBe(true);
  });

  it('collectionSchema is valid JSON with @type CollectionPage', async () => {
    const result = await getHubSchema();
    const schema = JSON.parse(result.collectionSchema);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('CollectionPage');
  });

  it('collectionSchema contains publisher info', async () => {
    const schema = JSON.parse((await getHubSchema()).collectionSchema);
    expect(schema.publisher['@type']).toBe('Organization');
    expect(schema.publisher.name).toBe('Carolina Futons');
    expect(schema.publisher.logo.url).toContain('logo.png');
  });

  it('collectionSchema mainEntity is ItemList with 8 items', async () => {
    const schema = JSON.parse((await getHubSchema()).collectionSchema);
    expect(schema.mainEntity['@type']).toBe('ItemList');
    expect(schema.mainEntity.numberOfItems).toBe(8);
    expect(schema.mainEntity.itemListElement).toHaveLength(8);
  });

  it('itemListSchema is valid JSON with @type ItemList', async () => {
    const schema = JSON.parse((await getHubSchema()).itemListSchema);
    expect(schema['@type']).toBe('ItemList');
    expect(schema.numberOfItems).toBe(8);
  });

  it('itemListSchema items have position, url, name, image, description', async () => {
    const schema = JSON.parse((await getHubSchema()).itemListSchema);
    for (const item of schema.itemListElement) {
      expect(item['@type']).toBe('ListItem');
      expect(item.position).toBeGreaterThan(0);
      expect(item.url).toContain(SITE_URL);
      expect(item.name).toBeTruthy();
      expect(item.image).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
  });

  it('itemListSchema positions are sequential 1-8', async () => {
    const schema = JSON.parse((await getHubSchema()).itemListSchema);
    const positions = schema.itemListElement.map(i => i.position);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('breadcrumbSchema has Home and Buying Guides', async () => {
    const schema = JSON.parse((await getHubSchema()).breadcrumbSchema);
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].name).toBe('Home');
    expect(schema.itemListElement[1].name).toBe('Buying Guides');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getGuideSchema
// ═════════════════════════════════════════════════════════════════════
describe('getGuideSchema', () => {
  it('returns success: true for valid slug', async () => {
    const result = await getGuideSchema('futon-frames');
    expect(result.success).toBe(true);
  });

  it('breadcrumbSchema has 3-level trail: Home > Buying Guides > Guide', async () => {
    const result = await getGuideSchema('covers');
    const schema = JSON.parse(result.breadcrumbSchema);
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[0].name).toBe('Home');
    expect(schema.itemListElement[1].name).toBe('Buying Guides');
    expect(schema.itemListElement[2].name).toBe('Covers');
  });

  it('breadcrumb uses shortTitle not full title', async () => {
    const result = await getGuideSchema('futon-frames');
    const schema = JSON.parse(result.breadcrumbSchema);
    expect(schema.itemListElement[2].name).toBe('Futon Frames');
  });

  it('navigationSchema is SiteNavigationElement with related guides', async () => {
    const result = await getGuideSchema('futon-frames');
    const schema = JSON.parse(result.navigationSchema);
    expect(schema['@type']).toBe('SiteNavigationElement');
    expect(schema.name).toBe('Related Buying Guides');
    expect(schema.hasPart.length).toBeGreaterThan(0);
  });

  it('navigationSchema hasPart entries are WebPage with name and url', async () => {
    const result = await getGuideSchema('mattresses');
    const schema = JSON.parse(result.navigationSchema);
    for (const part of schema.hasPart) {
      expect(part['@type']).toBe('WebPage');
      expect(part.name).toBeTruthy();
      expect(part.url).toContain(SITE_URL);
    }
  });

  it('returns empty strings for unknown slug', async () => {
    const result = await getGuideSchema('nonexistent');
    expect(result.success).toBe(true);
    expect(result.breadcrumbSchema).toBe('');
    expect(result.navigationSchema).toBe('');
  });

  it('returns error for empty slug', async () => {
    const result = await getGuideSchema('');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for null slug', async () => {
    const result = await getGuideSchema(null);
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getSitemapEntries
// ═════════════════════════════════════════════════════════════════════
describe('getSitemapEntries', () => {
  it('returns success: true', async () => {
    const result = await getSitemapEntries();
    expect(result.success).toBe(true);
  });

  it('returns 9 entries (1 hub + 8 guides)', async () => {
    const result = await getSitemapEntries();
    expect(result.entries).toHaveLength(9);
  });

  it('first entry is the hub page', async () => {
    const { entries } = await getSitemapEntries();
    expect(entries[0].url).toBe(`${SITE_URL}${HUB_PATH}`);
    expect(entries[0].title).toBe('Futon Buying Guides');
  });

  it('hub entry has higher priority than guide entries', async () => {
    const { entries } = await getSitemapEntries();
    expect(entries[0].priority).toBe(0.9);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].priority).toBe(0.8);
    }
  });

  it('hub changefreq is weekly, guides are monthly', async () => {
    const { entries } = await getSitemapEntries();
    expect(entries[0].changefreq).toBe('weekly');
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].changefreq).toBe('monthly');
    }
  });

  it('all entries have url, lastmod, changefreq, priority, title', async () => {
    const { entries } = await getSitemapEntries();
    for (const entry of entries) {
      expect(entry.url).toBeTruthy();
      expect(entry.lastmod).toBeTruthy();
      expect(entry.changefreq).toBeTruthy();
      expect(typeof entry.priority).toBe('number');
      expect(entry.title).toBeTruthy();
    }
  });

  it('guide entries have correct URLs', async () => {
    const { entries } = await getSitemapEntries();
    const guideEntries = entries.slice(1);
    for (const entry of guideEntries) {
      expect(entry.url).toMatch(new RegExp(`^${SITE_URL}${HUB_PATH}/[a-z-]+$`));
    }
  });

  it('hub lastmod is the latest updatedDate among guides', async () => {
    const { entries } = await getSitemapEntries();
    const hubLastmod = entries[0].lastmod;
    const guideLastmods = entries.slice(1).map(e => e.lastmod);
    for (const lm of guideLastmods) {
      expect(hubLastmod >= lm).toBe(true);
    }
  });
});
