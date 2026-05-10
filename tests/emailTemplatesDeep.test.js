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
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
      }
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: `ins-${Date.now()}-${Math.random()}` };
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
  mod = await import('../src/backend/emailTemplates.web.js');
});

describe('queuePromotionalEmail', () => {
  it('rejects non-marketing template', async () => {
    const r = await mod.queuePromotionalEmail('welcome_series_1', []);
    expect(r.success).toBe(false);
  });

  it('queues emails for recipients', async () => {
    __seed('Unsubscribes', []);
    __seed('EmailQueue', []);
    const r = await mod.queuePromotionalEmail(
      'promotional_sale',
      [{ email: 'jane@test.com', contactId: 'c1', firstName: 'Jane' }],
      { saleName: 'Spring Sale', discountPercent: 30 },
    );
    expect(r.success).toBe(true);
    expect(r.queued).toBe(1);
    expect(_collections['EmailQueue']).toHaveLength(1);
  });

  it('skips unsubscribed recipients', async () => {
    __seed('Unsubscribes', [{ email: 'jane@test.com', sequenceType: 'promotional' }]);
    __seed('EmailQueue', []);
    const r = await mod.queuePromotionalEmail(
      'promotional_sale',
      [{ email: 'jane@test.com', contactId: 'c1', firstName: 'Jane' }],
      {},
    );
    expect(r.queued).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it('skips empty email', async () => {
    __seed('Unsubscribes', []);
    __seed('EmailQueue', []);
    const r = await mod.queuePromotionalEmail(
      'promotional_sale',
      [{ email: '', contactId: 'c1', firstName: 'Jane' }],
      {},
    );
    expect(r.skipped).toBe(1);
  });
});
