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

import { getLocalPage } from '../src/backend/localSeoService.web.js';

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
});
