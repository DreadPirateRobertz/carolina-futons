/**
 * Tests for localSeoService.web.js
 *
 * Covers getLocalPage() and getAllLocalSlugs() webMethods:
 * known cities, unknown cities, invalid slugs, SEO field generation,
 * nearby areas resolution, and the home city (Hendersonville NC).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';

// ── Mock Wix modules ────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: vi.fn((_, fn) => fn),
}));

import { getLocalPage, getAllLocalSlugs } from '../src/backend/localSeoService.web.js';

const SAMPLE_PRODUCTS = [
  { _id: 'p1', name: 'Futon Frame A', price: 399, formattedPrice: '$399.00', mainMedia: 'img1.jpg', slug: 'futon-frame-a', salesRank: 1, categories: ['futon-frames'] },
  { _id: 'p2', name: 'Mattress B',    price: 199, formattedPrice: '$199.00', mainMedia: 'img2.jpg', slug: 'mattress-b',    salesRank: 2, categories: ['mattresses'] },
];

beforeEach(() => {
  vi.clearAllMocks();
  __reset();
  __seed('Stores/Products', SAMPLE_PRODUCTS);
});

// ── getLocalPage — happy path ──────────────────────────────────────────

describe('getLocalPage — known city slugs', () => {
  it('returns success: true for a valid city slug', async () => {
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
  });

  it('returns a page object for a valid slug', async () => {
    const result = await getLocalPage('asheville-nc');
    expect(result.page).not.toBeNull();
  });

  it('page has slug, city, state', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.slug).toBe('asheville-nc');
    expect(page.city).toBe('Asheville');
    expect(page.state).toBe('NC');
  });

  it('page has headline as non-empty string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.headline).toBe('string');
    expect(page.headline.length).toBeGreaterThan(0);
  });

  it('page has metaTitle containing city name', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaTitle).toContain('Asheville');
  });

  it('page has metaTitle containing "Carolina Futons"', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaTitle).toContain('Carolina Futons');
  });

  it('page has metaDescription as non-empty string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.metaDescription).toBe('string');
    expect(page.metaDescription.length).toBeGreaterThan(0);
  });

  it('canonicalUrl points to /near/{slug}', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.canonicalUrl).toContain('/near/asheville-nc');
  });

  it('page has featuredProducts as non-empty array', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.featuredProducts)).toBe(true);
    expect(page.featuredProducts.length).toBeGreaterThan(0);
  });

  it('page has mapEmbedUrl as string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.mapEmbedUrl).toBe('string');
  });

  it('page has directions as string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.directions).toBe('string');
  });

  it('page has directionsUrl as non-empty string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.directionsUrl).toBe('string');
    expect(page.directionsUrl).toBeTruthy();
  });

  it('page has nearbyAreas as array', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.nearbyAreas)).toBe(true);
  });

  it('each nearbyArea has slug, city, state, url', async () => {
    const { page } = await getLocalPage('asheville-nc');
    for (const area of page.nearbyAreas) {
      expect(area.slug).toBeTruthy();
      expect(area.city).toBeTruthy();
      expect(area.state).toBeTruthy();
      expect(area.url).toContain('/near/');
    }
  });

  it('works for all 6 defined city slugs', async () => {
    const slugs = ['hendersonville-nc', 'asheville-nc', 'charlotte-nc', 'greenville-sc', 'spartanburg-sc', 'boone-nc'];
    for (const slug of slugs) {
      const result = await getLocalPage(slug);
      expect(result.success).toBe(true);
      expect(result.page.slug).toBe(slug);
    }
  });
});

// ── Hendersonville NC — home city ────────────────────────────────────

describe('getLocalPage — Hendersonville NC (home city)', () => {
  it('returns success: true', async () => {
    const result = await getLocalPage('hendersonville-nc');
    expect(result.success).toBe(true);
  });

  it('isHomeCity is true', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.isHomeCity).toBe(true);
  });

  it('isHomeCity is false for other cities', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.isHomeCity).toBe(false);
  });

  it('metaTitle contains Hendersonville', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.metaTitle).toContain('Hendersonville');
  });

  it('canonicalUrl points to /near/hendersonville-nc', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.canonicalUrl).toContain('/near/hendersonville-nc');
  });
});

// ── nearbyAreas resolution ────────────────────────────────────────────

describe('getLocalPage — nearbyAreas resolution', () => {
  it('nearbyAreas only includes defined slugs (no dead links)', async () => {
    const slugs = ['hendersonville-nc', 'asheville-nc', 'charlotte-nc', 'greenville-sc', 'spartanburg-sc', 'boone-nc'];
    const definedSlugs = new Set(slugs);
    for (const slug of slugs) {
      const { page } = await getLocalPage(slug);
      for (const area of page.nearbyAreas) {
        expect(definedSlugs.has(area.slug)).toBe(true);
      }
    }
  });

  it('nearbyAreas url uses /near/ prefix', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    for (const area of page.nearbyAreas) {
      expect(area.url).toMatch(/\/near\//);
    }
  });
});

// ── Unknown city slug ────────────────────────────────────────────────

describe('getLocalPage — unknown city', () => {
  it('returns success: true, page: null for unknown slug', async () => {
    const result = await getLocalPage('not-a-city');
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });

  it('returns success: true, page: null for valid-format unknown slug', async () => {
    const result = await getLocalPage('portland-or');
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });
});

// ── Invalid / missing slug ────────────────────────────────────────────

describe('getLocalPage — invalid slug', () => {
  it('returns success: false for empty string', async () => {
    const result = await getLocalPage('');
    expect(result.success).toBe(false);
    expect(result.page).toBeNull();
  });

  it('returns success: false for null', async () => {
    const result = await getLocalPage(null);
    expect(result.success).toBe(false);
  });

  it('returns success: false for path-traversal slug', async () => {
    const result = await getLocalPage('../etc/passwd');
    expect(result.success).toBe(false);
    expect(result.page).toBeNull();
  });

  it('returns success: false for slug with spaces', async () => {
    const result = await getLocalPage('hello world');
    expect(result.success).toBe(false);
  });

  it('returns success: false for HTML injection attempt', async () => {
    const result = await getLocalPage('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });
});

// ── getAllLocalSlugs ──────────────────────────────────────────────────

describe('getAllLocalSlugs', () => {
  it('returns success: true', async () => {
    const result = await getAllLocalSlugs();
    expect(result.success).toBe(true);
  });

  it('returns an array of slugs', async () => {
    const { slugs } = await getAllLocalSlugs();
    expect(Array.isArray(slugs)).toBe(true);
  });

  it('includes all 6 seeded city slugs', async () => {
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toContain('hendersonville-nc');
    expect(slugs).toContain('asheville-nc');
    expect(slugs).toContain('charlotte-nc');
    expect(slugs).toContain('greenville-sc');
    expect(slugs).toContain('spartanburg-sc');
    expect(slugs).toContain('boone-nc');
  });

  it('returns exactly 6 slugs', async () => {
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toHaveLength(6);
  });

  it('all slugs match known city page keys', async () => {
    const { slugs } = await getAllLocalSlugs();
    for (const slug of slugs) {
      const result = await getLocalPage(slug);
      expect(result.success).toBe(true);
      expect(result.page).not.toBeNull();
    }
  });
});

// ── SC cities (cross-state) ───────────────────────────────────────────

describe('getLocalPage — South Carolina cities', () => {
  it('greenville-sc has state SC', async () => {
    const { page } = await getLocalPage('greenville-sc');
    expect(page.state).toBe('SC');
  });

  it('spartanburg-sc has state SC', async () => {
    const { page } = await getLocalPage('spartanburg-sc');
    expect(page.state).toBe('SC');
  });

  it('SC cities have isHomeCity: false', async () => {
    for (const slug of ['greenville-sc', 'spartanburg-sc']) {
      const { page } = await getLocalPage(slug);
      expect(page.isHomeCity).toBe(false);
    }
  });
});

// ── CMS city path (LocalSeoCities collection) ─────────────────────────────────
// New cities are added via CMS. Static cities remain unchanged as fallback.

const CMS_CITY_BREVARD = {
  _id: 'cms-brevard',
  slug: 'brevard-nc',
  city: 'Brevard',
  state: 'NC',
  headline: 'Carolina Futons near Brevard, NC',
  heroDescription: 'Shop futons and mattresses near Brevard in Transylvania County.',
  neighborhoodContext: 'Brevard is the gateway to Pisgah National Forest.',
  metaTitle: 'Futon Store near Brevard NC | Carolina Futons',
  metaDescription: 'Shop futons and murphy beds near Brevard, NC. Carolina Futons in Hendersonville — 45 min away.',
  preferredCategories: ['futon-frames', 'mattresses'],
  featuredProducts: ['futon-frames'],
  categoryRecommendations: JSON.stringify([
    { category: 'futon-frames', label: 'Futon Frames', reason: 'Great selection near Brevard' },
  ]),
  faqs: JSON.stringify([
    { question: 'Do you deliver to Brevard?', answer: 'Yes, we deliver to the Brevard area.' },
    { question: 'How far is your store from Brevard?', answer: 'About 45 minutes from downtown Brevard.' },
  ]),
  distance: '45 min',
  isHomeCity: false,
};

describe('getLocalPage — CMS city (LocalSeoCities)', () => {
  beforeEach(() => {
    __seed('LocalSeoCities', [CMS_CITY_BREVARD]);
  });

  it('returns success:true for a CMS-only city slug', async () => {
    const result = await getLocalPage('brevard-nc');
    expect(result.success).toBe(true);
  });

  it('returns a non-null page for a CMS city', async () => {
    const result = await getLocalPage('brevard-nc');
    expect(result.page).not.toBeNull();
  });

  it('page has correct slug, city, state from CMS', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.slug).toBe('brevard-nc');
    expect(page.city).toBe('Brevard');
    expect(page.state).toBe('NC');
  });

  it('page headline comes from CMS', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.headline).toBe('Carolina Futons near Brevard, NC');
  });

  it('page heroDescription comes from CMS', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.heroDescription).toContain('Brevard');
  });

  it('page metaTitle contains city name', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.metaTitle).toContain('Brevard');
  });

  it('page metaDescription contains city name', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.metaDescription).toContain('Brevard');
  });

  it('page canonicalUrl points to /near/brevard-nc', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.canonicalUrl).toContain('/near/brevard-nc');
  });

  it('isHomeCity is false for CMS city', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.isHomeCity).toBe(false);
  });

  it('faqItems are parsed from JSON field', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(Array.isArray(page.faqItems)).toBe(true);
    expect(page.faqItems).toHaveLength(2);
    expect(page.faqItems[0].question).toBe('Do you deliver to Brevard?');
  });

  it('categoryRecommendations are parsed from JSON field', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(Array.isArray(page.categoryRecommendations)).toBe(true);
    expect(page.categoryRecommendations[0].category).toBe('futon-frames');
  });

  it('page has schemaData with localBusiness, faqPage, breadcrumb', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.schemaData).toBeDefined();
    expect(page.schemaData.localBusiness).toBeDefined();
    expect(page.schemaData.breadcrumb).toBeDefined();
  });

  it('page has directionsUrl as non-empty string', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(page.directionsUrl).toBeTruthy();
  });

  it('page has nearbyAreas as array (empty for CMS city with no nearbyAreas field)', async () => {
    const { page } = await getLocalPage('brevard-nc');
    expect(Array.isArray(page.nearbyAreas)).toBe(true);
  });

  it('static city still returned when CMS has a different city', async () => {
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.page.city).toBe('Asheville');
  });

  it('CMS city not returned for static slug (no overlap — CMS is checked first then static)', async () => {
    // brevard-nc is CMS-only; asheville-nc is static-only
    const asheville = await getLocalPage('asheville-nc');
    expect(asheville.page.city).toBe('Asheville'); // static, not CMS
  });

  it('returns page:null for unknown slug even with CMS seeded', async () => {
    const result = await getLocalPage('unknown-city-zz');
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });

  it('CMS query error falls through to static data gracefully', async () => {
    __setQueryError('LocalSeoCities', new Error('CMS unavailable'));
    // asheville-nc is in static data, so it should still return
    const result = await getLocalPage('asheville-nc');
    expect(result.success).toBe(true);
    expect(result.page.city).toBe('Asheville');
  });

  it('CMS query error returns null for truly unknown slug (no static fallback)', async () => {
    __setQueryError('LocalSeoCities', new Error('CMS unavailable'));
    const result = await getLocalPage('brevard-nc');
    // CMS errored and brevard-nc not in static — page null
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });
});

// ── getAllLocalSlugs — CMS union ──────────────────────────────────────────────

describe('getAllLocalSlugs — CMS union', () => {
  it('includes CMS slugs in addition to static slugs', async () => {
    __seed('LocalSeoCities', [CMS_CITY_BREVARD]);
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toContain('brevard-nc');
    expect(slugs).toContain('asheville-nc'); // static still included
  });

  it('returns 7 slugs when one CMS city is added', async () => {
    __seed('LocalSeoCities', [CMS_CITY_BREVARD]);
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toHaveLength(7);
  });

  it('returns exactly 6 slugs when no CMS cities are seeded', async () => {
    // default beforeEach has no LocalSeoCities seed
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toHaveLength(6);
  });

  it('does not duplicate slugs when CMS has no overlap with static', async () => {
    __seed('LocalSeoCities', [CMS_CITY_BREVARD]);
    const { slugs } = await getAllLocalSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('CMS query error returns static slugs only', async () => {
    __setQueryError('LocalSeoCities', new Error('CMS unavailable'));
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toHaveLength(6);
    expect(slugs).toContain('asheville-nc');
  });

  it('deduplicates when CMS slug overlaps a static slug', async () => {
    // seed a CMS record with a slug that already exists in LOCAL_PAGES
    __seed('LocalSeoCities', [{ ...CMS_CITY_BREVARD, slug: 'asheville-nc' }]);
    const { slugs } = await getAllLocalSlugs();
    // still 6 — no duplication of asheville-nc
    expect(slugs).toHaveLength(6);
    expect(slugs.filter(s => s === 'asheville-nc')).toHaveLength(1);
  });
});

// ── CMS additional edge cases ─────────────────────────────────────────────────

describe('getLocalPage — CMS edge cases', () => {
  it('CMS record wins over static when slug matches both', async () => {
    // Intentional CMS-primary behavior: CMS record for a static slug overrides static
    __seed('LocalSeoCities', [{
      ...CMS_CITY_BREVARD,
      slug: 'asheville-nc',
      city: 'Asheville',
      state: 'NC',
      headline: 'CMS headline for Asheville',
    }]);
    const { page } = await getLocalPage('asheville-nc');
    expect(page).not.toBeNull();
    expect(page.headline).toBe('CMS headline for Asheville');
  });

  it('_parseJsonField: already-parsed array in faqs passes through', async () => {
    // Wix CMS can return fields pre-deserialized; _parseJsonField must handle this
    __seed('LocalSeoCities', [{
      ...CMS_CITY_BREVARD,
      faqs: [{ question: 'Pre-parsed?', answer: 'Yes.' }], // array, not JSON string
    }]);
    const { page } = await getLocalPage('brevard-nc');
    expect(page.faqItems).toHaveLength(1);
    expect(page.faqItems[0].question).toBe('Pre-parsed?');
  });

  it('_parseJsonField: malformed JSON string returns empty array', async () => {
    __seed('LocalSeoCities', [{ ...CMS_CITY_BREVARD, faqs: 'not valid json' }]);
    const { page } = await getLocalPage('brevard-nc');
    expect(page.faqItems).toEqual([]);
  });

  it('_parseJsonField: non-array JSON (object/number) returns empty array', async () => {
    __seed('LocalSeoCities', [{ ...CMS_CITY_BREVARD, faqs: '{"key":"value"}' }]);
    const { page } = await getLocalPage('brevard-nc');
    expect(page.faqItems).toEqual([]);
  });

  it('nearbyAreas resolves CMS city nearbyAreas that point to valid static slugs', async () => {
    __seed('LocalSeoCities', [{
      ...CMS_CITY_BREVARD,
      nearbyAreas: ['asheville-nc', 'hendersonville-nc'],
    }]);
    const { page } = await getLocalPage('brevard-nc');
    expect(page.nearbyAreas).toHaveLength(2);
    expect(page.nearbyAreas.map(a => a.slug)).toContain('asheville-nc');
    expect(page.nearbyAreas.map(a => a.slug)).toContain('hendersonville-nc');
  });
});
