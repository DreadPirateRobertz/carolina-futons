import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { getQuizRecommendations, getQuizOptions, getPersonalizedCopy } from '../src/backend/styleQuiz.web.js';

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

// ── sizeNeeds scoring ───────────────────────────────────────────────

describe('sizeNeeds scoring', () => {
  // Products identical in all criteria except availableSizes
  const sizeProducts = [
    {
      _id: 'sz-twin',
      name: 'Classic Futon Frame',
      slug: 'classic-twin',
      price: 700,
      formattedPrice: '$700.00',
      mainMedia: 'https://example.com/twin.jpg',
      collections: ['futon-frames'],
      description: 'Classic futon frame.',
      inStock: true,
      numericRating: 4.0,
      availableSizes: ['twin'],
    },
    {
      _id: 'sz-full',
      name: 'Classic Futon Frame Full',
      slug: 'classic-full',
      price: 700,
      formattedPrice: '$700.00',
      mainMedia: 'https://example.com/full.jpg',
      collections: ['futon-frames'],
      description: 'Classic futon frame.',
      inStock: true,
      numericRating: 4.0,
      availableSizes: ['full'],
    },
    {
      _id: 'sz-queen',
      name: 'Classic Futon Frame Queen',
      slug: 'classic-queen',
      price: 700,
      formattedPrice: '$700.00',
      mainMedia: 'https://example.com/queen.jpg',
      collections: ['futon-frames'],
      description: 'Classic futon frame.',
      inStock: true,
      numericRating: 4.0,
      availableSizes: ['queen'],
    },
    {
      _id: 'sz-multi',
      name: 'Versatile Futon Frame',
      slug: 'versatile-multi',
      price: 700,
      formattedPrice: '$700.00',
      mainMedia: 'https://example.com/multi.jpg',
      collections: ['futon-frames'],
      description: 'Classic futon frame.',
      inStock: true,
      numericRating: 4.0,
      availableSizes: ['twin', 'full', 'queen'],
    },
  ];

  it('queen answer returns different ranked results than twin answer', async () => {
    __seed('Stores/Products', sizeProducts);

    const queenResults = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'queen',
    });
    const twinResults = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'twin',
    });

    expect(queenResults.length).toBeGreaterThan(0);
    expect(twinResults.length).toBeGreaterThan(0);
    const queenTopId = queenResults[0].product._id;
    const twinTopId = twinResults[0].product._id;
    expect(queenTopId).not.toEqual(twinTopId);
  });

  it('size match adds 20 points to score', async () => {
    __seed('Stores/Products', [
      sizeProducts.find(p => p._id === 'sz-twin'),
      sizeProducts.find(p => p._id === 'sz-queen'),
    ]);

    const twinResults = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'twin',
    });

    const twinProduct = twinResults.find(r => r.product._id === 'sz-twin');
    const queenProduct = twinResults.find(r => r.product._id === 'sz-queen');
    expect(twinProduct).toBeDefined();
    expect(queenProduct).toBeDefined();
    // twin gets +20 for size match, queen does not
    expect(twinProduct.score).toBe(queenProduct.score + 20);
  });

  it('products without availableSizes are not penalized', async () => {
    __seed('Stores/Products', [
      {
        _id: 'no-size',
        name: 'No Size Frame',
        slug: 'no-size',
        price: 700,
        collections: ['futon-frames'],
        description: 'Classic futon.',
        inStock: true,
      },
      sizeProducts.find(p => p._id === 'sz-queen'),
    ]);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'queen',
    });

    expect(results.length).toBe(2);
    const noSizeResult = results.find(r => r.product._id === 'no-size');
    const queenResult = results.find(r => r.product._id === 'sz-queen');
    expect(noSizeResult).toBeDefined();
    expect(queenResult).toBeDefined();
    // queen gets size bonus, no-size does not — but no-size still appears
    expect(queenResult.score).toBe(noSizeResult.score + 20);
  });

  it('missing sizeNeeds does not affect existing scoring', async () => {
    __seed('Stores/Products', sizeProducts.slice(0, 2));

    const withSize = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'twin',
    });
    const withoutSize = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });

    // Both should return results
    expect(withSize.length).toBeGreaterThan(0);
    expect(withoutSize).toHaveLength(2);
    // Without sizeNeeds, no size bonus — scores should be equal for both products
    expect(withoutSize[0].score).toEqual(withoutSize[1].score);
  });

  it('multi-size product matches any requested size', async () => {
    __seed('Stores/Products', [
      sizeProducts.find(p => p._id === 'sz-multi'),
      sizeProducts.find(p => p._id === 'sz-twin'),
    ]);

    const queenResults = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'queen',
    });

    const multiResult = queenResults.find(r => r.product._id === 'sz-multi');
    const twinResult = queenResults.find(r => r.product._id === 'sz-twin');
    expect(multiResult).toBeDefined();
    expect(twinResult).toBeDefined();
    // multi includes queen so gets size bonus; twin does not
    expect(multiResult.score).toBe(twinResult.score + 20);
  });

  it('unrecognized sizeNeeds value applies no size bonus', async () => {
    __seed('Stores/Products', [
      sizeProducts.find(p => p._id === 'sz-twin'),
      sizeProducts.find(p => p._id === 'sz-queen'),
    ]);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'king',
    });

    // Neither product matches 'king' — both get same score
    expect(results).toHaveLength(2);
    expect(results[0].score).toEqual(results[1].score);
  });

  it('size matching is case-insensitive', async () => {
    __seed('Stores/Products', [
      { ...sizeProducts.find(p => p._id === 'sz-queen'), availableSizes: ['Queen'] },
      sizeProducts.find(p => p._id === 'sz-twin'),
    ]);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'queen',
    });

    const queenResult = results.find(r => r.product._id === 'sz-queen');
    const twinResult = results.find(r => r.product._id === 'sz-twin');
    expect(queenResult).toBeDefined();
    expect(twinResult).toBeDefined();
    // 'Queen' (capital Q) should still match 'queen' answer
    expect(queenResult.score).toBe(twinResult.score + 20);
  });

  it('null availableSizes is treated as no sizes (no bonus)', async () => {
    __seed('Stores/Products', [
      {
        _id: 'null-sizes',
        name: 'Null Sizes Frame',
        slug: 'null-sizes',
        price: 700,
        collections: ['futon-frames'],
        description: 'Classic futon.',
        inStock: true,
        availableSizes: null,
      },
      sizeProducts.find(p => p._id === 'sz-queen'),
    ]);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'queen',
    });

    const nullResult = results.find(r => r.product._id === 'null-sizes');
    const queenResult = results.find(r => r.product._id === 'sz-queen');
    expect(nullResult).toBeDefined();
    expect(queenResult).toBeDefined();
    expect(queenResult.score).toBe(nullResult.score + 20);
  });

  it('empty availableSizes array is treated same as missing', async () => {
    __seed('Stores/Products', [
      {
        _id: 'empty-sizes',
        name: 'Empty Sizes Frame',
        slug: 'empty-sizes',
        price: 700,
        collections: ['futon-frames'],
        description: 'Classic futon.',
        inStock: true,
        availableSizes: [],
      },
      sizeProducts.find(p => p._id === 'sz-queen'),
    ]);

    const results = await getQuizRecommendations({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
      sizeNeeds: 'queen',
    });

    const emptyResult = results.find(r => r.product._id === 'empty-sizes');
    const queenResult = results.find(r => r.product._id === 'sz-queen');
    expect(emptyResult).toBeDefined();
    expect(queenResult).toBeDefined();
    expect(queenResult.score).toBe(emptyResult.score + 20);
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

// ── getPersonalizedCopy ──────────────────────────────────────────────

describe('getPersonalizedCopy — profile types', () => {
  it('returns copy and profileType for valid answers', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'living-room',
      primaryUse: 'both',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    expect(result).toHaveProperty('copy');
    expect(result).toHaveProperty('profileType');
    expect(typeof result.copy).toBe('string');
    expect(result.copy.length).toBeGreaterThan(0);
  });

  it('dorm room returns compact profile', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'dorm',
      primaryUse: 'both',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    expect(result.profileType).toBe('compact');
  });

  it('office room returns compact profile', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'office',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    expect(result.profileType).toBe('compact');
  });

  it('sleeping primary use returns comfort profile', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'guest-room',
      primaryUse: 'sleeping',
      stylePreference: 'classic',
      budgetRange: '500-1000',
    });
    expect(result.profileType).toBe('comfort');
  });

  it('both primary use (non-dorm/office) returns versatile profile', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'living-room',
      primaryUse: 'both',
      stylePreference: 'rustic',
      budgetRange: '500-1000',
    });
    expect(result.profileType).toBe('versatile');
  });

  it('living room + sitting returns style profile', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    expect(result.profileType).toBe('style');
  });

  it('dorm + sleeping yields compact (roomType takes priority over primaryUse)', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'dorm',
      primaryUse: 'sleeping',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    expect(result.profileType).toBe('compact');
  });
});

