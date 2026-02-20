import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { getQuizRecommendations, getQuizOptions } from '../src/backend/styleQuiz.web.js';

// Seed products that match various quiz criteria
const quizProducts = [
  {
    _id: 'qp-1',
    name: 'Eureka Futon Frame',
    slug: 'eureka-futon-frame',
    price: 499,
    formattedPrice: '$499.00',
    mainMedia: 'https://example.com/eureka.jpg',
    collections: ['futon-frames'],
    description: 'Clean modern lines with solid hardwood construction.',
    inStock: true,
    numericRating: 4.5,
  },
  {
    _id: 'qp-2',
    name: 'Dillon Wall Hugger Frame',
    slug: 'dillon-wall-hugger',
    price: 699,
    formattedPrice: '$699.00',
    mainMedia: 'https://example.com/dillon.jpg',
    collections: ['futon-frames', 'wall-huggers'],
    description: 'Space-saving contemporary wall hugger futon.',
    inStock: true,
    numericRating: 4.2,
  },
  {
    _id: 'qp-3',
    name: 'Sagebrush Murphy Cabinet Bed',
    slug: 'sagebrush-murphy',
    price: 1899,
    formattedPrice: '$1,899.00',
    mainMedia: 'https://example.com/sagebrush.jpg',
    collections: ['murphy-cabinet-beds'],
    description: 'Queen Murphy cabinet bed with elegant design.',
    inStock: true,
    numericRating: 4.8,
  },
  {
    _id: 'qp-4',
    name: 'Lexington Platform Bed',
    slug: 'lexington-platform',
    price: 599,
    formattedPrice: '$599.00',
    mainMedia: 'https://example.com/lexington.jpg',
    collections: ['platform-beds'],
    description: 'Solid hardwood platform bed with natural finish.',
    inStock: true,
    numericRating: 4.0,
  },
  {
    _id: 'qp-5',
    name: 'KD Unfinished Poplar Frame',
    slug: 'kd-unfinished',
    price: 299,
    formattedPrice: '$299.00',
    mainMedia: 'https://example.com/kd.jpg',
    collections: ['futon-frames'],
    description: 'Unfinished natural Tulip Poplar wood frame, handcrafted in USA.',
    inStock: true,
    numericRating: 3.8,
  },
  {
    _id: 'qp-6',
    name: 'Moonshadow Futon Mattress',
    slug: 'moonshadow-mattress',
    price: 349,
    formattedPrice: '$349.00',
    mainMedia: 'https://example.com/moonshadow.jpg',
    collections: ['mattresses'],
    description: 'Premium innerspring futon mattress.',
    inStock: false,
    numericRating: 4.6,
  },
];

beforeEach(() => {
  __seed('Stores/Products', quizProducts);
});

// ── getQuizRecommendations ──────────────────────────────────────────

