/**
 * Tests for localSeoService.web.js
 *
 * Covers getLocalPage() and getAllLocalSlugs() webMethods:
 * known cities, unknown cities, invalid slugs, SEO field generation,
 * nearby areas resolution, and the home city (Hendersonville NC).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';

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
