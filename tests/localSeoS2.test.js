/**
 * CF-kj47.1: Local SEO S2 tests
 *
 * Covers:
 * - localSeoHelpers: buildBreadcrumbSchema, buildBreadcrumbList, buildFaqSchema, buildJsonLdScript
 * - Extended getLocalPage: heroDescription, neighborhoodContext, storeHours,
 *   categoryRecommendations, faqs, breadcrumbs, breadcrumbSchema, faqSchema
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: vi.fn((_, fn) => fn),
}));

import {
  buildBreadcrumbSchema,
  buildBreadcrumbList,
  buildFaqSchema,
  buildJsonLdScript,
} from '../src/public/localSeoHelpers.js';
import { getLocalPage } from '../src/backend/localSeoService.web.js';

const ASHEVILLE = { city: 'Asheville', slug: 'asheville-nc' };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── buildBreadcrumbSchema ─────────────────────────────────────────────────

describe('buildBreadcrumbSchema — structure', () => {
  it('returns an object', () => {
    expect(typeof buildBreadcrumbSchema(ASHEVILLE)).toBe('object');
  });

  it('@context is schema.org', () => {
    expect(buildBreadcrumbSchema(ASHEVILLE)['@context']).toBe('https://schema.org');
  });

  it('@type is BreadcrumbList', () => {
    expect(buildBreadcrumbSchema(ASHEVILLE)['@type']).toBe('BreadcrumbList');
  });

  it('has itemListElement array', () => {
    const { itemListElement } = buildBreadcrumbSchema(ASHEVILLE);
    expect(Array.isArray(itemListElement)).toBe(true);
  });

  it('has exactly 3 breadcrumb items', () => {
    const { itemListElement } = buildBreadcrumbSchema(ASHEVILLE);
    expect(itemListElement).toHaveLength(3);
  });

  it('first item is Home at position 1', () => {
    const first = buildBreadcrumbSchema(ASHEVILLE).itemListElement[0];
    expect(first['@type']).toBe('ListItem');
    expect(first.position).toBe(1);
    expect(first.name).toBe('Home');
  });

  it('second item is Local Stores at position 2', () => {
    const second = buildBreadcrumbSchema(ASHEVILLE).itemListElement[1];
    expect(second.position).toBe(2);
    expect(second.name).toBe('Local Stores');
    expect(second.item).toContain('/near');
  });

  it('third item is the city at position 3', () => {
    const third = buildBreadcrumbSchema(ASHEVILLE).itemListElement[2];
    expect(third.position).toBe(3);
    expect(third.name).toBe('Asheville');
    expect(third.item).toContain('asheville-nc');
  });

  it('all items have @type ListItem', () => {
    const { itemListElement } = buildBreadcrumbSchema(ASHEVILLE);
    for (const item of itemListElement) {
      expect(item['@type']).toBe('ListItem');
    }
  });

  it('null cityData: does not throw', () => {
    expect(() => buildBreadcrumbSchema(null)).not.toThrow();
  });

  it('null cityData: still has 3 items', () => {
    expect(buildBreadcrumbSchema(null).itemListElement).toHaveLength(3);
  });

  it('schema is JSON-serializable', () => {
    expect(() => JSON.stringify(buildBreadcrumbSchema(ASHEVILLE))).not.toThrow();
  });
});

// ── buildBreadcrumbList ───────────────────────────────────────────────────

describe('buildBreadcrumbList — display array', () => {
  it('returns an array', () => {
    expect(Array.isArray(buildBreadcrumbList(ASHEVILLE))).toBe(true);
  });

  it('has 3 items', () => {
    expect(buildBreadcrumbList(ASHEVILLE)).toHaveLength(3);
  });

  it('first item label is Home', () => {
    expect(buildBreadcrumbList(ASHEVILLE)[0].label).toBe('Home');
  });

  it('first item isCurrentPage is false', () => {
    expect(buildBreadcrumbList(ASHEVILLE)[0].isCurrentPage).toBe(false);
  });

  it('last item label is the city name', () => {
    expect(buildBreadcrumbList(ASHEVILLE)[2].label).toBe('Asheville');
  });

  it('last item isCurrentPage is true', () => {
    expect(buildBreadcrumbList(ASHEVILLE)[2].isCurrentPage).toBe(true);
  });

  it('last item url contains city slug', () => {
    expect(buildBreadcrumbList(ASHEVILLE)[2].url).toContain('asheville-nc');
  });

  it('null cityData: does not throw and returns 3 items', () => {
    const list = buildBreadcrumbList(null);
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(3);
  });
});

// ── buildFaqSchema ────────────────────────────────────────────────────────

describe('buildFaqSchema — structure', () => {
  const FAQS = [
    { question: 'Where is the store?', answer: 'In Hendersonville, NC.' },
    { question: 'Do you deliver?', answer: 'Yes, delivery available.' },
  ];

  it('returns an object', () => {
    expect(typeof buildFaqSchema(FAQS)).toBe('object');
  });

  it('@context is schema.org', () => {
    expect(buildFaqSchema(FAQS)['@context']).toBe('https://schema.org');
  });

  it('@type is FAQPage', () => {
    expect(buildFaqSchema(FAQS)['@type']).toBe('FAQPage');
  });

  it('mainEntity is an array', () => {
    expect(Array.isArray(buildFaqSchema(FAQS).mainEntity)).toBe(true);
  });

  it('mainEntity length matches input', () => {
    expect(buildFaqSchema(FAQS).mainEntity).toHaveLength(2);
  });

  it('each item has @type Question', () => {
    for (const item of buildFaqSchema(FAQS).mainEntity) {
      expect(item['@type']).toBe('Question');
    }
  });

  it('each item name matches question text', () => {
    const items = buildFaqSchema(FAQS).mainEntity;
    expect(items[0].name).toBe('Where is the store?');
    expect(items[1].name).toBe('Do you deliver?');
  });

  it('each acceptedAnswer has @type Answer', () => {
    for (const item of buildFaqSchema(FAQS).mainEntity) {
      expect(item.acceptedAnswer['@type']).toBe('Answer');
    }
  });

  it('each acceptedAnswer text matches answer', () => {
    const items = buildFaqSchema(FAQS).mainEntity;
    expect(items[0].acceptedAnswer.text).toBe('In Hendersonville, NC.');
  });

  it('empty array: mainEntity is empty', () => {
    expect(buildFaqSchema([]).mainEntity).toHaveLength(0);
  });

  it('null input: mainEntity is empty', () => {
    expect(buildFaqSchema(null).mainEntity).toHaveLength(0);
  });

  it('filters items missing question or answer', () => {
    const mixed = [
      { question: 'Valid?', answer: 'Yes.' },
      { question: 'No answer' },
      { answer: 'No question' },
    ];
    expect(buildFaqSchema(mixed).mainEntity).toHaveLength(1);
  });

  it('schema is JSON-serializable', () => {
    expect(() => JSON.stringify(buildFaqSchema(FAQS))).not.toThrow();
  });
});

// ── buildJsonLdScript ─────────────────────────────────────────────────────

describe('buildJsonLdScript', () => {
  it('returns a string', () => {
    expect(typeof buildJsonLdScript({ '@type': 'FAQPage' })).toBe('string');
  });

  it('output contains script tag with application/ld+json type', () => {
    const out = buildJsonLdScript({ '@type': 'FAQPage' });
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('</script>');
  });

  it('output contains the serialized schema', () => {
    const schema = { '@type': 'LocalBusiness', name: 'Carolina Futons' };
    expect(buildJsonLdScript(schema)).toContain('Carolina Futons');
  });

  it('null input: returns empty string', () => {
    expect(buildJsonLdScript(null)).toBe('');
  });

  it('non-object input: returns empty string', () => {
    expect(buildJsonLdScript('not-an-object')).toBe('');
  });
});

// ── Extended getLocalPage — new S2 fields ────────────────────────────────

describe('getLocalPage — heroDescription and neighborhoodContext (S2)', () => {
  it('returns heroDescription as non-empty string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.heroDescription).toBe('string');
    expect(page.heroDescription.length).toBeGreaterThan(0);
  });

  it('returns neighborhoodContext as non-empty string', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(typeof page.neighborhoodContext).toBe('string');
    expect(page.neighborhoodContext.length).toBeGreaterThan(0);
  });

  it('heroDescription contains city name for nearby cities', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.heroDescription).toMatch(/Asheville/i);
  });

  it('heroDescription is present for all 6 cities', async () => {
    const slugs = ['hendersonville-nc', 'asheville-nc', 'charlotte-nc', 'greenville-sc', 'spartanburg-sc', 'boone-nc'];
    for (const slug of slugs) {
      const { page } = await getLocalPage(slug);
      expect(page.heroDescription.length).toBeGreaterThan(0);
    }
  });
});

describe('getLocalPage — storeHours (S2)', () => {
  it('returns storeHours as non-empty array', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.storeHours)).toBe(true);
    expect(page.storeHours.length).toBeGreaterThan(0);
  });

  it('storeHours are strings in schema.org format', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    for (const h of page.storeHours) {
      expect(typeof h).toBe('string');
    }
  });

  it('same storeHours across all cities', async () => {
    const a = (await getLocalPage('asheville-nc')).page.storeHours;
    const b = (await getLocalPage('charlotte-nc')).page.storeHours;
    expect(a).toEqual(b);
  });
});

describe('getLocalPage — categoryRecommendations (S2)', () => {
  it('returns categoryRecommendations as array', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.categoryRecommendations)).toBe(true);
  });

  it('each recommendation has category, label, and reason', async () => {
    const { page } = await getLocalPage('asheville-nc');
    for (const rec of page.categoryRecommendations) {
      expect(typeof rec.category).toBe('string');
      expect(typeof rec.label).toBe('string');
      expect(typeof rec.reason).toBe('string');
    }
  });

  it('home city has 3 category recommendations', async () => {
    const { page } = await getLocalPage('hendersonville-nc');
    expect(page.categoryRecommendations).toHaveLength(3);
  });
});

describe('getLocalPage — faqs (S2)', () => {
  it('returns faqs as non-empty array', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.faqs)).toBe(true);
    expect(page.faqs.length).toBeGreaterThan(0);
  });

  it('each faq has question and answer', async () => {
    const { page } = await getLocalPage('asheville-nc');
    for (const faq of page.faqs) {
      expect(typeof faq.question).toBe('string');
      expect(typeof faq.answer).toBe('string');
    }
  });

  it('all 6 cities have at least 3 faqs', async () => {
    const slugs = ['hendersonville-nc', 'asheville-nc', 'charlotte-nc', 'greenville-sc', 'spartanburg-sc', 'boone-nc'];
    for (const slug of slugs) {
      const { page } = await getLocalPage(slug);
      expect(page.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('faqs questions are non-empty strings', async () => {
    const { page } = await getLocalPage('boone-nc');
    for (const faq of page.faqs) {
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    }
  });
});

describe('getLocalPage — breadcrumbs (S2)', () => {
  it('returns breadcrumbs as array of 3 items', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(Array.isArray(page.breadcrumbs)).toBe(true);
    expect(page.breadcrumbs).toHaveLength(3);
  });

  it('last breadcrumb is the current city', async () => {
    const { page } = await getLocalPage('asheville-nc');
    const last = page.breadcrumbs[page.breadcrumbs.length - 1];
    expect(last.label).toBe('Asheville');
    expect(last.isCurrentPage).toBe(true);
  });

  it('first breadcrumb is Home with isCurrentPage false', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.breadcrumbs[0].label).toBe('Home');
    expect(page.breadcrumbs[0].isCurrentPage).toBe(false);
  });
});

describe('getLocalPage — breadcrumbSchema (S2)', () => {
  it('returns breadcrumbSchema as valid JSON-LD', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.breadcrumbSchema['@type']).toBe('BreadcrumbList');
    expect(page.breadcrumbSchema['@context']).toBe('https://schema.org');
  });

  it('breadcrumbSchema city item contains city slug', async () => {
    const { page } = await getLocalPage('asheville-nc');
    const items = page.breadcrumbSchema.itemListElement;
    const cityItem = items.find(i => i.position === 3);
    expect(cityItem.item).toContain('asheville-nc');
  });
});

describe('getLocalPage — faqSchema (S2)', () => {
  it('returns faqSchema as FAQPage JSON-LD', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.faqSchema['@type']).toBe('FAQPage');
    expect(page.faqSchema['@context']).toBe('https://schema.org');
  });

  it('faqSchema mainEntity count matches faqs count', async () => {
    const { page } = await getLocalPage('asheville-nc');
    expect(page.faqSchema.mainEntity).toHaveLength(page.faqs.length);
  });

  it('faqSchema is JSON-serializable', async () => {
    const { page } = await getLocalPage('greenville-sc');
    expect(() => JSON.stringify(page.faqSchema)).not.toThrow();
  });
});
