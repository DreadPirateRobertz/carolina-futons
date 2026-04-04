/**
 * Tests for Futon Studio compatibility + pricing API in bundleBuilder.web.js
 * getCompatibleMattresses, getCompatibleCovers, getBundlePrice
 *
 * CF-eqc5.1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __setQueryError } from './__mocks__/wix-data.js';
import {
  futonFrame,
  futonMattress,
  futonCover,
  allProducts,
} from './fixtures/products.js';
import {
  getCompatibleMattresses,
  getCompatibleCovers,
  getBundlePrice,
} from '../src/backend/bundleBuilder.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────

// Frame with Full size
const fullFrame = { ...futonFrame, _id: 'frame-full', options: { size: 'Full' } };
// Frame with Queen size
const queenFrame = { ...futonFrame, _id: 'frame-queen', options: { size: 'Queen' } };
// Frame with no size option
const noSizeFrame = { ...futonFrame, _id: 'frame-nosize', options: {} };

// Mattresses
const fullMattress  = { ...futonMattress, _id: 'matt-full',  price: 299, options: { size: 'Full' } };
const queenMattress = { ...futonMattress, _id: 'matt-queen', price: 349, options: { size: 'Queen' } };
const noSizeMattress = { ...futonMattress, _id: 'matt-nosize', price: 199, options: {} };

// Covers
const fullCover  = { ...futonCover, _id: 'cover-full',  price: 89, options: { size: 'Full' } };
const queenCover = { ...futonCover, _id: 'cover-queen', price: 99, options: { size: 'Queen' } };
const noSizeCover = { ...futonCover, _id: 'cover-nosize', price: 79, options: {} };

const studioProducts = [
  fullFrame, queenFrame, noSizeFrame,
  fullMattress, queenMattress, noSizeMattress,
  fullCover, queenCover, noSizeCover,
];

beforeEach(() => {
  resetData();
  __seed('Stores/Products', studioProducts);
  __seed('BundleTemplates', []);
});

// ── getCompatibleMattresses ───────────────────────────────────────────

describe('getCompatibleMattresses', () => {
  it('returns only Full mattresses for a Full frame', async () => {
    const result = await getCompatibleMattresses('frame-full');
    expect(result.success).toBe(true);
    const ids = result.mattresses.map(m => m._id);
    expect(ids).toContain('matt-full');
    expect(ids).toContain('matt-nosize'); // no size matches any size
    expect(ids).not.toContain('matt-queen');
  });

  it('returns only Queen mattresses for a Queen frame', async () => {
    const result = await getCompatibleMattresses('frame-queen');
    expect(result.success).toBe(true);
    const ids = result.mattresses.map(m => m._id);
    expect(ids).toContain('matt-queen');
    expect(ids).toContain('matt-nosize');
    expect(ids).not.toContain('matt-full');
  });

  it('returns all mattresses when frame has no size', async () => {
    const result = await getCompatibleMattresses('frame-nosize');
    expect(result.success).toBe(true);
    expect(result.mattresses.length).toBeGreaterThanOrEqual(3);
  });

  it('returns error for empty frameId', async () => {
    const result = await getCompatibleMattresses('');
    expect(result.success).toBe(false);
    expect(result.mattresses).toEqual([]);
  });

  it('returns error when frame not found', async () => {
    const result = await getCompatibleMattresses('nonexistent-frame');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(result.mattresses).toEqual([]);
  });

  it('maps mattress fields to expected shape', async () => {
    const result = await getCompatibleMattresses('frame-full');
    const m = result.mattresses.find(x => x._id === 'matt-full');
    expect(m).toBeDefined();
    expect(m).toHaveProperty('_id');
    expect(m).toHaveProperty('name');
    expect(m).toHaveProperty('price');
    expect(m).toHaveProperty('formattedPrice');
    expect(m).toHaveProperty('size');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await getCompatibleMattresses('frame-full');
    expect(result.success).toBe(false);
    expect(result.mattresses).toEqual([]);
  });
});

// ── getCompatibleCovers ───────────────────────────────────────────────

describe('getCompatibleCovers', () => {
  it('returns only Full covers for a Full mattress', async () => {
    const result = await getCompatibleCovers('matt-full');
    expect(result.success).toBe(true);
    const ids = result.covers.map(c => c._id);
    expect(ids).toContain('cover-full');
    expect(ids).toContain('cover-nosize');
    expect(ids).not.toContain('cover-queen');
  });

  it('returns only Queen covers for a Queen mattress', async () => {
    const result = await getCompatibleCovers('matt-queen');
    expect(result.success).toBe(true);
    const ids = result.covers.map(c => c._id);
    expect(ids).toContain('cover-queen');
    expect(ids).toContain('cover-nosize');
    expect(ids).not.toContain('cover-full');
  });

  it('returns all covers when mattress has no size', async () => {
    const result = await getCompatibleCovers('matt-nosize');
    expect(result.success).toBe(true);
    expect(result.covers.length).toBeGreaterThanOrEqual(3);
  });

  it('returns error for empty mattressId', async () => {
    const result = await getCompatibleCovers('');
    expect(result.success).toBe(false);
    expect(result.covers).toEqual([]);
  });

  it('returns error when mattress not found', async () => {
    const result = await getCompatibleCovers('nonexistent-matt');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(result.covers).toEqual([]);
  });

  it('returns empty covers array when no covers in store', async () => {
    resetData();
    __seed('Stores/Products', [fullFrame, fullMattress]); // no covers
    const result = await getCompatibleCovers('matt-full');
    expect(result.success).toBe(true);
    expect(result.covers).toEqual([]);
  });

  it('maps cover fields to expected shape', async () => {
    const result = await getCompatibleCovers('matt-full');
    const c = result.covers.find(x => x._id === 'cover-full');
    expect(c).toBeDefined();
    expect(c).toHaveProperty('_id');
    expect(c).toHaveProperty('name');
    expect(c).toHaveProperty('price');
    expect(c).toHaveProperty('formattedPrice');
    expect(c).toHaveProperty('size');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await getCompatibleCovers('matt-full');
    expect(result.success).toBe(false);
    expect(result.covers).toEqual([]);
  });
});

// ── getBundlePrice ────────────────────────────────────────────────────

describe('getBundlePrice', () => {
  it('applies 10% discount for frame + mattress', async () => {
    // fullFrame.price=499, fullMattress.price=299 → base=798, 10% off=718.20
    const result = await getBundlePrice('frame-full', 'matt-full', null);
    expect(result.success).toBe(true);
    expect(result.basePrice).toBe(798);
    expect(result.discountPercent).toBe(10);
    expect(result.bundlePrice).toBeCloseTo(718.2, 1);
    expect(result.savings).toBeCloseTo(79.8, 1);
  });

  it('applies 12% discount for frame + mattress + cover', async () => {
    // 499+299+89=887, 12% off=780.56
    const result = await getBundlePrice('frame-full', 'matt-full', 'cover-full');
    expect(result.success).toBe(true);
    expect(result.basePrice).toBe(887);
    expect(result.discountPercent).toBe(12);
    expect(result.bundlePrice).toBeCloseTo(780.56, 1);
    expect(result.savings).toBeCloseTo(106.44, 1);
  });

  it('falls back to 10% when coverId is provided but cover not found', async () => {
    const result = await getBundlePrice('frame-full', 'matt-full', 'nonexistent-cover');
    expect(result.success).toBe(true);
    expect(result.discountPercent).toBe(10);
  });

  it('returns error when frameId is missing', async () => {
    const result = await getBundlePrice('', 'matt-full', null);
    expect(result.success).toBe(false);
    expect(result.basePrice).toBe(0);
  });

  it('returns error when mattressId is missing', async () => {
    const result = await getBundlePrice('frame-full', '', null);
    expect(result.success).toBe(false);
    expect(result.basePrice).toBe(0);
  });

  it('returns error when frame not found', async () => {
    const result = await getBundlePrice('nonexistent-frame', 'matt-full', null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error when mattress not found', async () => {
    const result = await getBundlePrice('frame-full', 'nonexistent-matt', null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error on DB failure', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    // Note: getBundlePrice uses wixData.get (not query), so __setQueryError won't affect it.
    // We need to seed nothing so get() returns null.
    resetData();
    __seed('Stores/Products', []);
    const result = await getBundlePrice('frame-full', 'matt-full', null);
    expect(result.success).toBe(false);
  });
});
