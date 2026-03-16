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
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = applyFilters(collection, filters);
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      return applyFilters(collection, filters).length;
    },
  };
  return chain;
}

function applyFilters(collection, filters) {
  let items = [...(_collections[collection] || [])];
  for (const [key, f] of Object.entries(filters)) {
    if (key === '_limit') continue;
    const fld = f.field || key;
    if (f.type === 'eq') items = items.filter(i => i[fld] === f.value);
    if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
  }
  return items;
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
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/checkoutOptimization.web.js');
});

// ── calculateOrderSummary ─────────────────────────────────────────

describe('calculateOrderSummary', () => {
  it('rejects null params', () => {
    const r = mod.calculateOrderSummary(null);
    expect(r.success).toBe(false);
  });

  it('rejects empty items array', () => {
    const r = mod.calculateOrderSummary({ items: [] });
    expect(r.success).toBe(false);
  });

  it('calculates subtotal from items', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 2 }, { price: 50, quantity: 1 }] });
    expect(r.success).toBe(true);
    expect(r.data.subtotal).toBe(250);
    expect(r.data.itemCount).toBe(3);
  });

  it('skips negative prices', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: -10, quantity: 1 }, { price: 100, quantity: 1 }] });
    expect(r.data.subtotal).toBe(100);
  });

  it('clamps quantity to 1-99', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 10, quantity: 200 }] });
    expect(r.data.itemCount).toBe(99);
    expect(r.data.subtotal).toBe(990);
  });

  it('defaults quantity to 1 for invalid values', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100 }] });
    expect(r.data.itemCount).toBe(1);
  });

  it('uses NC tax rate for state NC', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], state: 'NC' });
    expect(r.data.taxRate).toBe(0.0675);
    expect(r.data.tax).toBe(6.75);
  });

  it('uses default tax rate for unknown state', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], state: 'ZZ' });
    expect(r.data.taxRate).toBe(0.065);
  });

  it('uses default tax rate when no state', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(r.data.taxRate).toBe(0.065);
  });

  it('calculates standard shipping for small orders', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(r.data.shipping.amount).toBe(49.99);
    expect(r.data.shipping.method).toBe('standard');
  });

  it('calculates white glove local shipping', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], shippingMethod: 'white_glove_local' });
    expect(r.data.shipping.amount).toBe(149);
  });

  it('calculates white glove regional shipping', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }], shippingMethod: 'white_glove_regional' });
    expect(r.data.shipping.amount).toBe(249);
  });

  it('caps items at 50', () => {
    const items = Array.from({ length: 60 }, () => ({ price: 1, quantity: 1 }));
    const r = mod.calculateOrderSummary({ items });
    expect(r.data.subtotal).toBe(50);
  });

  it('calculates total = subtotal + shipping + tax', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 1000, quantity: 1 }], state: 'NC' });
    // subtotal=1000, shipping=49.99, tax=67.5
    expect(r.data.total).toBe(1000 + 49.99 + 67.5);
  });

  it('freeShippingProgress shows not qualifying', () => {
    const r = mod.calculateOrderSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(r.data.freeShippingProgress.qualifies).toBe(false);
    expect(r.data.freeShippingProgress.remaining).toBeGreaterThan(0);
  });
});

// ── validateShippingAddress ───────────────────────────────────────

