import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __setQueryError, __reset } from './__mocks__/wix-data.js';
import {
  getProductDimensions,
  checkRoomFit,
  getDimensionsByCategory,
  getComparisonTable,
  convertUnit,
} from '../src/backend/sizeGuide.web.js';

// ── Fixtures ────────────────────────────────────────────────────

const baseDims = {
  _id: 'dim-deep-1',
  productId: 'prod-deep-1',
  closedWidth: 60,
  closedDepth: 30,
  closedHeight: 32,
  openWidth: 60,
  openDepth: 72,
  openHeight: 16,
  weight: 70,
  seatHeight: 17,
  mattressSize: 'Full',
};

const dimsWithPartialShipping = {
  _id: 'dim-deep-2',
  productId: 'prod-deep-2',
  closedWidth: 48,
  closedDepth: 28,
  closedHeight: 30,
  openWidth: 48,
  openDepth: 70,
  openHeight: 15,
  weight: 55,
  seatHeight: null,
  mattressSize: null,
  shippingWidth: 50, // only width present — hasShipping should still be true
};

const dimsWithStringValues = {
  _id: 'dim-deep-3',
  productId: 'prod-deep-3',
  closedWidth: 'wide',
  closedDepth: undefined,
  closedHeight: null,
  openWidth: 'big',
  openDepth: false,
  openHeight: 0, // valid number (0)
  weight: null,
  seatHeight: 'low',
  mattressSize: null,
};

const products = [
  { _id: 'prod-deep-1', name: 'Deep Futon', slug: 'deep-futon', collections: ['futon-frames'] },
  { _id: 'prod-deep-2', name: 'Compact Futon', slug: 'compact-futon', collections: ['futon-frames'] },
  { _id: 'prod-deep-3', name: 'String Futon', slug: 'string-futon', collections: ['futon-frames'] },
  { _id: 'prod-deep-no-dims', name: 'No Dims', slug: 'no-dims', collections: ['futon-frames'] },
  { _id: 'prod-deep-solo', name: 'Solo', slug: 'solo', collections: ['solo-cat'] },
  { _id: 'prod-no-cat', name: 'No Cat', slug: 'no-cat', collections: [] },
  { _id: 'prod-no-collections', name: 'No Collections', slug: 'no-collections' },
];

const soloDims = {
  _id: 'dim-deep-solo',
  productId: 'prod-deep-solo',
  closedWidth: 40,
  closedDepth: 25,
  closedHeight: 28,
  openWidth: 40,
  openDepth: 60,
  openHeight: 14,
  weight: 45,
  seatHeight: 15,
  mattressSize: 'Twin',
};

beforeEach(() => {
  __reset();
  __seed('ProductDimensions', [baseDims, dimsWithPartialShipping, dimsWithStringValues, soloDims]);
  __seed('Stores/Products', products);
});

// ── getProductDimensions — untested branches ─────────────────────

describe('getProductDimensions (deepen)', () => {
  it('cm conversion rounds to 1 decimal for all closed/open fields', async () => {
    const r = await getProductDimensions('prod-deep-1', 'cm');
    // 60 * 2.54 = 152.4
    expect(r.closed.width).toBe(152.4);
    // 30 * 2.54 = 76.2
    expect(r.closed.depth).toBe(76.2);
    // 32 * 2.54 = 81.28 → 81.3
    expect(r.closed.height).toBe(81.3);
    // open: 72 * 2.54 = 182.88 → 182.9
    expect(r.open.depth).toBe(182.9);
    // 16 * 2.54 = 40.64 → 40.6
    expect(r.open.height).toBe(40.6);
  });

  it('cm conversion applies to seatHeight', async () => {
    const r = await getProductDimensions('prod-deep-1', 'cm');
    // 17 * 2.54 = 43.18 → 43.2
    expect(r.seatHeight).toBe(43.2);
  });

  it('shipping present when only one shipping field is a number', async () => {
    const r = await getProductDimensions('prod-deep-2');
    expect(r.shipping).not.toBeNull();
    expect(r.shipping.width).toBe(50);
    // depth and height not set → convert returns null
    expect(r.shipping.depth).toBeNull();
    expect(r.shipping.height).toBeNull();
    // shippingWeight not set → null
    expect(r.shipping.weight).toBeNull();
  });

  it('non-number dimension values return null from convert()', async () => {
    const r = await getProductDimensions('prod-deep-3');
    expect(r.closed.width).toBeNull();  // 'wide'
    expect(r.closed.depth).toBeNull();  // undefined
    expect(r.closed.height).toBeNull(); // null
    expect(r.open.width).toBeNull();    // 'big'
    expect(r.open.depth).toBeNull();    // false
    expect(r.open.height).toBe(0);      // 0 is a valid number
  });

  it('non-number seatHeight returns null', async () => {
    const r = await getProductDimensions('prod-deep-3');
    expect(r.seatHeight).toBeNull(); // 'low' is not a number
  });

  it('mattressSize returns null when field is missing', async () => {
    const r = await getProductDimensions('prod-deep-2');
    expect(r.mattressSize).toBeNull();
  });

  it('returns null for empty string productId', async () => {
    expect(await getProductDimensions('')).toBeNull();
  });

  it('returns null for undefined productId', async () => {
    expect(await getProductDimensions(undefined)).toBeNull();
  });

  it('cm conversion on shipping dimensions', async () => {
    const r = await getProductDimensions('prod-deep-2', 'cm');
    // 50 * 2.54 = 127.0
    expect(r.shipping.width).toBe(127);
  });

  it('weight field returns null when not present', async () => {
    const r = await getProductDimensions('prod-deep-3');
    expect(r.weight).toBeNull();
  });
});

