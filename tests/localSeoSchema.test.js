/**
 * CF-lhln: Local SEO S2 — LocalBusiness JSON-LD schema tests
 *
 * Tests generateLocalBusinessSchema() directly:
 * - Correct @type, @context, fields per Google LocalBusiness spec
 * - Missing city param returns valid schema (no throw / no 500)
 * - Special chars in city name are JSON-safe
 * - Products included as hasOfferCatalog; omitted when empty
 */
import { describe, it, expect } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone' },
  webMethod: vi.fn((_, fn) => fn),
}));

import { generateLocalBusinessSchema } from '../src/backend/localSeo.web.js';

const ASHEVILLE = { city: 'Asheville', state: 'NC', slug: 'asheville-nc' };
const GREENVILLE = { city: 'Greenville', state: 'SC', slug: 'greenville-sc' };

// ── Core schema structure ─────────────────────────────────────────────

describe('generateLocalBusinessSchema — core structure', () => {
  it('returns a non-null object', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema).toBeTruthy();
    expect(typeof schema).toBe('object');
  });

  it('@context is "https://schema.org"', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema['@context']).toBe('https://schema.org');
  });

  it('@type is an array', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(Array.isArray(schema['@type'])).toBe(true);
  });

  it('@type includes "LocalBusiness"', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema['@type']).toContain('LocalBusiness');
  });

  it('@type includes "FurnitureStore"', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema['@type']).toContain('FurnitureStore');
  });

  it('telephone is present and non-empty', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.telephone).toBeTruthy();
    expect(typeof schema.telephone).toBe('string');
  });

  it('geo has @type GeoCoordinates with numeric lat/lon', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.geo['@type']).toBe('GeoCoordinates');
    expect(typeof schema.geo.latitude).toBe('number');
    expect(typeof schema.geo.longitude).toBe('number');
  });

  it('openingHours is a non-empty array', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(Array.isArray(schema.openingHours)).toBe(true);
    expect(schema.openingHours.length).toBeGreaterThan(0);
  });

  it('openingHours contains Wed-Fri entry', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    const combined = schema.openingHours.join(' ');
    expect(combined).toMatch(/We.*Fr/);
  });

  it('openingHours contains Sat entry', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    const combined = schema.openingHours.join(' ');
    expect(combined).toMatch(/Sa/);
  });
});

// ── Address ───────────────────────────────────────────────────────────

describe('generateLocalBusinessSchema — address', () => {
  it('address has @type PostalAddress', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address['@type']).toBe('PostalAddress');
  });

  it('address locality is Hendersonville (always the HQ)', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address.addressLocality).toBe('Hendersonville');
  });

  it('address region is NC', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address.addressRegion).toBe('NC');
  });

  it('address postalCode is 28792', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address.postalCode).toBe('28792');
  });

  it('address streetAddress is 824 Locust St', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address.streetAddress).toBe('824 Locust St');
  });
});

// ── City-specific fields ──────────────────────────────────────────────

describe('generateLocalBusinessSchema — city-specific fields', () => {
  it('name includes "Carolina Futons"', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.name).toContain('Carolina Futons');
  });

  it('name includes the city name', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.name).toContain('Asheville');
  });

  it('areaServed includes the city name', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.areaServed).toContain('Asheville');
  });

  it('areaServed includes the state', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.areaServed).toContain('NC');
  });

  it('url includes the city slug', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.url).toContain('asheville-nc');
  });

  it('url includes /near/ path segment', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.url).toContain('/near/');
  });

  it('url uses carolinafutons.com domain', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.url).toContain('carolinafutons.com');
  });

  it('out-of-state city: areaServed includes SC state', () => {
    const schema = generateLocalBusinessSchema(GREENVILLE);
    expect(schema.areaServed).toContain('SC');
  });
});

// ── Missing / null city (no 500) ──────────────────────────────────────

