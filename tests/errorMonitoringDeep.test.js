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
  let filters = [];
  let _limit = null;
  const chain = {
    eq: (field, val) => { filters.push({ field, type: 'eq', value: val }); return chain; },
    ne: (field, val) => { filters.push({ field, type: 'ne', value: val }); return chain; },
    ge: (field, val) => { filters.push({ field, type: 'ge', value: val }); return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { _limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const f of filters) {
        if (f.type === 'eq') items = items.filter(i => i[f.field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'ge') items = items.filter(i => i[f.field] >= f.value);
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

// cf-4x7e Pass 2 chunk 9 retired the dashboard / details /
// updateGroupStatus / checkRateSpike / getErrorFrequency methods
// (admin tooling, never wired). Only logError remains here.
const mod = await import('../src/backend/errorMonitoring.web.js');
const {
  logError,
} = mod;

// ═══════════════════════════════════════════════════════════════════
// logError
// ═══════════════════════════════════════════════════════════════════
describe('logError', () => {
  it('logs an error with all fields', async () => {
    const result = await logError({
      message: 'Something broke',
      stack: 'Error at line 5',
      page: '/product',
      context: 'ProductPage',
      userId: 'u1',
      userAgent: 'Mozilla/5.0',
      severity: 'error',
      metadata: { key: 'val' },
    });
    expect(result.success).toBe(true);
    expect(result.groupKey).toBeTruthy();
    expect(_collections.ErrorLogs).toHaveLength(1);
    expect(_collections.ErrorGroups).toHaveLength(1);
  });

  it('returns success with empty errorData', async () => {
    const result = await logError();
    expect(result.success).toBe(true);
    expect(_collections.ErrorLogs).toHaveLength(1);
  });

  it('creates a new error group on first occurrence', async () => {
    await logError({ message: 'new error', context: 'ctx' });
    const group = _collections.ErrorGroups[0];
    expect(group.occurrenceCount).toBe(1);
    expect(group.status).toBe('active');
  });

  it('increments occurrenceCount on duplicate error', async () => {
    __seed('ErrorGroups', [{
      _id: 'g1',
      groupKey: 'ctx::new error',
      occurrenceCount: 3,
      affectedPages: '[]',
      status: 'active',
    }]);
    await logError({ message: 'new error', context: 'ctx', page: '/home' });
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    expect(group.occurrenceCount).toBe(4);
  });

  it('adds new pages to affectedPages', async () => {
    __seed('ErrorGroups', [{
      _id: 'g1',
      groupKey: 'ctx::test',
      occurrenceCount: 1,
      affectedPages: JSON.stringify(['/old']),
      status: 'active',
    }]);
    await logError({ message: 'test', context: 'ctx', page: '/new' });
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    const pages = JSON.parse(group.affectedPages);
    expect(pages).toContain('/old');
    expect(pages).toContain('/new');
  });

  it('does not duplicate existing pages in affectedPages', async () => {
    __seed('ErrorGroups', [{
      _id: 'g1',
      groupKey: 'ctx::test',
      occurrenceCount: 1,
      affectedPages: JSON.stringify(['/home']),
      status: 'active',
    }]);
    await logError({ message: 'test', context: 'ctx', page: '/home' });
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    const pages = JSON.parse(group.affectedPages);
    expect(pages).toEqual(['/home']);
  });

  it('re-opens a resolved error group on new occurrence', async () => {
    __seed('ErrorGroups', [{
      _id: 'g1',
      groupKey: 'ctx::resolved error',
      occurrenceCount: 5,
      affectedPages: '[]',
      status: 'resolved',
    }]);
    await logError({ message: 'resolved error', context: 'ctx' });
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    expect(group.status).toBe('active');
  });

  it('defaults severity to error for invalid values', async () => {
    await logError({ message: 'test', severity: 'banana' });
    expect(_collections.ErrorLogs[0].severity).toBe('error');
  });

  it('accepts warning severity', async () => {
    await logError({ message: 'test', severity: 'warning' });
    expect(_collections.ErrorLogs[0].severity).toBe('warning');
  });

  it('accepts critical severity', async () => {
    await logError({ message: 'test', severity: 'critical' });
    expect(_collections.ErrorLogs[0].severity).toBe('critical');
  });

  it('serializes object metadata to JSON string', async () => {
    await logError({ message: 'test', metadata: { foo: 'bar' } });
    expect(_collections.ErrorLogs[0].metadata).toBe('{"foo":"bar"}');
  });

  it('passes string metadata through', async () => {
    await logError({ message: 'test', metadata: 'raw string' });
    expect(_collections.ErrorLogs[0].metadata).toBe('raw string');
  });

  it('sets empty metadata when none provided', async () => {
    await logError({ message: 'test' });
    expect(_collections.ErrorLogs[0].metadata).toBe('');
  });

  it('normalizes numbers in message for groupKey', async () => {
    await logError({ message: 'Error at line 42 col 7', context: 'ctx' });
    expect(result => result.groupKey).toBeTruthy();
    const group = _collections.ErrorGroups[0];
    // numbers replaced with N
    expect(group.groupKey).toBe('ctx::Error at line N col N');
  });

  it('normalizes quoted strings in message for groupKey', async () => {
    await logError({ message: 'Cannot find "myElement"', context: 'ctx' });
    const group = _collections.ErrorGroups[0];
    expect(group.groupKey).toBe('ctx::Cannot find S');
  });

  it('handles malformed affectedPages JSON gracefully', async () => {
    __seed('ErrorGroups', [{
      _id: 'g1',
      groupKey: 'ctx::test',
      occurrenceCount: 1,
      affectedPages: 'not-json',
      status: 'active',
    }]);
    await logError({ message: 'test', context: 'ctx', page: '/new' });
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    const pages = JSON.parse(group.affectedPages);
    expect(pages).toContain('/new');
  });

  it('never throws — returns success false on internal error', async () => {
    // Force an error by making insert throw
    const wixData = (await import('wix-data')).default;
    const origInsert = wixData.insert;
    wixData.insert = async () => { throw new Error('DB down'); };
    const result = await logError({ message: 'fail' });
    expect(result.success).toBe(false);
    wixData.insert = origInsert;
  });

  it('creates group with empty affectedPages when no page', async () => {
    await logError({ message: 'no page', context: 'ctx' });
    const group = _collections.ErrorGroups[0];
    expect(group.affectedPages).toBe('[]');
  });

  it('creates group with page in affectedPages when page provided', async () => {
    await logError({ message: 'has page', context: 'ctx', page: '/checkout' });
    const group = _collections.ErrorGroups[0];
    expect(JSON.parse(group.affectedPages)).toEqual(['/checkout']);
  });
});