// ── checkRoomFit — untested branches ─────────────────────────────

describe('checkRoomFit (deepen)', () => {
  it('product rotated to fit doorway via getSmallestPassThroughDims', async () => {
    // baseDims closed: W=60, D=30, H=32 → sorted [30, 32, 60]
    // smallest pass-through: width=30, height=32
    // doorway 33 wide x 35 high → clearance 3w, 3h → fits, not tight
    const r = await checkRoomFit('prod-deep-1', {
      doorwayWidth: 33,
      doorwayHeight: 35,
    });
    const dc = r.checks.find(c => c.check === 'doorway');
    expect(dc.fits).toBe(true);
    expect(dc.tight).toBe(false);
    expect(dc.clearanceWidth).toBe(3);
    expect(dc.clearanceHeight).toBe(3);
  });

  it('tight fit threshold — exactly 2" clearance is NOT tight', async () => {
    // sorted [30, 32, 60] → width=30, height=32
    // doorway 32 wide x 34 high → clearance 2w, 2h → fits, NOT tight (threshold < 2)
    const r = await checkRoomFit('prod-deep-1', {
      doorwayWidth: 32,
      doorwayHeight: 34,
    });
    const dc = r.checks.find(c => c.check === 'doorway');
    expect(dc.fits).toBe(true);
    expect(dc.tight).toBe(false);
  });

  it('tight fit — clearance just under 2" on height only', async () => {
    // sorted [30, 32, 60] → width=30, height=32
    // doorway 40 wide x 33 high → clearance 10w, 1h → tight (height < 2)
    const r = await checkRoomFit('prod-deep-1', {
      doorwayWidth: 40,
      doorwayHeight: 33,
    });
    const dc = r.checks.find(c => c.check === 'doorway');
    expect(dc.fits).toBe(true);
    expect(dc.tight).toBe(true);
    expect(dc.clearanceHeight).toBe(1);
  });

  it('both room orientations fail — returns fit1 (first orientation)', async () => {
    // open: W=60, D=72. Room: 50x50.
    // fit1: 50-60=-10, 50-72=-22 → no
    // fit2: 50-72=-22, 50-60=-10 → no
    // defaults to fit1
    const r = await checkRoomFit('prod-deep-1', {
      roomWidth: 50,
      roomDepth: 50,
    });
    const rc = r.checks.find(c => c.check === 'room');
    expect(rc.fits).toBe(false);
    expect(rc.clearanceWidth).toBe(-10); // fit1 values
    expect(rc.clearanceDepth).toBe(-22);
  });

  it('orientation 2 chosen when orientation 1 fails but 2 fits', async () => {
    // open: W=60, D=72. Room: 75x65.
    // fit1: 75-60=15, 65-72=-7 → no
    // fit2: 75-72=3, 65-60=5 → yes!
    const r = await checkRoomFit('prod-deep-1', {
      roomWidth: 75,
      roomDepth: 65,
    });
    const rc = r.checks.find(c => c.check === 'room');
    expect(rc.fits).toBe(true);
    expect(rc.clearanceWidth).toBe(3);
    expect(rc.clearanceDepth).toBe(5);
  });

  it('room fit tight when clearance < 2 in best orientation', async () => {
    // open: W=60, D=72. Room: 73x61.
    // fit1: 73-60=13, 61-72=-11 → no
    // fit2: 73-72=1, 61-60=1 → yes, but tight (both < 2)
    const r = await checkRoomFit('prod-deep-1', {
      roomWidth: 73,
      roomDepth: 61,
    });
    const rc = r.checks.find(c => c.check === 'room');
    expect(rc.fits).toBe(true);
    expect(rc.tight).toBe(true);
  });

  it('hallway check only — no doorway or room dims', async () => {
    const r = await checkRoomFit('prod-deep-1', {
      hallwayWidth: 35,
    });
    expect(r.success).toBe(true);
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0].check).toBe('hallway');
    // min(60,30) = 30. clearance = 35-30 = 5
    expect(r.checks[0].clearance).toBe(5);
    expect(r.checks[0].fits).toBe(true);
  });

  it('partial room dims — only roomWidth given (no roomDepth) skips room check', async () => {
    const r = await checkRoomFit('prod-deep-1', {
      roomWidth: 100,
    });
    expect(r.success).toBe(true);
    const rc = r.checks.find(c => c.check === 'room');
    expect(rc).toBeUndefined();
  });

  it('partial room dims — only roomDepth given skips room check', async () => {
    const r = await checkRoomFit('prod-deep-1', {
      roomDepth: 100,
    });
    const rc = r.checks.find(c => c.check === 'room');
    expect(rc).toBeUndefined();
  });

  it('doorway check requires both doorwayWidth and doorwayHeight', async () => {
    const r = await checkRoomFit('prod-deep-1', {
      doorwayWidth: 40,
      // doorwayHeight missing
    });
    const dc = r.checks.find(c => c.check === 'doorway');
    expect(dc).toBeUndefined();
  });

  it('hallway tight at 0 clearance', async () => {
    // min(60,30) = 30. hallwayWidth=30 → clearance=0, fits, tight
    const r = await checkRoomFit('prod-deep-1', { hallwayWidth: 30 });
    const hc = r.checks.find(c => c.check === 'hallway');
    expect(hc.fits).toBe(true);
    expect(hc.tight).toBe(true);
    expect(hc.clearance).toBe(0);
  });

  it('default roomDims is empty object when omitted', async () => {
    const r = await checkRoomFit('prod-deep-1');
    expect(r.success).toBe(true);
    expect(r.checks).toHaveLength(0);
  });

  it('returns error message on wix-data failure', async () => {
    __setQueryError('ProductDimensions', new Error('DB down'));
    const r = await checkRoomFit('prod-deep-1', { hallwayWidth: 40 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Failed to check room fit');
  });
});

