/**
 * Edge case tests for topicClusters.web.js:
 *   1. Empty cluster — a cluster whose spokePages array has 0 articles.
 *   2. Overflow cluster — a cluster with 11 spoke articles (> the 6-link cap
 *      in getTopicClusterPage and the 5-link default in generateInternalLinks).
 *
 * Both scenarios require mocking backend/utils/topicClusterData to inject
 * synthetic cluster fixtures, since the static production CLUSTERS always have
 * 2–4 spoke pages and never hit these boundaries.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: vi.fn((_, fn) => fn),
}));

vi.mock('wix-data', () => ({
  default: { query: vi.fn(() => ({ find: vi.fn(() => Promise.resolve({ items: [] })) })) },
}));

// Inject synthetic cluster fixtures.
// NOTE: The factory must be self-contained — no references to module-level
// variables — because vi.mock() is hoisted before module code runs.
vi.mock('backend/utils/topicClusterData', () => {
  const SITE_URL = 'https://www.carolinafutons.com';
  const GUIDES_URL = `${SITE_URL}/guides`;

  // 11 spoke pages — enough to exercise both the 6-link pillar-page cap and
  // the 5-link default in generateInternalLinks.
  const elevenSpokes = Array.from({ length: 11 }, (_, i) => ({
    slug: `big-spoke-${i + 1}`,
    title: `Big Spoke Article ${i + 1}`,
    type: 'guide',
  }));

  return {
    SITE_URL,
    GUIDES_URL,
    CLUSTERS: {
      // A pillar cluster with no spoke articles — "empty CMS collection"
      'empty-cluster': {
        pillarSlug: 'empty-cluster',
        pillarTitle: 'Empty Cluster Guide',
        topic: 'empty topic',
        keywords: ['keyword-a'],
        spokePages: [],
      },
      // A pillar cluster with 11 spoke articles — exercises pagination boundary
      'big-cluster': {
        pillarSlug: 'big-cluster',
        pillarTitle: 'Big Cluster Guide',
        topic: 'big topic',
        keywords: ['keyword-b'],
        spokePages: elevenSpokes,
      },
      // A third cluster to supply cross-cluster sidebar targets
      'side-cluster': {
        pillarSlug: 'side-cluster',
        pillarTitle: 'Side Cluster Guide',
        topic: 'side topic',
        keywords: ['keyword-c'],
        spokePages: [{ slug: 'side-spoke-1', title: 'Side Spoke', type: 'guide' }],
      },
    },
    PILLAR_CONTENT: {
      'empty-cluster': {
        metaDescription: 'Empty cluster meta description.',
        intro: 'No articles yet.',
        sections: [],
        faqs: [],
      },
      'big-cluster': {
        metaDescription: 'Big cluster meta description.',
        intro: 'Eleven spoke articles.',
        sections: [],
        faqs: [],
      },
    },
  };
});

import {
  getTopicClusterPage,
} from '../src/backend/topicClusters.web.js';

// ── Empty cluster page — 0 spoke articles ─────────────────────────────

describe('getTopicClusterPage — empty cluster (0 spoke articles)', () => {
  it('returns success: true for a cluster with no spoke pages', async () => {
    const result = await getTopicClusterPage('empty-cluster');
    expect(result.success).toBe(true);
    expect(result.page).not.toBeNull();
  });

  it('cluster.spokePages is an empty array', async () => {
    const { page } = await getTopicClusterPage('empty-cluster');
    expect(Array.isArray(page.cluster.spokePages)).toBe(true);
    expect(page.cluster.spokePages).toHaveLength(0);
  });

  it('cluster.spokeCount is 0', async () => {
    const { page } = await getTopicClusterPage('empty-cluster');
    expect(page.cluster.spokeCount).toBe(0);
  });

  it('internalLinks contains no pillar-to-spoke links', async () => {
    const { page } = await getTopicClusterPage('empty-cluster');
    const pillarToSpoke = page.internalLinks.filter(l => l.relationship === 'pillar-to-spoke');
    expect(pillarToSpoke).toHaveLength(0);
  });

  it('internalLinks still has cross-cluster sidebar links from other clusters', async () => {
    const { page } = await getTopicClusterPage('empty-cluster');
    const crossCluster = page.internalLinks.filter(l => l.relationship === 'cross-cluster');
    // Two other clusters exist (big-cluster, side-cluster) → up to 3 sidebar links
    expect(crossCluster.length).toBeGreaterThan(0);
  });

  it('cross-cluster links point to GUIDES_URL paths', async () => {
    const { page } = await getTopicClusterPage('empty-cluster');
    const crossCluster = page.internalLinks.filter(l => l.relationship === 'cross-cluster');
    for (const link of crossCluster) {
      expect(link.targetUrl).toContain('/guides/');
      expect(link.context).toBe('sidebar');
    }
  });
});


// ── Big cluster page — 11 spoke articles (> 6-link cap) ───────────────

describe('getTopicClusterPage — overflow cluster (11 spoke articles)', () => {
  it('returns success: true for a cluster with 11 spoke pages', async () => {
    const result = await getTopicClusterPage('big-cluster');
    expect(result.success).toBe(true);
    expect(result.page).not.toBeNull();
  });

  it('cluster.spokePages contains all 11 spokes', async () => {
    const { page } = await getTopicClusterPage('big-cluster');
    expect(page.cluster.spokePages).toHaveLength(11);
    expect(page.cluster.spokeCount).toBe(11);
  });

  it('pillar-to-spoke internal links are capped at 6', async () => {
    const { page } = await getTopicClusterPage('big-cluster');
    const pillarToSpoke = page.internalLinks.filter(l => l.relationship === 'pillar-to-spoke');
    // getTopicClusterPage uses spokePages.slice(0, 6) for inline links
    expect(pillarToSpoke.length).toBe(6);
  });

  it('capped pillar-to-spoke links reference the first 6 spokes in order', async () => {
    const { page } = await getTopicClusterPage('big-cluster');
    const pillarToSpoke = page.internalLinks.filter(l => l.relationship === 'pillar-to-spoke');
    expect(pillarToSpoke[0].targetSlug).toBe('big-spoke-1');
    expect(pillarToSpoke[5].targetSlug).toBe('big-spoke-6');
  });
});

