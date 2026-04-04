/**
 * @file buyingGuideSeo.test.js
 * @description CF-lz4r — Buying guide SEO schema + internal linking strategy.
 *
 * Covers:
 *   getBuyingGuideSchema (buyingGuides.web.js)
 *     — Article JSON-LD: all required schema.org fields
 *     — FAQPage JSON-LD: Question/Answer structure
 *     — Edge cases: unknown slug, null slug, coming-soon stub
 *
 *   getRelatedGuides (guideSeoService.web.js)
 *     — Affinity scoring: same-category (3) > related-category (2) > unrelated (1)
 *     — Category affinity map completeness for all 8 CF categories
 *     — Result ordering and URL generation
 *
 *   getHowToSchema (guideSeoService.web.js)
 *     — XSS: sanitize() strips HTML tags from title/description/step content
 *     — Optional fields: totalTime omitted when estimatedMinutes absent
 *     — Step URL anchor format
 *
 *   getGuidePageSeoData (guideSeoService.web.js)
 *     — Integration: both Article schema and cross-links returned in one call
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetStores } from './__mocks__/wix-stores-backend.js';

import {
  getBuyingGuideSchema,
} from '../src/backend/buyingGuides.web.js';

import {
  getRelatedGuides,
  getHowToSchema,
  getGuidePageSeoData,
} from '../src/backend/guideSeoService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  __resetStores();
});

/** Minimal guide fixture for guideSeoService tests (injected, not DB-backed). */
function makeGuide(overrides = {}) {
  return {
    title: 'Futon Frame Buying Guide',
    slug: 'futon-frames',
    category: 'futon-frames',
    metaDescription: 'Choose the right futon frame for your space.',
    heroImage: 'https://www.carolinafutons.com/hero.jpg',
    estimatedMinutes: 8,
    sections: [
      { title: 'Why Material Matters', content: 'Solid hardwood lasts 15-20 years.' },
      { title: 'Frame Sizes',         content: 'Twin, Full, and Queen are the standard sizes.' },
      { title: 'Style Options',       content: 'Wall hugger vs standard clearance frames.', image: 'https://www.carolinafutons.com/styles.jpg' },
    ],
    ...overrides,
  };
}

/** Build a guide list for getRelatedGuides tests. */
function makeGuideList(entries) {
  return entries.map(([slug, category, title]) => ({ slug, category, title }));
}

// ── getBuyingGuideSchema — Article JSON-LD ────────────────────────────────────

describe('getBuyingGuideSchema — Article JSON-LD structure', () => {
  let article;

  beforeEach(async () => {
    const result = await getBuyingGuideSchema('futon-frames');
    expect(result.success).toBe(true);
    article = JSON.parse(result.articleSchema);
  });

  it('@context is https://schema.org', () => {
    expect(article['@context']).toBe('https://schema.org');
  });

  it('@type is Article', () => {
    expect(article['@type']).toBe('Article');
  });

  it('headline matches the guide title exactly', () => {
    expect(article.headline).toBe('The Complete Futon Frame Buying Guide for 2026');
  });

  it('description matches the guide metaDescription', () => {
    expect(article.description).toBe(
      'Everything you need to know before buying a futon frame. Compare wood vs metal, sizes, styles, weight capacity, and top picks from Night & Day and KD Frames.'
    );
  });

  it('image is the guide heroImage URL', () => {
    expect(article.image).toBe('https://www.carolinafutons.com/buying-guides/futon-frames-hero.jpg');
  });

  it('author is an Organization named Carolina Futons', () => {
    expect(article.author['@type']).toBe('Organization');
    expect(article.author.name).toBe('Carolina Futons');
  });

  it('publisher is an Organization named Carolina Futons', () => {
    expect(article.publisher['@type']).toBe('Organization');
    expect(article.publisher.name).toBe('Carolina Futons');
  });

  it('publisher.logo is an ImageObject', () => {
    expect(article.publisher.logo['@type']).toBe('ImageObject');
  });

  it('publisher.logo.url contains the site origin', () => {
    expect(article.publisher.logo.url).toContain('carolinafutons.com');
  });

  it('datePublished matches guide publishDate', () => {
    expect(article.datePublished).toBe('2026-02-20');
  });

  it('dateModified matches guide updatedDate', () => {
    expect(article.dateModified).toBe('2026-02-20');
  });

  it('keywords is a non-empty comma-separated string', () => {
    expect(typeof article.keywords).toBe('string');
    expect(article.keywords).toContain(',');
    expect(article.keywords.length).toBeGreaterThan(0);
  });

  it('mainEntityOfPage @type is WebPage', () => {
    expect(article.mainEntityOfPage['@type']).toBe('WebPage');
  });

  it('mainEntityOfPage @id is the canonical guide URL', () => {
    expect(article.mainEntityOfPage['@id']).toBe(
      'https://www.carolinafutons.com/buying-guides/futon-frames'
    );
  });
});

