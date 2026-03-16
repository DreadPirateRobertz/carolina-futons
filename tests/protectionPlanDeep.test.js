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
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
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
    remove: async (collection, id) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === id);
      if (idx >= 0) col.splice(idx, 1);
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/protectionPlan.web.js');
});

// ── PLAN_TIERS ───────────────────────────────────────────────────

describe('PLAN_TIERS', () => {
  it('has three tiers', () => {
    expect(Object.keys(mod.PLAN_TIERS)).toEqual(['basic', 'extended', 'premium']);
  });

  it('basic is 1 year at 6%', () => {
    expect(mod.PLAN_TIERS.basic.durationYears).toBe(1);
    expect(mod.PLAN_TIERS.basic.pricePercent).toBe(6);
  });

  it('premium is 5 years at 18%', () => {
    expect(mod.PLAN_TIERS.premium.durationYears).toBe(5);
    expect(mod.PLAN_TIERS.premium.pricePercent).toBe(18);
  });
});

// ── getProtectionPlans ───────────────────────────────────────────

describe('getProtectionPlans', () => {
  it('returns empty for no product IDs', async () => {
    const r = await mod.getProtectionPlans([]);
    expect(r.success).toBe(true);
    expect(r.plans).toEqual([]);
  });

  it('returns empty for null', async () => {
    const r = await mod.getProtectionPlans(null);
    expect(r.success).toBe(true);
    expect(r.plans).toEqual([]);
  });

  it('returns plans with calculated prices', async () => {
    __seed('Stores/Products', [{ _id: 'p1', name: 'Classic Futon', price: 500 }]);
    __seed('ProtectionPlanSelections', []);
    const r = await mod.getProtectionPlans(['p1']);
    expect(r.success).toBe(true);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].productName).toBe('Classic Futon');
    expect(r.plans[0].tiers).toHaveLength(3);
    expect(r.plans[0].tiers[0].price).toBe(30);   // 500 * 6%
    expect(r.plans[0].tiers[1].price).toBe(60);   // 500 * 12%
    expect(r.plans[0].tiers[2].price).toBe(90);   // 500 * 18%
    expect(r.plans[0].selectedTier).toBeNull();
  });

  it('shows existing selection', async () => {
    __seed('Stores/Products', [{ _id: 'p1', name: 'Futon', price: 400 }]);
    __seed('ProtectionPlanSelections', [{ _id: 's1', sessionId: 'sess1', productId: 'p1', tier: 'extended' }]);
    const r = await mod.getProtectionPlans(['p1'], 'sess1');
    expect(r.plans[0].selectedTier).toBe('extended');
  });

  it('skips products with no price', async () => {
    __seed('Stores/Products', [{ _id: 'p1', name: 'Free Item', price: 0 }]);
    const r = await mod.getProtectionPlans(['p1']);
    expect(r.plans).toHaveLength(0);
  });

  it('caps at 10 product IDs', async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `p${i}`);
    __seed('Stores/Products', ids.map(id => ({ _id: id, name: 'Item', price: 100 })));
    const r = await mod.getProtectionPlans(ids);
    expect(r.plans.length).toBeLessThanOrEqual(10);
  });
});

// ── addProtectionPlan ────────────────────────────────────────────

describe('addProtectionPlan', () => {
  it('rejects missing productId', async () => {
    const r = await mod.addProtectionPlan(null, 'basic');
    expect(r.success).toBe(false);
  });

  it('rejects invalid tier', async () => {
    __seed('Stores/Products', [{ _id: 'p1', name: 'Futon', price: 400 }]);
    const r = await mod.addProtectionPlan('p1', 'invalid');
    expect(r.success).toBe(false);
  });

  it('adds new plan selection', async () => {
    __seed('Stores/Products', [{ _id: 'p1', name: 'Futon', price: 400 }]);
    __seed('ProtectionPlanSelections', []);
    const r = await mod.addProtectionPlan('p1', 'basic', 'sess1');
    expect(r.success).toBe(true);
    expect(r.data.price).toBe(24); // 400 * 6%
    expect(r.data.planName).toBe('1-Year Basic Protection');
    expect(_collections['ProtectionPlanSelections']).toHaveLength(1);
  });

  it('updates existing selection', async () => {
    __seed('Stores/Products', [{ _id: 'p1', name: 'Futon', price: 400 }]);
    __seed('ProtectionPlanSelections', [{ _id: 's1', sessionId: 'sess1', productId: 'p1', tier: 'basic' }]);
    const r = await mod.addProtectionPlan('p1', 'premium', 'sess1');
    expect(r.success).toBe(true);
    expect(r.data.tier).toBe('premium');
    expect(r.data.price).toBe(72); // 400 * 18%
  });

  it('rejects non-existent product', async () => {
    __seed('Stores/Products', []);
    const r = await mod.addProtectionPlan('p1', 'basic');
    expect(r.success).toBe(false);
  });
});

// ── removeProtectionPlan ─────────────────────────────────────────

describe('removeProtectionPlan', () => {
  it('rejects missing productId', async () => {
    const r = await mod.removeProtectionPlan(null, 'sess1');
    expect(r.success).toBe(false);
  });

  it('removes existing selection', async () => {
    __seed('ProtectionPlanSelections', [{ _id: 's1', sessionId: 'sess1', productId: 'p1', tier: 'basic' }]);
    const r = await mod.removeProtectionPlan('p1', 'sess1');
    expect(r.success).toBe(true);
    expect(_collections['ProtectionPlanSelections']).toHaveLength(0);
  });

  it('succeeds when no selection exists', async () => {
    __seed('ProtectionPlanSelections', []);
    const r = await mod.removeProtectionPlan('p1', 'sess1');
    expect(r.success).toBe(true);
  });
});

// ── getProtectionPlanSummary ─────────────────────────────────────

describe('getProtectionPlanSummary', () => {
  it('returns empty for no sessionId', async () => {
    const r = await mod.getProtectionPlanSummary('');
    expect(r.success).toBe(true);
    expect(r.data.selections).toEqual([]);
    expect(r.data.totalProtectionCost).toBe(0);
  });

  it('returns selections with total cost', async () => {
    __seed('ProtectionPlanSelections', [
      { _id: 's1', sessionId: 'sess1', productId: 'p1', productName: 'Futon A', tier: 'basic', price: 30, durationYears: 1 },
      { _id: 's2', sessionId: 'sess1', productId: 'p2', productName: 'Futon B', tier: 'premium', price: 90, durationYears: 5 },
    ]);
    const r = await mod.getProtectionPlanSummary('sess1');
    expect(r.success).toBe(true);
    expect(r.data.selections).toHaveLength(2);
    expect(r.data.totalProtectionCost).toBe(120);
    expect(r.data.selections[0].planName).toBe('1-Year Basic Protection');
    expect(r.data.selections[1].planName).toBe('5-Year Premium Protection');
  });

  it('returns empty for different session', async () => {
    __seed('ProtectionPlanSelections', [
      { _id: 's1', sessionId: 'sess1', productId: 'p1', tier: 'basic', price: 30 },
    ]);
    const r = await mod.getProtectionPlanSummary('sess2');
    expect(r.data.selections).toHaveLength(0);
  });
});
