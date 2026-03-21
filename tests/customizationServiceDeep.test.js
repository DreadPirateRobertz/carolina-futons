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
    if (!id || typeof id !== 'string') return '';
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
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
    or: () => chain,
    contains: () => chain,
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
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => ({ _id: 'mem-456' })),
  },
}));


let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/customizationService.web.js');
});

describe('getCustomizationOptions', () => {
  it('returns empty for invalid productId', async () => {
    const r = await mod.getCustomizationOptions('');
    expect(r.swatches).toEqual([]);
    expect(r.pricingRules).toEqual([]);
  });

  it('returns swatches and pricing rules', async () => {
    __seed('FabricSwatches', [
      { _id: 's1', swatchName: 'Navy', colorFamily: 'Blue', colorHex: '#001f3f', material: 'Cotton', priceTier: 'standard', availableForProducts: 'all', sortOrder: 1 },
    ]);
    __seed('CustomizationPricing', [
      { tier: 'standard', surchargePercent: 0, surchargeFlat: 0, label: 'Standard', sortOrder: 1 },
      { tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium', sortOrder: 2 },
    ]);
    const r = await mod.getCustomizationOptions('prod-123');
    expect(r.swatches).toHaveLength(1);
    expect(r.swatches[0].swatchName).toBe('Navy');
    expect(r.pricingRules).toHaveLength(2);
  });
});

describe('calculateCustomizationPrice', () => {
  it('returns base price with no rules', () => {
    const r = mod.calculateCustomizationPrice(500, 'standard', []);
    expect(r.basePrice).toBe(500);
    expect(r.surcharge).toBe(0);
    expect(r.totalPrice).toBe(500);
  });

  it('calculates percentage surcharge', () => {
    const rules = [{ tier: 'premium', surchargePercent: 20, surchargeFlat: 0, label: 'Premium' }];
    const r = mod.calculateCustomizationPrice(500, 'premium', rules);
    expect(r.surcharge).toBe(100);
    expect(r.totalPrice).toBe(600);
    expect(r.surchargeLabel).toBe('Premium');
  });

  it('calculates flat surcharge', () => {
    const rules = [{ tier: 'luxury', surchargePercent: 0, surchargeFlat: 75, label: 'Luxury' }];
    const r = mod.calculateCustomizationPrice(500, 'luxury', rules);
    expect(r.surcharge).toBe(75);
    expect(r.totalPrice).toBe(575);
  });

  it('returns default for unknown tier', () => {
    const rules = [{ tier: 'premium', surchargePercent: 20, surchargeFlat: 0 }];
    const r = mod.calculateCustomizationPrice(500, 'unknown', rules);
    expect(r.surcharge).toBe(0);
    expect(r.totalPrice).toBe(500);
  });

  it('handles zero/negative base price', () => {
    const r = mod.calculateCustomizationPrice(-10, 'standard', []);
    expect(r.basePrice).toBe(0);
    expect(r.totalPrice).toBe(0);
  });
});

describe('saveConfiguration', () => {
  it('rejects missing fields', async () => {
    const r = await mod.saveConfiguration({});
    expect(r.error).toBeTruthy();
  });

  it('saves valid config', async () => {
    __seed('SavedCustomizations', []);
    const r = await mod.saveConfiguration({
      productId: 'prod-123', memberId: 'mem-456',
      configName: 'My Setup', fabricSwatchId: 's1',
      fabricName: 'Navy', totalPrice: 599,
    });
    expect(r._id).toBeTruthy();
    expect(_collections['SavedCustomizations']).toHaveLength(1);
  });
});

describe('getSavedConfigurations', () => {
  it('returns empty for invalid IDs', async () => {
    const r = await mod.getSavedConfigurations('', '');
    expect(r).toEqual([]);
  });

  it('returns saved configs for member/product', async () => {
    __seed('SavedCustomizations', [
      { _id: 'c1', productId: 'prod-123', memberId: 'mem-456', configName: 'Setup 1', totalPrice: 599 },
    ]);
    const r = await mod.getSavedConfigurations('prod-123', 'mem-456');
    expect(r).toHaveLength(1);
    expect(r[0].configName).toBe('Setup 1');
  });
});

describe('getConfigurationById', () => {
  it('returns null for invalid ID', async () => {
    const r = await mod.getConfigurationById('');
    expect(r).toBeNull();
  });

  it('returns config by ID', async () => {
    __seed('SavedCustomizations', [
      { _id: 'c1', productId: 'prod-123', memberId: 'mem-456', configName: 'My Config' },
    ]);
    const r = await mod.getConfigurationById('c1');
    expect(r).not.toBeNull();
    expect(r.configName).toBe('My Config');
  });
});
