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
let _insertCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
      }
      return items.length;
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2,6)}` };
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
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

beforeEach(() => { _collections = {}; _insertCbs = []; });

const mod = await import('../src/backend/abTesting.web.js');
const { getVariant, trackEvent, getTestResults, concludeTest, createTest, simpleHash, assignVariant, calculateSignificance, parseVariants } = mod;

const twoVariants = JSON.stringify([
  { id: 'control', name: 'Control', weight: 50 },
  { id: 'treatment', name: 'Treatment', weight: 50 },
]);

// ═════════════════════════════════════════════════════════════════════
// simpleHash (internal)
// ═════════════════════════════════════════════════════════════════════
describe('simpleHash', () => {
  it('returns a non-negative integer', () => {
    const h = simpleHash('test');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('is deterministic', () => {
    expect(simpleHash('abc')).toBe(simpleHash('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(simpleHash('abc')).not.toBe(simpleHash('def'));
  });

  it('handles empty string', () => {
    expect(simpleHash('')).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// parseVariants (internal)
// ═════════════════════════════════════════════════════════════════════
describe('parseVariants', () => {
  it('parses JSON string', () => {
    const result = parseVariants('[{"id":"a","name":"A"}]');
    expect(result).toHaveLength(1);
  });

  it('returns array as-is', () => {
    const arr = [{ id: 'a', name: 'A' }];
    expect(parseVariants(arr)).toBe(arr);
  });

  it('returns empty array for null', () => {
    expect(parseVariants(null)).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    expect(parseVariants('not-json')).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// assignVariant (internal)
// ═════════════════════════════════════════════════════════════════════
describe('assignVariant', () => {
  it('deterministically assigns same visitor to same variant', () => {
    const variants = [{ id: 'a', weight: 50 }, { id: 'b', weight: 50 }];
    const v1 = assignVariant('test', 'visitor-1', variants);
    const v2 = assignVariant('test', 'visitor-1', variants);
    expect(v1.id).toBe(v2.id);
  });

  it('handles single variant', () => {
    const variants = [{ id: 'only', weight: 100 }];
    const v = assignVariant('test', 'visitor', variants);
    expect(v.id).toBe('only');
  });

  it('distributes across multiple variants', () => {
    const variants = [{ id: 'a', weight: 50 }, { id: 'b', weight: 50 }];
    const assignments = new Set();
    for (let i = 0; i < 100; i++) {
      assignments.add(assignVariant('test', `visitor-${i}`, variants).id);
    }
    expect(assignments.size).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// calculateSignificance (internal)
// ═════════════════════════════════════════════════════════════════════
describe('calculateSignificance', () => {
  it('returns not significant for zero impressions', () => {
    const result = calculateSignificance(0, 0, 100, 50);
    expect(result.significant).toBe(false);
    expect(result.pValue).toBe(1);
  });

  it('returns not significant for identical rates', () => {
    const result = calculateSignificance(1000, 100, 1000, 100);
    expect(result.significant).toBe(false);
    expect(result.zScore).toBe(0);
  });

  it('returns significant for large difference with sufficient data', () => {
    // 50% vs 30% with 1000 samples each should be significant
    const result = calculateSignificance(1000, 500, 1000, 300);
    expect(result.significant).toBe(true);
    expect(result.confidence).toBeGreaterThan(95);
  });

  it('returns not significant for small difference with few samples', () => {
    const result = calculateSignificance(10, 5, 10, 4);
    expect(result.significant).toBe(false);
  });

  it('handles all-zero conversions (pPooled=0)', () => {
    const result = calculateSignificance(100, 0, 100, 0);
    expect(result.significant).toBe(false);
    expect(result.pValue).toBe(1);
  });

  it('handles all-converted (pPooled=1)', () => {
    const result = calculateSignificance(100, 100, 100, 100);
    expect(result.significant).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getVariant
// ═════════════════════════════════════════════════════════════════════
describe('getVariant', () => {
  it('assigns a variant for active test', async () => {
    __seed('AbTests', [{ testName: 'cta-color', active: true, trafficPercent: 100, variants: twoVariants, winnerVariant: '' }]);
    const result = await getVariant('cta-color', 'visitor-123');
    expect(result.success).toBe(true);
    expect(['control', 'treatment']).toContain(result.variant.id);
    expect(result.testActive).toBe(true);
  });

  it('returns winner for inactive test', async () => {
    __seed('AbTests', [{ testName: 'old-test', active: false, trafficPercent: 100, variants: twoVariants, winnerVariant: 'treatment' }]);
    const result = await getVariant('old-test', 'visitor-1');
    expect(result.success).toBe(true);
    expect(result.variant.id).toBe('treatment');
    expect(result.testActive).toBe(false);
  });

  it('returns first variant when inactive and no winner set', async () => {
    __seed('AbTests', [{ testName: 'old', active: false, variants: twoVariants, winnerVariant: '' }]);
    const result = await getVariant('old', 'visitor-1');
    expect(result.variant.id).toBe('control');
  });

  it('requires testName', async () => {
    const result = await getVariant('', 'visitor-1');
    expect(result.success).toBe(false);
  });

  it('requires visitorId', async () => {
    const result = await getVariant('test', '');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent test', async () => {
    __seed('AbTests', []);
    const result = await getVariant('nonexistent', 'visitor-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for test with no variants', async () => {
    __seed('AbTests', [{ testName: 'empty', active: true, variants: '[]' }]);
    const result = await getVariant('empty', 'visitor-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no variants');
  });

  it('is deterministic — same visitor gets same variant', async () => {
    __seed('AbTests', [{ testName: 't', active: true, trafficPercent: 100, variants: twoVariants }]);
    const r1 = await getVariant('t', 'visitor-stable');
    const r2 = await getVariant('t', 'visitor-stable');
    expect(r1.variant.id).toBe(r2.variant.id);
  });

  it('handles partial traffic allocation', async () => {
    __seed('AbTests', [{ testName: 't', active: true, trafficPercent: 50, variants: twoVariants }]);
    // Some visitors will be in test, some won't — just verify no crash
    const result = await getVariant('t', 'visitor-1');
    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackEvent
// ═════════════════════════════════════════════════════════════════════
describe('trackEvent', () => {
  it('tracks an impression', async () => {
    const result = await trackEvent('test-1', 'control', 'visitor-1', 'impression', '/home');
    expect(result.success).toBe(true);
    expect(_collections.AbEvents).toHaveLength(1);
    expect(_collections.AbEvents[0].eventType).toBe('impression');
  });

  it('tracks a conversion', async () => {
    const result = await trackEvent('test-1', 'treatment', 'visitor-1', 'conversion');
    expect(result.success).toBe(true);
    expect(_collections.AbEvents[0].eventType).toBe('conversion');
  });

  it('requires testName', async () => {
    const result = await trackEvent('', 'v', 'vis', 'impression');
    expect(result.success).toBe(false);
  });

  it('requires variantId', async () => {
    const result = await trackEvent('t', '', 'vis', 'impression');
    expect(result.success).toBe(false);
  });

  it('requires visitorId', async () => {
    const result = await trackEvent('t', 'v', '', 'impression');
    expect(result.success).toBe(false);
  });

  it('requires eventType', async () => {
    const result = await trackEvent('t', 'v', 'vis', '');
    expect(result.success).toBe(false);
  });

  it('rejects invalid eventType', async () => {
    const result = await trackEvent('t', 'v', 'vis', 'click');
    expect(result.success).toBe(false);
  });

  it('lowercases eventType', async () => {
    const result = await trackEvent('t', 'v', 'vis', 'Impression');
    expect(result.success).toBe(true);
  });

  it('defaults page to empty string', async () => {
    await trackEvent('t', 'v', 'vis', 'impression');
    expect(_collections.AbEvents[0].page).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getTestResults
// ═════════════════════════════════════════════════════════════════════
describe('getTestResults', () => {
  it('returns results with conversion rates', async () => {
    __seed('AbTests', [{ testName: 'cta', active: true, variants: twoVariants }]);
    __seed('AbEvents', [
      { testName: 'cta', variantId: 'control', eventType: 'impression' },
      { testName: 'cta', variantId: 'control', eventType: 'impression' },
      { testName: 'cta', variantId: 'control', eventType: 'conversion' },
      { testName: 'cta', variantId: 'treatment', eventType: 'impression' },
      { testName: 'cta', variantId: 'treatment', eventType: 'conversion' },
    ]);
    const result = await getTestResults('cta');
    expect(result.success).toBe(true);
    expect(result.results.variants).toHaveLength(2);
    expect(result.results.variants[0].impressions).toBe(2);
    expect(result.results.variants[0].conversions).toBe(1);
    expect(result.results.variants[0].conversionRate).toBe(50);
  });

  it('returns significance data', async () => {
    __seed('AbTests', [{ testName: 'sig', active: true, variants: twoVariants }]);
    __seed('AbEvents', []);
    const result = await getTestResults('sig');
    expect(result.results.significance).toBeTruthy();
  });

  it('requires testName', async () => {
    const result = await getTestResults('');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent test', async () => {
    __seed('AbTests', []);
    const result = await getTestResults('nope');
    expect(result.success).toBe(false);
  });

  it('handles zero impressions (0% conversion)', async () => {
    __seed('AbTests', [{ testName: 'empty', active: true, variants: twoVariants }]);
    __seed('AbEvents', []);
    const result = await getTestResults('empty');
    expect(result.results.variants[0].conversionRate).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// concludeTest
// ═════════════════════════════════════════════════════════════════════
describe('concludeTest', () => {
  it('disables test and sets winner', async () => {
    __seed('AbTests', [{ _id: 'at1', testName: 'cta', active: true, variants: twoVariants }]);
    const result = await concludeTest('cta', 'treatment');
    expect(result.success).toBe(true);
    const updated = _collections.AbTests.find(t => t._id === 'at1');
    expect(updated.active).toBe(false);
    expect(updated.winnerVariant).toBe('treatment');
  });

  it('requires testName', async () => {
    const result = await concludeTest('', 'winner');
    expect(result.success).toBe(false);
  });

  it('requires winnerVariantId', async () => {
    const result = await concludeTest('test', '');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent test', async () => {
    __seed('AbTests', []);
    const result = await concludeTest('nope', 'winner');
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// createTest
// ═════════════════════════════════════════════════════════════════════
describe('createTest', () => {
  it('creates a new test', async () => {
    __seed('AbTests', []);
    const result = await createTest({
      testName: 'new-test',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });
    expect(result.success).toBe(true);
    expect(_collections.AbTests).toHaveLength(1);
    expect(_collections.AbTests[0].active).toBe(true);
  });

  it('requires test name', async () => {
    const result = await createTest({ variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    expect(result.success).toBe(false);
  });

  it('requires at least 2 variants', async () => {
    const result = await createTest({ testName: 'test', variants: [{ id: 'a', name: 'A' }] });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate test name', async () => {
    __seed('AbTests', [{ testName: 'existing' }]);
    const result = await createTest({
      testName: 'existing',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('clamps trafficPercent to 0-100', async () => {
    __seed('AbTests', []);
    await createTest({
      testName: 'clamped',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      trafficPercent: 150,
    });
    expect(_collections.AbTests[0].trafficPercent).toBe(100);
  });

  it('clamps negative trafficPercent to 0', async () => {
    __seed('AbTests', []);
    await createTest({
      testName: 'neg',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      trafficPercent: -10,
    });
    expect(_collections.AbTests[0].trafficPercent).toBe(0);
  });

  it('defaults trafficPercent to 100', async () => {
    __seed('AbTests', []);
    await createTest({
      testName: 'default',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });
    expect(_collections.AbTests[0].trafficPercent).toBe(100);
  });

  it('defaults variant weight to 50', async () => {
    __seed('AbTests', []);
    await createTest({
      testName: 'w',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });
    const variants = JSON.parse(_collections.AbTests[0].variants);
    expect(variants[0].weight).toBe(50);
  });

  it('handles empty params', async () => {
    const result = await createTest();
    expect(result.success).toBe(false);
  });
});
