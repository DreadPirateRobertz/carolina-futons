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

const mod = await import('../src/backend/errorMonitoring.web.js');
const {
  logError,
  getErrorDashboard,
  getErrorDetails,
  updateErrorGroupStatus,
  checkErrorRateSpike,
  getErrorFrequency,
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

// ═══════════════════════════════════════════════════════════════════
// getErrorDashboard
// ═══════════════════════════════════════════════════════════════════
describe('getErrorDashboard', () => {
  it('returns dashboard summary for admin', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k1', message: 'err1', occurrenceCount: 10, lastSeen: new Date(), status: 'active', affectedPages: '[]', sampleStack: 'stack' },
    ]);
    __seed('ErrorLogs', [
      { _id: 'l1', _createdDate: new Date(), severity: 'error' },
      { _id: 'l2', _createdDate: new Date(), severity: 'critical' },
    ]);
    const result = await getErrorDashboard();
    expect(result.success).toBe(true);
    expect(result.summary.totalErrors).toBe(2);
    expect(result.summary.criticalErrors).toBe(1);
    expect(result.summary.activeGroups).toBe(1);
    expect(result.topErrors).toHaveLength(1);
  });

  it('uses default days=7 and limit=50', async () => {
    __seed('ErrorGroups', []);
    __seed('ErrorLogs', []);
    const result = await getErrorDashboard();
    expect(result.success).toBe(true);
    expect(result.summary.period).toBe('7 days');
  });

  it('respects custom days option', async () => {
    __seed('ErrorGroups', []);
    __seed('ErrorLogs', []);
    const result = await getErrorDashboard({ days: 30 });
    expect(result.success).toBe(true);
    expect(result.summary.period).toBe('30 days');
  });

  it('parses affectedPages in topErrors', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k', message: 'e', occurrenceCount: 1, lastSeen: new Date(), status: 'active', affectedPages: JSON.stringify(['/home', '/cart']), sampleStack: '' },
    ]);
    __seed('ErrorLogs', []);
    const result = await getErrorDashboard();
    expect(result.topErrors[0].affectedPages).toEqual(['/home', '/cart']);
  });

  it('falls back for invalid affectedPages JSON', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k', message: 'e', occurrenceCount: 1, lastSeen: new Date(), status: 'active', affectedPages: 'broken', sampleStack: '' },
    ]);
    __seed('ErrorLogs', []);
    const result = await getErrorDashboard();
    expect(result.topErrors[0].affectedPages).toEqual([]);
  });

  it('fails for non-admin users', async () => {
    _mockRoles = [{ title: 'Member', _id: 'member' }];
    const result = await getErrorDashboard();
    expect(result.success).toBe(false);
  });

  it('fails for unauthenticated users', async () => {
    _mockMember = null;
    const result = await getErrorDashboard();
    expect(result.success).toBe(false);
  });

  it('counts resolved groups', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k1', message: 'e1', occurrenceCount: 5, lastSeen: new Date(), status: 'resolved', affectedPages: '[]', sampleStack: '' },
      { _id: 'g2', groupKey: 'k2', message: 'e2', occurrenceCount: 3, lastSeen: new Date(), status: 'active', affectedPages: '[]', sampleStack: '' },
    ]);
    __seed('ErrorLogs', []);
    const result = await getErrorDashboard();
    expect(result.summary.resolvedGroups).toBe(1);
    expect(result.summary.activeGroups).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getErrorDetails