// ── getDimensionsByCategory — untested branches ─────────────────

describe('getDimensionsByCategory (deepen)', () => {
  it('returns empty string category as empty array', async () => {
    const r = await getDimensionsByCategory('');
    expect(r).toEqual([]);
  });

  it('products without dimensions have all null dimension fields', async () => {
    const r = await getDimensionsByCategory('futon-frames');
    const noDims = r.find(d => d.productId === 'prod-deep-no-dims');
    expect(noDims.hasDimensions).toBe(false);
    expect(noDims.closedWidth).toBeNull();
    expect(noDims.closedDepth).toBeNull();
    expect(noDims.closedHeight).toBeNull();
    expect(noDims.openWidth).toBeNull();
    expect(noDims.openDepth).toBeNull();
    expect(noDims.openHeight).toBeNull();
    expect(noDims.weight).toBeNull();
    expect(noDims.mattressSize).toBeNull();
  });

  it('returns slug and name for each product', async () => {
    const r = await getDimensionsByCategory('futon-frames');
    const item = r.find(d => d.productId === 'prod-deep-1');
    expect(item.slug).toBe('deep-futon');
    expect(item.name).toBe('Deep Futon');
  });

  it('returns empty on wix-data query error', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const r = await getDimensionsByCategory('futon-frames');
    expect(r).toEqual([]);
  });
});

// ── getComparisonTable — untested branches ───────────────────────

