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

// ── metaTitle ──────────────────────────────────────────────────────────

describe('getLocalPage — metaTitle', () => {
  it('non-home city: includes city name', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaTitle).toContain('Asheville');
  });

  it('non-home city: includes "Carolina Futons"', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaTitle).toContain('Carolina Futons');
  });

  it('non-home city: includes city and state', async () => {
    const { page } = await getLocalPage('greenville-sc');
    expect(page.metaTitle).toContain('Greenville');
    expect(page.metaTitle).toContain('SC');
  });

  it('home city (Hendersonville): includes city name', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.metaTitle).toContain('Hendersonville');
  });

  it('home city: includes "Carolina Futons"', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.metaTitle).toContain('Carolina Futons');
  });

  it('home city: does NOT say "near [City]" — store is located there', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.metaTitle).not.toMatch(/near Hendersonville/i);
  });
});

// ── metaDescription ────────────────────────────────────────────────────

describe('getLocalPage — metaDescription', () => {
  it('non-home city: includes city name', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaDescription).toContain('Asheville');
  });

  it('non-home city: mentions Hendersonville (store location)', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaDescription).toContain('Hendersonville');
  });

  it('non-home city: includes distance from city', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaDescription).toContain('20 miles');
  });

  it('non-home city: does NOT say "located in" (says "near")', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.metaDescription).not.toMatch(/located in Asheville/i);
  });

  it('home city (Hendersonville): says "located in" not "near"', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.metaDescription).toMatch(/located in/i);
    expect(page.metaDescription).not.toMatch(/near Hendersonville/i);
  });

  it('home city: mentions special offer for local customers', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.metaDescription).toMatch(/special/i);
  });

  it('out-of-state city: includes city and state', async () => {
    const { page } = await getLocalPage('greenville-sc');
    expect(page.metaDescription).toContain('Greenville');
    expect(page.metaDescription).toContain('SC');
  });
});

// ── canonicalUrl ───────────────────────────────────────────────────────

describe('getLocalPage — canonicalUrl', () => {
  it('uses carolinafutons.com domain', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.canonicalUrl).toContain('carolinafutons.com');
  });

  it('includes /near/ path segment', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.canonicalUrl).toContain('/near/');
  });

  it('includes the city slug', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.canonicalUrl).toContain('asheville-nc');
  });

  it('correct format: https://www.carolinafutons.com/near/[slug]', async () => {
    const { page } = await getLocalPage('charlotte-nc');
    expect(page.canonicalUrl).toBe('https://www.carolinafutons.com/near/charlotte-nc');
  });

  it('home city canonical includes home slug', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.canonicalUrl).toBe('https://www.carolinafutons.com/near/hendersonville-nc');
  });
});

// ── JSON-LD structured data ────────────────────────────────────────────

describe('getLocalPage — jsonLd', () => {
  let asheville;
  let hendersonville;

  beforeAll(async () => {
    const [a, h] = await Promise.all([
      getLocalPage('asheville-nc'),
      getLocalPage('hendersonville-nc'),
    ]);
    asheville = a.page.jsonLd;
    hendersonville = h.page.jsonLd;
  });

  it('jsonLd is present and is an object', () => {
    expect(asheville).toBeTruthy();
    expect(typeof asheville).toBe('object');
  });

  it('@type includes "LocalBusiness"', () => {
    const types = [].concat(asheville['@type']);
    expect(types).toContain('LocalBusiness');
  });

  it('@context is "https://schema.org"', () => {
    expect(asheville['@context']).toBe('https://schema.org');
  });

  it('name includes "Carolina Futons"', () => {
    expect(asheville.name).toContain('Carolina Futons');
  });

  it('address has @type PostalAddress', () => {
    expect(asheville.address['@type']).toBe('PostalAddress');
  });

  it('address includes Hendersonville (store location)', () => {
    expect(asheville.address.addressLocality).toBe('Hendersonville');
  });

  it('address includes state NC', () => {
    expect(asheville.address.addressRegion).toBe('NC');
  });

  it('address includes postalCode', () => {
    expect(asheville.address.postalCode).toBeTruthy();
  });

  it('geo has @type GeoCoordinates with latitude and longitude', () => {
    expect(asheville.geo['@type']).toBe('GeoCoordinates');
    expect(typeof asheville.geo.latitude).toBe('number');
    expect(typeof asheville.geo.longitude).toBe('number');
  });

  it('telephone is present and non-empty', () => {
    expect(asheville.telephone).toBeTruthy();
  });

  it('openingHours is a non-empty array', () => {
    expect(Array.isArray(asheville.openingHours)).toBe(true);
    expect(asheville.openingHours.length).toBeGreaterThan(0);
  });

  it('areaServed includes the target city', () => {
    expect(asheville.areaServed).toContain('Asheville');
  });

  it('home city areaServed includes Hendersonville', () => {
    expect(hendersonville.areaServed).toContain('Hendersonville');
  });

  it('url is present and contains the canonical path', () => {
    expect(asheville.url).toContain('carolinafutons.com');
  });
});