// ═══════════════════════════════════════════════════════════════════
describe('getErrorDetails', () => {
  it('returns group and recent logs', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'ctx::err', message: 'err', occurrenceCount: 5, firstSeen: new Date(), lastSeen: new Date(), status: 'active', affectedPages: '[]', sampleStack: 'stack', resolvedBy: null, resolvedDate: null },
    ]);
    __seed('ErrorLogs', [
      { _id: 'l1', errorGroup: 'ctx::err', message: 'err', stack: 'stack', page: '/p', context: 'ctx', userId: 'u1', userAgent: 'UA', severity: 'error', metadata: '{}', _createdDate: new Date() },
    ]);
    const result = await getErrorDetails('ctx::err');
    expect(result.success).toBe(true);
    expect(result.group.groupKey).toBe('ctx::err');
    expect(result.recentLogs).toHaveLength(1);
  });

  it('returns error for empty groupKey', async () => {
    const result = await getErrorDetails('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('returns error for non-existent group', async () => {
    __seed('ErrorGroups', []);
    const result = await getErrorDetails('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for non-admin users', async () => {
    _mockRoles = [];
    const result = await getErrorDetails('some-key');
    expect(result.success).toBe(false);
  });

  it('parses metadata JSON in logs', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k', message: 'e', occurrenceCount: 1, firstSeen: new Date(), lastSeen: new Date(), status: 'active', affectedPages: '[]', sampleStack: '' },
    ]);
    __seed('ErrorLogs', [
      { _id: 'l1', errorGroup: 'k', message: 'e', metadata: '{"x":1}', _createdDate: new Date() },
    ]);
    const result = await getErrorDetails('k');
    expect(result.recentLogs[0].metadata).toEqual({ x: 1 });
  });

  it('falls back for invalid metadata JSON in logs', async () => {
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k', message: 'e', occurrenceCount: 1, firstSeen: new Date(), lastSeen: new Date(), status: 'active', affectedPages: '[]', sampleStack: '' },
    ]);
    __seed('ErrorLogs', [
      { _id: 'l1', errorGroup: 'k', message: 'e', metadata: 'broken', _createdDate: new Date() },
    ]);
    const result = await getErrorDetails('k');
    expect(result.recentLogs[0].metadata).toEqual({});
  });

  it('includes resolvedBy and resolvedDate when present', async () => {
    const rd = new Date('2025-01-01');
    __seed('ErrorGroups', [
      { _id: 'g1', groupKey: 'k', message: 'e', occurrenceCount: 1, firstSeen: new Date(), lastSeen: new Date(), status: 'resolved', affectedPages: '[]', sampleStack: '', resolvedBy: 'admin-1', resolvedDate: rd },
    ]);
    __seed('ErrorLogs', []);
    const result = await getErrorDetails('k');
    expect(result.group.resolvedBy).toBe('admin-1');
    expect(result.group.resolvedDate).toEqual(rd);
  });
});

