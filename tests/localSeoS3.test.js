/**
 * @file localSeoS3.test.js
 * @description CF-ov8s: Local SEO phase 3 (S3) — JSON-LD schema + FAQ section on /near/[city] pages.
 *
 * Covers:
 *  - generateLocalBusinessSchema: per-city geo coordinates for all 6 cities
 *  - generateLocalBusinessSchema: FurnitureStore @type, address, telephone, openingHours
 *  - buildFaqSchema: FAQPage structure, Question/Answer entries
 *  - buildJsonLdScript: <script> tag serialization
 *  - getLocalPage: faqItems[] — 4 questions per city
 *  - getLocalPage: schemaData combined bundle (localBusiness, faqPage, breadcrumb)
 *  - getLocalPage: jsonLd includes correct per-city geo
 *  - getLocalPage: faqSchema is a valid FAQPage
 *  - All 6 city pages have schema and FAQ data
 */

import { describe, it, expect } from 'vitest';
import { generateLocalBusinessSchema, SCHEMA_OPENING_HOURS } from '../src/backend/localSeo.web.js';
import { buildFaqSchema, buildJsonLdScript } from '../src/public/localSeoHelpers.js';
import { getLocalPage } from '../src/backend/localSeoService.web.js';
import { CITY_GEO, STORE_GEO, LOCAL_PAGES } from '../src/backend/utils/localSeoData.js';

// ── City fixtures ─────────────────────────────────────────────────────────────

const ALL_SLUGS = ['hendersonville-nc', 'asheville-nc', 'charlotte-nc', 'greenville-sc', 'spartanburg-sc', 'boone-nc'];

const ASHEVILLE = { city: 'Asheville', state: 'NC', slug: 'asheville-nc' };
const HENDERSONVILLE = { city: 'Hendersonville', state: 'NC', slug: 'hendersonville-nc', isHomeCity: true };
const CHARLOTTE = { city: 'Charlotte', state: 'NC', slug: 'charlotte-nc' };
const GREENVILLE = { city: 'Greenville', state: 'SC', slug: 'greenville-sc' };
const SPARTANBURG = { city: 'Spartanburg', state: 'SC', slug: 'spartanburg-sc' };
const BOONE = { city: 'Boone', state: 'NC', slug: 'boone-nc' };

const ALL_CITY_FIXTURES = [HENDERSONVILLE, ASHEVILLE, CHARLOTTE, GREENVILLE, SPARTANBURG, BOONE];

// ── CITY_GEO data ─────────────────────────────────────────────────────────────

describe('CITY_GEO — per-city geo coordinates', () => {
  it('exports CITY_GEO with all 6 city slugs', () => {
    expect(Object.keys(CITY_GEO)).toHaveLength(6);
    for (const slug of ALL_SLUGS) {
      expect(CITY_GEO).toHaveProperty(slug);
    }
  });

  it('each entry has numeric latitude and longitude', () => {
    for (const [, geo] of Object.entries(CITY_GEO)) {
      expect(typeof geo.latitude).toBe('number');
      expect(typeof geo.longitude).toBe('number');
    }
  });

  it('Hendersonville geo matches STORE_GEO', () => {
    expect(CITY_GEO['hendersonville-nc'].latitude).toBe(STORE_GEO.latitude);
    expect(CITY_GEO['hendersonville-nc'].longitude).toBe(STORE_GEO.longitude);
  });

  it('Asheville geo is distinct from store geo', () => {
    expect(CITY_GEO['asheville-nc'].latitude).not.toBe(STORE_GEO.latitude);
    expect(CITY_GEO['asheville-nc'].longitude).not.toBe(STORE_GEO.longitude);
  });

  it('Greenville SC has southern latitude (below 35°N)', () => {
    expect(CITY_GEO['greenville-sc'].latitude).toBeLessThan(35);
  });

  it('all latitudes are in the NC/SC region (33–37°N)', () => {
    for (const [, geo] of Object.entries(CITY_GEO)) {
      expect(geo.latitude).toBeGreaterThan(33);
      expect(geo.latitude).toBeLessThan(37.5);
    }
  });

  it('all longitudes are in the NC/SC region (west of -80°)', () => {
    for (const [, geo] of Object.entries(CITY_GEO)) {
      expect(geo.longitude).toBeLessThan(-80);
    }
  });
});

// ── generateLocalBusinessSchema — per-city geo ────────────────────────────────

