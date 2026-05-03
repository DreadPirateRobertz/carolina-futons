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

describe('getTemplatesBySequence', () => {
  it('returns welcome series templates sorted by step', async () => {
    const r = await mod.getTemplatesBySequence('welcome');
    expect(r.length).toBe(3);
    expect(r[0].id).toBe('welcome_series_1');
    expect(r[1].step).toBe(2);
    expect(r[2].step).toBe(3);
  });

  it('returns cart recovery templates', async () => {
    const r = await mod.getTemplatesBySequence('cart_recovery');
    expect(r.length).toBe(3);
    expect(r[0].id).toBe('cart_recovery_1');
  });

  it('returns empty for unknown sequence', async () => {
    const r = await mod.getTemplatesBySequence('nonexistent');
    expect(r).toEqual([]);
  });
});

describe('getTemplate', () => {
  it('returns template by ID', async () => {
    const r = await mod.getTemplate('welcome_series_1');
    expect(r).not.toBeNull();
    expect(r.name).toContain('Welcome');
    expect(r.subjectLine).toContain('10% off');
  });

  it('returns null for unknown ID', async () => {
    const r = await mod.getTemplate('nonexistent');
    expect(r).toBeNull();
  });
});

describe('getTemplateIndex', () => {
  it('returns grouped template IDs', async () => {
    const r = await mod.getTemplateIndex();
    expect(r.welcome).toHaveLength(3);
    expect(r.cart_recovery).toHaveLength(3);
    expect(r.post_purchase).toHaveLength(5);
    expect(r.promotional.length).toBeGreaterThanOrEqual(3);
    expect(r.reengagement).toHaveLength(3);
  });
});

describe('resolveSubjectLine', () => {
  it('resolves variables in subject', async () => {
    const r = await mod.resolveSubjectLine('promotional_sale', { saleName: 'Spring Sale', discountPercent: '30' });
    expect(r).toContain('Spring Sale');
    expect(r).toContain('30');
  });

  it('returns empty for unknown template', async () => {
    const r = await mod.resolveSubjectLine('nonexistent');
    expect(r).toBe('');
  });
});

describe('validateTemplateVariables', () => {
  it('returns valid when all vars present', async () => {
    const r = await mod.validateTemplateVariables('welcome_series_1', {
      firstName: 'Jane', discountCode: 'WELCOME10', email: 'jane@test.com',
    });
    expect(r.valid).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it('reports missing variables', async () => {
    const r = await mod.validateTemplateVariables('welcome_series_1', { firstName: 'Jane' });
    expect(r.valid).toBe(false);
    expect(r.missing).toContain('discountCode');
    expect(r.missing).toContain('email');
  });

  it('returns invalid for unknown template', async () => {
    const r = await mod.validateTemplateVariables('nonexistent', {});
    expect(r.valid).toBe(false);
  });
});

describe('getTemplatePerformance', () => {
  it('returns zeros for no data', async () => {
    __seed('EmailQueue', []);
    const r = await mod.getTemplatePerformance('welcome_series_1');
    expect(r.sent).toBe(0);
    expect(r.failed).toBe(0);
  });

  it('counts by status', async () => {
    __seed('EmailQueue', [
      { templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'failed', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'pending', createdAt: new Date() },
    ]);
    const r = await mod.getTemplatePerformance('welcome_series_1');
    expect(r.sent).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.pending).toBe(1);
  });
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
