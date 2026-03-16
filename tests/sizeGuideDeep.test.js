import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    hasSome: (field, vals) => { filters[`${field}_hs`] = { type: 'hasSome', field, value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        const fld = f.field || key;
        if (f.type === 'eq') items = items.filter(i => i[fld] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => {
          if (Array.isArray(i[f.field])) return i[f.field].some(v => f.value.includes(v));
          return f.value.includes(i[f.field]);
        });
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/sizeGuide.web.js');
});

const SAMPLE_DIMS = {
  _id: 'd1', productId: 'prod1',
  closedWidth: 80, closedDepth: 36, closedHeight: 34,
  openWidth: 80, openDepth: 54, openHeight: 20,
  shippingWidth: 82, shippingDepth: 14, shippingHeight: 14,
  shippingWeight: 75,
  weight: 65, seatHeight: 18, mattressSize: 'Full',
};

// ── getProductDimensions ──────────────────────────────────────────

describe('getProductDimensions', () => {
  it('returns null for falsy productId', async () => {
    expect(await mod.getProductDimensions(null)).toBeNull();
    expect(await mod.getProductDimensions('')).toBeNull();
  });

  it('returns null when no dimension data exists', async () => {
    __seed('ProductDimensions', []);
    expect(await mod.getProductDimensions('prod1')).toBeNull();
  });

  it('returns dimensions in inches by default', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.getProductDimensions('prod1');
    expect(r.unit).toBe('in');
    expect(r.closed.width).toBe(80);
    expect(r.closed.depth).toBe(36);
    expect(r.open.width).toBe(80);
    expect(r.open.depth).toBe(54);
    expect(r.weight).toBe(65);
    expect(r.seatHeight).toBe(18);
    expect(r.mattressSize).toBe('Full');
  });

  it('converts to cm when unit=cm', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.getProductDimensions('prod1', 'cm');
    expect(r.unit).toBe('cm');
    // 80 * 2.54 = 203.2
    expect(r.closed.width).toBe(203.2);
    // 36 * 2.54 = 91.44 → 91.4
    expect(r.closed.depth).toBe(91.4);
  });

  it('includes shipping dimensions when available', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.getProductDimensions('prod1');
    expect(r.shipping).not.toBeNull();
    expect(r.shipping.width).toBe(82);
    expect(r.shipping.weight).toBe(75);
  });

  it('returns null shipping when no shipping dims', async () => {
    __seed('ProductDimensions', [{
      ...SAMPLE_DIMS, shippingWidth: undefined, shippingDepth: undefined, shippingHeight: undefined,
    }]);
    const r = await mod.getProductDimensions('prod1');
    expect(r.shipping).toBeNull();
  });

  it('returns null for non-number dimension values', async () => {
    __seed('ProductDimensions', [{
      _id: 'd1', productId: 'prod1', closedWidth: 'big',
    }]);
    const r = await mod.getProductDimensions('prod1');
    expect(r.closed.width).toBeNull();
  });
});

// ── checkRoomFit ──────────────────────────────────────────────────

describe('checkRoomFit', () => {
  it('rejects falsy productId', async () => {
    const r = await mod.checkRoomFit(null);
    expect(r.success).toBe(false);
  });

  it('returns error when no dimension data', async () => {
    __seed('ProductDimensions', []);
    const r = await mod.checkRoomFit('prod1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('No dimension data');
  });

  it('checks doorway fit — product fits', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { doorwayWidth: 40, doorwayHeight: 80 });
    expect(r.success).toBe(true);
    const doorCheck = r.checks.find(c => c.check === 'doorway');
    expect(doorCheck.fits).toBe(true);
  });

  it('checks doorway fit — product does not fit', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { doorwayWidth: 20, doorwayHeight: 20 });
    const doorCheck = r.checks.find(c => c.check === 'doorway');
    expect(doorCheck.fits).toBe(false);
  });

  it('detects tight fit on doorway (clearance < 2")', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    // Smallest pass-through dims: sorted [34, 36, 80] → width=34, height=36
    // doorwayWidth=35 → clearance=1 (tight), doorwayHeight=80 → clearance=44
    const r = await mod.checkRoomFit('prod1', { doorwayWidth: 35, doorwayHeight: 80 });
    const doorCheck = r.checks.find(c => c.check === 'doorway');
    expect(doorCheck.fits).toBe(true);
    expect(doorCheck.tight).toBe(true);
  });

  it('checks hallway fit', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { hallwayWidth: 40 });
    const hallCheck = r.checks.find(c => c.check === 'hallway');
    expect(hallCheck.fits).toBe(true);
    expect(hallCheck.clearance).toBe(4); // 40 - min(80,36) = 40-36 = 4
  });

  it('checks hallway does not fit', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { hallwayWidth: 30 });
    const hallCheck = r.checks.find(c => c.check === 'hallway');
    expect(hallCheck.fits).toBe(false);
  });

  it('checks room fit — product fits in open position', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { roomWidth: 100, roomDepth: 100 });
    const roomCheck = r.checks.find(c => c.check === 'room');
    expect(roomCheck.fits).toBe(true);
  });

  it('checks room fit — product too big', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { roomWidth: 50, roomDepth: 40 });
    const roomCheck = r.checks.find(c => c.check === 'room');
    expect(roomCheck.fits).toBe(false);
  });

  it('tries both orientations for room fit', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    // open: 80x54. Room 55x85 doesn't fit in orientation 1 (85-80=5, 55-54=1 fits!)
    const r = await mod.checkRoomFit('prod1', { roomWidth: 55, roomDepth: 85 });
    const roomCheck = r.checks.find(c => c.check === 'room');
    // Orientation 2: 55-54=1, 85-80=5 → fits
    expect(roomCheck.fits).toBe(true);
  });

  it('allFit is true only when all checks pass', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', {
      doorwayWidth: 40, doorwayHeight: 80,
      hallwayWidth: 40,
      roomWidth: 100, roomDepth: 100,
    });
    expect(r.allFit).toBe(true);
  });

  it('anyTight detects tight fits', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', { hallwayWidth: 37 });
    // clearance = 37-36 = 1 < 2 → tight
    const hallCheck = r.checks.find(c => c.check === 'hallway');
    expect(hallCheck.tight).toBe(true);
    expect(r.anyTight).toBe(true);
  });

  it('skips checks when dimensions not provided', async () => {
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.checkRoomFit('prod1', {});
    expect(r.checks).toHaveLength(0);
    expect(r.allFit).toBe(true);
  });
});