describe('generateLocalBusinessSchema — null city param (no 500)', () => {
  it('null city: does not throw', () => {
    expect(() => generateLocalBusinessSchema(null)).not.toThrow();
  });

  it('undefined city: does not throw', () => {
    expect(() => generateLocalBusinessSchema(undefined)).not.toThrow();
  });

  it('null city: returns a valid object', () => {
    const schema = generateLocalBusinessSchema(null);
    expect(schema).toBeTruthy();
    expect(typeof schema).toBe('object');
  });

  it('null city: @context is still schema.org', () => {
    const schema = generateLocalBusinessSchema(null);
    expect(schema['@context']).toBe('https://schema.org');
  });

  it('null city: @type still includes LocalBusiness', () => {
    const schema = generateLocalBusinessSchema(null);
    expect([].concat(schema['@type'])).toContain('LocalBusiness');
  });

  it('null city: name falls back to "Carolina Futons"', () => {
    const schema = generateLocalBusinessSchema(null);
    expect(schema.name).toBe('Carolina Futons');
  });

  it('null city: areaServed has a fallback value', () => {
    const schema = generateLocalBusinessSchema(null);
    expect(schema.areaServed).toBeTruthy();
  });
});

// ── Special characters ────────────────────────────────────────────────

describe('generateLocalBusinessSchema — special chars in city name', () => {
  it('city with apostrophe: does not throw', () => {
    const city = { city: "O'Brien", state: 'NC', slug: 'obrien-nc' };
    expect(() => generateLocalBusinessSchema(city)).not.toThrow();
  });

  it('city with apostrophe: name is valid JSON-serialisable string', () => {
    const city = { city: "O'Brien", state: 'NC', slug: 'obrien-nc' };
    const schema = generateLocalBusinessSchema(city);
    expect(() => JSON.stringify(schema)).not.toThrow();
    expect(typeof JSON.parse(JSON.stringify(schema)).name).toBe('string');
  });

  it('city with ampersand: name is safe in JSON', () => {
    const city = { city: 'Fort & Lee', state: 'NC', slug: 'fort-lee-nc' };
    const schema = generateLocalBusinessSchema(city);
    const serialised = JSON.stringify(schema);
    expect(serialised).toContain('Fort & Lee');
  });

  it('city with accented chars: schema round-trips through JSON', () => {
    const city = { city: 'Montréal', state: 'QC', slug: 'montreal-qc' };
    const schema = generateLocalBusinessSchema(city);
    expect(() => JSON.parse(JSON.stringify(schema))).not.toThrow();
  });
});

// ── Products / hasOfferCatalog ────────────────────────────────────────

describe('generateLocalBusinessSchema — products param', () => {
  const PRODUCTS = [
    { name: 'Classic Futon Frame' },
    { name: 'Premium Mattress' },
  ];

  it('no products: hasOfferCatalog is not set', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE, []);
    expect(schema.hasOfferCatalog).toBeUndefined();
  });

  it('no products arg: hasOfferCatalog is not set', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.hasOfferCatalog).toBeUndefined();
  });

  it('with products: hasOfferCatalog is present', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE, PRODUCTS);
    expect(schema.hasOfferCatalog).toBeTruthy();
  });

  it('with products: hasOfferCatalog @type is OfferCatalog', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE, PRODUCTS);
    expect(schema.hasOfferCatalog['@type']).toBe('OfferCatalog');
  });

  it('with products: itemListElement has correct count', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE, PRODUCTS);
    expect(schema.hasOfferCatalog.itemListElement).toHaveLength(PRODUCTS.length);
  });

  it('with products: each item has @type Offer with Product name', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE, PRODUCTS);
    const first = schema.hasOfferCatalog.itemListElement[0];
    expect(first['@type']).toBe('Offer');
    expect(first.itemOffered['@type']).toBe('Product');
    expect(first.itemOffered.name).toBe('Classic Futon Frame');
  });
});
