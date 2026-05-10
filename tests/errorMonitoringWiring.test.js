import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline mocks (self-contained Deep-test style) ────────────────────

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
  let filters = [];
  let _limit = null;
  const chain = {
    eq: (field, val) => { filters.push({ field, type: 'eq', value: val }); return chain; },
    ne: (field, val) => { filters.push({ field, type: 'ne', value: val }); return chain; },
    ge: (field, val) => { filters.push({ field, type: 'ge', value: val }); return chain; },
    le: (field, val) => { filters.push({ field, type: 'le', value: val }); return chain; },
    contains: (field, val) => { filters.push({ field, type: 'contains', value: val }); return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { _limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        if (f.type === 'eq') items = items.filter(i => i[f.field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
        if (f.type === 'le') items = items.filter(i => i[f.field] <= f.value);
        if (f.type === 'contains') items = items.filter(i => (i[f.field] || '').includes(f.value));
      }
      if (_limit) items = items.slice(0, _limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        if (f.type === 'eq') items = items.filter(i => i[f.field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
        if (f.type === 'le') items = items.filter(i => i[f.field] <= f.value);
        if (f.type === 'contains') items = items.filter(i => (i[f.field] || '').includes(f.value));
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    },
    remove: async (collection, id) => {
      _collections[collection] = (_collections[collection] || []).filter(i => i._id !== id);
    },
  },
}));

let _mockMember = { _id: 'admin-1' };
let _mockRoles = [{ title: 'Admin', _id: 'admin' }];

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
    getRoles: async () => _mockRoles,
  },
}));

beforeEach(() => {
  _collections = {};
  _mockMember = { _id: 'admin-1' };
  _mockRoles = [{ title: 'Admin', _id: 'admin' }];
});

// cf-4x7e Pass 2 chunk 9 retired the alert-rules surface
// (configureAlert, getAlertRules, checkAlertConditions — admin tooling,
// never wired). Only logError + createErrorBoundaryLogger remain.
const mod = await import('../src/backend/errorMonitoring.web.js');
const {
  logError,
  createErrorBoundaryLogger,
} = mod;

// ═══════════════════════════════════════════════════════════════════
// createErrorBoundaryLogger — generate context-aware error loggers
// ═══════════════════════════════════════════════════════════════════
describe('createErrorBoundaryLogger', () => {
  it('creates a logger for checkout flow', () => {
    const logger = createErrorBoundaryLogger('checkout');
    expect(typeof logger).toBe('function');
  });

  it('logs error with correct context when invoked', async () => {
    const logger = createErrorBoundaryLogger('checkout.payment');
    const result = await logger(new Error('Payment declined'), { orderId: '123' });

    expect(result.success).toBe(true);
    expect(result.groupKey).toBeTruthy();

    const logs = _collections.ErrorLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0].context).toBe('checkout.payment');
    expect(logs[0].severity).toBe('critical');
  });

  it('logs cart errors with error severity', async () => {
    const logger = createErrorBoundaryLogger('cart');
    const result = await logger(new Error('Cart update failed'));

    expect(result.success).toBe(true);
    const logs = _collections.ErrorLogs;
    expect(logs[0].context).toBe('cart');
    expect(logs[0].severity).toBe('error');
  });

  it('logs product page errors with error severity', async () => {
    const logger = createErrorBoundaryLogger('product');
    const result = await logger(new Error('Product not found'));

    expect(result.success).toBe(true);
    const logs = _collections.ErrorLogs;
    expect(logs[0].context).toBe('product');
  });

  it('captures error message and stack', async () => {
    const logger = createErrorBoundaryLogger('test');
    const error = new Error('Test error');
    await logger(error);

    const logs = _collections.ErrorLogs;
    expect(logs[0].message).toBe('Test error');
    expect(logs[0].stack).toBeTruthy();
  });

  it('includes metadata in logged error', async () => {
    const logger = createErrorBoundaryLogger('checkout');
    await logger(new Error('Fail'), { orderId: 'ord-1', step: 'confirmation' });

    const logs = _collections.ErrorLogs;
    const metadata = logs[0].metadata;
    expect(metadata).toContain('orderId');
    expect(metadata).toContain('ord-1');
  });

  it('handles string errors', async () => {
    const logger = createErrorBoundaryLogger('cart');
    const result = await logger('Something went wrong');

    expect(result.success).toBe(true);
    const logs = _collections.ErrorLogs;
    expect(logs[0].message).toBe('Something went wrong');
  });

  it('handles null error gracefully', async () => {
    const logger = createErrorBoundaryLogger('cart');
    const result = await logger(null);

    expect(result.success).toBe(true);
    const logs = _collections.ErrorLogs;
    expect(logs[0].message).toBe('Unknown error');
  });

  it('uses critical severity for checkout context', async () => {
    const logger = createErrorBoundaryLogger('checkout.submit');
    await logger(new Error('fail'));
    expect(_collections.ErrorLogs[0].severity).toBe('critical');
  });

  it('uses critical severity for payment context', async () => {
    const logger = createErrorBoundaryLogger('payment.process');
    await logger(new Error('fail'));
    expect(_collections.ErrorLogs[0].severity).toBe('critical');
  });

  it('uses error severity for non-checkout contexts', async () => {
    const logger = createErrorBoundaryLogger('product.gallery');
    await logger(new Error('fail'));
    expect(_collections.ErrorLogs[0].severity).toBe('error');
  });

  it('never throws even when logError fails internally', async () => {
    // Force wixData.insert to throw
    const wixData = (await import('wix-data')).default;
    const origInsert = wixData.insert;
    wixData.insert = async () => { throw new Error('DB down'); };

    const logger = createErrorBoundaryLogger('checkout');
    const result = await logger(new Error('payment failed'));
    // Must return gracefully, never throw
    expect(result).toBeDefined();
    expect(result.success).toBe(false);

    wixData.insert = origInsert;
  });

  it('handles non-string context gracefully', () => {
    const logger = createErrorBoundaryLogger(null);
    expect(typeof logger).toBe('function');
  });

  it('handles numeric context gracefully', async () => {
    const logger = createErrorBoundaryLogger(42);
    const result = await logger(new Error('test'));
    expect(result.success).toBe(true);
  });

  it('case-insensitive: "Checkout" gets critical severity', async () => {
    const logger = createErrorBoundaryLogger('Checkout.submit');
    await logger(new Error('fail'));
    expect(_collections.ErrorLogs[0].severity).toBe('critical');
  });

  it('case-insensitive: "PAYMENT" gets critical severity', async () => {
    const logger = createErrorBoundaryLogger('PAYMENT.process');
    await logger(new Error('fail'));
    expect(_collections.ErrorLogs[0].severity).toBe('critical');
  });

  it('detects payment in nested context via includes', async () => {
    const logger = createErrorBoundaryLogger('order.payment.confirm');
    await logger(new Error('fail'));
    expect(_collections.ErrorLogs[0].severity).toBe('critical');
  });
});

