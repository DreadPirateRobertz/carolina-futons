/**
 * @file localSeoCrossLinks.test.js
 * @description Tests for CF-54s6 Local SEO S5 — getRelatedCityLinks webMethod.
 *
 * Tests:
 *  - Returns all other defined city pages as cross-links
 *  - Excludes the current city slug from results
 *  - isNearby flag is set for cities in nearbyAreas
 *  - Nearby cities sort before non-nearby cities
 *  - Non-nearby cities are sorted alphabetically by city name
 *  - Only returns defined slugs (no dead links)
 *  - url uses /near/ prefix
 *  - Invalid / unknown slug handling
 */
import { describe, it, expect, vi } from 'vitest';

// ── mock wix-data (required by localSeoService) ───────────────────────
vi.mock('wix-data', () => ({
  default: {
    get: vi.fn(() => Promise.resolve(null)),
    query: vi.fn(() => ({ limit: vi.fn(() => ({ find: vi.fn(() => Promise.resolve({ items: [] })) })) })),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  validateSlug: vi.fn(s => {
    if (!s || typeof s !== 'string') return null;
    if (/[^a-z0-9-]/.test(s)) return null;
    return s;
  }),
}));

import { getRelatedCityLinks } from '../src/backend/localSeoService.web.js';
import { LOCAL_PAGES, SITE_URL } from '../src/backend/utils/localSeoData.js';

// All defined slugs (the 6 seeded cities)
const ALL_SLUGS = Object.keys(LOCAL_PAGES);

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — basic shape
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — basic shape', () => {
  it('returns success: true for a valid slug', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    expect(result.success).toBe(true);
  });

  it('returns links as an array', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    expect(Array.isArray(result.links)).toBe(true);
  });

  it('each link has slug, city, state, url, isNearby', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    for (const link of result.links) {
      expect(link).toHaveProperty('slug');
      expect(link).toHaveProperty('city');
      expect(link).toHaveProperty('state');
      expect(link).toHaveProperty('url');
      expect(link).toHaveProperty('isNearby');
    }
  });

  it('isNearby is a boolean on every link', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    for (const link of result.links) {
      expect(typeof link.isNearby).toBe('boolean');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — exclusion
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — excludes current city', () => {
  it('does not include the current slug in results', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    const slugs = result.links.map(l => l.slug);
    expect(slugs).not.toContain('asheville-nc');
  });

  it('does not include hendersonville-nc when queried for hendersonville-nc', async () => {
    const result = await getRelatedCityLinks('hendersonville-nc');
    expect(result.links.map(l => l.slug)).not.toContain('hendersonville-nc');
  });

  it('returns count = total cities - 1', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    expect(result.links).toHaveLength(ALL_SLUGS.length - 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — coverage
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — covers all defined cities', () => {
  it('all other defined slugs appear in links', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    const slugs = result.links.map(l => l.slug);
    for (const slug of ALL_SLUGS) {
      if (slug !== 'asheville-nc') {
        expect(slugs).toContain(slug);
      }
    }
  });

  it('only returns defined slugs (no dead links)', async () => {
    const result = await getRelatedCityLinks('hendersonville-nc');
    for (const link of result.links) {
      expect(ALL_SLUGS).toContain(link.slug);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — isNearby flag
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — isNearby flag', () => {
  it('hendersonville-nc is isNearby for asheville-nc', async () => {
    // asheville nearbyAreas includes hendersonville-nc
    const result = await getRelatedCityLinks('asheville-nc');
    const hendersonville = result.links.find(l => l.slug === 'hendersonville-nc');
    expect(hendersonville?.isNearby).toBe(true);
  });

  it('asheville-nc is isNearby for hendersonville-nc', async () => {
    // hendersonville nearbyAreas includes asheville-nc
    const result = await getRelatedCityLinks('hendersonville-nc');
    const asheville = result.links.find(l => l.slug === 'asheville-nc');
    expect(asheville?.isNearby).toBe(true);
  });

  it('non-nearby cities have isNearby: false', async () => {
    // charlotte-nc is not in hendersonville-nc nearbyAreas
    const result = await getRelatedCityLinks('hendersonville-nc');
    const charlotte = result.links.find(l => l.slug === 'charlotte-nc');
    expect(charlotte?.isNearby).toBe(false);
  });

  it('cities NOT in nearbyAreas are isNearby: false', async () => {
    // greenville-sc is not in hendersonville-nc nearbyAreas
    const result = await getRelatedCityLinks('hendersonville-nc');
    const greenville = result.links.find(l => l.slug === 'greenville-sc');
    expect(greenville?.isNearby).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — sort order
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — sort order', () => {
  it('nearby cities appear before non-nearby cities', async () => {
    const result = await getRelatedCityLinks('hendersonville-nc');
    const firstNonNearbyIndex = result.links.findIndex(l => !l.isNearby);
    const lastNearbyIndex = result.links.map(l => l.isNearby).lastIndexOf(true);
    if (firstNonNearbyIndex !== -1 && lastNearbyIndex !== -1) {
      expect(lastNearbyIndex).toBeLessThan(firstNonNearbyIndex);
    }
  });

  it('non-nearby cities are sorted alphabetically within their group', async () => {
    const result = await getRelatedCityLinks('hendersonville-nc');
    const nonNearby = result.links.filter(l => !l.isNearby).map(l => l.city);
    const sorted = [...nonNearby].sort((a, b) => a.localeCompare(b));
    expect(nonNearby).toEqual(sorted);
  });

  it('nearby cities are sorted alphabetically within their group', async () => {
    const result = await getRelatedCityLinks('hendersonville-nc');
    const nearby = result.links.filter(l => l.isNearby).map(l => l.city);
    const sorted = [...nearby].sort((a, b) => a.localeCompare(b));
    expect(nearby).toEqual(sorted);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — url format
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — url format', () => {
  it('each url uses /near/ prefix', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    for (const link of result.links) {
      expect(link.url).toContain('/near/');
    }
  });

  it('url contains the link slug', async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    for (const link of result.links) {
      expect(link.url).toContain(link.slug);
    }
  });

  it(`url starts with ${SITE_URL}`, async () => {
    const result = await getRelatedCityLinks('asheville-nc');
    for (const link of result.links) {
      expect(link.url.startsWith(SITE_URL)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// getRelatedCityLinks — unknown / invalid slug
// ═══════════════════════════════════════════════════════════════════

describe('getRelatedCityLinks — unknown slug', () => {
  it('returns success: true and all cities for unknown-but-valid slug', async () => {
    const result = await getRelatedCityLinks('unknown-city-nc');
    expect(result.success).toBe(true);
    expect(result.links).toHaveLength(ALL_SLUGS.length);
  });

  it('no links have isNearby: true for unknown slug', async () => {
    const result = await getRelatedCityLinks('unknown-city-nc');
    for (const link of result.links) {
      expect(link.isNearby).toBe(false);
    }
  });
});

describe('getRelatedCityLinks — invalid slug', () => {
  it('returns success: false for empty string', async () => {
    const result = await getRelatedCityLinks('');
    expect(result.success).toBe(false);
    expect(result.links).toEqual([]);
  });

  it('returns success: false for null', async () => {
    const result = await getRelatedCityLinks(null);
    expect(result.success).toBe(false);
  });

  it('returns success: false for path-traversal', async () => {
    const result = await getRelatedCityLinks('../etc/passwd');
    expect(result.success).toBe(false);
  });
});
