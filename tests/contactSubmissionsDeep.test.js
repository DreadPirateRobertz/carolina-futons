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
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/contactSubmissions.web.js');
});

describe('submitContactForm', () => {
  it('rejects missing data', async () => {
    const r = await mod.submitContactForm(null);
    expect(r.success).toBe(false);
  });

  it('rejects missing email', async () => {
    const r = await mod.submitContactForm({ name: 'Jane' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const r = await mod.submitContactForm({ email: 'bad' });
    expect(r.success).toBe(false);
  });

  it('inserts valid submission', async () => {
    __seed('ContactSubmissions', []);
    const r = await mod.submitContactForm({
      email: 'jane@test.com',
      name: 'Jane',
      source: 'exit_intent_popup',
      notes: 'Interested in futons',
    });
    expect(r.success).toBe(true);
    expect(_collections['ContactSubmissions']).toHaveLength(1);
    expect(_collections['ContactSubmissions'][0].email).toBe('jane@test.com');
    expect(_collections['ContactSubmissions'][0].source).toBe('exit_intent_popup');
  });

  it('silently succeeds when 3/hour rate limit is reached', async () => {
    __seed('ContactRateLimits', [{
      _id: 'rl-1',
      key: 'jane@test.com',
      count: 3,
      windowStart: new Date(Date.now() - 1000),
    }]);
    __seed('ContactSubmissions', []);
    const r = await mod.submitContactForm({ email: 'jane@test.com' });
    expect(r.success).toBe(true);
    // Should NOT have inserted to ContactSubmissions when rate limited
    expect((_collections['ContactSubmissions'] || [])).toHaveLength(0);
  });

  it('lowercases email', async () => {
    __seed('ContactSubmissions', []);
    await mod.submitContactForm({ email: 'JANE@TEST.COM' });
    expect(_collections['ContactSubmissions'][0].email).toBe('jane@test.com');
  });
});
