import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline mocks ─────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let _collections = {};
let _insertCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = [];
  let _limit = null;
  const chain = {
    eq: (field, val) => { filters.push({ field, type: 'eq', value: val }); return chain; },
    ne: (field, val) => { filters.push({ field, type: 'ne', value: val }); return chain; },
    ge: (field, val) => { filters.push({ field, type: 'ge', value: val }); return chain; },
    le: (field, val) => { filters.push({ field, type: 'le', value: val }); return chain; },
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
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => (_collections[col] || []).find(i => i._id === id) || null),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || `ins-${Date.now()}` };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, item) => {
      _collections[col] = (_collections[col] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
});

const mod = await import('../src/backend/coreWebVitals.web.js');
const {
  reportMetrics,
  DEFAULT_THRESHOLDS,
  VALID_DEVICE_TYPES,
  clampMetric,
  checkBudgetViolations,
} = mod;

// ═══════════════════════════════════════════════════════════════════
// Hardening: clampMetric with isFinite guard
// ═══════════════════════════════════════════════════════════════════
describe('clampMetric — isFinite hardening', () => {
  it('returns 0 for Infinity', () => {
    expect(clampMetric(Infinity, 0, 60000)).toBe(0);
  });

  it('returns 0 for -Infinity', () => {
    expect(clampMetric(-Infinity, 0, 60000)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(clampMetric(NaN, 0, 1000)).toBe(0);
  });

  it('allows valid numbers', () => {
    expect(clampMetric(500, 0, 1000)).toBe(500);
    expect(clampMetric(0, 0, 1000)).toBe(0);
    expect(clampMetric(1000, 0, 1000)).toBe(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hardening: reportMetrics with Infinity
// ═══════════════════════════════════════════════════════════════════
describe('reportMetrics — Infinity hardening', () => {
  it('clamps Infinity LCP to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: Infinity });
    expect(inserted.lcp).toBe(0);
  });

  it('clamps -Infinity FID to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', fid: -Infinity });
    expect(inserted.fid).toBe(0);
  });
});
