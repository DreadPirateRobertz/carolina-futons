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

let _mockMember = { _id: 'member1', loginEmail: 'test@example.com' };
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
    hasSome: (field, vals) => { filters[`${field}_hasSome`] = { type: 'hasSome', field, value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[f.field]));
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
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _mockMember = { _id: 'member1', loginEmail: 'test@example.com' };
  vi.resetModules();
  mod = await import('../src/backend/sustainability.web.js');
});

// ── getSustainabilityInfo ──────────────────────────────────────────

describe('getSustainabilityInfo', () => {
  it('rejects invalid product ID', async () => {
    const r = await mod.getSustainabilityInfo(null);
    expect(r.success).toBe(false);
  });

  it('returns null when no sustainability data', async () => {
    __seed('ProductSustainability', []);
    const r = await mod.getSustainabilityInfo('prod1');
    expect(r.success).toBe(true);
    expect(r.sustainability).toBeNull();
  });

  it('returns sustainability data with badges', async () => {
    __seed('ProductSustainability', [{
      _id: 'ps1', productId: 'prod1', active: true,
      materialSource: 'Plantation-grown rubberwood',
      durabilityRating: 5, durabilityYears: 20,
      recyclability: 'fully', carbonFootprint: 150,
      sustainabilityScore: 85,
      certifications: '["FSC","GREENGUARD"]',
      badges: '["eco-material","long-lasting","recyclable"]',
    }]);
    const r = await mod.getSustainabilityInfo('prod1');
    expect(r.success).toBe(true);
    expect(r.sustainability.materialSource).toBe('Plantation-grown rubberwood');
    expect(r.sustainability.durabilityRating).toBe(5);
    expect(r.sustainability.badges).toHaveLength(3);
    expect(r.sustainability.badges[0].label).toBe('Eco-Friendly Materials');
    expect(r.sustainability.badges[0].slug).toBe('eco-material');
  });

  it('skips inactive records', async () => {
    __seed('ProductSustainability', [{
      _id: 'ps1', productId: 'prod1', active: false,
      materialSource: 'Wood', badges: '[]', certifications: '[]',
    }]);
    const r = await mod.getSustainabilityInfo('prod1');
    expect(r.sustainability).toBeNull();
  });
});

// ── calculateCarbonOffset ──────────────────────────────────────────

describe('calculateCarbonOffset', () => {
  it('rejects empty array', async () => {
    const r = await mod.calculateCarbonOffset([]);
    expect(r.success).toBe(false);
  });

  it('rejects non-array', async () => {
    const r = await mod.calculateCarbonOffset('not-array');
    expect(r.success).toBe(false);
  });

  it('calculates offset for products', async () => {
    __seed('ProductSustainability', [
      { _id: 'ps1', productId: 'p1', active: true, carbonFootprint: 100 },
      { _id: 'ps2', productId: 'p2', active: true, carbonFootprint: 50 },
    ]);
    const r = await mod.calculateCarbonOffset(['p1', 'p2']);
    expect(r.success).toBe(true);
    expect(r.offset.totalCarbonKg).toBe(150);
    expect(r.offset.productsMatched).toBe(2);
    expect(r.offset.offsetCost).toBeGreaterThanOrEqual(1); // Min $1
  });

  it('returns 0 cost when no carbon data', async () => {
    __seed('ProductSustainability', []);
    const r = await mod.calculateCarbonOffset(['p1']);
    expect(r.success).toBe(true);
    expect(r.offset.totalCarbonKg).toBe(0);
    expect(r.offset.offsetCost).toBe(0);
  });

  it('enforces minimum $1 offset', async () => {
    __seed('ProductSustainability', [
      { _id: 'ps1', productId: 'p1', active: true, carbonFootprint: 10 }, // 10 * 0.01 = $0.10
    ]);
    const r = await mod.calculateCarbonOffset(['p1']);
    expect(r.offset.offsetCost).toBe(1); // Min $1
  });

  it('caps at 20 product IDs', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const r = await mod.calculateCarbonOffset(ids);
    expect(r.success).toBe(true);
  });

  it('calculates tree equivalence', async () => {
    __seed('ProductSustainability', [
      { _id: 'ps1', productId: 'p1', active: true, carbonFootprint: 21.77 },
    ]);
    const r = await mod.calculateCarbonOffset(['p1']);
    expect(r.offset.treesEquivalent).toBeCloseTo(1, 0);
  });
});