// ── getBuyingGuideSchema — FAQPage JSON-LD ────────────────────────────────────

describe('getBuyingGuideSchema — FAQPage JSON-LD structure', () => {
  let faqPage;

  beforeEach(async () => {
    const result = await getBuyingGuideSchema('futon-frames');
    faqPage = JSON.parse(result.faqSchema);
  });

  it('@context is https://schema.org', () => {
    expect(faqPage['@context']).toBe('https://schema.org');
  });

  it('@type is FAQPage', () => {
    expect(faqPage['@type']).toBe('FAQPage');
  });

  it('mainEntity is an array with one entry per FAQ', () => {
    expect(Array.isArray(faqPage.mainEntity)).toBe(true);
    expect(faqPage.mainEntity.length).toBe(5); // futon-frames guide has 5 FAQs
  });

  it('each Question entry has @type Question', () => {
    for (const entry of faqPage.mainEntity) {
      expect(entry['@type']).toBe('Question');
    }
  });

  it('each Question name is non-empty', () => {
    for (const entry of faqPage.mainEntity) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('each acceptedAnswer has @type Answer', () => {
    for (const entry of faqPage.mainEntity) {
      expect(entry.acceptedAnswer['@type']).toBe('Answer');
    }
  });

  it('each acceptedAnswer text is non-empty', () => {
    for (const entry of faqPage.mainEntity) {
      expect(typeof entry.acceptedAnswer.text).toBe('string');
      expect(entry.acceptedAnswer.text.length).toBeGreaterThan(10);
    }
  });

  it('FAQPage schema works for all 8 guide categories', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getBuyingGuideSchema(slug);
      expect(result.success).toBe(true);
      const schema = JSON.parse(result.faqSchema);
      expect(schema['@type']).toBe('FAQPage');
      expect(schema.mainEntity.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ── getBuyingGuideSchema — edge cases ─────────────────────────────────────────

describe('getBuyingGuideSchema — edge cases', () => {
  it('returns null schemas for an unknown (coming-soon) slug', async () => {
    const result = await getBuyingGuideSchema('hammock-chairs');
    expect(result.success).toBe(true);
    expect(result.articleSchema).toBeNull();
    expect(result.faqSchema).toBeNull();
  });

  it('returns success:false for empty slug', async () => {
    const result = await getBuyingGuideSchema('');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns success:false for null slug', async () => {
    const result = await getBuyingGuideSchema(null);
    expect(result.success).toBe(false);
  });

  it('Article schema is valid parseable JSON for every real slug', async () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = await getBuyingGuideSchema(slug);
      expect(() => JSON.parse(result.articleSchema)).not.toThrow();
      expect(() => JSON.parse(result.faqSchema)).not.toThrow();
    }
  });

  it('Article schema headline uses title-cased guide title (not slug)', async () => {
    // Ensures the full prose title is in schema, not the raw slug
    const result = await getBuyingGuideSchema('mattresses');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.headline).toContain('Mattress');
    expect(schema.headline).not.toBe('mattresses');
  });
});

// ── getRelatedGuides — affinity scoring ──────────────────────────────────────

describe('getRelatedGuides — affinity scoring and ordering', () => {
  it('same-category guides rank above affinity-category guides', () => {
    const guides = makeGuideList([
      ['current-guide',    'futon-frames',      'Current'],
      ['another-frame',    'futon-frames',      'Other Frame Guide'],   // same category → 3
      ['mattress-guide',   'mattresses',         'Mattress Guide'],      // affinity → 2
      ['murphy-guide',     'murphy-cabinet-beds','Murphy Guide'],        // no affinity → 1
    ]);

    const result = getRelatedGuides('current-guide', 'futon-frames', guides);
    expect(result.success).toBe(true);

    const slugs = result.guides.map(g => g.slug);
    const frameIdx   = slugs.indexOf('another-frame');
    const mattressIdx = slugs.indexOf('mattress-guide');
    const murphyIdx  = slugs.indexOf('murphy-guide');

    expect(frameIdx).toBeLessThan(mattressIdx);
    expect(mattressIdx).toBeLessThan(murphyIdx);
  });

  it('affinity-category guides rank above unrelated guides', () => {
    const guides = makeGuideList([
      ['current',   'mattresses',  'Current'],
      ['frame',     'futon-frames', 'Frame Guide'],       // futon-frames is in mattresses affinity → 2
      ['murphy',    'murphy-cabinet-beds', 'Murphy'],     // not in mattresses affinity → 1
    ]);

    const result = getRelatedGuides('current', 'mattresses', guides);
    const slugs = result.guides.map(g => g.slug);
    expect(slugs.indexOf('frame')).toBeLessThan(slugs.indexOf('murphy'));
  });

  it('guides with score 1 (no affinity) are still included in results', () => {
    const guides = makeGuideList([
      ['current',  'futon-frames', 'Current'],
      ['unrelated','outdoor-furniture','Outdoor'],  // not in futon-frames affinity → score 1
    ]);

    const result = getRelatedGuides('current', 'futon-frames', guides);
    expect(result.guides.some(g => g.slug === 'unrelated')).toBe(true);
  });

  it('current guide is excluded regardless of category', () => {
    const guides = makeGuideList([
      ['my-guide',   'futon-frames', 'Mine'],
      ['other-guide','futon-frames', 'Other'],
    ]);

    const result = getRelatedGuides('my-guide', 'futon-frames', guides);
    expect(result.guides.every(g => g.slug !== 'my-guide')).toBe(true);
  });

  it('returns at most 4 related guides', () => {
    const guides = makeGuideList([
      ['cur', 'futon-frames', 'Current'],
      ...Array.from({ length: 10 }, (_, i) => [`g${i}`, 'covers', `Guide ${i}`]),
    ]);

    const result = getRelatedGuides('cur', 'futon-frames', guides);
    expect(result.guides.length).toBeLessThanOrEqual(4);
  });

  it('returns success:false when allGuides is not an array', () => {
    const result = getRelatedGuides('slug', 'futon-frames', null);
    expect(result.success).toBe(false);
    expect(result.guides).toEqual([]);
  });

  it('returns success:false when currentSlug is empty', () => {
    const guides = makeGuideList([['a', 'futon-frames', 'A']]);
    const result = getRelatedGuides('', 'futon-frames', guides);
    expect(result.success).toBe(false);
  });

  it('each related guide has a /buying-guides/ URL', () => {
    const guides = makeGuideList([
      ['cur',   'futon-frames', 'Current'],
      ['other', 'mattresses',   'Other'],
    ]);

    const result = getRelatedGuides('cur', 'futon-frames', guides);
    for (const g of result.guides) {
      expect(g.url).toMatch(/\/buying-guides\//);
    }
  });

  it('guide URL slug matches the guide slug field', () => {
    const guides = makeGuideList([
      ['cur',           'futon-frames', 'Current'],
      ['mattress-guide','mattresses',   'Mattresses'],
    ]);

    const result = getRelatedGuides('cur', 'futon-frames', guides);
    for (const g of result.guides) {
      expect(g.url).toContain(g.slug);
    }
  });
});

// ── getRelatedGuides — category affinity map ──────────────────────────────────

describe('getRelatedGuides — category affinity map', () => {
  /**
   * Assert that when searching from `fromCat`, the guide with `toCat`
   * outranks a truly unrelated guide.
   * Uses 'novelty-items' as the control category — it appears in no
   * affinity map so always scores 1 regardless of fromCat.
   */
  function assertAffinity(fromCat, toCat) {
    const UNRELATED_CAT = 'novelty-items';
    const guides = makeGuideList([
      ['cur',      fromCat,      'Current'],
      ['related',  toCat,        'Related'],
      ['unrelated', UNRELATED_CAT, 'Unrelated'],
    ]);

    const result = getRelatedGuides('cur', fromCat, guides);
    const slugs = result.guides.map(g => g.slug);
    const relatedIdx   = slugs.indexOf('related');
    const unrelatedIdx = slugs.indexOf('unrelated');

    expect(relatedIdx).toBeLessThan(unrelatedIdx);
  }

  it('futon-frames has affinity with mattresses', () => assertAffinity('futon-frames', 'mattresses'));
  it('futon-frames has affinity with covers', () => assertAffinity('futon-frames', 'covers'));
  it('futon-frames has affinity with casegoods-accessories', () => assertAffinity('futon-frames', 'casegoods-accessories'));

  it('mattresses has affinity with futon-frames', () => assertAffinity('mattresses', 'futon-frames'));
  it('mattresses has affinity with covers', () => assertAffinity('mattresses', 'covers'));
  it('mattresses has affinity with pillows', () => assertAffinity('mattresses', 'pillows'));

  it('covers has affinity with futon-frames', () => assertAffinity('covers', 'futon-frames'));
  it('covers has affinity with mattresses', () => assertAffinity('covers', 'mattresses'));

  it('murphy-cabinet-beds has affinity with mattresses', () => assertAffinity('murphy-cabinet-beds', 'mattresses'));
  it('platform-beds has affinity with mattresses', () => assertAffinity('platform-beds', 'mattresses'));
  it('platform-beds has affinity with murphy-cabinet-beds', () => assertAffinity('platform-beds', 'murphy-cabinet-beds'));

  it('casegoods-accessories has affinity with futon-frames', () => assertAffinity('casegoods-accessories', 'futon-frames'));
  it('casegoods-accessories has affinity with covers', () => assertAffinity('casegoods-accessories', 'covers'));

  it('pillows has affinity with mattresses', () => assertAffinity('pillows', 'mattresses'));
  it('pillows has affinity with covers', () => assertAffinity('pillows', 'covers'));

  it('outdoor-furniture has affinity with futon-frames', () => assertAffinity('outdoor-furniture', 'futon-frames'));
  it('outdoor-furniture has affinity with covers', () => assertAffinity('outdoor-furniture', 'covers'));

  it('unknown category produces no affinity (all guides score 1)', () => {
    const guides = makeGuideList([
      ['cur', 'hammock-chairs', 'Current'],
      ['a',   'mattresses',    'A'],
      ['b',   'futon-frames',  'B'],
    ]);

    const result = getRelatedGuides('cur', 'hammock-chairs', guides);
    // All guides get base score 1 — order is stable but not by category affinity
    expect(result.success).toBe(true);
    expect(result.guides.length).toBe(2);
  });
});

// ── getHowToSchema — XSS / sanitization ──────────────────────────────────────

describe('getHowToSchema — sanitization in schema output', () => {
  it('strips HTML tags from guide title', () => {
    const guide = makeGuide({ title: '<script>alert(1)</script>Futon Guide' });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.name).not.toContain('<script>');
    expect(schema.name).toContain('Futon Guide');
  });

  it('strips HTML tags from step name', () => {
    const guide = makeGuide({
      sections: [{ title: '<b>Bold Title</b>', content: 'Content here.' }],
    });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.step[0].name).not.toContain('<b>');
    expect(schema.step[0].name).toContain('Bold Title');
  });

  it('strips HTML tags from step text', () => {
    const guide = makeGuide({
      sections: [{ title: 'Step', content: '<img src=x onerror=alert(1)>Safe text.' }],
    });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.step[0].text).not.toContain('<img');
    expect(schema.step[0].text).toContain('Safe text');
  });

  it('strips HTML tags from metaDescription', () => {
    const guide = makeGuide({ metaDescription: '<em>Great</em> guide for frames.' });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.description).not.toContain('<em>');
    expect(schema.description).toContain('Great');
  });

  it('omits totalTime when estimatedMinutes is absent', () => {
    const guide = makeGuide({ estimatedMinutes: undefined });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.totalTime).toBeUndefined();
  });

  it('totalTime is ISO 8601 PT format when estimatedMinutes is provided', () => {
    const guide = makeGuide({ estimatedMinutes: 12 });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.totalTime).toBe('PT12M');
  });

  it('step URLs use the guide slug and 1-based position anchors', () => {
    const guide = makeGuide({ slug: 'futon-frames' });
    const result = getHowToSchema(guide);
    const schema = JSON.parse(result.schema);
    expect(schema.step[0].url).toContain('/buying-guides/futon-frames#step-1');
    expect(schema.step[2].url).toContain('#step-3');
  });

  it('step with image includes ImageObject; step without image has no image key', () => {
    const result = getHowToSchema(makeGuide());
    const schema = JSON.parse(result.schema);
    // Third section has an image
    expect(schema.step[2].image['@type']).toBe('ImageObject');
    expect(schema.step[2].image.url).toContain('styles.jpg');
    // First and second sections have no image
    expect(schema.step[0].image).toBeUndefined();
    expect(schema.step[1].image).toBeUndefined();
  });

  it('returns failure when guide has no sections', () => {
    const result = getHowToSchema(makeGuide({ sections: [] }));
    expect(result.success).toBe(false);
    expect(result.schema).toBeNull();
  });

  it('returns failure for null guide', () => {
    expect(getHowToSchema(null).success).toBe(false);
  });
});

