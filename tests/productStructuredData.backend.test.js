/**
 * productStructuredData.backend.test.js
 * CF-06xu — Backend: getProductStructuredData
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import { getProductStructuredData } from '../src/backend/productResources.web.js';

const PRODUCT_ID = 'prod-sd-1';

function seedProduct(overrides = {}) {
  __seed('Stores/Products', [{
    _id: PRODUCT_ID,
    name: 'Monterey Full Futon Frame',
    description: 'Solid hardwood futon frame.',
    slug: 'monterey-full-futon-frame',
    sku: 'MFF-001',
    price: 499.99,
    discountedPrice: null,
    inStock: true,
    mainMedia: 'https://example.com/monterey.jpg',
    ...overrides,
  }]);
}

function seedReviews(reviews = []) {
  __seed('Reviews', reviews);
}

beforeEach(() => {
  __reset();
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('getProductStructuredData — happy path', () => {
  it('returns product data with name, sku, price', async () => {
    seedProduct();
    seedReviews([]);
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result.product).toMatchObject({
      name: 'Monterey Full Futon Frame',
      sku: 'MFF-001',
      price: 499.99,
    });
  });

  it('returns aggregate rating from reviews', async () => {
    seedProduct();
    seedReviews([
      { _id: 'r1', productId: PRODUCT_ID, rating: 5, status: 'approved', authorName: 'A', body: 'Great', _createdDate: '2026-03-20' },
      { _id: 'r2', productId: PRODUCT_ID, rating: 3, status: 'approved', authorName: 'B', body: 'OK', _createdDate: '2026-03-19' },
    ]);
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result.aggregate.average).toBe(4);
    expect(result.aggregate.total).toBe(2);
  });

  it('returns first 3 approved reviews', async () => {
    seedProduct();
    seedReviews([
      { _id: 'r1', productId: PRODUCT_ID, rating: 5, status: 'approved', authorName: 'A', body: 'Great', _createdDate: '2026-03-20' },
      { _id: 'r2', productId: PRODUCT_ID, rating: 4, status: 'approved', authorName: 'B', body: 'Good', _createdDate: '2026-03-19' },
      { _id: 'r3', productId: PRODUCT_ID, rating: 3, status: 'approved', authorName: 'C', body: 'OK', _createdDate: '2026-03-18' },
      { _id: 'r4', productId: PRODUCT_ID, rating: 2, status: 'approved', authorName: 'D', body: 'Meh', _createdDate: '2026-03-17' },
    ]);
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result.reviews).toHaveLength(3);
  });

  it('excludes non-approved reviews from aggregate', async () => {
    seedProduct();
    seedReviews([
      { _id: 'r1', productId: PRODUCT_ID, rating: 5, status: 'approved', authorName: 'A', body: 'Great', _createdDate: '2026-03-20' },
      { _id: 'r2', productId: PRODUCT_ID, rating: 1, status: 'pending', authorName: 'B', body: 'Bad', _createdDate: '2026-03-19' },
    ]);
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result.aggregate.average).toBe(5);
    expect(result.aggregate.total).toBe(1);
  });
});

// ── Zero reviews ──────────────────────────────────────────────────────────────

describe('getProductStructuredData — zero reviews', () => {
  it('returns empty reviews array', async () => {
    seedProduct();
    seedReviews([]);
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result.reviews).toEqual([]);
  });

  it('returns zero aggregate', async () => {
    seedProduct();
    seedReviews([]);
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result.aggregate).toEqual({ average: 0, total: 0 });
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getProductStructuredData — error handling', () => {
  it('returns null when productId is empty', async () => {
    const result = await getProductStructuredData('');
    expect(result).toBeNull();
  });

  it('returns null when productId is not a string', async () => {
    const result = await getProductStructuredData(123);
    expect(result).toBeNull();
  });

  it('returns null on DB error', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await getProductStructuredData(PRODUCT_ID);
    expect(result).toBeNull();
  });
});
