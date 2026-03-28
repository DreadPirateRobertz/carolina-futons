/**
 * @file guideSeoService.test.js
 * @description Tests for buying guide SEO schema + link recommendations (cf-0je0).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import {
  getHowToSchema,
  getRelatedProducts,
  getRelatedGuides,
  getGuidePageSeoData,
} from '../src/backend/guideSeoService.web.js';

beforeEach(() => {
  __reset();
});

const SAMPLE_GUIDE = {
  title: 'Futon Frame Buying Guide',
  slug: 'futon-frame-buying-guide',
  category: 'futon-frames',
  metaDescription: 'Everything you need to know about choosing a futon frame.',
  heroImage: 'https://example.com/hero.jpg',
  estimatedMinutes: 10,
  sections: [
    { title: 'Choose Your Style', content: 'Bi-fold, tri-fold, or loveseat — each suits different spaces.', image: 'https://example.com/styles.jpg' },
    { title: 'Pick Your Material', content: 'Solid hardwood lasts longest. Metal is most affordable.' },
    { title: 'Size Matters', content: 'Measure your room before buying. Leave 12 inches on each side.' },
  ],
  faqs: [
    { question: 'How long do futon frames last?', answer: '10+ years with quality hardwood.' },
  ],
};

const ALL_GUIDES = [
  { slug: 'futon-frame-buying-guide', title: 'Futon Frame Guide', category: 'futon-frames' },
  { slug: 'mattress-buying-guide', title: 'Mattress Guide', category: 'mattresses' },
  { slug: 'cover-buying-guide', title: 'Cover Guide', category: 'covers' },
  { slug: 'murphy-bed-guide', title: 'Murphy Bed Guide', category: 'murphy-cabinet-beds' },
];

// ── HowTo Schema ────────────────────────────────────────────────────

describe('getHowToSchema', () => {
  it('generates valid HowTo JSON-LD', () => {
    const result = getHowToSchema(SAMPLE_GUIDE);
    expect(result.success).toBe(true);

    const schema = JSON.parse(result.schema);
    expect(schema['@type']).toBe('HowTo');
    expect(schema.name).toBe('Futon Frame Buying Guide');
    expect(schema.step).toHaveLength(3);
  });

  it('maps sections to HowToSteps with position', () => {
    const result = getHowToSchema(SAMPLE_GUIDE);
    const schema = JSON.parse(result.schema);

    expect(schema.step[0].position).toBe(1);
    expect(schema.step[0].name).toBe('Choose Your Style');
    expect(schema.step[1].position).toBe(2);
    expect(schema.step[2].position).toBe(3);
  });

  it('includes step URLs with anchors', () => {
    const result = getHowToSchema(SAMPLE_GUIDE);
    const schema = JSON.parse(result.schema);

    expect(schema.step[0].url).toContain('#step-1');
    expect(schema.step[2].url).toContain('#step-3');
  });

  it('includes images on steps that have them', () => {
    const result = getHowToSchema(SAMPLE_GUIDE);
    const schema = JSON.parse(result.schema);

    expect(schema.step[0].image).toBeDefined();
    expect(schema.step[0].image.url).toContain('styles.jpg');
    expect(schema.step[1].image).toBeUndefined();
  });

  it('includes totalTime in ISO 8601 duration', () => {
    const result = getHowToSchema(SAMPLE_GUIDE);
    const schema = JSON.parse(result.schema);
    expect(schema.totalTime).toBe('PT10M');
  });

  it('returns failure for empty guide', () => {
    expect(getHowToSchema(null).success).toBe(false);
    expect(getHowToSchema({}).success).toBe(false);
    expect(getHowToSchema({ title: 'Test', sections: [] }).success).toBe(false);
  });
});

// ── Related Products ────────────────────────────────────────────────

describe('getRelatedProducts', () => {
  it('returns products matching category', async () => {
    __seed('Products', [
      { _id: 'p1', name: 'Eureka', slug: 'eureka', category: 'futon-frames', price: 499, numericRating: 4.5, mainMedia: 'img.jpg' },
      { _id: 'p2', name: 'Mesa', slug: 'mesa', category: 'mattresses', price: 299, numericRating: 4.0 },
    ]);

    const result = await getRelatedProducts('futon-frames', 6);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Eureka');
    expect(result.products[0].url).toContain('/product-page/eureka');
  });

  it('returns empty for unknown category', async () => {
    __seed('Products', []);
    const result = await getRelatedProducts('nonexistent');
    expect(result.products).toEqual([]);
  });

  it('limits results', async () => {
    const products = Array.from({ length: 10 }, (_, i) => ({
      _id: `p${i}`, name: `Frame ${i}`, slug: `frame-${i}`, category: 'futon-frames', price: 400 + i, numericRating: 4,
    }));
    __seed('Products', products);

    const result = await getRelatedProducts('futon-frames', 3);
    expect(result.products).toHaveLength(3);
  });
});

// ── Related Guides ──────────────────────────────────────────────────

describe('getRelatedGuides', () => {
  it('excludes current guide from results', () => {
    const result = getRelatedGuides('futon-frame-buying-guide', 'futon-frames', ALL_GUIDES);
    expect(result.guides.every(g => g.slug !== 'futon-frame-buying-guide')).toBe(true);
  });

  it('ranks related categories higher', () => {
    const result = getRelatedGuides('futon-frame-buying-guide', 'futon-frames', ALL_GUIDES);
    expect(result.success).toBe(true);

    // Mattresses and covers are related to futon-frames
    const slugs = result.guides.map(g => g.slug);
    expect(slugs).toContain('mattress-buying-guide');
    expect(slugs).toContain('cover-buying-guide');
  });

  it('returns max 4 guides', () => {
    const manyGuides = Array.from({ length: 10 }, (_, i) => ({
      slug: `guide-${i}`, title: `Guide ${i}`, category: 'other',
    }));
    const result = getRelatedGuides('guide-0', 'futon-frames', manyGuides);
    expect(result.guides.length).toBeLessThanOrEqual(4);
  });

  it('includes URLs', () => {
    const result = getRelatedGuides('futon-frame-buying-guide', 'futon-frames', ALL_GUIDES);
    expect(result.guides[0].url).toContain('/buying-guides/');
  });
});

// ── Combined Page Data ──────────────────────────────────────────────

describe('getGuidePageSeoData', () => {
  it('returns all SEO + linking data in one call', async () => {
    __seed('Products', [
      { _id: 'p1', name: 'Eureka', slug: 'eureka', category: 'futon-frames', price: 499, numericRating: 4.5 },
    ]);

    const result = await getGuidePageSeoData(SAMPLE_GUIDE, ALL_GUIDES);
    expect(result.success).toBe(true);
    expect(result.howToSchema).toBeTruthy();
    expect(result.relatedProducts.length).toBeGreaterThanOrEqual(1);
    expect(result.relatedGuides.length).toBeGreaterThanOrEqual(1);
  });

  it('returns failure for null guide', async () => {
    const result = await getGuidePageSeoData(null, []);
    expect(result.success).toBe(false);
  });
});