// ── getGuidePageSeoData — integration ─────────────────────────────────────────

describe('getGuidePageSeoData — integration', () => {
  const ALL_GUIDES = makeGuideList([
    ['futon-frames', 'futon-frames', 'Futon Frames'],
    ['mattresses',   'mattresses',   'Mattresses'],
    ['covers',       'covers',       'Covers'],
    ['murphy-beds',  'murphy-cabinet-beds', 'Murphy Beds'],
  ]);

  it('returns success with howToSchema, relatedProducts, and relatedGuides', async () => {
    __seed('Products', [
      { _id: 'p1', name: 'Eureka', slug: 'eureka', category: 'futon-frames', price: 499, numericRating: 4.5, mainMedia: 'img.jpg' },
    ]);

    const result = await getGuidePageSeoData(makeGuide(), ALL_GUIDES);
    expect(result.success).toBe(true);
    expect(result.howToSchema).toBeTruthy();
    expect(Array.isArray(result.relatedProducts)).toBe(true);
    expect(Array.isArray(result.relatedGuides)).toBe(true);
  });

  it('howToSchema is valid JSON containing HowTo @type', async () => {
    const result = await getGuidePageSeoData(makeGuide(), ALL_GUIDES);
    const schema = JSON.parse(result.howToSchema);
    expect(schema['@type']).toBe('HowTo');
  });

  it('relatedGuides excludes the current guide slug', async () => {
    const result = await getGuidePageSeoData(makeGuide({ slug: 'futon-frames' }), ALL_GUIDES);
    expect(result.relatedGuides.every(g => g.slug !== 'futon-frames')).toBe(true);
  });

  it('relatedGuides ranks mattresses above unrelated guides for futon-frames', async () => {
    const result = await getGuidePageSeoData(makeGuide({ slug: 'futon-frames' }), ALL_GUIDES);
    const slugs = result.relatedGuides.map(g => g.slug);
    const mattressIdx = slugs.indexOf('mattresses');
    const murphyIdx   = slugs.indexOf('murphy-beds');
    if (mattressIdx !== -1 && murphyIdx !== -1) {
      expect(mattressIdx).toBeLessThan(murphyIdx);
    }
  });

  it('returns success:false for null guide', async () => {
    const result = await getGuidePageSeoData(null, ALL_GUIDES);
    expect(result.success).toBe(false);
    expect(result.howToSchema).toBeNull();
  });

  it('relatedProducts are empty when Products collection is empty', async () => {
    const result = await getGuidePageSeoData(makeGuide(), ALL_GUIDES);
    expect(result.relatedProducts).toEqual([]);
  });
});
