import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from '../__mocks__/wix-data.js';

import {
  getComfortLevels,
  getProductComfort,
  getComfortProducts,
} from '../../src/backend/comfortService.web.js';

const COMFORT_LEVELS = [
  {
    _id: 'cl-plush',
    slug: 'plush',
    name: 'Plush',
    tagline: 'Sink in and let go',
    description: 'Like being hugged by a cloud. Deep cushioning that cradles every curve — perfect for movie marathons and Sunday naps.',
    illustration: 'wix:image://v1/plush-figure.svg',
    illustrationAlt: 'Hand-drawn figure sinking into a plush cushion',
    sortOrder: 1,
  },
  {
    _id: 'cl-medium',
    slug: 'medium',
    name: 'Medium',
    tagline: 'The best of both worlds',
    description: 'Supportive enough for all-day sitting, soft enough for falling asleep with a book. The Goldilocks zone.',
    illustration: 'wix:image://v1/medium-figure.svg',
    illustrationAlt: 'Hand-drawn figure in balanced seated position',
    sortOrder: 2,
  },
  {
    _id: 'cl-firm',
    slug: 'firm',
    name: 'Firm',
    tagline: 'Sit tall, feel strong',
    description: 'Solid support that keeps your posture happy. Ideal for working from home, reading, or anyone who prefers structure.',
    illustration: 'wix:image://v1/firm-figure.svg',
    illustrationAlt: 'Hand-drawn figure sitting upright with good posture',
    sortOrder: 3,
  },
];

const PRODUCT_COMFORT = [
  { _id: 'pc-1', productId: 'prod-1', comfortLevelId: 'cl-plush', sortOrder: 1 },
  { _id: 'pc-2', productId: 'prod-2', comfortLevelId: 'cl-firm', sortOrder: 1 },
  { _id: 'pc-3', productId: 'prod-3', comfortLevelId: 'cl-medium', sortOrder: 1 },
  { _id: 'pc-4', productId: 'prod-4', comfortLevelId: 'cl-plush', sortOrder: 2 },
];

// ── getComfortLevels ────────────────────────────────────────────────

describe('getComfortLevels', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
  });

  it('returns all comfort levels sorted by sortOrder', async () => {
    const levels = await getComfortLevels();
    expect(levels).toHaveLength(3);
    expect(levels[0].slug).toBe('plush');
    expect(levels[1].slug).toBe('medium');
    expect(levels[2].slug).toBe('firm');
  });

  it('returns mapped fields: name, slug, tagline, description, illustration, illustrationAlt', async () => {
    const levels = await getComfortLevels();
    const plush = levels.find(l => l.slug === 'plush');
    expect(plush).toBeDefined();
    expect(plush.name).toBe('Plush');
    expect(plush.tagline).toBe('Sink in and let go');
    expect(plush.description).toContain('hugged by a cloud');
    expect(plush.illustration).toContain('plush-figure.svg');
    expect(plush.illustrationAlt).toContain('sinking into');
  });

  it('does not expose raw CMS fields like _id and sortOrder', async () => {
    const levels = await getComfortLevels();
    expect(levels[0].sortOrder).toBeUndefined();
    expect(levels[0]._id).toBeUndefined();
  });

  it('returns empty array when no comfort levels exist', async () => {
    __seed('ComfortLevels', []);
    const levels = await getComfortLevels();
    expect(Array.isArray(levels)).toBe(true);
    expect(levels).toHaveLength(0);
  });

  it('returns empty array on error', async () => {
    // No seed data at all — graceful error handling
    const levels = await getComfortLevels();
    expect(Array.isArray(levels)).toBe(true);
  });

  it('sorts correctly when seeded in reverse order', async () => {
    __seed('ComfortLevels', [
      { _id: 'cl-z', slug: 'firm', name: 'Firm', tagline: 'z', description: 'z', illustration: 'z', illustrationAlt: 'z', sortOrder: 3 },
      { _id: 'cl-a', slug: 'plush', name: 'Plush', tagline: 'a', description: 'a', illustration: 'a', illustrationAlt: 'a', sortOrder: 1 },
      { _id: 'cl-m', slug: 'medium', name: 'Medium', tagline: 'm', description: 'm', illustration: 'm', illustrationAlt: 'm', sortOrder: 2 },
    ]);

    const levels = await getComfortLevels();
    expect(levels).toHaveLength(3);
    expect(levels[0].name).toBe('Plush');
    expect(levels[1].name).toBe('Medium');
    expect(levels[2].name).toBe('Firm');
  });
});

