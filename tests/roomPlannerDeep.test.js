import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _mockMember = { _id: 'member1' };
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: async () => _mockMember },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
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
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _mockMember = { _id: 'member1' };
  vi.resetModules();
  mod = await import('../src/backend/roomPlanner.web.js');
});

// ── createRoomLayout ──────────────────────────────────────────────

describe('createRoomLayout', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.createRoomLayout({ name: 'Test', roomWidth: 120, roomLength: 120 });
    expect(r.success).toBe(false);
  });

  it('rejects missing name', async () => {
    const r = await mod.createRoomLayout({ name: '', roomWidth: 120, roomLength: 120 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('name');
  });

  it('creates layout with valid data', async () => {
    const r = await mod.createRoomLayout({ name: 'Living Room', roomWidth: 180, roomLength: 240 });
    expect(r.success).toBe(true);
    expect(r.id).toBeTruthy();
    expect(r.shareId).toBeTruthy();
    expect(r.shareId.length).toBe(8);
  });

  it('clamps room dimensions to 24-600', async () => {
    const r = await mod.createRoomLayout({ name: 'Tiny Room', roomWidth: 10, roomLength: 700 });
    expect(r.success).toBe(true);
    const layout = _collections['RoomLayouts'][0];
    expect(layout.roomWidth).toBe(24);
    expect(layout.roomLength).toBe(600);
  });

  it('defaults roomShape to rectangular for invalid value', async () => {
    const r = await mod.createRoomLayout({ name: 'Room', roomWidth: 120, roomLength: 120, roomShape: 'triangle' });
    expect(r.success).toBe(true);
    expect(_collections['RoomLayouts'][0].roomShape).toBe('rectangular');
  });

  it('accepts valid room shapes', async () => {
    for (const shape of ['rectangular', 'l-shaped', 'custom']) {
      _collections = {};
      await mod.createRoomLayout({ name: 'Room', roomWidth: 120, roomLength: 120, roomShape: shape });
      expect(_collections['RoomLayouts'][0].roomShape).toBe(shape);
    }
  });

  it('initializes with empty products and isPublic=false', async () => {
    await mod.createRoomLayout({ name: 'Room', roomWidth: 120, roomLength: 120 });
    const layout = _collections['RoomLayouts'][0];
    expect(layout.products).toBe('[]');
    expect(layout.isPublic).toBe(false);
  });
});

// ── addProductToLayout ────────────────────────────────────────────

describe('addProductToLayout', () => {
  const seedLayout = () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', memberId: 'member1', name: 'Test',
      roomWidth: 200, roomLength: 200, products: '[]',
    }]);
  };

  it('rejects invalid layout ID', async () => {
    const r = await mod.addProductToLayout(null, { productType: 'futon-frame-full', x: 0, y: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects layout not owned by user', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'other-member', products: '[]' }]);
    const r = await mod.addProductToLayout('lay1', { productType: 'futon-frame-full', x: 0, y: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects unknown product type', async () => {
    seedLayout();
    const r = await mod.addProductToLayout('lay1', { productType: 'unknown', x: 0, y: 0 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Unknown product');
  });

  it('adds product to layout', async () => {
    seedLayout();
    const r = await mod.addProductToLayout('lay1', { productType: 'futon-frame-full', x: 10, y: 20 });
    expect(r.success).toBe(true);
    expect(r.placementId).toBeTruthy();
    expect(r.fits).toBe(true);
    expect(r.dimensions.width).toBe(82); // full futon width
    expect(r.dimensions.label).toBe('Full Futon Frame');
  });

  it('detects product that does not fit', async () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', memberId: 'member1', roomWidth: 50, roomLength: 50, products: '[]',
    }]);
    const r = await mod.addProductToLayout('lay1', { productType: 'futon-frame-full', x: 0, y: 0 });
    expect(r.fits).toBe(false); // 82 > 50
  });

  it('uses bed depth when isBedMode=true', async () => {
    seedLayout();
    const r = await mod.addProductToLayout('lay1', { productType: 'futon-frame-full', x: 0, y: 0, isBedMode: true });
    expect(r.dimensions.depth).toBe(54); // depthBed for full
  });

  it('uses closed depth when isBedMode=false', async () => {
    seedLayout();
    const r = await mod.addProductToLayout('lay1', { productType: 'futon-frame-full', x: 0, y: 0, isBedMode: false });
    expect(r.dimensions.depth).toBe(38); // depth for full
  });

  it('swaps width/depth on 90 degree rotation', async () => {
    seedLayout();
    const r = await mod.addProductToLayout('lay1', { productType: 'futon-frame-full', x: 0, y: 0, rotation: 90 });
    expect(r.dimensions.width).toBe(38); // depth becomes width
    expect(r.dimensions.depth).toBe(82); // width becomes depth
  });

  it('defaults rotation to 0 for invalid values', async () => {
    seedLayout();
    const r = await mod.addProductToLayout('lay1', { productType: 'end-table', x: 0, y: 0, rotation: 45 });
    expect(r.dimensions.width).toBe(20);
  });

  it('updates existing placement by placementId', async () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', memberId: 'member1', roomWidth: 200, roomLength: 200,
      products: JSON.stringify([{ placementId: 'existing', productType: 'end-table', x: 0, y: 0 }]),
    }]);
    const r = await mod.addProductToLayout('lay1', { productType: 'coffee-table', x: 50, y: 50, placementId: 'existing' });
    expect(r.success).toBe(true);
    const products = JSON.parse(_collections['RoomLayouts'][0].products);
    expect(products).toHaveLength(1); // replaced, not added
    expect(products[0].productType).toBe('coffee-table');
  });
});

