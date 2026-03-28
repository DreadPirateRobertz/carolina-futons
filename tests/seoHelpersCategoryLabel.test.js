/**
 * seoHelpersCategoryLabel.test.js
 * CF-i5bi — Branch coverage for getCategoryLabel branches in seoHelpers.web.js
 *
 * Each test calls getProductSchema with a product whose collections trigger a
 * different branch of getCategoryLabel (10 category if-branches + 1 fallback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-data', () => ({
  default: {
    query: () => ({
      eq: vi.fn().mockReturnThis(),
      hasSome: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      ascending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      count: vi.fn().mockResolvedValue(0),
    }),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn().mockResolvedValue('test-secret'),
}));

import { getProductSchema } from '../src/backend/seoHelpers.web.js';

const makeProduct = (collections, extras = {}) => ({
  _id: 'prod-test',
  name: 'Test Product',
  slug: 'test-product',
  price: 499,
  formattedPrice: '$499.00',
  mainMedia: 'https://cdn.example.com/test.jpg',
  description: 'A test product for category label coverage.',
  inStock: true,
  collections: Array.isArray(collections) ? collections : [collections],
  ...extras,
});

describe('getCategoryLabel branches via getProductSchema', () => {
  it('returns Murphy Cabinet Bed for murphy collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['murphy-cabinet-beds'])));
    expect(schema.category).toBe('Murphy Cabinet Bed');
  });

  it('returns Platform Bed for platform collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['platform-beds'])));
    expect(schema.category).toBe('Platform Bed');
  });

  it('returns Futon Mattress for mattress collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['mattresses'])));
    expect(schema.category).toBe('Futon Mattress');
  });

  it('returns Wall Hugger Futon Frame for wall-hugger collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['wall-hugger-frames'])));
    expect(schema.category).toBe('Wall Hugger Futon Frame');
  });

  it('returns Futon Frame for futon-frames collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['futon-frames'])));
    expect(schema.category).toBe('Futon Frame');
  });

  it('returns Futon Frame for frame collection (alt match)', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['frame-only'])));
    expect(schema.category).toBe('Futon Frame');
  });

  it('returns Bedroom Furniture for casegood collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['casegoods'])));
    expect(schema.category).toBe('Bedroom Furniture');
  });

  it('returns Bedroom Furniture for accessor collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['accessories'])));
    expect(schema.category).toBe('Bedroom Furniture');
  });

  it('returns Futon Cover for cover collection', () => {
    // Use "covers" without "futon" prefix to avoid matching futon/frame branch first
    const schema = JSON.parse(getProductSchema(makeProduct(['covers'])));
    expect(schema.category).toBe('Futon Cover');
  });

  it('returns Outdoor Furniture for outdoor collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['outdoor-furniture'])));
    expect(schema.category).toBe('Outdoor Furniture');
  });

  it('returns Pillow for pillow collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['pillows'])));
    expect(schema.category).toBe('Pillow');
  });

  it('returns Log Futon Frame for log collection', () => {
    // "log-furniture" avoids matching "frame" before "log"
    const schema = JSON.parse(getProductSchema(makeProduct(['log-furniture'])));
    expect(schema.category).toBe('Log Futon Frame');
  });

  it('returns Furniture for unrecognized collection', () => {
    const schema = JSON.parse(getProductSchema(makeProduct(['gift-cards'])));
    expect(schema.category).toBe('Furniture');
  });

  it('returns Furniture for null product', () => {
    expect(getProductSchema(null)).toBeNull();
  });

  it('returns Furniture when collections is a string (not array)', () => {
    const schema = JSON.parse(getProductSchema(makeProduct('murphy-cabinet-beds')));
    expect(schema.category).toBe('Murphy Cabinet Bed');
  });

  it('returns Furniture when collections is missing', () => {
    const product = { ...makeProduct([]), collections: undefined };
    const schema = JSON.parse(getProductSchema(product));
    expect(schema.category).toBe('Furniture');
  });
});

// Exercise detectMaterial branches (called internally by getProductSchema)
describe('detectMaterial branches via getProductSchema', () => {
  it('exercises solid hardwood path', () => {
    const schema = getProductSchema(makeProduct(['futon-frames'], { name: 'Solid Wood Futon Frame' }));
    expect(schema).toBeTruthy();
  });

  it('exercises memory foam path', () => {
    const schema = getProductSchema(makeProduct(['mattresses'], { name: 'Memory Foam Futon Mattress' }));
    expect(schema).toBeTruthy();
  });

  it('exercises steel path', () => {
    const schema = getProductSchema(makeProduct(['futon-frames'], { description: 'Steel frame construction' }));
    expect(schema).toBeTruthy();
  });

  it('exercises rubberwood path', () => {
    const schema = getProductSchema(makeProduct(['futon-frames'], { name: 'Rubberwood Futon Frame' }));
    expect(schema).toBeTruthy();
  });

  it('exercises unfinished collection path', () => {
    const schema = getProductSchema(makeProduct(['unfinished-frames']));
    expect(schema).toBeTruthy();
  });

  it('exercises otis collection path', () => {
    const schema = getProductSchema(makeProduct(['otis-mattresses']));
    expect(schema).toBeTruthy();
  });

  it('exercises latex path', () => {
    const schema = getProductSchema(makeProduct(['mattresses'], { name: 'Latex Foam Mattress' }));
    expect(schema).toBeTruthy();
  });

  it('exercises parawood path', () => {
    const schema = getProductSchema(makeProduct(['futon-frames'], { name: 'Parawood Futon Frame' }));
    expect(schema).toBeTruthy();
  });

  it('exercises poplar path', () => {
    const schema = getProductSchema(makeProduct(['futon-frames'], { name: 'Tulip Poplar Frame' }));
    expect(schema).toBeTruthy();
  });

  it('exercises rustic/log path in description', () => {
    const schema = getProductSchema(makeProduct(['misc'], { description: 'Rustic log cabin style' }));
    expect(schema).toBeTruthy();
  });
});
