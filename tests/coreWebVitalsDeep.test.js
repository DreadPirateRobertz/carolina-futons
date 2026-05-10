import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let _collections = {};
let _insertCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}
function __onInsert(cb) { _insertCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field.startsWith('_')) continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => (_collections[col] || []).find(i => i._id === id) || null),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'a1b2c3d4-0000-0000-0000-000000000001' };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import {
  reportMetrics,
  DEFAULT_THRESHOLDS,
  VALID_DEVICE_TYPES,
  clampMetric,
  checkBudgetViolations,
} from '../src/backend/coreWebVitals.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
});

// ── clampMetric — deep edge cases ───────────────────────────────────

describe('clampMetric — deep edge cases', () => {
  it('returns 0 for NaN', () => {
    expect(clampMetric(NaN, 0, 1000)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(clampMetric(undefined, 0, 1000)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(clampMetric(null, 0, 1000)).toBe(0);
  });

  it('returns 0 for string', () => {
    expect(clampMetric('500', 0, 1000)).toBe(0);
  });

  it('clamps below min', () => {
    expect(clampMetric(-5, 0, 1000)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clampMetric(99999, 0, 1000)).toBe(1000);
  });

  it('returns value within range', () => {
    expect(clampMetric(500, 0, 1000)).toBe(500);
  });

  it('returns 0 for Infinity (isFinite guard rejects it)', () => {
    expect(clampMetric(Infinity, 0, 60000)).toBe(0);
  });

  it('returns 0 for -Infinity', () => {
    expect(clampMetric(-Infinity, 0, 60000)).toBe(0);
  });
});

// ── checkBudgetViolations — deep edge cases ─────────────────────────

describe('checkBudgetViolations — deep edge cases', () => {
  it('returns empty for all-green metrics', () => {
    const violations = checkBudgetViolations({ lcp: 1000, inp: 50, cls: 0.05 });
    expect(violations.length).toBe(0);
  });

  it('detects poor LCP', () => {
    const violations = checkBudgetViolations({ lcp: 5000, inp: 50, cls: 0.05 });
    expect(violations.length).toBe(1);
    expect(violations[0].metric).toBe('lcp');
    expect(violations[0].severity).toBe('poor');
  });

  it('detects needs-improvement INP', () => {
    const violations = checkBudgetViolations({ lcp: 1000, inp: 300, cls: 0.05 });
    expect(violations.length).toBe(1);
    expect(violations[0].metric).toBe('inp');
    expect(violations[0].severity).toBe('needs-improvement');
  });

  it('skips metrics that are 0', () => {
    const violations = checkBudgetViolations({ lcp: 0, inp: 0, cls: 0 });
    expect(violations.length).toBe(0);
  });

  it('skips non-number metrics', () => {
    const violations = checkBudgetViolations({ lcp: 'fast', inp: null, cls: undefined });
    expect(violations.length).toBe(0);
  });

  it('only checks lcp, inp, cls (not fid, ttfb, fcp)', () => {
    const violations = checkBudgetViolations({ fid: 99999, ttfb: 99999, fcp: 99999 });
    expect(violations.length).toBe(0);
  });
});

// ── reportMetrics — deep edge cases ─────────────────────────────────

describe('reportMetrics — deep edge cases', () => {
  it('rejects null data', async () => {
    const result = await reportMetrics(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('sessionId');
  });

  it('rejects missing sessionId', async () => {
    const result = await reportMetrics({ page: '/home' });
    expect(result.success).toBe(false);
  });

  it('rejects missing page', async () => {
    const result = await reportMetrics({ sessionId: 'sess-1' });
    expect(result.success).toBe(false);
  });

  it('defaults deviceType to desktop for invalid value', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PerformanceMetrics') inserted = item; });

    await reportMetrics({ sessionId: 'sess-1', page: '/home', deviceType: 'smartwatch' });
    expect(inserted.deviceType).toBe('desktop');
  });

  it('accepts valid device types', async () => {
    for (const dt of ['mobile', 'tablet', 'desktop']) {
      _insertCbs = [];
      let inserted = null;
      __onInsert((col, item) => { inserted = item; });

      await reportMetrics({ sessionId: `sess-${dt}`, page: '/test', deviceType: dt });
      expect(inserted.deviceType).toBe(dt);
    }
  });

  it('clamps LCP to 60000 max', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: 99999 });
    expect(inserted.lcp).toBe(60000);
  });

  it('clamps CLS to 10 max', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', cls: 50 });
    expect(inserted.cls).toBe(10);
  });

  it('clamps negative metrics to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: -100, fid: -50 });
    expect(inserted.lcp).toBe(0);
    expect(inserted.fid).toBe(0);
  });

  it('sets NaN metrics to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p', lcp: NaN, cls: NaN });
    expect(inserted.lcp).toBe(0);
    expect(inserted.cls).toBe(0);
  });

  it('returns violations for poor metrics', async () => {
    const result = await reportMetrics({
      sessionId: 's1',
      page: '/p',
      lcp: 5000, // poor (> 4000)
      inp: 100,  // good
      cls: 0.3,  // poor (> 0.25)
    });
    expect(result.success).toBe(true);
    expect(result.violations.length).toBe(2);
    expect(result.violations[0].metric).toBe('lcp');
    expect(result.violations[1].metric).toBe('cls');
  });

  it('returns empty violations for good metrics', async () => {
    const result = await reportMetrics({
      sessionId: 's1',
      page: '/p',
      lcp: 1000,
      inp: 50,
      cls: 0.05,
    });
    expect(result.violations.length).toBe(0);
  });

  it('defaults connectionType to "unknown"', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await reportMetrics({ sessionId: 's1', page: '/p' });
    expect(inserted.connectionType).toBe('unknown');
  });
});