describe('validateShippingAddress', () => {
  const validAddr = {
    fullName: 'John Doe',
    addressLine1: '123 Main St',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
  };

  it('rejects null address', () => {
    const r = mod.validateShippingAddress(null);
    expect(r.valid).toBe(false);
  });

  it('validates a complete address', () => {
    const r = mod.validateShippingAddress(validAddr);
    expect(r.success).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.errors).toBeUndefined();
  });

  it('rejects short fullName', () => {
    const r = mod.validateShippingAddress({ ...validAddr, fullName: 'J' });
    expect(r.valid).toBe(false);
    expect(r.errors).toContainEqual(expect.stringContaining('Full name'));
  });

  it('rejects short addressLine1', () => {
    const r = mod.validateShippingAddress({ ...validAddr, addressLine1: 'AB' });
    expect(r.valid).toBe(false);
  });

  it('rejects short city', () => {
    const r = mod.validateShippingAddress({ ...validAddr, city: 'X' });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid state code (3 letters)', () => {
    const r = mod.validateShippingAddress({ ...validAddr, state: 'NCC' });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid zip', () => {
    const r = mod.validateShippingAddress({ ...validAddr, zip: '1234' });
    expect(r.valid).toBe(false);
  });

  it('accepts ZIP+4 format', () => {
    const r = mod.validateShippingAddress({ ...validAddr, zip: '28792-1234' });
    expect(r.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const r = mod.validateShippingAddress({ fullName: '', addressLine1: '', city: '', state: '', zip: '' });
    expect(r.errors.length).toBeGreaterThanOrEqual(5);
  });
});

// ── getShippingOptions ────────────────────────────────────────────

describe('getShippingOptions', () => {
  it('returns 3 shipping options', () => {
    const r = mod.getShippingOptions(100);
    expect(r.success).toBe(true);
    expect(r.options).toHaveLength(3);
  });

  it('standard has correct price for small orders', () => {
    const r = mod.getShippingOptions(100);
    const std = r.options.find(o => o.id === 'standard');
    expect(std.price).toBe(49.99);
  });

  it('white glove local has correct price', () => {
    const r = mod.getShippingOptions(100);
    const wgl = r.options.find(o => o.id === 'white_glove_local');
    expect(wgl.price).toBe(149);
  });

  it('handles NaN subtotal as 0', () => {
    const r = mod.getShippingOptions(NaN);
    expect(r.success).toBe(true);
    const std = r.options.find(o => o.id === 'standard');
    expect(std.price).toBe(49.99);
  });
});

// ── getDeliveryEstimate ───────────────────────────────────────────

describe('getDeliveryEstimate', () => {
  it('returns estimate for standard shipping', () => {
    const r = mod.getDeliveryEstimate('standard');
    expect(r.success).toBe(true);
    expect(r.data.minDate).toBeTruthy();
    expect(r.data.maxDate).toBeTruthy();
    expect(r.data.label).toContain('–');
  });

  it('returns estimate for white_glove_local', () => {
    const r = mod.getDeliveryEstimate('white_glove_local');
    expect(r.success).toBe(true);
    // Local has shorter range (3-7 days) so min should be before standard min (5-14)
    expect(r.data.minDate).toBeTruthy();
  });

  it('defaults to standard for unknown method', () => {
    const r = mod.getDeliveryEstimate('drone');
    expect(r.success).toBe(true);
    expect(r.data.minDate).toBeTruthy();
  });

  it('defaults to standard when null', () => {
    const r = mod.getDeliveryEstimate(null);
    expect(r.success).toBe(true);
  });
});

// ── trackCheckoutStep ─────────────────────────────────────────────

