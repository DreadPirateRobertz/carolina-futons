import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getProductDimensions,
  checkRoomFit,
  getDimensionsByCategory,
  convertUnit,
  getComparisonTable,
} from '../src/backend/sizeGuide.web.js';

// ── Seed Data ────────────────────────────────────────────────────

const futonDims = {
  _id: 'dim-001',
  productId: 'prod-frame-001',
  closedWidth: 54,
  closedDepth: 36,
  closedHeight: 34,
  openWidth: 54,
  openDepth: 75,
  openHeight: 18,
  weight: 85,
  seatHeight: 18,
  mattressSize: 'Full',
};

const murphyDims = {
  _id: 'dim-002',
  productId: 'prod-murphy-001',
  closedWidth: 42,
  closedDepth: 24,
  closedHeight: 60,
  openWidth: 42,
  openDepth: 80,
  openHeight: 20,
  weight: 180,
  seatHeight: null,
  mattressSize: 'Queen',
};

const products = [
  {
    _id: 'prod-frame-001', name: 'Eureka Futon Frame', slug: 'eureka',
    collections: ['futon-frames'],
  },
  {
    _id: 'prod-murphy-001', name: 'Sagebrush Murphy Bed', slug: 'sagebrush',
    collections: ['murphy-cabinet-beds'],
  },
  {
    _id: 'prod-no-dims', name: 'New Product', slug: 'new-product',
    collections: ['futon-frames'],
  },
];

beforeEach(() => {
  __seed('ProductDimensions', [futonDims, murphyDims]);
  __seed('Stores/Products', products);
});

// ── getProductDimensions ─────────────────────────────────────────

describe('getProductDimensions', () => {
  it('returns dimension data in inches by default', async () => {
    const dims = await getProductDimensions('prod-frame-001');
    expect(dims).not.toBeNull();
    expect(dims.unit).toBe('in');
    expect(dims.closed.width).toBe(54);
    expect(dims.closed.depth).toBe(36);
    expect(dims.closed.height).toBe(34);
    expect(dims.open.width).toBe(54);
    expect(dims.open.depth).toBe(75);
    expect(dims.open.height).toBe(18);
  });

  it('converts dimensions to centimeters', async () => {
    const dims = await getProductDimensions('prod-frame-001', 'cm');
    expect(dims.unit).toBe('cm');
    expect(dims.closed.width).toBe(Math.round(54 * 2.54 * 10) / 10);
    expect(dims.closed.depth).toBe(Math.round(36 * 2.54 * 10) / 10);
  });

  it('returns weight and mattress size', async () => {
    const dims = await getProductDimensions('prod-frame-001');
    expect(dims.weight).toBe(85);
    expect(dims.mattressSize).toBe('Full');
    expect(dims.seatHeight).toBe(18);
  });

  it('returns null for product without dimension data', async () => {
    const dims = await getProductDimensions('prod-no-dims');
    expect(dims).toBeNull();
  });

  it('returns null for null product ID', async () => {
    const dims = await getProductDimensions(null);
    expect(dims).toBeNull();
  });

  it('returns null for nonexistent product ID', async () => {
    const dims = await getProductDimensions('nonexistent');
    expect(dims).toBeNull();
  });

  it('handles null seatHeight gracefully', async () => {
    const dims = await getProductDimensions('prod-murphy-001');
    expect(dims.seatHeight).toBeNull();
  });

  it('defaults to inches for invalid unit param', async () => {
    const dims = await getProductDimensions('prod-frame-001', 'invalid');
    expect(dims.unit).toBe('in');
    expect(dims.closed.width).toBe(54);
  });
});

// ── checkRoomFit ─────────────────────────────────────────────────

