/**
 * CF-gjy4: Local SEO S4 — SEO layer tests for /near/[city] pages
 *
 * Validates dynamically generated metaTitle, metaDescription, canonicalUrl,
 * and LocalBusiness JSON-LD structured data from getLocalPage().
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone' },
  webMethod: vi.fn((_, fn) => fn),
}));

import { getLocalPage, getAllLocalSlugs } from '../src/backend/localSeoService.web.js';

// ── Shared page data (fetched once for all describe blocks) ────────────

let asheville;
let hendersonville;
let greenville;
let charlotte;

beforeAll(async () => {
  const [a, h, g, c] = await Promise.all([
    getLocalPage('asheville-nc'),
    getLocalPage('hendersonville-nc'),
    getLocalPage('greenville-sc'),
    getLocalPage('charlotte-nc'),
  ]);
  asheville = a.page;
  hendersonville = h.page;
  greenville = g.page;
  charlotte = c.page;
});

// ── metaTitle ──────────────────────────────────────────────────────────

describe('getLocalPage — metaTitle', () => {
  it('non-home city: includes city name', () => {
    expect(asheville.metaTitle).toContain('Asheville');
  });

  it('non-home city: includes "Carolina Futons"', () => {
    expect(asheville.metaTitle).toContain('Carolina Futons');
  });

  it('non-home city: includes city and state', () => {
    expect(greenville.metaTitle).toContain('Greenville');
    expect(greenville.metaTitle).toContain('SC');
  });

  it('home city (Hendersonville): includes city name', () => {
    expect(hendersonville.metaTitle).toContain('Hendersonville');
  });

  it('home city: includes "Carolina Futons"', () => {
    expect(hendersonville.metaTitle).toContain('Carolina Futons');
  });

  it('home city: does NOT say "near [City]" — store is located there', () => {
    expect(hendersonville.metaTitle).not.toMatch(/near Hendersonville/i);
  });
});

// ── metaDescription ────────────────────────────────────────────────────

describe('getLocalPage — metaDescription', () => {
  it('non-home city: includes city name', () => {
    expect(asheville.metaDescription).toContain('Asheville');
  });

  it('non-home city: mentions Hendersonville (store location)', () => {
    expect(asheville.metaDescription).toContain('Hendersonville');
  });

  it('non-home city: includes distance from city', () => {
    expect(asheville.metaDescription).toContain('20 miles');
  });

  it('non-home city: does NOT say "located in" (says "near")', () => {
    expect(asheville.metaDescription).not.toMatch(/located in Asheville/i);
  });

  it('home city (Hendersonville): says "located in" not "near"', () => {
    expect(hendersonville.metaDescription).toMatch(/located in/i);
    expect(hendersonville.metaDescription).not.toMatch(/near Hendersonville/i);
  });

  it('home city: mentions special offer for local customers', () => {
    expect(hendersonville.metaDescription).toMatch(/special/i);
  });

  it('out-of-state city: includes city and state', () => {
    expect(greenville.metaDescription).toContain('Greenville');
    expect(greenville.metaDescription).toContain('SC');
  });
});

// ── canonicalUrl ───────────────────────────────────────────────────────

describe('getLocalPage — canonicalUrl', () => {
  it('uses carolinafutons.com domain', () => {
    expect(asheville.canonicalUrl).toContain('carolinafutons.com');
  });

  it('includes /near/ path segment', () => {
    expect(asheville.canonicalUrl).toContain('/near/');
  });

  it('includes the city slug', () => {
    expect(asheville.canonicalUrl).toContain('asheville-nc');
  });

  it('correct format: https://www.carolinafutons.com/near/[slug]', () => {
    expect(charlotte.canonicalUrl).toBe('https://www.carolinafutons.com/near/charlotte-nc');
  });

  it('home city canonical includes home slug', () => {
    expect(hendersonville.canonicalUrl).toBe('https://www.carolinafutons.com/near/hendersonville-nc');
  });
});

// ── JSON-LD structured data ────────────────────────────────────────────

describe('getLocalPage — jsonLd', () => {
  it('jsonLd is present and is an object', () => {
    expect(asheville.jsonLd).toBeTruthy();
    expect(typeof asheville.jsonLd).toBe('object');
  });

  it('@type is "LocalBusiness"', () => {
    expect(asheville.jsonLd['@type']).toBe('LocalBusiness');
  });

  it('@context is "https://schema.org"', () => {
    expect(asheville.jsonLd['@context']).toBe('https://schema.org');
  });

  it('name is "Carolina Futons"', () => {
    expect(asheville.jsonLd.name).toBe('Carolina Futons');
  });

  it('address has @type PostalAddress', () => {
    expect(asheville.jsonLd.address['@type']).toBe('PostalAddress');
  });

  it('address includes Hendersonville (store location)', () => {
    expect(asheville.jsonLd.address.addressLocality).toBe('Hendersonville');
  });

  it('address includes state NC', () => {
    expect(asheville.jsonLd.address.addressRegion).toBe('NC');
  });

  it('address includes postalCode', () => {
    expect(asheville.jsonLd.address.postalCode).toBeTruthy();
  });

  it('geo has @type GeoCoordinates with latitude and longitude', () => {
    expect(asheville.jsonLd.geo['@type']).toBe('GeoCoordinates');
    expect(typeof asheville.jsonLd.geo.latitude).toBe('number');
    expect(typeof asheville.jsonLd.geo.longitude).toBe('number');
  });

  it('telephone is present and non-empty', () => {
    expect(asheville.jsonLd.telephone).toBeTruthy();
  });

  it('openingHours is a non-empty array', () => {
    expect(Array.isArray(asheville.jsonLd.openingHours)).toBe(true);
    expect(asheville.jsonLd.openingHours.length).toBeGreaterThan(0);
  });

  it('areaServed includes the target city', () => {
    expect(asheville.jsonLd.areaServed).toContain('Asheville');
  });

  it('home city areaServed includes Hendersonville', () => {
    expect(hendersonville.jsonLd.areaServed).toContain('Hendersonville');
  });

  it('url is present and contains the canonical path', () => {
    expect(asheville.jsonLd.url).toContain('carolinafutons.com');
  });

  it('url matches the canonical URL exactly', () => {
    expect(asheville.jsonLd.url).toBe('https://www.carolinafutons.com/near/asheville-nc');
  });
});

// ── slug validation edge cases ─────────────────────────────────────────

describe('getLocalPage — invalid / unknown slugs', () => {
  it('empty slug returns success: false', async () => {
    const result = await getLocalPage('');
    expect(result.success).toBe(false);
    expect(result.page).toBeNull();
  });

  it('path-traversal slug returns success: false', async () => {
    const result = await getLocalPage('../admin');
    expect(result.success).toBe(false);
    expect(result.page).toBeNull();
  });

  it('valid format but unknown city returns success: true, page: null', async () => {
    const result = await getLocalPage('portland-or');
    expect(result.success).toBe(true);
    expect(result.page).toBeNull();
  });
});

// ── home city metaDescription does not interpolate null distance ───────

describe('getLocalPage — home city metaDescription null distance guard', () => {
  it('home city description does not contain "null"', () => {
    expect(hendersonville.metaDescription).not.toContain('null');
  });

  it('home city description does not contain "undefined"', () => {
    expect(hendersonville.metaDescription).not.toContain('undefined');
  });
});

// ── nearbyAreas filtering ──────────────────────────────────────────────

describe('getLocalPage — nearbyAreas output', () => {
  it('nearbyAreas is an array', () => {
    expect(Array.isArray(asheville.nearbyAreas)).toBe(true);
  });

  it('nearbyAreas items have slug, city, state, and url', () => {
    for (const area of asheville.nearbyAreas) {
      expect(area.slug).toBeTruthy();
      expect(area.city).toBeTruthy();
      expect(area.state).toBeTruthy();
      expect(area.url).toContain('/near/');
    }
  });

  it('nearbyAreas only includes slugs that exist in LOCAL_PAGES (unknown refs filtered out)', () => {
    // asheville.nearbyAreas references 'weaverville-nc' and 'black-mountain-nc'
    // which are not in LOCAL_PAGES — they should be filtered out, leaving only
    // 'hendersonville-nc' which is defined
    const slugs = asheville.nearbyAreas.map(a => a.slug);
    expect(slugs).toContain('hendersonville-nc');
    expect(slugs).not.toContain('weaverville-nc');
    expect(slugs).not.toContain('black-mountain-nc');
  });
});

// ── getAllLocalSlugs ───────────────────────────────────────────────────

describe('getAllLocalSlugs', () => {
  it('returns success: true', async () => {
    const result = await getAllLocalSlugs();
    expect(result.success).toBe(true);
  });

  it('returns a non-empty array of slugs', async () => {
    const { slugs } = await getAllLocalSlugs();
    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs.length).toBeGreaterThan(0);
  });

  it('includes known city slugs', async () => {
    const { slugs } = await getAllLocalSlugs();
    expect(slugs).toContain('hendersonville-nc');
    expect(slugs).toContain('asheville-nc');
  });
});