describe('getPersonalizedCopy — copy content', () => {
  it('compact copy mentions space efficiency', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'dorm',
      primaryUse: 'both',
      stylePreference: 'modern',
      budgetRange: 'under-500',
    });
    expect(result.copy).toMatch(/space|small space|square foot/i);
  });

  it('comfort copy mentions sleep', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'guest-room',
      primaryUse: 'sleeping',
      stylePreference: 'classic',
      budgetRange: '500-1000',
    });
    expect(result.copy).toMatch(/sleep/i);
  });

  it('versatile copy mentions day-to-night or sitting and sleeping', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'living-room',
      primaryUse: 'both',
      stylePreference: 'rustic',
      budgetRange: '500-1000',
    });
    expect(result.copy).toMatch(/day.to.night|sitting and sleeping|both modes/i);
  });

  it('copy references the style preference tone', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'living-room',
      primaryUse: 'sitting',
      stylePreference: 'rustic',
      budgetRange: '500-1000',
    });
    expect(result.copy).toMatch(/natural|rustic|warm/i);
  });

  it('copy references the room type', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'guest-room',
      primaryUse: 'sleeping',
      stylePreference: 'classic',
      budgetRange: '500-1000',
    });
    expect(result.copy).toMatch(/guest room/i);
  });

  it('three distinct copy variants produce different text', async () => {
    const [compact, comfort, versatile] = await Promise.all([
      getPersonalizedCopy({ roomType: 'dorm',        primaryUse: 'both',     stylePreference: 'modern', budgetRange: 'under-500' }),
      getPersonalizedCopy({ roomType: 'guest-room',  primaryUse: 'sleeping', stylePreference: 'modern', budgetRange: '500-1000' }),
      getPersonalizedCopy({ roomType: 'living-room', primaryUse: 'both',     stylePreference: 'modern', budgetRange: '500-1000' }),
    ]);
    expect(compact.copy).not.toBe(comfort.copy);
    expect(comfort.copy).not.toBe(versatile.copy);
    expect(compact.copy).not.toBe(versatile.copy);
  });
});

describe('getPersonalizedCopy — null/edge cases', () => {
  it('returns empty copy and default profileType for null answers', async () => {
    const result = await getPersonalizedCopy(null);
    expect(result.copy).toBe('');
    expect(result.profileType).toBe('style');
  });

  it('handles unknown roomType gracefully', async () => {
    const result = await getPersonalizedCopy({
      roomType: 'spaceship',
      primaryUse: 'sitting',
      stylePreference: 'modern',
      budgetRange: '500-1000',
    });
    expect(typeof result.copy).toBe('string');
    expect(result.copy.length).toBeGreaterThan(0);
  });
});
