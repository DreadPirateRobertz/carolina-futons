/**
 * Tests for src/public/topicClusterHelpers.js
 * Pure functions — no mocks needed.
 */
import { describe, it, expect } from 'vitest';
import {
  buildClusterBreadcrumbs,
  buildClusterMetaTitle,
  buildClusterMetaDescription,
  getSpokeTypeLabel,
  buildSpokeCards,
  getSpokesByType,
  groupSpokesByType,
  buildRelatedClusterNav,
} from '../src/public/topicClusterHelpers.js';

// ── buildClusterBreadcrumbs ────────────────────────────────────────────

describe('buildClusterBreadcrumbs', () => {
  it('returns 3 items: Home, Buying Guides, cluster title', () => {
    const crumbs = buildClusterBreadcrumbs('Futon Frame Buying Guide');
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0].label).toBe('Home');
    expect(crumbs[1].label).toBe('Buying Guides');
    expect(crumbs[2].label).toBe('Futon Frame Buying Guide');
  });

  it('Home has a url, last item has url: null and isLast: true', () => {
    const crumbs = buildClusterBreadcrumbs('Futon Frame Buying Guide');
    expect(crumbs[0].url).toBeTruthy();
    expect(crumbs[2].url).toBeNull();
    expect(crumbs[2].isLast).toBe(true);
  });

  it('intermediate items have isLast: false', () => {
    const crumbs = buildClusterBreadcrumbs('Any Title');
    expect(crumbs[0].isLast).toBe(false);
    expect(crumbs[1].isLast).toBe(false);
  });

  it('falls back gracefully when title is null', () => {
    const crumbs = buildClusterBreadcrumbs(null);
    expect(crumbs.length).toBeGreaterThan(0);
    expect(crumbs[0].label).toBe('Home');
  });

  it('falls back gracefully when title is empty string', () => {
    const crumbs = buildClusterBreadcrumbs('');
    expect(crumbs.length).toBeGreaterThan(0);
  });
});

// ── buildClusterMetaTitle ──────────────────────────────────────────────

describe('buildClusterMetaTitle', () => {
  it('appends "| Carolina Futons" to the pillar title', () => {
    expect(buildClusterMetaTitle('The Complete Futon Frame Buying Guide'))
      .toBe('The Complete Futon Frame Buying Guide | Carolina Futons');
  });

  it('returns default title for null input', () => {
    expect(buildClusterMetaTitle(null)).toContain('Carolina Futons');
  });

  it('returns default title for empty string', () => {
    expect(buildClusterMetaTitle('')).toContain('Carolina Futons');
  });
});

// ── buildClusterMetaDescription ───────────────────────────────────────

describe('buildClusterMetaDescription', () => {
  it('uses content.metaDescription when provided', () => {
    const cluster = { topic: 'futon frames' };
    const content = { metaDescription: 'Custom description here.' };
    expect(buildClusterMetaDescription(cluster, content)).toBe('Custom description here.');
  });

  it('falls back to topic-based description when content is null', () => {
    const cluster = { topic: 'futon frames' };
    const desc = buildClusterMetaDescription(cluster, null);
    expect(desc).toContain('futon frames');
  });

  it('falls back to topic-based description when content has no metaDescription', () => {
    const cluster = { topic: 'futon covers' };
    const desc = buildClusterMetaDescription(cluster, {});
    expect(desc).toContain('futon covers');
  });

  it('returns generic fallback when cluster is null', () => {
    const desc = buildClusterMetaDescription(null, null);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });
});

// ── getSpokeTypeLabel ─────────────────────────────────────────────────

describe('getSpokeTypeLabel', () => {
  it('maps comparison → Comparison', () => {
    expect(getSpokeTypeLabel('comparison')).toBe('Comparison');
  });

  it('maps guide → Guide', () => {
    expect(getSpokeTypeLabel('guide')).toBe('Guide');
  });

  it('maps howto → How-To', () => {
    expect(getSpokeTypeLabel('howto')).toBe('How-To');
  });

  it('maps reference → Reference', () => {
    expect(getSpokeTypeLabel('reference')).toBe('Reference');
  });

  it('returns "Article" for unknown types', () => {
    expect(getSpokeTypeLabel('unknown')).toBe('Article');
    expect(getSpokeTypeLabel('')).toBe('Article');
    expect(getSpokeTypeLabel(undefined)).toBe('Article');
  });
});