describe('trackCheckoutStep', () => {
  it('rejects null data', async () => {
    const r = await mod.trackCheckoutStep(null);
    expect(r.success).toBe(false);
  });

  it('rejects missing sessionId', async () => {
    const r = await mod.trackCheckoutStep({ step: 'start' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Session ID');
  });

  it('rejects invalid step', async () => {
    const r = await mod.trackCheckoutStep({ sessionId: 'sess1', step: 'invalid' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Invalid step');
  });

  it('accepts all valid steps', async () => {
    for (const step of ['start', 'address', 'shipping', 'payment', 'complete', 'abandon']) {
      _collections = {};
      const r = await mod.trackCheckoutStep({ sessionId: 'sess1', step });
      expect(r.success).toBe(true);
    }
  });

  it('clamps negative cartTotal to 0', async () => {
    await mod.trackCheckoutStep({ sessionId: 'sess1', step: 'start', cartTotal: -100 });
    expect(_collections['CheckoutAnalytics'][0].cartTotal).toBe(0);
  });

  it('clamps negative itemCount to 0', async () => {
    await mod.trackCheckoutStep({ sessionId: 'sess1', step: 'start', itemCount: -5 });
    expect(_collections['CheckoutAnalytics'][0].itemCount).toBe(0);
  });

  it('serializes metadata as JSON', async () => {
    await mod.trackCheckoutStep({ sessionId: 'sess1', step: 'start', metadata: { source: 'mobile' } });
    expect(_collections['CheckoutAnalytics'][0].metadata).toBe('{"source":"mobile"}');
  });

  it('stores empty string when no metadata', async () => {
    await mod.trackCheckoutStep({ sessionId: 'sess1', step: 'start' });
    expect(_collections['CheckoutAnalytics'][0].metadata).toBe('');
  });
});

// ── getAbandonmentRate ────────────────────────────────────────────

describe('getAbandonmentRate', () => {
  it('returns 0 abandon rate when no data', async () => {
    __seed('CheckoutAnalytics', []);
    const r = await mod.getAbandonmentRate();
    expect(r.success).toBe(true);
    expect(r.data.abandonRate).toBe(0);
    expect(r.data.totalStarts).toBe(0);
  });

  it('calculates abandon rate', async () => {
    const now = new Date();
    __seed('CheckoutAnalytics', [
      { step: 'start', timestamp: now },
      { step: 'start', timestamp: now },
      { step: 'start', timestamp: now },
      { step: 'start', timestamp: now },
      { step: 'complete', timestamp: now },
    ]);
    const r = await mod.getAbandonmentRate();
    expect(r.data.totalStarts).toBe(4);
    expect(r.data.totalCompletes).toBe(1);
    expect(r.data.abandonRate).toBe(75); // (4-1)/4 * 100
  });

  it('clamps daysBack to 1-90', async () => {
    __seed('CheckoutAnalytics', []);
    const r = await mod.getAbandonmentRate(200);
    expect(r.data.period).toBe('90 days');
  });

  it('defaults daysBack to 7', async () => {
    __seed('CheckoutAnalytics', []);
    const r = await mod.getAbandonmentRate();
    expect(r.data.period).toBe('7 days');
  });

  it('handles falsy daysBack (0) as default 7', async () => {
    __seed('CheckoutAnalytics', []);
    // Number(0) || 7 = 7
    const r = await mod.getAbandonmentRate(0);
    expect(r.data.period).toBe('7 days');
  });
});

// ── getExpressCheckoutSummary ──────────────────────────────────────

describe('getExpressCheckoutSummary', () => {
  it('rejects null params', () => {
    const r = mod.getExpressCheckoutSummary(null);
    expect(r.success).toBe(false);
  });

  it('rejects empty items', () => {
    const r = mod.getExpressCheckoutSummary({ items: [], address: { state: 'NC' } });
    expect(r.success).toBe(false);
  });

  it('rejects missing address', () => {
    const r = mod.getExpressCheckoutSummary({ items: [{ price: 100, quantity: 1 }] });
    expect(r.success).toBe(false);
    expect(r.error).toContain('address');
  });

  it('rejects address without state', () => {
    const r = mod.getExpressCheckoutSummary({ items: [{ price: 100, quantity: 1 }], address: {} });
    expect(r.success).toBe(false);
  });

  it('returns express checkout summary', () => {
    const r = mod.getExpressCheckoutSummary({
      items: [{ price: 500, quantity: 1 }],
      address: { fullName: 'Jane', addressLine1: '456 Oak', city: 'Raleigh', state: 'NC', zip: '27601' },
    });
    expect(r.success).toBe(true);
    expect(r.data.subtotal).toBe(500);
    expect(r.data.expressReady).toBe(true);
    expect(r.data.shippingAddress.state).toBe('NC');
    expect(r.data.shippingAddress.fullName).toBe('Jane');
  });

  it('sanitizes address fields', () => {
    const r = mod.getExpressCheckoutSummary({
      items: [{ price: 100, quantity: 1 }],
      address: { fullName: '<script>alert(1)</script>John', addressLine1: '123', city: 'City', state: 'nc', zip: '12345' },
    });
    expect(r.data.shippingAddress.fullName).not.toContain('<script>');
    expect(r.data.shippingAddress.state).toBe('NC'); // uppercased
  });
});