describe('getComparisonTable (deepen)', () => {
  it('cm unit on comparison table converts all dims', async () => {
    const r = await getComparisonTable('prod-deep-1', 'cm');
    expect(r.unit).toBe('cm');
    const cur = r.products[0];
    // 60 * 2.54 = 152.4
    expect(cur.closed.width).toBe(152.4);
    // 30 * 2.54 = 76.2
    expect(cur.closed.depth).toBe(76.2);
    // open: 72 * 2.54 = 182.88 → 182.9
    expect(cur.open.depth).toBe(182.9);
  });

  it('limit clamped to minimum 1', async () => {
    const r = await getComparisonTable('prod-deep-1', 'in', 0);
    expect(r.success).toBe(true);
    // limit clamped to 1 → at most 1 other product beyond current
    const others = r.products.filter(p => !p.isCurrent);
    expect(others.length).toBeLessThanOrEqual(1);
  });

  it('limit clamped to maximum 10', async () => {
    // Create 15 products in same category with dims
    const manyProducts = [];
    const manyDims = [];
    for (let i = 0; i < 15; i++) {
      manyProducts.push({
        _id: `prod-many-${i}`, name: `Many ${i}`, slug: `many-${i}`,
        collections: ['many-cat'],
      });
      manyDims.push({
        _id: `dim-many-${i}`, productId: `prod-many-${i}`,
        closedWidth: 50 + i, closedDepth: 30, closedHeight: 30,
        openWidth: 50 + i, openDepth: 70, openHeight: 15,
        weight: 60, mattressSize: 'Full',
      });
    }
    __seed('Stores/Products', [...products, ...manyProducts]);
    __seed('ProductDimensions', [baseDims, dimsWithPartialShipping, dimsWithStringValues, soloDims, ...manyDims]);

    const r = await getComparisonTable('prod-many-0', 'in', 50);
    expect(r.success).toBe(true);
    // 1 current + max 10 others
    expect(r.products.length).toBeLessThanOrEqual(11);
  });

  it('product not found returns error', async () => {
    const r = await getComparisonTable('nonexistent-xyz');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('product with no category (empty collections) returns error', async () => {
    const r = await getComparisonTable('prod-no-cat');
    expect(r.success).toBe(false);
    expect(r.error).toContain('no category');
  });

  it('product with undefined collections returns error', async () => {
    const r = await getComparisonTable('prod-no-collections');
    expect(r.success).toBe(false);
    expect(r.error).toContain('no category');
  });

  it('no other products with dimensions — only current product returned', async () => {
    // solo-cat has only prod-deep-solo and its dims
    const r = await getComparisonTable('prod-deep-solo');
    expect(r.success).toBe(true);
    expect(r.products).toHaveLength(1);
    expect(r.products[0].isCurrent).toBe(true);
    expect(r.products[0].productId).toBe('prod-deep-solo');
  });

  it('current product without dims has null closed/open', async () => {
    // prod-deep-no-dims is in futon-frames but has no ProductDimensions entry
    const r = await getComparisonTable('prod-deep-no-dims');
    expect(r.success).toBe(true);
    const cur = r.products[0];
    expect(cur.closed).toBeNull();
    expect(cur.open).toBeNull();
  });

  it('returns error on wix-data failure', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const r = await getComparisonTable('prod-deep-1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Failed to build comparison table');
  });

  it('invalid unit defaults to in', async () => {
    const r = await getComparisonTable('prod-deep-1', 'meters');
    expect(r.unit).toBe('in');
    expect(r.products[0].closed.width).toBe(60);
  });
});

// ── convertUnit — untested branches ─────────────────────────────

describe('convertUnit (deepen)', () => {
  it('cm to in conversion', async () => {
    // 76.2 cm / 2.54 = 30
    const r = await convertUnit(76.2, 'cm', 'in');
    expect(r).toBe(30);
  });

  it('cm to in with rounding', async () => {
    // 10 cm / 2.54 = 3.937... → 3.9
    const r = await convertUnit(10, 'cm', 'in');
    expect(r).toBe(3.9);
  });

  it('NaN returns 0', async () => {
    expect(await convertUnit(NaN, 'cm', 'in')).toBe(0);
  });

  it('same unit from === to returns value unchanged', async () => {
    expect(await convertUnit(42.7, 'cm', 'cm')).toBe(42.7);
    expect(await convertUnit(99, 'in', 'in')).toBe(99);
  });

  it('invalid unit names return value unchanged', async () => {
    expect(await convertUnit(10, 'ft', 'mm')).toBe(10);
    expect(await convertUnit(10, 'foo', 'bar')).toBe(10);
  });

  it('null input returns 0', async () => {
    expect(await convertUnit(null, 'in', 'cm')).toBe(0);
  });

  it('undefined input returns 0', async () => {
    expect(await convertUnit(undefined, 'in', 'cm')).toBe(0);
  });

  it('zero converts correctly', async () => {
    expect(await convertUnit(0, 'in', 'cm')).toBe(0);
    expect(await convertUnit(0, 'cm', 'in')).toBe(0);
  });

  it('negative values convert correctly', async () => {
    // -10 in = -25.4 cm
    expect(await convertUnit(-10, 'in', 'cm')).toBe(-25.4);
  });
});
