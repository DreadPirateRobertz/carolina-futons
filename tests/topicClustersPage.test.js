/**
 * Tests for getTopicClusterPage() in backend/topicClusters.web.js
 *
 * Tests the combined page data webMethod: cluster metadata, pillar content,
 * internal links, and SEO fields for /guides/{slug} cluster overview pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Wix modules ────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: vi.fn((_, fn) => fn),
}));
vi.mock('wix-data', () => ({
  default: { query: vi.fn(() => ({ find: vi.fn(() => Promise.resolve({ items: [] })) })) },
}));

import { getTopicClusterPage } from '../src/backend/topicClusters.web.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Happy path ──────────────────────────────────────────────────────────

describe('getTopicClusterPage — known slugs', () => {
  it('returns success: true for a valid cluster slug', async () => {
    const result = await getTopicClusterPage('futon-frames');
    expect(result.success).toBe(true);
  });

  it('returns a page object for a valid slug', async () => {
    const result = await getTopicClusterPage('futon-frames');
    expect(result.page).not.toBeNull();
  });

  it('page has all required SEO fields', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(typeof page.title).toBe('string');
    expect(page.metaTitle).toContain('Carolina Futons');
    expect(typeof page.metaDescription).toBe('string');
    expect(page.canonicalUrl).toContain('/guides/futon-frames');
  });

  it('page.cluster has pillarSlug, topic, keywords, spokePages, spokeCount', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(page.cluster.pillarSlug).toBe('futon-frames');
    expect(page.cluster.topic).toBe('futon frames');
    expect(Array.isArray(page.cluster.keywords)).toBe(true);
    expect(Array.isArray(page.cluster.spokePages)).toBe(true);
    expect(page.cluster.spokeCount).toBe(page.cluster.spokePages.length);
  });

  it('each spoke page in cluster has slug, title, type, url', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    for (const sp of page.cluster.spokePages) {
      expect(sp.slug).toBeTruthy();
      expect(sp.title).toBeTruthy();
      expect(sp.type).toBeTruthy();
      expect(sp.url).toContain('/buying-guides/');
    }
  });

  it('page.pillarContent has intro, sections, faqs', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(page.pillarContent).not.toBeNull();
    expect(typeof page.pillarContent.intro).toBe('string');
    expect(Array.isArray(page.pillarContent.sections)).toBe(true);
    expect(Array.isArray(page.pillarContent.faqs)).toBe(true);
  });

  it('page.internalLinks is a non-empty array', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(Array.isArray(page.internalLinks)).toBe(true);
    expect(page.internalLinks.length).toBeGreaterThan(0);
  });

  it('pillar-to-spoke links point to /buying-guides/', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    const spokeLinks = page.internalLinks.filter(l => l.relationship === 'pillar-to-spoke');
    expect(spokeLinks.length).toBeGreaterThan(0);
    for (const link of spokeLinks) {
      expect(link.targetUrl).toContain('/buying-guides/');
      expect(link.context).toBe('inline');
    }
  });

  it('cross-cluster links point to /guides/', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    const crossLinks = page.internalLinks.filter(l => l.relationship === 'cross-cluster');
    expect(crossLinks.length).toBeGreaterThan(0);
    for (const link of crossLinks) {
      expect(link.targetUrl).toContain('/guides/');
      expect(link.context).toBe('sidebar');
    }
  });

  it('cross-cluster links do not include the current slug', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    const crossLinks = page.internalLinks.filter(l => l.relationship === 'cross-cluster');
    expect(crossLinks.every(l => !l.targetUrl.includes('/guides/futon-frames'))).toBe(true);
  });

  it('works for all 8 defined cluster slugs', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getTopicClusterPage(slug);
      expect(result.success).toBe(true);
      expect(result.page.slug).toBe(slug);
      expect(result.page.pillarContent).not.toBeNull();
    }
  });

  it('page.relatedClusters is an array of the other 7 clusters', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(Array.isArray(page.relatedClusters)).toBe(true);
    expect(page.relatedClusters).toHaveLength(7);
    expect(page.relatedClusters.every(c => c.slug !== 'futon-frames')).toBe(true);
  });

  it('each relatedCluster has slug, title, url pointing to /guides/', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    for (const c of page.relatedClusters) {
      expect(c.slug).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.url).toContain('/guides/');
    }
  });

  it('canonicalUrl uses /guides/ not /buying-guides/', async () => {
    const { page } = await getTopicClusterPage('mattresses');
    expect(page.canonicalUrl).toContain('/guides/mattresses');
    expect(page.canonicalUrl).not.toContain('/buying-guides/');
  });
});

// ── Unknown slug ────────────────────────────────────────────────────────

describe('getTopicClusterPage — unknown slug', () => {
  it('returns success: true, page: null for an unknown slug', async () => {
    const result = await getTopicClusterPage('not-a-cluster');
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });
});

// ── Missing / invalid slug ──────────────────────────────────────────────

describe('getTopicClusterPage — missing slug', () => {
  it('returns success: false for empty string', async () => {
    const result = await getTopicClusterPage('');
    expect(result.success).toBe(false);
    expect(result.page).toBeNull();
  });

  it('returns success: false for null', async () => {
    const result = await getTopicClusterPage(null);
    expect(result.success).toBe(false);
  });

  it('returns success: false for path-traversal input', async () => {
    const result = await getTopicClusterPage('../etc/passwd');
    expect(result.success).toBe(false);
    expect(result.page).toBeNull();
  });
});

// ── pillarContent detail ────────────────────────────────────────────────

describe('getTopicClusterPage — pillarContent detail', () => {
  it('futon-frames content sections is non-empty', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(page.pillarContent.sections.length).toBeGreaterThan(0);
    for (const section of page.pillarContent.sections) {
      expect(typeof section.heading).toBe('string');
      expect(typeof section.body).toBe('string');
    }
  });

  it('futon-frames content has at least one FAQ', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(page.pillarContent.faqs.length).toBeGreaterThan(0);
    for (const faq of page.pillarContent.faqs) {
      expect(typeof faq.question).toBe('string');
      expect(typeof faq.answer).toBe('string');
    }
  });

  it('metaDescription matches content.metaDescription', async () => {
    const { page } = await getTopicClusterPage('futon-frames');
    expect(page.metaDescription).toBe(page.pillarContent.metaDescription);
  });
});
