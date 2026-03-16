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
    gt: (field, val) => { filters[`${field}_gt`] = { type: 'gt', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => (i[f.field] || 0) >= (f.value instanceof Date ? f.value.getTime() : f.value));
        if (f.type === 'le') items = items.filter(i => (i[f.field] || 0) <= f.value);
        if (f.type === 'gt') items = items.filter(i => (i[f.field] || 0) > f.value);
      }
      return items.length;
    },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ge') items = items.filter(i => {
          const iv = i[f.field];
          const fv = f.value;
          if (iv instanceof Date && fv instanceof Date) return iv >= fv;
          return (iv || 0) >= fv;
        });
        if (f.type === 'le') items = items.filter(i => (i[f.field] || 0) <= f.value);
        if (f.type === 'gt') items = items.filter(i => (i[f.field] || 0) > f.value);
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
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/socialProof.web.js');
});

// ── getProductSocialProof ────────────────────────────────────────

describe('getProductSocialProof', () => {
  it('returns empty for null productId', async () => {
    const r = await mod.getProductSocialProof(null);
    expect(r.notifications).toEqual([]);
    expect(r.config).toBeTruthy();
  });

  it('returns config with display settings', async () => {
    const r = await mod.getProductSocialProof('p1');
    expect(r.config.maxPerSession).toBe(5);
    expect(r.config.position).toBe('bottom-left');
  });

  it('includes low stock notification', async () => {
    __seed('Orders', []);
    __seed('InventoryLevels', [{ productId: 'p1', quantity: 3 }]);
    __seed('ProductAnalytics', []);
    __seed('Reviews', []);
    const r = await mod.getProductSocialProof('p1');
    const lowStock = r.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeTruthy();
    expect(lowStock.message).toContain('3 left');
    expect(lowStock.urgency).toBe('medium');
  });

  it('marks high urgency for very low stock', async () => {
    __seed('Orders', []);
    __seed('InventoryLevels', [{ productId: 'p1', quantity: 1 }]);
    __seed('ProductAnalytics', []);
    __seed('Reviews', []);
    const r = await mod.getProductSocialProof('p1');
    const lowStock = r.notifications.find(n => n.type === 'low_stock');
    expect(lowStock.urgency).toBe('high');
  });

  it('includes review count notification', async () => {
    __seed('Orders', []);
    __seed('InventoryLevels', []);
    __seed('ProductAnalytics', []);
    __seed('Reviews', [
      { productId: 'p1', status: 'approved', rating: 5 },
      { productId: 'p1', status: 'approved', rating: 4 },
      { productId: 'p1', status: 'approved', rating: 5 },
      { productId: 'p1', status: 'approved', rating: 4 },
      { productId: 'p1', status: 'approved', rating: 5 },
    ]);
    const r = await mod.getProductSocialProof('p1');
    const reviewNotif = r.notifications.find(n => n.type === 'review_count');
    expect(reviewNotif).toBeTruthy();
    expect(reviewNotif.message).toContain('5 reviews');
    expect(reviewNotif.message).toContain('4.6/5');
  });

  it('skips review notification below threshold', async () => {
    __seed('Orders', []);
    __seed('InventoryLevels', []);
    __seed('ProductAnalytics', []);
    __seed('Reviews', [
      { productId: 'p1', status: 'approved', rating: 5 },
      { productId: 'p1', status: 'approved', rating: 4 },
    ]);
    const r = await mod.getProductSocialProof('p1');
    expect(r.notifications.find(n => n.type === 'review_count')).toBeUndefined();
  });

  it('includes recent purchase notification', async () => {
    __seed('Orders', [{
      _createdDate: new Date(),
      billingInfo: { firstName: 'jane', city: 'asheville' },
      lineItems: [{ productId: 'p1', name: 'Classic Futon' }],
    }]);
    __seed('InventoryLevels', []);
    __seed('ProductAnalytics', []);
    __seed('Reviews', []);
    const r = await mod.getProductSocialProof('p1', 'Classic Futon');
    const purchase = r.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeTruthy();
    expect(purchase.message).toContain('Jane');
    expect(purchase.message).toContain('Asheville');
  });
});

// ── getCategorySocialProof ───────────────────────────────────────

describe('getCategorySocialProof', () => {
  it('returns empty for null category', async () => {
    const r = await mod.getCategorySocialProof(null);
    expect(r.recentSalesCount).toBe(0);
    expect(r.lowStockProducts).toEqual([]);
  });

  it('returns low stock products', async () => {
    __seed('InventoryLevels', [
      { productId: 'p1', productName: 'Futon A', quantity: 3 },
      { productId: 'p2', productName: 'Futon B', quantity: 10 },
    ]);
    __seed('Orders', []);
    const r = await mod.getCategorySocialProof('futons');
    expect(r.lowStockProducts).toHaveLength(1);
    expect(r.lowStockProducts[0].productName).toBe('Futon A');
  });

  it('caps low stock products at 5', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      productId: `p${i}`, productName: `Item ${i}`, quantity: 2,
    }));
    __seed('InventoryLevels', items);
    __seed('Orders', []);
    const r = await mod.getCategorySocialProof('futons');
    expect(r.lowStockProducts.length).toBeLessThanOrEqual(5);
  });
});

// ── getSocialProofConfig ─────────────────────────────────────────

describe('getSocialProofConfig', () => {
  it('returns display configuration', async () => {
    const r = await mod.getSocialProofConfig();
    expect(r.maxPerSession).toBe(5);
    expect(r.minIntervalMs).toBe(60000);
    expect(r.autoDismissMs).toBe(5000);
    expect(r.position).toBe('bottom-left');
    expect(r.mobilePosition).toBe('bottom-full');
  });
});