describe('generateLocalBusinessSchema — per-city geo', () => {
  it('uses Asheville geo for Asheville page', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.geo.latitude).toBe(CITY_GEO['asheville-nc'].latitude);
    expect(schema.geo.longitude).toBe(CITY_GEO['asheville-nc'].longitude);
  });

  it('uses Hendersonville (store) geo for home city', () => {
    const schema = generateLocalBusinessSchema(HENDERSONVILLE);
    expect(schema.geo.latitude).toBe(STORE_GEO.latitude);
    expect(schema.geo.longitude).toBe(STORE_GEO.longitude);
  });

  it('uses Charlotte geo for Charlotte page', () => {
    const schema = generateLocalBusinessSchema(CHARLOTTE);
    expect(schema.geo.latitude).toBe(CITY_GEO['charlotte-nc'].latitude);
  });

  it('uses Greenville SC geo for Greenville page', () => {
    const schema = generateLocalBusinessSchema(GREENVILLE);
    expect(schema.geo.latitude).toBe(CITY_GEO['greenville-sc'].latitude);
  });

  it('uses Spartanburg geo for Spartanburg page', () => {
    const schema = generateLocalBusinessSchema(SPARTANBURG);
    expect(schema.geo.latitude).toBe(CITY_GEO['spartanburg-sc'].latitude);
  });

  it('uses Boone geo for Boone page', () => {
    const schema = generateLocalBusinessSchema(BOONE);
    expect(schema.geo.latitude).toBe(CITY_GEO['boone-nc'].latitude);
  });

  it('falls back to STORE_GEO for unknown slug', () => {
    const schema = generateLocalBusinessSchema({ city: 'Unknown', state: 'NC', slug: 'unknown-nc' });
    expect(schema.geo.latitude).toBe(STORE_GEO.latitude);
    expect(schema.geo.longitude).toBe(STORE_GEO.longitude);
  });

  it('falls back to STORE_GEO when city is null', () => {
    const schema = generateLocalBusinessSchema(null);
    expect(schema.geo.latitude).toBe(STORE_GEO.latitude);
  });

  it('geo @type is GeoCoordinates', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.geo['@type']).toBe('GeoCoordinates');
  });
});

// ── generateLocalBusinessSchema — core LocalBusiness fields ──────────────────

describe('generateLocalBusinessSchema — FurnitureStore schema', () => {
  it('@context is https://schema.org', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema['@context']).toBe('https://schema.org');
  });

  it('@type includes FurnitureStore', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema['@type']).toContain('FurnitureStore');
  });

  it('@type includes LocalBusiness', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema['@type']).toContain('LocalBusiness');
  });

  it('includes Hendersonville store address', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address.addressLocality).toBe('Hendersonville');
    expect(schema.address.addressRegion).toBe('NC');
    expect(schema.address.postalCode).toBe('28792');
  });

  it('includes store telephone', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.telephone).toBeTruthy();
    expect(schema.telephone).toContain('+1');
  });

  it('telephone is the correct store number (+1-828-252-9449)', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    // Strip formatting to normalize and compare digits only
    const digits = schema.telephone.replace(/\D/g, '');
    expect(digits).toBe('18282529449');
  });

  it('includes openingHours from SCHEMA_OPENING_HOURS', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.openingHours).toEqual(SCHEMA_OPENING_HOURS);
  });

  it('openingHours reflects Wed-Sat 10am-5pm schedule', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.openingHours).toEqual(['We-Sa 10:00-17:00']);
  });

  it('address street is 824 Locust St (matches physical storefront)', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.address.streetAddress).toBe('824 Locust St');
  });

  it('includes areaServed with city and state', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.areaServed).toContain('Asheville');
    expect(schema.areaServed).toContain('NC');
  });

  it('includes url pointing to city page', () => {
    const schema = generateLocalBusinessSchema(ASHEVILLE);
    expect(schema.url).toContain('/near/asheville-nc');
  });
});

// ── buildFaqSchema — FAQPage JSON-LD ─────────────────────────────────────────