describe('checkRoomFit', () => {
  it('returns success: false for missing product ID', async () => {
    const result = await checkRoomFit(null, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID');
  });

  it('returns success: false when no dimension data exists', async () => {
    const result = await checkRoomFit('prod-no-dims', { roomWidth: 120, roomDepth: 120 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No dimension data');
  });

  it('passes doorway check when product fits', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      doorwayWidth: 40,
      doorwayHeight: 80,
    });
    expect(result.success).toBe(true);
    const doorCheck = result.checks.find(c => c.check === 'doorway');
    expect(doorCheck.fits).toBe(true);
  });

  it('fails doorway check when product too large', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      doorwayWidth: 30,
      doorwayHeight: 30,
    });
    const doorCheck = result.checks.find(c => c.check === 'doorway');
    expect(doorCheck.fits).toBe(false);
  });

  it('flags tight doorway fit (< 2" clearance)', async () => {
    // Futon smallest pass-through: 34x36 (sorted: 34, 36, 54)
    // Doorway 35 wide x 37 high → clearance: 1w, 1h → tight
    const result = await checkRoomFit('prod-frame-001', {
      doorwayWidth: 35,
      doorwayHeight: 37,
    });
    const doorCheck = result.checks.find(c => c.check === 'doorway');
    expect(doorCheck.fits).toBe(true);
    expect(doorCheck.tight).toBe(true);
  });

  it('passes hallway check when product fits', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      hallwayWidth: 40,
    });
    const hallCheck = result.checks.find(c => c.check === 'hallway');
    expect(hallCheck.fits).toBe(true);
    expect(hallCheck.clearance).toBe(4); // 40 - 36 = 4
  });

  it('fails hallway check when too narrow', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      hallwayWidth: 30,
    });
    const hallCheck = result.checks.find(c => c.check === 'hallway');
    expect(hallCheck.fits).toBe(false);
  });

  it('flags tight hallway fit', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      hallwayWidth: 37,
    });
    const hallCheck = result.checks.find(c => c.check === 'hallway');
    expect(hallCheck.fits).toBe(true);
    expect(hallCheck.tight).toBe(true);
    expect(hallCheck.clearance).toBe(1);
  });

  it('passes room fit check for open position', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      roomWidth: 80,
      roomDepth: 100,
    });
    const roomCheck = result.checks.find(c => c.check === 'room');
    expect(roomCheck.fits).toBe(true);
  });

  it('fails room fit when room too small for open position', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      roomWidth: 50,
      roomDepth: 50,
    });
    const roomCheck = result.checks.find(c => c.check === 'room');
    expect(roomCheck.fits).toBe(false);
  });

  it('tries both orientations for room fit', async () => {
    // Open dims: 54w x 75d. Room: 80w x 60d.
    // Orientation 1: 80-54=26 w, 60-75=-15 d → doesn't fit
    // Orientation 2: 80-75=5 w, 60-54=6 d → fits!
    const result = await checkRoomFit('prod-frame-001', {
      roomWidth: 80,
      roomDepth: 60,
    });
    const roomCheck = result.checks.find(c => c.check === 'room');
    expect(roomCheck.fits).toBe(true);
  });

  it('runs all checks and reports allFit', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      doorwayWidth: 40,
      doorwayHeight: 80,
      hallwayWidth: 40,
      roomWidth: 120,
      roomDepth: 120,
    });
    expect(result.success).toBe(true);
    expect(result.allFit).toBe(true);
    expect(result.checks).toHaveLength(3);
  });

  it('reports allFit false when any check fails', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      doorwayWidth: 40,
      doorwayHeight: 80,
      hallwayWidth: 30, // too narrow
      roomWidth: 120,
      roomDepth: 120,
    });
    expect(result.allFit).toBe(false);
  });

  it('reports anyTight when one check is tight', async () => {
    const result = await checkRoomFit('prod-frame-001', {
      hallwayWidth: 37, // tight: clearance = 1
      roomWidth: 120,
      roomDepth: 120,
    });
    expect(result.anyTight).toBe(true);
  });

  it('skips checks when dimensions not provided', async () => {
    const result = await checkRoomFit('prod-frame-001', {});
    expect(result.success).toBe(true);
    expect(result.checks).toHaveLength(0);
    expect(result.allFit).toBe(true);
  });
});

// ── getDimensionsByCategory ──────────────────────────────────────

describe('getDimensionsByCategory', () => {
  it('returns dimension summaries for category products', async () => {
    const dims = await getDimensionsByCategory('futon-frames');
    expect(dims).toHaveLength(2); // Eureka + New Product
    const eureka = dims.find(d => d.productId === 'prod-frame-001');
    expect(eureka.hasDimensions).toBe(true);
    expect(eureka.closedWidth).toBe(54);
    expect(eureka.name).toBe('Eureka Futon Frame');
  });

  it('marks products without dimension data', async () => {
    const dims = await getDimensionsByCategory('futon-frames');
    const noDims = dims.find(d => d.productId === 'prod-no-dims');
    expect(noDims.hasDimensions).toBe(false);
    expect(noDims.closedWidth).toBeNull();
  });

  it('returns empty array for empty category', async () => {
    const dims = await getDimensionsByCategory('nonexistent');
    expect(dims).toEqual([]);
  });

  it('returns empty array for null category', async () => {
    const dims = await getDimensionsByCategory(null);
    expect(dims).toEqual([]);
  });
});

// ── convertUnit ──────────────────────────────────────────────────

