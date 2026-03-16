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

const mod = await import('../src/backend/errorMonitoring.web.js');
const {
  logError,
  configureAlert,
  getAlertRules,
  checkAlertConditions,
  createErrorBoundaryLogger,
} = mod;

// ═══════════════════════════════════════════════════════════════════
// configureAlert — set up alert rules for specific error conditions
// ═══════════════════════════════════════════════════════════════════
describe('configureAlert', () => {
  it('creates a payment failure alert rule', async () => {
    const result = await configureAlert({
      name: 'Payment Failures',
      contextPattern: 'checkout.payment',
      severityFilter: 'critical',
      thresholdCount: 3,
      windowMinutes: 15,
      enabled: true,
    });
    expect(result.success).toBe(true);
    expect(result.rule).toBeDefined();
    expect(result.rule.name).toBe('Payment Failures');
    const rules = _collections.AlertRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].contextPattern).toBe('checkout.payment');
  });

  it('creates an API timeout alert rule', async () => {
    const result = await configureAlert({
      name: 'API Timeouts',
      messagePattern: 'timeout',
      thresholdCount: 5,
      windowMinutes: 10,
      enabled: true,
    });
    expect(result.success).toBe(true);
    expect(result.rule.messagePattern).toBe('timeout');
  });

  it('creates a missing product data alert rule', async () => {
    const result = await configureAlert({
      name: 'Missing Product Data',
      contextPattern: 'product',
      messagePattern: 'undefined',
      thresholdCount: 2,
      windowMinutes: 30,
      enabled: true,
    });
    expect(result.success).toBe(true);
    expect(result.rule.contextPattern).toBe('product');
  });

  it('rejects alert without name', async () => {
    const result = await configureAlert({
      contextPattern: 'checkout',
      thresholdCount: 3,
      windowMinutes: 15,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects alert without threshold', async () => {
    const result = await configureAlert({
      name: 'Missing Threshold',
      contextPattern: 'checkout',
      windowMinutes: 15,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('threshold');
  });

  it('rejects alert without window', async () => {
    const result = await configureAlert({
      name: 'Missing Window',
      contextPattern: 'checkout',
      thresholdCount: 3,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('window');
  });

  it('defaults enabled to true', async () => {
    const result = await configureAlert({
      name: 'Default Enabled',
      contextPattern: 'test',
      thresholdCount: 1,
      windowMinutes: 5,
    });
    expect(result.success).toBe(true);
    expect(result.rule.enabled).toBe(true);
  });

  it('sanitizes name and patterns', async () => {
    const result = await configureAlert({
      name: '<script>alert("xss")</script>Real Name',
      contextPattern: '<b>checkout</b>',
      messagePattern: '<i>timeout</i>',
      thresholdCount: 1,
      windowMinutes: 5,
    });
    expect(result.success).toBe(true);
    expect(result.rule.name).not.toContain('<script>');
    expect(result.rule.name).toContain('Real Name');
  });

  it('clamps thresholdCount to minimum 1', async () => {
    const result = await configureAlert({
      name: 'Low Threshold',
      contextPattern: 'test',
      thresholdCount: 0,
      windowMinutes: 5,
    });
    expect(result.success).toBe(true);
    expect(result.rule.thresholdCount).toBe(1);
  });

  it('clamps windowMinutes to 1-1440 range', async () => {
    const result = await configureAlert({
      name: 'Big Window',
      contextPattern: 'test',
      thresholdCount: 1,
      windowMinutes: 9999,
    });
    expect(result.success).toBe(true);
    expect(result.rule.windowMinutes).toBeLessThanOrEqual(1440);
  });

  it('rejects non-admin', async () => {
    _mockRoles = [{ title: 'Member', _id: 'member' }];
    const result = await configureAlert({
      name: 'Unauthorized',
      contextPattern: 'test',
      thresholdCount: 1,
      windowMinutes: 5,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getAlertRules
// ═══════════════════════════════════════════════════════════════════
describe('getAlertRules', () => {
  it('returns all alert rules', async () => {
    __seed('AlertRules', [
      { _id: 'r1', name: 'Payment Failures', contextPattern: 'checkout.payment', thresholdCount: 3, windowMinutes: 15, enabled: true },
      { _id: 'r2', name: 'API Timeouts', messagePattern: 'timeout', thresholdCount: 5, windowMinutes: 10, enabled: false },
    ]);
    const result = await getAlertRules();
    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].name).toBe('Payment Failures');
  });

  it('returns empty array when no rules configured', async () => {
    __seed('AlertRules', []);
    const result = await getAlertRules();
    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(0);
  });

  it('rejects non-admin', async () => {
    _mockRoles = [];
    const result = await getAlertRules();
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// checkAlertConditions — evaluate errors against alert rules
// ═══════════════════════════════════════════════════════════════════
describe('checkAlertConditions', () => {
  it('fires alert when payment errors exceed threshold', async () => {
    __seed('AlertRules', [{
      _id: 'r1',
      name: 'Payment Failures',
      contextPattern: 'checkout.payment',
      severityFilter: 'critical',
      thresholdCount: 2,
      windowMinutes: 60,
      enabled: true,
    }]);

    const now = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', context: 'checkout.payment', severity: 'critical', _createdDate: now },
      { _id: 'l2', context: 'checkout.payment', severity: 'critical', _createdDate: now },
      { _id: 'l3', context: 'checkout.payment', severity: 'critical', _createdDate: now },
    ]);

    const result = await checkAlertConditions();
    expect(result.success).toBe(true);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].rule).toBe('Payment Failures');
    expect(result.alerts[0].triggered).toBe(true);
    expect(result.alerts[0].currentCount).toBeGreaterThanOrEqual(2);
  });

  it('does not fire alert when below threshold', async () => {
    __seed('AlertRules', [{
      _id: 'r1',
      name: 'Payment Failures',
      contextPattern: 'checkout.payment',
      severityFilter: 'critical',
      thresholdCount: 10,
      windowMinutes: 60,
      enabled: true,
    }]);

    const now = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', context: 'checkout.payment', severity: 'critical', _createdDate: now },
    ]);

    const result = await checkAlertConditions();
    expect(result.success).toBe(true);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].triggered).toBe(false);
  });

  it('skips disabled rules', async () => {
    __seed('AlertRules', [{
      _id: 'r1',
      name: 'Disabled Rule',
      contextPattern: 'checkout',
      thresholdCount: 1,
      windowMinutes: 60,
      enabled: false,
    }]);

    const now = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', context: 'checkout', _createdDate: now },
    ]);

    const result = await checkAlertConditions();
    expect(result.alerts).toHaveLength(0);
  });

  it('filters by messagePattern', async () => {
    __seed('AlertRules', [{
      _id: 'r1',
      name: 'Timeout Alert',
      messagePattern: 'timeout',
      thresholdCount: 1,
      windowMinutes: 60,
      enabled: true,
    }]);

    const now = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', message: 'Network timeout on API call', context: 'api', _createdDate: now },
      { _id: 'l2', message: 'Success', context: 'api', _createdDate: now },
    ]);

    const result = await checkAlertConditions();
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].triggered).toBe(true);
    expect(result.alerts[0].currentCount).toBe(1);
  });

  it('evaluates multiple rules independently', async () => {
    __seed('AlertRules', [
      { _id: 'r1', name: 'Payment', contextPattern: 'checkout.payment', thresholdCount: 1, windowMinutes: 60, enabled: true },
      { _id: 'r2', name: 'Product', contextPattern: 'product', thresholdCount: 5, windowMinutes: 60, enabled: true },
    ]);

    const now = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', context: 'checkout.payment', _createdDate: now },
      { _id: 'l2', context: 'product', _createdDate: now },
    ]);

    const result = await checkAlertConditions();
    expect(result.alerts).toHaveLength(2);
    const paymentAlert = result.alerts.find(a => a.rule === 'Payment');
    const productAlert = result.alerts.find(a => a.rule === 'Product');
    expect(paymentAlert.triggered).toBe(true);
    expect(productAlert.triggered).toBe(false);
  });

  it('returns empty alerts when no rules exist', async () => {
    __seed('AlertRules', []);
    const result = await checkAlertConditions();
    expect(result.success).toBe(true);
    expect(result.alerts).toHaveLength(0);
  });

  it('rejects non-admin', async () => {
    _mockRoles = [];
    const result = await checkAlertConditions();
    expect(result.success).toBe(false);
  });
});

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
});
