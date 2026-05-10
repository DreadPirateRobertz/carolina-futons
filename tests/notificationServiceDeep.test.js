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

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn().mockResolvedValue({}) },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: async (name) => `mock-${name}`,
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
    ge: (field, val) => { filters[`${field}_ge`] = { type: 'ge', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit' || key === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
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
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
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
  mod = await import('../src/backend/notificationService.web.js');
});

// ── recordPriceSnapshots ───────────────────────────────────────────

describe('recordPriceSnapshots', () => {
  it('returns 0 when no products', async () => {
    __seed('Stores/Products', []);
    const r = await mod.recordPriceSnapshots();
    expect(r.recorded).toBe(0);
  });

  it('records snapshots for all products', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', price: 500, inStock: true },
      { _id: 'p2', price: 300, discountedPrice: 250, inStock: false },
    ]);
    const r = await mod.recordPriceSnapshots();
    expect(r.recorded).toBe(2);
    expect(_collections['PriceHistory']).toHaveLength(2);
  });

  it('records correct price and stock data', async () => {
    __seed('Stores/Products', [{ _id: 'p1', price: 500, inStock: true }]);
    await mod.recordPriceSnapshots();
    const snapshot = _collections['PriceHistory'][0];
    expect(snapshot.productId).toBe('p1');
    expect(snapshot.price).toBe(500);
    expect(snapshot.inStock).toBe(true);
  });

  it('uses discountedPrice as comparePrice when available', async () => {
    __seed('Stores/Products', [{ _id: 'p1', price: 500, discountedPrice: 400 }]);
    await mod.recordPriceSnapshots();
    expect(_collections['PriceHistory'][0].comparePrice).toBe(400);
  });
});

// ── checkWishlistAlerts ────────────────────────────────────────────

describe('checkWishlistAlerts', () => {
  it('returns zeros when no products', async () => {
    __seed('Stores/Products', []);
    const r = await mod.checkWishlistAlerts();
    expect(r.priceDropAlerts).toBe(0);
    expect(r.backInStockAlerts).toBe(0);
  });

  it('returns zeros when no price history', async () => {
    __seed('Stores/Products', [{ _id: 'p1', price: 500, inStock: true }]);
    __seed('PriceHistory', []);
    const r = await mod.checkWishlistAlerts();
    expect(r.priceDropAlerts).toBe(0);
    expect(r.backInStockAlerts).toBe(0);
  });

  it('detects price drop and sends alerts', async () => {
    __seed('Stores/Products', [{ _id: 'p1', price: 400, inStock: true, name: 'Futon', slug: 'futon' }]);
    // Need 2 entries: skip(1) skips the first, so [0] is skipped, [1] is "previous"
    // Actually skip(1) with limit(1) means skip first result, take next
    __seed('PriceHistory', [
      { _id: 'ph0', productId: 'p1', price: 400, inStock: true, recordedAt: new Date() },
      { _id: 'ph1', productId: 'p1', price: 500, inStock: true, recordedAt: new Date(Date.now() - 86400000) },
    ]);
    __seed('Wishlist', [{ _id: 'w1', productId: 'p1', memberId: 'member1' }]);
    __seed('MemberPreferences', [{ _id: 'mp1', memberId: 'member1', saleAlerts: true }]);
    __seed('Members/PrivateMembersData', [{ _id: 'member1', contactId: 'contact1' }]);
    __seed('NotificationLog', []);

    const r = await mod.checkWishlistAlerts();
    expect(r.priceDropAlerts).toBe(1);
  });

  it('skips price drops below 10% threshold', async () => {
    __seed('Stores/Products', [{ _id: 'p1', price: 495, inStock: true }]);
    __seed('PriceHistory', [
      { _id: 'ph0', productId: 'p1', price: 495, recordedAt: new Date() },
      { _id: 'ph1', productId: 'p1', price: 500, recordedAt: new Date(Date.now() - 86400000) },
    ]);
    __seed('Wishlist', [{ _id: 'w1', productId: 'p1', memberId: 'member1' }]);
    __seed('NotificationLog', []);

    const r = await mod.checkWishlistAlerts();
    expect(r.priceDropAlerts).toBe(0);
  });
});

// ── toggleProductAlerts ────────────────────────────────────────────

describe('toggleProductAlerts', () => {
  it('rejects invalid ID', async () => {
    const r = await mod.toggleProductAlerts(null, true);
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.toggleProductAlerts('w1', true);
    expect(r.success).toBe(false);
  });

  it('rejects item not owned by user', async () => {
    __seed('Wishlist', [{ _id: 'w1', memberId: 'other-member' }]);
    const r = await mod.toggleProductAlerts('w1', true);
    expect(r.success).toBe(false);
  });

  it('mutes alerts for wishlist item', async () => {
    __seed('Wishlist', [{ _id: 'w1', memberId: 'member1', muteAlerts: false }]);
    const r = await mod.toggleProductAlerts('w1', true);
    expect(r.success).toBe(true);
    expect(_collections['Wishlist'][0].muteAlerts).toBe(true);
  });

  it('unmutes alerts for wishlist item', async () => {
    __seed('Wishlist', [{ _id: 'w1', memberId: 'member1', muteAlerts: true }]);
    const r = await mod.toggleProductAlerts('w1', false);
    expect(r.success).toBe(true);
    expect(_collections['Wishlist'][0].muteAlerts).toBe(false);
  });
});