// ── getDimensionsByCategory ───────────────────────────────────────

describe('getDimensionsByCategory', () => {
  it('returns empty for falsy category', async () => {
    expect(await mod.getDimensionsByCategory(null)).toEqual([]);
  });

  it('returns empty when no products in category', async () => {
    __seed('Stores/Products', []);
    expect(await mod.getDimensionsByCategory('futons')).toEqual([]);
  });

  it('returns product dimension summaries', async () => {
    __seed('Stores/Products', [
      { _id: 'prod1', name: 'Sofa', slug: 'sofa', collections: ['futons'] },
    ]);
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.getDimensionsByCategory('futons');
    expect(r).toHaveLength(1);
    expect(r[0].hasDimensions).toBe(true);
    expect(r[0].closedWidth).toBe(80);
    expect(r[0].name).toBe('Sofa');
  });

  it('marks products without dimensions', async () => {
    __seed('Stores/Products', [
      { _id: 'prod2', name: 'Pillow', slug: 'pillow', collections: ['accessories'] },
    ]);
    __seed('ProductDimensions', []);
    const r = await mod.getDimensionsByCategory('accessories');
    expect(r[0].hasDimensions).toBe(false);
    expect(r[0].closedWidth).toBeNull();
  });
});

// ── getComparisonTable ────────────────────────────────────────────

describe('getComparisonTable', () => {
  it('rejects falsy productId', async () => {
    const r = await mod.getComparisonTable(null);
    expect(r.success).toBe(false);
  });

  it('returns error when product not found', async () => {
    __seed('Stores/Products', []);
    const r = await mod.getComparisonTable('missing');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('returns error when product has no category', async () => {
    __seed('Stores/Products', [{ _id: 'prod1', name: 'Sofa', collections: [] }]);
    const r = await mod.getComparisonTable('prod1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('no category');
  });

  it('builds comparison table with current product first', async () => {
    __seed('Stores/Products', [
      { _id: 'prod1', name: 'Sofa A', slug: 'sofa-a', collections: ['futons'] },
      { _id: 'prod2', name: 'Sofa B', slug: 'sofa-b', collections: ['futons'] },
    ]);
    __seed('ProductDimensions', [
      { ...SAMPLE_DIMS, productId: 'prod1' },
      { ...SAMPLE_DIMS, productId: 'prod2', closedWidth: 70 },
    ]);
    const r = await mod.getComparisonTable('prod1');
    expect(r.success).toBe(true);
    expect(r.products[0].isCurrent).toBe(true);
    expect(r.products[0].productId).toBe('prod1');
    expect(r.products[1].productId).toBe('prod2');
  });

  it('converts to cm when requested', async () => {
    __seed('Stores/Products', [
      { _id: 'prod1', name: 'Sofa', slug: 'sofa', collections: ['futons'] },
    ]);
    __seed('ProductDimensions', [SAMPLE_DIMS]);
    const r = await mod.getComparisonTable('prod1', 'cm');
    expect(r.unit).toBe('cm');
    expect(r.products[0].closed.width).toBe(203.2);
  });

  it('clamps limit to 1-10', async () => {
    const products = Array.from({ length: 15 }, (_, i) => ({
      _id: `prod${i}`, name: `Sofa ${i}`, slug: `sofa-${i}`, collections: ['futons'],
    }));
    const dims = products.map(p => ({ ...SAMPLE_DIMS, _id: `d${p._id}`, productId: p._id }));
    __seed('Stores/Products', products);
    __seed('ProductDimensions', dims);
    const r = await mod.getComparisonTable('prod0', 'in', 20);
    // 1 current + 10 others max
    expect(r.products.length).toBeLessThanOrEqual(11);
  });
});

// ── convertUnit ───────────────────────────────────────────────────

describe('convertUnit', () => {
  it('converts inches to cm', () => {
    expect(mod.convertUnit(10, 'in', 'cm')).toBe(25.4);
  });

  it('converts cm to inches', () => {
    expect(mod.convertUnit(25.4, 'cm', 'in')).toBe(10);
  });

  it('returns same value when from === to', () => {
    expect(mod.convertUnit(42, 'in', 'in')).toBe(42);
  });

  it('returns 0 for NaN', () => {
    expect(mod.convertUnit(NaN, 'in', 'cm')).toBe(0);
  });

  it('returns 0 for non-number', () => {
    expect(mod.convertUnit('abc', 'in', 'cm')).toBe(0);
  });

  it('returns value for unknown unit pair', () => {
    expect(mod.convertUnit(10, 'ft', 'cm')).toBe(10);
  });
});