// ── getProductComfort ───────────────────────────────────────────────

describe('getProductComfort', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('returns comfort level for a product', async () => {
    const comfort = await getProductComfort('prod-1');
    expect(comfort).toBeDefined();
    expect(comfort.slug).toBe('plush');
    expect(comfort.name).toBe('Plush');
    expect(comfort.tagline).toBeTruthy();
  });

  it('returns null for product with no comfort mapping', async () => {
    const comfort = await getProductComfort('nonexistent-product');
    expect(comfort).toBeNull();
  });

  it('returns null for empty productId', async () => {
    const comfort = await getProductComfort('');
    expect(comfort).toBeNull();
  });

  it('returns null for null/undefined productId', async () => {
    const comfort = await getProductComfort(null);
    expect(comfort).toBeNull();
    const comfort2 = await getProductComfort(undefined);
    expect(comfort2).toBeNull();
  });

  it('includes illustration data in response', async () => {
    const comfort = await getProductComfort('prod-1');
    expect(comfort.illustration).toBeTruthy();
    expect(comfort.illustrationAlt).toBeTruthy();
  });

  it('returns full comfort level data including description', async () => {
    const comfort = await getProductComfort('prod-2');
    expect(comfort.slug).toBe('firm');
    expect(comfort.description).toContain('Solid support');
  });

  it('does not expose raw CMS fields like _id and sortOrder', async () => {
    const comfort = await getProductComfort('prod-1');
    expect(comfort).not.toBeNull();
    expect(comfort._id).toBeUndefined();
    expect(comfort.sortOrder).toBeUndefined();
  });

  it('returns null when mapping exists but comfort level is missing', async () => {
    __seed('ProductComfort', [
      { _id: 'pc-orphan', productId: 'prod-orphan', comfortLevelId: 'cl-nonexistent', sortOrder: 1 },
    ]);
    __seed('ComfortLevels', []);

    const comfort = await getProductComfort('prod-orphan');
    expect(comfort).toBeNull();
  });
});

// ── getComfortProducts ──────────────────────────────────────────────

describe('getComfortProducts', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('returns product IDs for a comfort level', async () => {
    const productIds = await getComfortProducts('plush');
    expect(productIds).toContain('prod-1');
    expect(productIds).toContain('prod-4');
    expect(productIds).toHaveLength(2);
  });

  it('returns empty array for comfort level with no products', async () => {
    __seed('ProductComfort', []);
    const productIds = await getComfortProducts('plush');
    expect(Array.isArray(productIds)).toBe(true);
    expect(productIds).toHaveLength(0);
  });

  it('returns empty array for invalid comfort slug', async () => {
    const productIds = await getComfortProducts('nonexistent');
    expect(Array.isArray(productIds)).toBe(true);
    expect(productIds).toHaveLength(0);
  });

  it('returns empty array for empty slug', async () => {
    const productIds = await getComfortProducts('');
    expect(Array.isArray(productIds)).toBe(true);
  });

  it('returns empty array for null slug', async () => {
    const productIds = await getComfortProducts(null);
    expect(Array.isArray(productIds)).toBe(true);
    expect(productIds).toHaveLength(0);
  });

  it('returns empty array for undefined slug', async () => {
    const productIds = await getComfortProducts(undefined);
    expect(Array.isArray(productIds)).toBe(true);
    expect(productIds).toHaveLength(0);
  });

  it('returns products sorted by sortOrder ascending', async () => {
    __seed('ProductComfort', [
      { _id: 'pc-z', productId: 'prod-last', comfortLevelId: 'cl-plush', sortOrder: 99 },
      { _id: 'pc-a', productId: 'prod-first', comfortLevelId: 'cl-plush', sortOrder: 1 },
      { _id: 'pc-m', productId: 'prod-middle', comfortLevelId: 'cl-plush', sortOrder: 50 },
    ]);

    const productIds = await getComfortProducts('plush');
    expect(productIds).toHaveLength(3);
    expect(productIds[0]).toBe('prod-first');
    expect(productIds[1]).toBe('prod-middle');
    expect(productIds[2]).toBe('prod-last');
  });

  it('returns only string product IDs with no extra fields', async () => {
    const productIds = await getComfortProducts('plush');
    expect(productIds.length).toBeGreaterThan(0);
    productIds.forEach(id => {
      expect(typeof id).toBe('string');
    });
  });
});