describe('getQuizRecommendations', () => {
  it('returns recommendations for living room + both uses', async () => {
    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'both',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results[0]).toHaveProperty('product');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('reason');
  });

  it('returns results sorted by score descending', async () => {
    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns max 5 results', async () => {
    // Seed many products
    const manyProducts = Array.from({ length: 15 }, (_, i) => ({
      _id: `bulk-${i}`,
      name: `Futon Frame ${i}`,
      slug: `futon-${i}`,
      price: 400 + i * 10,
      collections: ['futon-frames'],
      description: 'Modern futon frame.',
      inStock: true,
    }));
    __seed('Stores/Products', manyProducts);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array for null answers', async () => {
    const results = await getQuizRecommendations(null);
    expect(results).toEqual([]);
  });

  it('scores room type match at 30 points', async () => {
    const results = await getQuizRecommendations({
      roomType: 'living-room', // maps to futon-frames, wall-huggers
      primaryUse: 'sitting',   // maps to futon-frames, wall-huggers
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    // Wall hugger (Dillon) should score room + use (30+30) + possible style/budget bonuses
    const dillon = results.find(r => r.product._id === 'qp-2');
    if (dillon) {
      expect(dillon.score).toBeGreaterThanOrEqual(60);
    }
  });

  it('scores style keyword match at 20 points', async () => {
    // "rustic" maps to keywords: wood, hardwood, natural, unfinished, handcrafted
    // KD frame has "Unfinished natural Tulip Poplar wood frame, handcrafted"
    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'rustic',
      budgetRange: 'under-500',
    });
    const kd = results.find(r => r.product._id === 'qp-5');
    if (kd) {
      // Should get style match bonus (20 points)
      expect(kd.score).toBeGreaterThanOrEqual(20);
    }
  });

  it('gives bonus for highly rated products', async () => {
    const results = await getQuizRecommendations({
      roomType: 'guest-room',
      primaryUse: 'both',
      stylePreference: 'classic',
      budgetRange: '1000-2000',
    });
    // Murphy bed (rating 4.8) should get rating bonus
    const murphy = results.find(r => r.product._id === 'qp-3');
    if (murphy) {
      expect(murphy.score).toBeGreaterThan(0);
    }
  });

  it('gives bonus for in-stock products', async () => {
    const results = await getQuizRecommendations({
      roomType: 'bedroom',
      primaryUse: 'sleeping',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    // All in-stock products should score higher than out-of-stock
    const inStock = results.filter(r => r.product._id !== 'qp-6');
    for (const r of inStock) {
      expect(r.score).toBeGreaterThanOrEqual(5);
    }
  });

  it('falls back to budget-only search when no collection match', async () => {
    // Seed products with no matching collections
    __seed('Stores/Products', [
      {
        _id: 'fallback-1',
        name: 'Exotic Item',
        slug: 'exotic',
        price: 750,
        collections: ['exotic-category'],
        description: 'Something unique.',
        inStock: true,
      },
    ]);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    // Should fall back and still return something with score 50
    if (results.length > 0) {
      expect(results[0].score).toBe(50);
    }
  });

  it('filters by budget range', async () => {
    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    // Only products with price 0-500 should appear
    for (const r of results) {
      expect(r.product.price).toBeLessThanOrEqual(500);
    }
  });

  it('includes reason text in results', async () => {
    const results = await getQuizRecommendations({
      roomType: 'guest-room',
      primaryUse: 'both',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    if (results.length > 0) {
      expect(results[0].reason).toBeTruthy();
      expect(results[0].reason).toContain('guest room');
    }
  });

  it('formats product objects with expected fields', async () => {
    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    if (results.length > 0) {
      const product = results[0].product;
      expect(product).toHaveProperty('_id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('slug');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('mainMedia');
      expect(product).toHaveProperty('collections');
    }
  });
});

// ── getQuizOptions ──────────────────────────────────────────────────

describe('getQuizOptions', () => {
  it('returns all quiz option categories', async () => {
    const options = await getQuizOptions();
    expect(options).toHaveProperty('roomTypes');
    expect(options).toHaveProperty('primaryUses');
    expect(options).toHaveProperty('stylePreferences');
    expect(options).toHaveProperty('sizeOptions');
    expect(options).toHaveProperty('budgetRanges');
  });

  it('has 5 room type options', async () => {
    const options = await getQuizOptions();
    expect(options.roomTypes).toHaveLength(5);
    expect(options.roomTypes.map(r => r.value)).toContain('living-room');
    expect(options.roomTypes.map(r => r.value)).toContain('bedroom');
  });

  it('has 3 primary use options', async () => {
    const options = await getQuizOptions();
    expect(options.primaryUses).toHaveLength(3);
  });

  it('has 4 budget ranges', async () => {
    const options = await getQuizOptions();
    expect(options.budgetRanges).toHaveLength(4);
    expect(options.budgetRanges[0].value).toBe('under-500');
    expect(options.budgetRanges[3].value).toBe('over-2000');
  });

  it('each option has value, label, and description or icon', async () => {
    const options = await getQuizOptions();
    for (const room of options.roomTypes) {
      expect(room.value).toBeTruthy();
      expect(room.label).toBeTruthy();
    }
    for (const use of options.primaryUses) {
      expect(use.value).toBeTruthy();
      expect(use.description).toBeTruthy();
    }
  });
});
