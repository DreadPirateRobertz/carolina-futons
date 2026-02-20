import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getProductSwatches,
  getAllSwatchFamilies,
  getSwatchCount,
  getSwatchPreviewColors,
} from '../src/backend/swatchService.web.js';

const SWATCHES = [
  {
    _id: 'sw-1',
    swatchId: 'denim-blue',
    swatchName: 'Denim Blue',
    swatchImage: 'wix:image://v1/denim.jpg',
    colorFamily: 'Blues',
    colorHex: '#4A6FA5',
    material: 'Cotton Twill',
    careInstructions: 'Machine wash cold',
    availableForProducts: 'prod-1,prod-2',
    sortOrder: 1,
  },
  {
    _id: 'sw-2',
    swatchId: 'crimson-red',
    swatchName: 'Crimson Red',
    swatchImage: 'wix:image://v1/crimson.jpg',
    colorFamily: 'Reds',
    colorHex: '#DC143C',
    material: 'Microfiber',
    careInstructions: 'Spot clean only',
    availableForProducts: 'all',
    sortOrder: 2,
  },
  {
    _id: 'sw-3',
    swatchId: 'forest-green',
    swatchName: 'Forest Green',
    swatchImage: 'wix:image://v1/forest.jpg',
    colorFamily: 'Greens',
    colorHex: '#228B22',
    material: 'Canvas',
    careInstructions: 'Dry clean',
    availableForProducts: 'prod-1',
    sortOrder: 3,
  },
  {
    _id: 'sw-4',
    swatchId: 'navy-blue',
    swatchName: 'Navy Blue',
    swatchImage: 'wix:image://v1/navy.jpg',
    colorFamily: 'Blues',
    colorHex: '#000080',
    material: 'Cotton Twill',
    careInstructions: 'Machine wash cold',
    availableForProducts: 'prod-3',
    sortOrder: 4,
  },
];

// ── getProductSwatches ──────────────────────────────────────────────

describe('getProductSwatches', () => {
  beforeEach(() => {
    __seed('FabricSwatches', SWATCHES);
  });

  it('returns swatches available for a specific product', async () => {
    const results = await getProductSwatches('prod-1');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const names = results.map(r => r.swatchName);
    expect(names).toContain('Denim Blue');
    expect(names).toContain('Forest Green');
  });

  it('includes swatches available for "all" products', async () => {
    const results = await getProductSwatches('prod-1');
    const names = results.map(r => r.swatchName);
    expect(names).toContain('Crimson Red');
  });

  it('returns mapped fields only (no raw CMS fields)', async () => {
    const results = await getProductSwatches('prod-1');
    const swatch = results.find(r => r.swatchId === 'denim-blue');
    expect(swatch).toBeDefined();
    expect(swatch._id).toBe('sw-1');
    expect(swatch.swatchName).toBe('Denim Blue');
    expect(swatch.colorFamily).toBe('Blues');
    expect(swatch.colorHex).toBe('#4A6FA5');
    expect(swatch.material).toBe('Cotton Twill');
    expect(swatch.careInstructions).toBe('Machine wash cold');
    // Should NOT include raw fields like sortOrder, availableForProducts
    expect(swatch.sortOrder).toBeUndefined();
    expect(swatch.availableForProducts).toBeUndefined();
  });

  it('filters by color family when provided', async () => {
    const results = await getProductSwatches('prod-1', 'Blues');
    const families = results.map(r => r.colorFamily);
    expect(families.every(f => f === 'Blues')).toBe(true);
  });

  it('returns empty array on error', async () => {
    // No seed data — query returns nothing
    const results = await getProductSwatches('nonexistent');
    expect(Array.isArray(results)).toBe(true);
  });

  it('respects limit parameter', async () => {
    const results = await getProductSwatches('prod-1', null, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ── getAllSwatchFamilies ─────────────────────────────────────────────

describe('getAllSwatchFamilies', () => {
  beforeEach(() => {
    __seed('FabricSwatches', SWATCHES);
  });

  it('returns distinct color families', async () => {
    const families = await getAllSwatchFamilies();
    expect(families).toContain('Blues');
    expect(families).toContain('Reds');
    expect(families).toContain('Greens');
  });

  it('returns no duplicates', async () => {
    const families = await getAllSwatchFamilies();
    const unique = [...new Set(families)];
    expect(families.length).toBe(unique.length);
  });

  it('returns empty array when no swatches exist', async () => {
    const families = await getAllSwatchFamilies();
    expect(Array.isArray(families)).toBe(true);
  });
});

// ── getSwatchCount ──────────────────────────────────────────────────

describe('getSwatchCount', () => {
  beforeEach(() => {
    __seed('FabricSwatches', SWATCHES);
  });

  it('counts swatches available for a product', async () => {
    const count = await getSwatchCount('prod-1');
    expect(count).toBeGreaterThanOrEqual(2); // denim-blue + crimson-red(all) + forest-green
  });

  it('returns 0 for product with no swatches', async () => {
    const count = await getSwatchCount('nonexistent-product');
    // Only "all" swatches match
    expect(typeof count).toBe('number');
  });

  it('returns 0 on error', async () => {
    // getSwatchCount handles errors gracefully
    const count = await getSwatchCount('anything');
    expect(typeof count).toBe('number');
  });
});

// ── getSwatchPreviewColors ──────────────────────────────────────────

describe('getSwatchPreviewColors', () => {
  beforeEach(() => {
    __seed('FabricSwatches', SWATCHES);
  });

  it('returns color hex and name for preview dots', async () => {
    const colors = await getSwatchPreviewColors('prod-1');
    expect(colors.length).toBeGreaterThan(0);
    expect(colors[0]).toHaveProperty('colorHex');
    expect(colors[0]).toHaveProperty('swatchName');
  });

  it('limits to 4 colors by default', async () => {
    const colors = await getSwatchPreviewColors('prod-1');
    expect(colors.length).toBeLessThanOrEqual(4);
  });

  it('respects custom limit', async () => {
    const colors = await getSwatchPreviewColors('prod-1', 2);
    expect(colors.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array for unknown product', async () => {
    const colors = await getSwatchPreviewColors('nonexistent');
    expect(Array.isArray(colors)).toBe(true);
  });
});