// ── submitTradeIn ──────────────────────────────────────────────────

describe('submitTradeIn', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.submitTradeIn({ productType: 'Futon', condition: 'good' });
    expect(r.success).toBe(false);
  });

  it('rejects missing product type', async () => {
    const r = await mod.submitTradeIn({ productType: '', condition: 'good' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Product type');
  });

  it('rejects invalid condition', async () => {
    const r = await mod.submitTradeIn({ productType: 'Futon', condition: 'broken' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Condition');
  });

  it('submits trade-in with estimated credit', async () => {
    const r = await mod.submitTradeIn({ productType: 'Futon Frame', condition: 'good' });
    expect(r.success).toBe(true);
    expect(r.id).toBeTruthy();
    expect(r.estimatedCredit.condition).toBe('good');
    expect(r.estimatedCredit.range.min).toBe(75);
    expect(r.estimatedCredit.range.max).toBe(150);
    expect(r.estimatedCredit.amount).toBe(113); // Math.round((75+150)/2) = Math.round(112.5) = 113
  });

  it('calculates correct credit for each condition', async () => {
    for (const [condition, range] of Object.entries({ excellent: [100, 200], good: [75, 150], fair: [50, 100], poor: [25, 50] })) {
      _collections = {};
      const r = await mod.submitTradeIn({ productType: 'Futon', condition });
      expect(r.success).toBe(true);
      const expected = Math.round((range[0] + range[1]) / 2);
      expect(r.estimatedCredit.amount).toBe(expected);
    }
  });

  it('stores request in TradeInRequests', async () => {
    await mod.submitTradeIn({ productType: 'Futon Frame', condition: 'fair', age: '5 years', description: 'Some wear' });
    expect(_collections['TradeInRequests']).toHaveLength(1);
    expect(_collections['TradeInRequests'][0].status).toBe('submitted');
    expect(_collections['TradeInRequests'][0].memberId).toBe('member1');
  });

  it('caps photos at 5', async () => {
    const photos = Array.from({ length: 8 }, (_, i) => `photo${i}.jpg`);
    await mod.submitTradeIn({ productType: 'Futon', condition: 'good', photos });
    const stored = JSON.parse(_collections['TradeInRequests'][0].photos);
    expect(stored).toHaveLength(5);
  });
});

// ── getTradeInStatus ───────────────────────────────────────────────

describe('getTradeInStatus', () => {
  it('rejects unauthenticated user', async () => {
    _mockMember = null;
    const r = await mod.getTradeInStatus();
    expect(r.success).toBe(false);
  });

  it('returns empty when no requests', async () => {
    __seed('TradeInRequests', []);
    const r = await mod.getTradeInStatus();
    expect(r.success).toBe(true);
    expect(r.requests).toHaveLength(0);
  });

  it('returns all requests for current member', async () => {
    __seed('TradeInRequests', [
      { _id: 'tr1', memberId: 'member1', productType: 'Futon', condition: 'good', status: 'submitted', submittedAt: new Date() },
      { _id: 'tr2', memberId: 'other', productType: 'Chair', condition: 'fair', status: 'submitted', submittedAt: new Date() },
    ]);
    const r = await mod.getTradeInStatus();
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0]._id).toBe('tr1');
  });

  it('returns specific request by ID', async () => {
    __seed('TradeInRequests', [
      { _id: 'tr1', memberId: 'member1', productType: 'Futon', condition: 'good', status: 'submitted' },
    ]);
    const r = await mod.getTradeInStatus('tr1');
    expect(r.success).toBe(true);
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0].productType).toBe('Futon');
  });

  it('returns empty for request not owned by member', async () => {
    __seed('TradeInRequests', [
      { _id: 'tr1', memberId: 'other', productType: 'Chair' },
    ]);
    const r = await mod.getTradeInStatus('tr1');
    expect(r.requests).toHaveLength(0);
  });
});