// ── getLayoutPreview ──────────────────────────────────────────────

describe('getLayoutPreview', () => {
  it('returns null for non-existent layout', async () => {
    __seed('RoomLayouts', []);
    const r = await mod.getLayoutPreview('missing');
    expect(r.success).toBe(true);
    expect(r.layout).toBeNull();
  });

  it('returns layout by ID', async () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', name: 'Test', roomWidth: 120, roomLength: 120,
      roomShape: 'rectangular', products: '[]', shareId: 'abc12345', isPublic: false,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    }]);
    const r = await mod.getLayoutPreview('lay1');
    expect(r.success).toBe(true);
    expect(r.layout.name).toBe('Test');
    expect(r.layout.products).toEqual([]);
  });

  it('returns layout by shareId when isPublic=true', async () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', name: 'Shared', shareId: 'share123', isPublic: true,
      roomWidth: 100, roomLength: 100, products: '[]', roomShape: 'rectangular',
    }]);
    const r = await mod.getLayoutPreview('share123', true);
    expect(r.success).toBe(true);
    expect(r.layout.name).toBe('Shared');
  });

  it('returns null for shareId when layout is not public', async () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', shareId: 'share123', isPublic: false, products: '[]',
    }]);
    const r = await mod.getLayoutPreview('share123', true);
    expect(r.layout).toBeNull();
  });

  it('parses products from JSON', async () => {
    __seed('RoomLayouts', [{
      _id: 'lay1', name: 'Test', roomWidth: 100, roomLength: 100,
      products: JSON.stringify([{ placementId: 'p1', productType: 'end-table' }]),
      roomShape: 'rectangular', shareId: 'x', isPublic: false,
    }]);
    const r = await mod.getLayoutPreview('lay1');
    expect(r.layout.products).toHaveLength(1);
    expect(r.layout.products[0].productType).toBe('end-table');
  });
});

// ── shareLayout ───────────────────────────────────────────────────

describe('shareLayout', () => {
  it('makes layout public and returns share URL', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'member1', shareId: 'abc12345' }]);
    const r = await mod.shareLayout('lay1', true);
    expect(r.success).toBe(true);
    expect(r.shareUrl).toContain('abc12345');
    expect(_collections['RoomLayouts'][0].isPublic).toBe(true);
  });

  it('makes layout private and returns empty URL', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'member1', shareId: 'abc12345', isPublic: true }]);
    const r = await mod.shareLayout('lay1', false);
    expect(r.success).toBe(true);
    expect(r.shareUrl).toBe('');
    expect(_collections['RoomLayouts'][0].isPublic).toBe(false);
  });

  it('rejects layout not owned by user', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'other', shareId: 'x' }]);
    const r = await mod.shareLayout('lay1', true);
    expect(r.success).toBe(false);
  });
});

// ── saveLayout ────────────────────────────────────────────────────

describe('saveLayout', () => {
  it('updates name', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'member1', name: 'Old' }]);
    const r = await mod.saveLayout('lay1', { name: 'New Name' });
    expect(r.success).toBe(true);
    expect(_collections['RoomLayouts'][0].name).toBe('New Name');
  });

  it('updates roomWidth clamped', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'member1', roomWidth: 100 }]);
    await mod.saveLayout('lay1', { roomWidth: 10 });
    expect(_collections['RoomLayouts'][0].roomWidth).toBe(24);
  });

  it('rejects layout not owned by user', async () => {
    __seed('RoomLayouts', [{ _id: 'lay1', memberId: 'other' }]);
    const r = await mod.saveLayout('lay1', { name: 'Hack' });
    expect(r.success).toBe(false);
  });
});

// ── getProductDimensions ──────────────────────────────────────────

describe('getProductDimensions', () => {
  it('returns all products from catalog', async () => {
    const r = await mod.getProductDimensions();
    expect(r.success).toBe(true);
    expect(r.products.length).toBe(8);
    const futon = r.products.find(p => p.productType === 'futon-frame-full');
    expect(futon.width).toBe(82);
    expect(futon.depth).toBe(38);
    expect(futon.depthBed).toBe(54);
    expect(futon.category).toBe('futon-frames');
  });
});