describe('buildFaqSchema — FAQPage JSON-LD', () => {
  const sampleFaqs = [
    { question: 'Do you deliver to Asheville?', answer: 'Yes, we deliver.' },
    { question: 'What styles work best?', answer: 'Wall-hugger frames.' },
  ];

  it('@context is https://schema.org', () => {
    const schema = buildFaqSchema(sampleFaqs);
    expect(schema['@context']).toBe('https://schema.org');
  });

  it('@type is FAQPage', () => {
    const schema = buildFaqSchema(sampleFaqs);
    expect(schema['@type']).toBe('FAQPage');
  });

  it('mainEntity has one entry per FAQ', () => {
    const schema = buildFaqSchema(sampleFaqs);
    expect(schema.mainEntity).toHaveLength(2);
  });

  it('each entry has @type Question', () => {
    const schema = buildFaqSchema(sampleFaqs);
    for (const entry of schema.mainEntity) {
      expect(entry['@type']).toBe('Question');
    }
  });

  it('each entry has name (question text)', () => {
    const schema = buildFaqSchema(sampleFaqs);
    expect(schema.mainEntity[0].name).toBe('Do you deliver to Asheville?');
  });

  it('each entry has acceptedAnswer with @type Answer', () => {
    const schema = buildFaqSchema(sampleFaqs);
    expect(schema.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe('Yes, we deliver.');
  });

  it('returns null for empty array', () => {
    expect(buildFaqSchema([])).toBeNull();
  });

  it('returns null for non-array input', () => {
    expect(buildFaqSchema(null)).toBeNull();
    expect(buildFaqSchema(undefined)).toBeNull();
  });

  it('filters entries with missing question or answer', () => {
    const schema = buildFaqSchema([
      { question: 'Valid?', answer: 'Yes.' },
      { question: '', answer: 'orphan answer' },
      { question: 'No answer?' },
    ]);
    expect(schema.mainEntity).toHaveLength(1);
  });
});

// ── buildJsonLdScript — serialization ────────────────────────────────────────

describe('buildJsonLdScript', () => {
  it('wraps schema in <script type="application/ld+json">', () => {
    const script = buildJsonLdScript({ '@type': 'FAQPage' });
    expect(script).toMatch(/^<script type="application\/ld\+json">/);
    expect(script).toMatch(/<\/script>$/);
  });

  it('contains serialized JSON', () => {
    const schema = { '@type': 'FAQPage', name: 'Test' };
    const script = buildJsonLdScript(schema);
    expect(script).toContain('"@type":"FAQPage"');
  });

  it('returns empty string for null', () => {
    expect(buildJsonLdScript(null)).toBe('');
  });

  it('returns empty string for non-object', () => {
    expect(buildJsonLdScript('string')).toBe('');
  });
});

// ── getLocalPage — faqItems and schemaData ────────────────────────────────────

describe('getLocalPage — faqItems and schemaData', () => {
  it('returns faqItems array for Asheville', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.faqItems)).toBe(true);
    expect(page.faqItems.length).toBeGreaterThanOrEqual(4);
  });

  it('each faqItem has question and answer strings', async () => {
    const { page } = await getLocalPage('asheville-nc');
    for (const faq of page.faqItems) {
      expect(typeof faq.question).toBe('string');
      expect(typeof faq.answer).toBe('string');
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    }
  });

  it('returns schemaData object with localBusiness, faqPage, breadcrumb', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.schemaData).toBeDefined();
    expect(page.schemaData.localBusiness).toBeDefined();
    expect(page.schemaData.faqPage).toBeDefined();
    expect(page.schemaData.breadcrumb).toBeDefined();
  });

  it('schemaData.localBusiness has FurnitureStore @type', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.schemaData.localBusiness['@type']).toContain('FurnitureStore');
  });

  it('schemaData.faqPage has FAQPage @type', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.schemaData.faqPage['@type']).toBe('FAQPage');
  });

  it('schemaData.breadcrumb has BreadcrumbList @type', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.schemaData.breadcrumb['@type']).toBe('BreadcrumbList');
  });

  it('jsonLd uses Asheville geo coordinates', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.jsonLd.geo.latitude).toBe(CITY_GEO['asheville-nc'].latitude);
    expect(page.jsonLd.geo.longitude).toBe(CITY_GEO['asheville-nc'].longitude);
  });

  it('jsonLd uses Charlotte geo coordinates', async () => {
    const { page } = await getLocalPage('charlotte-nc');
    expect(page.jsonLd.geo.latitude).toBe(CITY_GEO['charlotte-nc'].latitude);
  });

  it('faqSchema mainEntity length matches faqItems length', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.faqSchema.mainEntity).toHaveLength(page.faqItems.length);
  });

  it('legacy faqs field still present (alias of faqItems)', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.faqs).toEqual(page.faqItems);
  });

  it('schemaData.faqPage is null when city has no FAQs (via buildFaqSchema contract)', () => {
    // buildFaqSchema returns null for empty input — getLocalPage passes this directly
    // into schemaData.faqPage. Callers must null-check before accessing faqPage fields.
    expect(buildFaqSchema([])).toBeNull();
    expect(buildFaqSchema(null)).toBeNull();
  });
});

// ── All 6 city pages — schema and FAQ completeness ────────────────────────────

describe('all 6 city pages — schema and FAQ completeness', () => {
  for (const slug of ALL_SLUGS) {
    it(`${slug}: faqItems has 4 entries`, async () => {
      const { page } = await getLocalPage(slug);
      expect(page.faqItems).toHaveLength(4);
    });

    it(`${slug}: schemaData is complete`, async () => {
      const { page } = await getLocalPage(slug);
      expect(page.schemaData.localBusiness['@type']).toContain('LocalBusiness');
      expect(page.schemaData.faqPage['@type']).toBe('FAQPage');
      expect(page.schemaData.breadcrumb['@type']).toBe('BreadcrumbList');
    });

    it(`${slug}: jsonLd geo uses city-specific coordinates`, async () => {
      const { page } = await getLocalPage(slug);
      const expectedGeo = CITY_GEO[slug];
      expect(page.jsonLd.geo.latitude).toBe(expectedGeo.latitude);
      expect(page.jsonLd.geo.longitude).toBe(expectedGeo.longitude);
    });
  }
});