describe('convertUnit', () => {
  it('converts inches to centimeters', async () => {
    const result = await convertUnit(10, 'in', 'cm');
    expect(result).toBe(25.4);
  });

  it('converts centimeters to inches', async () => {
    const result = await convertUnit(25.4, 'cm', 'in');
    expect(result).toBe(10);
  });

  it('returns same value when units match', async () => {
    const result = await convertUnit(42, 'in', 'in');
    expect(result).toBe(42);
  });

  it('returns 0 for non-numeric input', async () => {
    const result = await convertUnit('abc', 'in', 'cm');
    expect(result).toBe(0);
  });

  it('returns 0 for NaN input', async () => {
    const result = await convertUnit(NaN, 'in', 'cm');
    expect(result).toBe(0);
  });

  it('rounds to 1 decimal place', async () => {
    const result = await convertUnit(1, 'in', 'cm');
    expect(result).toBe(2.5); // 2.54 rounded to 1 decimal
  });
});

// ── getComparisonTable ───────────────────────────────────────────

describe('getComparisonTable', () => {
  it('returns comparison table with current product first', async () => {
    const result = await getComparisonTable('prod-frame-001');
    expect(result.success).toBe(true);
    expect(result.category).toBe('futon-frames');
    expect(result.unit).toBe('in');
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.products[0].productId).toBe('prod-frame-001');
    expect(result.products[0].isCurrent).toBe(true);
    expect(result.products[0].name).toBe('Eureka Futon Frame');
  });

  it('includes similar products with dimension data', async () => {
    // prod-no-dims is in futon-frames but has no dimensions — should be excluded from others
    const result = await getComparisonTable('prod-frame-001');
    expect(result.success).toBe(true);
    // Only prod-frame-001 has dimensions in futon-frames category
    const others = result.products.filter(p => !p.isCurrent);
    for (const p of others) {
      expect(p.closed).not.toBeNull();
    }
  });

  it('returns dimension data for current product', async () => {
    const result = await getComparisonTable('prod-frame-001');
    const current = result.products[0];
    expect(current.closed.width).toBe(54);
    expect(current.closed.depth).toBe(36);
    expect(current.closed.height).toBe(34);
    expect(current.open.width).toBe(54);
    expect(current.open.depth).toBe(75);
    expect(current.weight).toBe(85);
    expect(current.mattressSize).toBe('Full');
  });

  it('converts dimensions to centimeters', async () => {
    const result = await getComparisonTable('prod-frame-001', 'cm');
    expect(result.unit).toBe('cm');
    const current = result.products[0];
    expect(current.closed.width).toBe(Math.round(54 * 2.54 * 10) / 10);
  });

  it('returns success: false for null product ID', async () => {
    const result = await getComparisonTable(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID');
  });

  it('returns success: false for nonexistent product', async () => {
    const result = await getComparisonTable('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns success: false when product has no category', async () => {
    __seed('Stores/Products', [
      ...products,
      { _id: 'no-cat', name: 'No Category', slug: 'no-cat', collections: [] },
    ]);
    const result = await getComparisonTable('no-cat');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no category');
  });

  it('respects limit parameter', async () => {
    // Add more products with dimensions to the same category
    const extraProducts = [];
    const extraDims = [];
    for (let i = 0; i < 8; i++) {
      extraProducts.push({
        _id: `prod-extra-${i}`, name: `Extra Frame ${i}`, slug: `extra-${i}`,
        collections: ['futon-frames'],
      });
      extraDims.push({
        _id: `dim-extra-${i}`, productId: `prod-extra-${i}`,
        closedWidth: 50 + i, closedDepth: 35, closedHeight: 33,
        openWidth: 50 + i, openDepth: 72, openHeight: 16,
        weight: 70 + i, mattressSize: 'Full',
      });
    }
    __seed('Stores/Products', [...products, ...extraProducts]);
    __seed('ProductDimensions', [futonDims, murphyDims, ...extraDims]);

    const result = await getComparisonTable('prod-frame-001', 'in', 3);
    expect(result.success).toBe(true);
    // 1 current + up to 3 others
    expect(result.products.length).toBeLessThanOrEqual(4);
    expect(result.products[0].isCurrent).toBe(true);
  });

  it('marks non-current products correctly', async () => {
    const result = await getComparisonTable('prod-murphy-001');
    expect(result.success).toBe(true);
    expect(result.products[0].isCurrent).toBe(true);
    expect(result.products[0].productId).toBe('prod-murphy-001');
    for (let i = 1; i < result.products.length; i++) {
      expect(result.products[i].isCurrent).toBe(false);
    }
  });
});
