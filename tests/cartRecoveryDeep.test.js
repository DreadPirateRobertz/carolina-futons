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
    le: (field, val) => { filters[`${field}_le`] = { type: 'le', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => String(i[f.field] || '') >= String(f.value));
        if (f.type === 'le') items = items.filter(i => String(i[f.field] || '') <= String(f.value));
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
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
  vi.resetModules();
  mod = await import('../src/backend/cartRecovery.web.js');
});

// ── getAbandonedCartStats ────────────────────────────────────────

describe('getAbandonedCartStats', () => {
  it('returns zeros for no data', async () => {
    __seed('AbandonedCarts', []);
    const r = await mod.getAbandonedCartStats();
    expect(r.totalAbandoned).toBe(0);
    expect(r.recoveryRate).toBe(0);
  });

  it('calculates recovery rate', async () => {
    __seed('AbandonedCarts', [
      { checkoutId: 'c1', status: 'abandoned', abandonedAt: new Date().toISOString(), cartTotal: 500 },
      { checkoutId: 'c2', status: 'recovered', abandonedAt: new Date().toISOString(), cartTotal: 300 },
      { checkoutId: 'c3', status: 'abandoned', abandonedAt: new Date().toISOString(), cartTotal: 700 },
    ]);
    const r = await mod.getAbandonedCartStats();
    expect(r.totalAbandoned).toBe(3);
    expect(r.totalRecovered).toBe(1);
    expect(r.recoveryRate).toBe(33);
  });

  it('returns recent carts capped at 10', async () => {
    const carts = Array.from({ length: 15 }, (_, i) => ({
      checkoutId: `c${i}`, status: 'abandoned',
      abandonedAt: new Date().toISOString(), cartTotal: 100,
      buyerEmail: `user${i}@test.com`,
    }));
    __seed('AbandonedCarts', carts);
    const r = await mod.getAbandonedCartStats();
    expect(r.recentCarts.length).toBeLessThanOrEqual(10);
  });
});

// ── getRecoverableCarts ──────────────────────────────────────────

describe('getRecoverableCarts', () => {
  it('returns empty for no carts', async () => {
    __seed('AbandonedCarts', []);
    const r = await mod.getRecoverableCarts();
    expect(r).toEqual([]);
  });

  it('returns carts eligible for recovery', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    __seed('AbandonedCarts', [
      { _id: 'ac1', checkoutId: 'c1', status: 'abandoned', recoveryEmailSent: false, abandonedAt: twoHoursAgo, buyerEmail: 'test@test.com', cartTotal: 500, lineItems: '[]' },
    ]);
    const r = await mod.getRecoverableCarts();
    expect(r).toHaveLength(1);
    expect(r[0].checkoutId).toBe('c1');
  });

  it('excludes already-emailed carts', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    __seed('AbandonedCarts', [
      { _id: 'ac1', checkoutId: 'c1', status: 'abandoned', recoveryEmailSent: true, abandonedAt: twoHoursAgo },
    ]);
    const r = await mod.getRecoverableCarts();
    expect(r).toHaveLength(0);
  });
});

// ── markRecoveryEmailSent ────────────────────────────────────────

describe('markRecoveryEmailSent', () => {
  it('rejects null cartId', async () => {
    const r = await mod.markRecoveryEmailSent(null);
    expect(r.success).toBe(false);
  });

  it('marks email as sent', async () => {
    __seed('AbandonedCarts', [{ _id: 'ac1', checkoutId: 'c1', recoveryEmailSent: false }]);
    const r = await mod.markRecoveryEmailSent('ac1');
    expect(r.success).toBe(true);
    expect(_collections['AbandonedCarts'][0].recoveryEmailSent).toBe(true);
  });

  it('returns false for non-existent cart', async () => {
    __seed('AbandonedCarts', []);
    const r = await mod.markRecoveryEmailSent('nonexistent');
    expect(r.success).toBe(false);
  });
});

// ── wixEcom_onAbandonedCheckoutCreated ───────────────────────────

describe('wixEcom_onAbandonedCheckoutCreated', () => {
  it('records abandoned cart', async () => {
    __seed('AbandonedCarts', []);
    await mod.wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'checkout1',
        buyerInfo: { email: 'test@test.com', firstName: 'Jane' },
        payNow: { total: { amount: 499 } },
        lineItems: [{ catalogReference: { catalogItemId: 'p1' }, productName: { original: 'Futon' }, quantity: 1, price: { amount: 499 } }],
      },
    });
    // Give the async fire-and-forget time to complete
    await new Promise(r => setTimeout(r, 50));
    expect(_collections['AbandonedCarts']).toHaveLength(1);
    expect(_collections['AbandonedCarts'][0].status).toBe('abandoned');
  });
});

// ── wixEcom_onAbandonedCheckoutRecovered ─────────────────────────

describe('wixEcom_onAbandonedCheckoutRecovered', () => {
  it('marks cart as recovered', async () => {
    __seed('AbandonedCarts', [{ _id: 'ac1', checkoutId: 'checkout1', status: 'abandoned' }]);
    await mod.wixEcom_onAbandonedCheckoutRecovered({ entity: { _id: 'checkout1' } });
    await new Promise(r => setTimeout(r, 50));
    expect(_collections['AbandonedCarts'][0].status).toBe('recovered');
  });
});