// ── buildSpokeCards ───────────────────────────────────────────────────

describe('buildSpokeCards', () => {
  const spokes = [
    { slug: 'wood-vs-metal', title: 'Wood vs Metal', type: 'comparison' },
    { slug: 'wall-hugger-guide', title: 'Wall Hugger Guide', type: 'guide' },
  ];

  it('returns one card per spoke page', () => {
    expect(buildSpokeCards(spokes)).toHaveLength(2);
  });

  it('each card has _id, slug, title, type, typeLabel, url', () => {
    const cards = buildSpokeCards(spokes);
    for (const card of cards) {
      expect(card._id).toBeTruthy();
      expect(card.slug).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.type).toBeTruthy();
      expect(card.typeLabel).toBeTruthy();
      expect(card.url).toContain('/buying-guides/');
    }
  });

  it('url uses the spoke slug', () => {
    const cards = buildSpokeCards(spokes);
    expect(cards[0].url).toContain('wood-vs-metal');
    expect(cards[1].url).toContain('wall-hugger-guide');
  });

  it('typeLabel is human-readable', () => {
    const cards = buildSpokeCards(spokes);
    expect(cards[0].typeLabel).toBe('Comparison');
    expect(cards[1].typeLabel).toBe('Guide');
  });

  it('returns empty array for null input', () => {
    expect(buildSpokeCards(null)).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(buildSpokeCards('foo')).toEqual([]);
  });
});

// ── getSpokesByType ───────────────────────────────────────────────────

describe('getSpokesByType', () => {
  const spokes = [
    { slug: 'a', type: 'comparison' },
    { slug: 'b', type: 'guide' },
    { slug: 'c', type: 'comparison' },
  ];

  it('filters to the requested type', () => {
    expect(getSpokesByType(spokes, 'comparison')).toHaveLength(2);
    expect(getSpokesByType(spokes, 'guide')).toHaveLength(1);
  });

  it('returns empty array for an absent type', () => {
    expect(getSpokesByType(spokes, 'howto')).toHaveLength(0);
  });

  it('returns empty array for null input', () => {
    expect(getSpokesByType(null, 'comparison')).toEqual([]);
  });
});

// ── groupSpokesByType ─────────────────────────────────────────────────

describe('groupSpokesByType', () => {
  const spokes = [
    { slug: 'a', type: 'comparison' },
    { slug: 'b', type: 'guide' },
    { slug: 'c', type: 'comparison' },
    { slug: 'd', type: 'howto' },
  ];

  it('groups by type with correct counts', () => {
    const groups = groupSpokesByType(spokes);
    expect(groups.comparison).toHaveLength(2);
    expect(groups.guide).toHaveLength(1);
    expect(groups.howto).toHaveLength(1);
  });

  it('returns empty object for null input', () => {
    expect(groupSpokesByType(null)).toEqual({});
  });

  it('uses "other" for spokes without a type', () => {
    const result = groupSpokesByType([{ slug: 'x' }]);
    expect(result.other).toHaveLength(1);
  });
});

// ── buildRelatedClusterNav ────────────────────────────────────────────

describe('buildRelatedClusterNav', () => {
  const clusters = {
    'futon-frames': { pillarTitle: 'Futon Frame Buying Guide' },
    'mattresses': { pillarTitle: 'Futon Mattress Buying Guide' },
    'covers': { pillarTitle: 'Futon Cover Guide' },
  };

  it('excludes the current cluster', () => {
    const nav = buildRelatedClusterNav('futon-frames', clusters);
    expect(nav.find(n => n.slug === 'futon-frames')).toBeUndefined();
  });

  it('includes other clusters', () => {
    const nav = buildRelatedClusterNav('futon-frames', clusters);
    expect(nav).toHaveLength(2);
    expect(nav.map(n => n.slug)).toContain('mattresses');
    expect(nav.map(n => n.slug)).toContain('covers');
  });

  it('each nav item has slug, title, url', () => {
    const nav = buildRelatedClusterNav('futon-frames', clusters);
    for (const item of nav) {
      expect(item.slug).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.url).toContain('/guides/');
    }
  });

  it('returns empty array for null clusters', () => {
    expect(buildRelatedClusterNav('futon-frames', null)).toEqual([]);
  });

  it('returns all when currentSlug not found in clusters', () => {
    const nav = buildRelatedClusterNav('unknown', clusters);
    expect(nav).toHaveLength(3);
  });
});