// ═══════════════════════════════════════════════════════════════════
// updateErrorGroupStatus
// ═══════════════════════════════════════════════════════════════════
describe('updateErrorGroupStatus', () => {
  it('updates group status to resolved', async () => {
    __seed('ErrorGroups', [{ _id: 'g1', groupKey: 'k', status: 'active' }]);
    const result = await updateErrorGroupStatus('g1', 'resolved');
    expect(result.success).toBe(true);
    expect(result.status).toBe('resolved');
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    expect(group.resolvedBy).toBe('admin-1');
    expect(group.resolvedDate).toBeInstanceOf(Date);
  });

  it('updates group status to ignored', async () => {
    __seed('ErrorGroups', [{ _id: 'g1', groupKey: 'k', status: 'active' }]);
    const result = await updateErrorGroupStatus('g1', 'ignored');
    expect(result.success).toBe(true);
    expect(result.status).toBe('ignored');
  });

  it('updates group status to active', async () => {
    __seed('ErrorGroups', [{ _id: 'g1', groupKey: 'k', status: 'resolved' }]);
    const result = await updateErrorGroupStatus('g1', 'active');
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', async () => {
    const result = await updateErrorGroupStatus('g1', 'banana');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('rejects empty groupId', async () => {
    const result = await updateErrorGroupStatus('', 'resolved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('returns error for non-existent group', async () => {
    __seed('ErrorGroups', []);
    const result = await updateErrorGroupStatus('nonexistent', 'resolved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for non-admin users', async () => {
    _mockRoles = [{ title: 'Viewer', _id: 'viewer' }];
    const result = await updateErrorGroupStatus('g1', 'resolved');
    expect(result.success).toBe(false);
  });

  it('does not set resolvedBy/Date for non-resolved status', async () => {
    __seed('ErrorGroups', [{ _id: 'g1', groupKey: 'k', status: 'active' }]);
    await updateErrorGroupStatus('g1', 'ignored');
    const group = _collections.ErrorGroups.find(g => g._id === 'g1');
    expect(group.resolvedBy).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// checkErrorRateSpike
// ═══════════════════════════════════════════════════════════════════
describe('checkErrorRateSpike', () => {
  it('detects no spike when hourly rate is below threshold', async () => {
    // 24 errors spread across 24h baseline = 1/hr avg, spike needs 10+ in last hour
    // Seed 24 errors with old timestamps (>1hr ago) so spikeCount=0
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    __seed('ErrorLogs', Array.from({ length: 24 }, (_, i) => ({
      _id: `l${i}`, _createdDate: twoHoursAgo,
    })));
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(true);
    expect(result.isSpike).toBe(false);
  });

  it('returns spike metrics', async () => {
    __seed('ErrorLogs', []);
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('currentHourCount');
    expect(result).toHaveProperty('hourlyBaseline');
    expect(result).toHaveProperty('threshold');
    expect(result.baselinePeriod).toBe('24 hours');
    expect(result.spikePeriod).toBe('1 hour');
  });

  it('no spike when baseline is zero', async () => {
    __seed('ErrorLogs', []);
    const result = await checkErrorRateSpike();
    expect(result.isSpike).toBe(false);
  });

  it('fails for non-admin', async () => {
    _mockRoles = [];
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(false);
  });

  it('fails for unauthenticated user', async () => {
    _mockMember = null;
    const result = await checkErrorRateSpike();
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getErrorFrequency
// ═══════════════════════════════════════════════════════════════════
describe('getErrorFrequency', () => {
  it('returns frequency data grouped by date', async () => {
    const d = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', _createdDate: d, severity: 'error', page: '/home' },
      { _id: 'l2', _createdDate: d, severity: 'warning', page: '/home' },
      { _id: 'l3', _createdDate: d, severity: 'critical', page: '/cart' },
    ]);
    const result = await getErrorFrequency(7);
    expect(result.success).toBe(true);
    expect(result.totalErrors).toBe(3);
    expect(result.bySeverity.error).toBe(1);
    expect(result.bySeverity.warning).toBe(1);
    expect(result.bySeverity.critical).toBe(1);
    expect(result.topPages.length).toBeGreaterThanOrEqual(1);
  });

  it('clamps days to minimum 1', async () => {
    __seed('ErrorLogs', []);
    const result = await getErrorFrequency(0);
    expect(result.success).toBe(true);
    expect(result.period).toBe('1 days');
  });

  it('clamps days to maximum 90', async () => {
    __seed('ErrorLogs', []);
    const result = await getErrorFrequency(200);
    expect(result.success).toBe(true);
    expect(result.period).toBe('90 days');
  });

  it('defaults to 7 days', async () => {
    __seed('ErrorLogs', []);
    const result = await getErrorFrequency();
    expect(result.success).toBe(true);
    expect(result.period).toBe('7 days');
  });

  it('sorts frequency by date ascending', async () => {
    const now = Date.now();
    const d1 = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const d2 = new Date(now - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const d3 = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    __seed('ErrorLogs', [
      { _id: 'l1', _createdDate: d1, severity: 'error' },
      { _id: 'l2', _createdDate: d2, severity: 'error' },
      { _id: 'l3', _createdDate: d3, severity: 'error' },
    ]);
    const result = await getErrorFrequency(7);
    expect(result.frequency.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < result.frequency.length; i++) {
      expect(result.frequency[i].date >= result.frequency[i - 1].date).toBe(true);
    }
  });

  it('returns top pages sorted by count descending', async () => {
    const d = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', _createdDate: d, severity: 'error', page: '/cart' },
      { _id: 'l2', _createdDate: d, severity: 'error', page: '/home' },
      { _id: 'l3', _createdDate: d, severity: 'error', page: '/home' },
      { _id: 'l4', _createdDate: d, severity: 'error', page: '/home' },
    ]);
    const result = await getErrorFrequency(7);
    expect(result.topPages[0].page).toBe('/home');
    expect(result.topPages[0].count).toBe(3);
  });

  it('handles logs with no page', async () => {
    const d = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', _createdDate: d, severity: 'error' },
    ]);
    const result = await getErrorFrequency(7);
    expect(result.topPages).toHaveLength(0);
  });

  it('handles logs with unknown severity', async () => {
    const d = new Date();
    __seed('ErrorLogs', [
      { _id: 'l1', _createdDate: d, page: '/x' },
    ]);
    const result = await getErrorFrequency(7);
    // undefined severity falls back to 'error' in source
    expect(result.bySeverity.error).toBe(1);
  });

  it('fails for non-admin', async () => {
    _mockRoles = [];
    const result = await getErrorFrequency();
    expect(result.success).toBe(false);
  });

  it('handles _createdDate with undefined — ge filter excludes it', async () => {
    // undefined >= Date is false, so the ge filter drops it
    __seed('ErrorLogs', [
      { _id: 'l1', severity: 'error', _createdDate: undefined },
    ]);
    const result = await getErrorFrequency(90);
    // Item is filtered out by ge('_createdDate', cutoff) since undefined >= Date is false
    expect(result.totalErrors).toBe(0);
  });
});
