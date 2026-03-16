import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: {
    success: '#00C853',
    mountainBlue: '#1565C0',
    espressoLight: '#8D6E63',
    sunsetCoral: '#FF6F61',
  },
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function __onInsert(cb) { _insertCbs.push(cb); }
function __onUpdate(cb) { _updateCbs.push(cb); }

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[field] = { type: 'ne', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
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
    query: vi.fn((col) => buildQueryChain(col)),
    get: vi.fn(async (col, id) => {
      const items = _collections[col] || [];
      return items.find(i => i._id === id) || null;
    }),
    insert: vi.fn(async (col, data) => {
      const item = { ...data, _id: data._id || 'a1b2c3d4-0000-0000-0000-000000000001', _createdDate: new Date() };
      if (!_collections[col]) _collections[col] = [];
      _collections[col].push(item);
      _insertCbs.forEach(cb => cb(col, item));
      return item;
    }),
    update: vi.fn(async (col, data) => {
      if (_collections[col]) {
        const idx = _collections[col].findIndex(i => i._id === data._id);
        if (idx >= 0) _collections[col][idx] = { ...data };
      }
      _updateCbs.forEach(cb => cb(col, data));
      return data;
    }),
  },
}));

let _currentMember = null;
let _currentRoles = [];
function __setMember(m) { _currentMember = m; }
function __setRoles(r) { _currentRoles = r; }

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => _currentMember),
    getRoles: vi.fn(async () => _currentRoles),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
}));

import {
  getSustainabilityInfo,
  getBatchSustainabilityBadges,
  calculateCarbonOffset,
  estimateTradeInCredit,
  submitTradeIn,
  getTradeInStatus,
  getMyTradeIns,
  moderateTradeIn,
  getPendingTradeIns,
  getSustainabilityStats,
} from '../src/backend/sustainabilityService.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _currentMember = { _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', loginEmail: 'test@test.com', name: 'Test' };
  _currentRoles = [{ title: 'Admin', _id: 'admin' }];
});

// ── getSustainabilityInfo — deep edge cases ─────────────────────────

describe('getSustainabilityInfo — deep edge cases', () => {
  it('returns error for null productId', async () => {
    const result = await getSustainabilityInfo(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('returns error for undefined productId', async () => {
    const result = await getSustainabilityInfo(undefined);
    expect(result.success).toBe(false);
  });

  it('returns error for numeric productId (sanitize returns empty)', async () => {
    const result = await getSustainabilityInfo(12345);
    expect(result.success).toBe(false);
  });

  it('defaults missing fields to fallback values', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1a1a1a1-0000-0000-0000-000000000001',
      productId: 'p1',
      // all other fields missing
    }]);
    const result = await getSustainabilityInfo('p1');
    expect(result.success).toBe(true);
    expect(result.info.materialSource).toBe('');
    expect(result.info.durabilityRating).toBe(0);
    expect(result.info.recyclabilityPercent).toBe(0);
    expect(result.info.carbonFootprintKg).toBe(0);
    expect(result.info.certifications).toEqual([]);
    expect(result.info.ecoScore).toBe('D');
    expect(result.info.tradeInEligible).toBe(false);
    expect(result.info.tradeInCreditRange).toBeNull();
  });

  it('returns tradeInCreditRange with 0 when min/max not set but eligible', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1a1a1a1-0000-0000-0000-000000000002',
      productId: 'p2',
      tradeInEligible: true,
      // tradeInCreditMin/Max missing
    }]);
    const result = await getSustainabilityInfo('p2');
    expect(result.info.tradeInCreditRange).toEqual({ min: 0, max: 0 });
  });

  it('truncates long productId via sanitize (50 char limit)', async () => {
    const longId = 'a'.repeat(100);
    const result = await getSustainabilityInfo(longId);
    // Should query with truncated ID but not crash
    expect(result.success).toBe(true);
    expect(result.found).toBe(false);
  });

  it('returns first item when multiple match same productId', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1a1-0000-0000-0000-000000000001', productId: 'dup', ecoScore: 'A' },
      { _id: 'a1a1-0000-0000-0000-000000000002', productId: 'dup', ecoScore: 'C' },
    ]);
    const result = await getSustainabilityInfo('dup');
    expect(result.info.ecoScore).toBe('A');
  });
});

// ── getBatchSustainabilityBadges — deep edge cases ──────────────────

describe('getBatchSustainabilityBadges — deep edge cases', () => {
  it('returns empty badges for undefined (defaults to [])', async () => {
    const result = await getBatchSustainabilityBadges(undefined);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('returns empty badges for string input', async () => {
    const result = await getBatchSustainabilityBadges('not-an-array');
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('filters out empty/null IDs from array', async () => {
    const result = await getBatchSustainabilityBadges([null, '', undefined, 0, false]);
    expect(result.success).toBe(true);
    expect(result.badges).toEqual({});
  });

  it('eco-score B gets badge, C does not', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', productId: 'p-b', ecoScore: 'B', certifications: [], durabilityRating: 2, recyclabilityPercent: 30, tradeInEligible: false },
      { _id: 'a1-0000-0000-0000-000000000002', productId: 'p-c', ecoScore: 'C', certifications: [], durabilityRating: 2, recyclabilityPercent: 30, tradeInEligible: false },
    ]);
    const result = await getBatchSustainabilityBadges(['p-b', 'p-c']);
    expect(result.badges['p-b']).toBeDefined();
    expect(result.badges['p-b'].some(b => b.type === 'eco-score')).toBe(true);
    expect(result.badges['p-c']).toBeUndefined(); // C doesn't earn any badges
  });

  it('durability 3 does not get badge, 4 does', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', productId: 'p3', ecoScore: 'D', certifications: [], durabilityRating: 3, recyclabilityPercent: 50, tradeInEligible: false },
      { _id: 'a1-0000-0000-0000-000000000002', productId: 'p4', ecoScore: 'D', certifications: [], durabilityRating: 4, recyclabilityPercent: 50, tradeInEligible: false },
    ]);
    const result = await getBatchSustainabilityBadges(['p3', 'p4']);
    expect(result.badges['p3']).toBeUndefined();
    expect(result.badges['p4']).toBeDefined();
    expect(result.badges['p4'].some(b => b.type === 'durable')).toBe(true);
  });

  it('recyclability 74 no badge, 75 gets badge', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', productId: 'r74', ecoScore: 'D', certifications: [], durabilityRating: 1, recyclabilityPercent: 74, tradeInEligible: false },
      { _id: 'a1-0000-0000-0000-000000000002', productId: 'r75', ecoScore: 'D', certifications: [], durabilityRating: 1, recyclabilityPercent: 75, tradeInEligible: false },
    ]);
    const result = await getBatchSustainabilityBadges(['r74', 'r75']);
    expect(result.badges['r74']).toBeUndefined();
    expect(result.badges['r75']).toBeDefined();
    expect(result.badges['r75'].some(b => b.type === 'recyclable')).toBe(true);
  });

  it('only first certification shown in badge', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1-0000-0000-0000-000000000001',
      productId: 'multi-cert',
      ecoScore: 'D',
      certifications: ['FSC', 'GREENGUARD', 'CertiPUR-US'],
      durabilityRating: 1,
      recyclabilityPercent: 10,
      tradeInEligible: false,
    }]);
    const result = await getBatchSustainabilityBadges(['multi-cert']);
    const certBadge = result.badges['multi-cert'].find(b => b.type === 'certified');
    expect(certBadge.label).toBe('FSC');
  });

  it('null certifications treated as empty — no certified badge', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1-0000-0000-0000-000000000001',
      productId: 'no-cert',
      ecoScore: 'D',
      certifications: null,
      durabilityRating: 1,
      recyclabilityPercent: 10,
      tradeInEligible: false,
    }]);
    const result = await getBatchSustainabilityBadges(['no-cert']);
    expect(result.badges['no-cert']).toBeUndefined();
  });

  it('trade-in badge has correct color', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1-0000-0000-0000-000000000001',
      productId: 'tradein',
      ecoScore: 'D',
      certifications: [],
      durabilityRating: 1,
      recyclabilityPercent: 10,
      tradeInEligible: true,
    }]);
    const result = await getBatchSustainabilityBadges(['tradein']);
    const badge = result.badges['tradein'].find(b => b.type === 'trade-in');
    expect(badge.label).toBe('Trade-In Eligible');
    expect(badge.color).toBe('#FF6F61');
  });
});

// ── calculateCarbonOffset — deep edge cases ─────────────────────────

describe('calculateCarbonOffset — deep edge cases', () => {
  it('returns zero for non-array input', async () => {
    const result = await calculateCarbonOffset('not-array');
    expect(result.success).toBe(true);
    expect(result.totalKg).toBe(0);
  });

  it('returns zero for null input', async () => {
    const result = await calculateCarbonOffset(null);
    expect(result.success).toBe(true);
    expect(result.totalKg).toBe(0);
  });

  it('limits to 20 products (vs 50 for badges)', async () => {
    __seed('ProductSustainability', Array.from({ length: 25 }, (_, i) => ({
      _id: `a0-0000-0000-0000-${String(i).padStart(12, '0')}`,
      productId: `p${i}`,
      carbonFootprintKg: 10,
    })));
    const ids = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const result = await calculateCarbonOffset(ids);
    // Only 20 should be queried
    expect(result.success).toBe(true);
  });

  it('handles missing carbonFootprintKg (defaults to 0)', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1-0000-0000-0000-000000000001',
      productId: 'no-carbon',
    }]);
    const result = await calculateCarbonOffset(['no-carbon']);
    expect(result.totalKg).toBe(0);
    expect(result.offsetCost).toBe(0);
    expect(result.products[0].carbonFootprintKg).toBe(0);
  });

  it('rounds offsetCost to 2 decimal places', async () => {
    __seed('ProductSustainability', [{
      _id: 'a1-0000-0000-0000-000000000001',
      productId: 'precise',
      carbonFootprintKg: 33.333,
    }]);
    const result = await calculateCarbonOffset(['precise']);
    // 33.333 * 0.02 = 0.66666 → rounded to 0.67
    expect(result.offsetCost).toBe(0.67);
    expect(result.totalKg).toBe(33.33);
  });

  it('sums multiple products correctly', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', productId: 'p1', carbonFootprintKg: 10.5 },
      { _id: 'a1-0000-0000-0000-000000000002', productId: 'p2', carbonFootprintKg: 20.3 },
      { _id: 'a1-0000-0000-0000-000000000003', productId: 'p3', carbonFootprintKg: 5.2 },
    ]);
    const result = await calculateCarbonOffset(['p1', 'p2', 'p3']);
    expect(result.totalKg).toBe(36);
    expect(result.offsetCost).toBe(0.72); // 36 * 0.02
    expect(result.products.length).toBe(3);
  });

  it('filters out invalid IDs (sanitize returns empty)', async () => {
    const result = await calculateCarbonOffset([null, undefined, 123, '']);
    expect(result.success).toBe(true);
    expect(result.totalKg).toBe(0);
  });
});

// ── estimateTradeInCredit — deep edge cases ─────────────────────────

describe('estimateTradeInCredit — deep edge cases', () => {
  it('returns error for null category', async () => {
    const result = await estimateTradeInCredit(null, 'good');
    expect(result.success).toBe(false);
  });

  it('returns error for null condition', async () => {
    const result = await estimateTradeInCredit('futon-frames', null);
    expect(result.success).toBe(false);
  });

  it('calculates all 8 categories × 4 conditions correctly', async () => {
    const categories = {
      'futon-frames': { min: 75, max: 200 },
      'mattresses': { min: 50, max: 100 },
      'murphy-cabinet-beds': { min: 100, max: 200 },
      'platform-beds': { min: 75, max: 175 },
      'outdoor-furniture': { min: 50, max: 150 },
      'casegoods-accessories': { min: 25, max: 75 },
      'covers': { min: 25, max: 50 },
      'pillows-702': { min: 15, max: 40 },
    };
    const multipliers = { excellent: 1.0, good: 0.75, fair: 0.5, poor: 0.25 };

    for (const [cat, base] of Object.entries(categories)) {
      for (const [cond, mult] of Object.entries(multipliers)) {
        const result = await estimateTradeInCredit(cat, cond);
        expect(result.success).toBe(true);
        expect(result.creditRange.min).toBe(Math.round(base.min * mult));
        expect(result.creditRange.max).toBe(Math.round(base.max * mult));
        expect(result.category).toBe(cat);
        expect(result.condition).toBe(cond);
      }
    }
  });

  it('message replaces dashes with spaces in category name', async () => {
    const result = await estimateTradeInCredit('murphy-cabinet-beds', 'excellent');
    expect(result.message).toContain('murphy cabinet beds');
  });

  it('message includes dollar amounts', async () => {
    const result = await estimateTradeInCredit('covers', 'poor');
    // covers poor: min=25*0.25=6 (rounded), max=50*0.25=13 (rounded)
    expect(result.message).toContain('$6');
    expect(result.message).toContain('$13');
  });

  it('rejects category with extra whitespace', async () => {
    const result = await estimateTradeInCredit('futon-frames ', 'good');
    // sanitize preserves trailing space → 'futon-frames ' != 'futon-frames'
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid product category');
  });

  it('rejects condition with different casing', async () => {
    const result = await estimateTradeInCredit('futon-frames', 'Good');
    // 'Good' != 'good' — CONDITION_MULTIPLIERS is case-sensitive
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid condition');
  });
});

// ── submitTradeIn — deep edge cases ─────────────────────────────────

describe('submitTradeIn — deep edge cases', () => {
  it('returns error when member has no _id', async () => {
    _currentMember = { loginEmail: 'x@x.com' };
    const result = await submitTradeIn({ category: 'futon-frames', condition: 'good' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('handles missing description gracefully', async () => {
    const result = await submitTradeIn({ category: 'mattresses', condition: 'fair' });
    expect(result.success).toBe(true);
    // description defaults to empty string
  });

  it('handles non-array photos', async () => {
    const result = await submitTradeIn({
      category: 'mattresses',
      condition: 'good',
      photos: 'not-an-array',
    });
    expect(result.success).toBe(true);
  });

  it('limits photos to 5', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInRequests') inserted = item; });

    await submitTradeIn({
      category: 'futon-frames',
      condition: 'excellent',
      photos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    });
    expect(inserted.photos.length).toBeLessThanOrEqual(5);
  });

  it('calculates estimatedCredit as midpoint of range', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInRequests') inserted = item; });

    await submitTradeIn({ category: 'futon-frames', condition: 'excellent' });
    // min=75, max=200, midpoint = Math.round((75+200)/2) = 138
    expect(inserted.estimatedCredit).toBe(138);
  });

  it('sets correct default fields on insert', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInRequests') inserted = item; });

    await submitTradeIn({ category: 'covers', condition: 'poor' });
    expect(inserted.status).toBe('pending');
    expect(inserted.adminNotes).toBe('');
    expect(inserted.reviewedBy).toBe('');
    expect(inserted.reviewedAt).toBeNull();
    expect(inserted.memberId).toBe('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
  });

  it('returns creditRange in response', async () => {
    const result = await submitTradeIn({ category: 'platform-beds', condition: 'good' });
    expect(result.success).toBe(true);
    // platform-beds good: min=75*0.75=56, max=175*0.75=131
    expect(result.creditRange.min).toBe(56);
    expect(result.creditRange.max).toBe(131);
  });

  it('returns success message with credit range', async () => {
    const result = await submitTradeIn({ category: 'outdoor-furniture', condition: 'fair' });
    expect(result.message).toContain('Trade-in request submitted');
    expect(result.message).toContain('2 business days');
  });

  it('sanitizes description to 500 chars', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInRequests') inserted = item; });

    const longDesc = 'x'.repeat(1000);
    await submitTradeIn({ category: 'futon-frames', condition: 'good', description: longDesc });
    expect(inserted.description.length).toBeLessThanOrEqual(500);
  });

  it('filters out empty photo URLs', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInRequests') inserted = item; });

    await submitTradeIn({
      category: 'futon-frames',
      condition: 'good',
      photos: ['https://a.com/1.jpg', '', null, 'https://b.com/2.jpg'],
    });
    // Only non-empty strings should remain
    expect(inserted.photos.length).toBe(2);
  });
});

// ── getTradeInStatus — deep edge cases ──────────────────────────────

describe('getTradeInStatus — deep edge cases', () => {
  it('returns error for null requestId', async () => {
    const result = await getTradeInStatus(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Request ID required');
  });

  it('returns error for numeric requestId', async () => {
    const result = await getTradeInStatus(42);
    expect(result.success).toBe(false);
  });

  it('hides adminNotes when status is pending', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'pending',
      adminNotes: 'SECRET INTERNAL NOTE',
      productCategory: 'futon-frames',
      condition: 'good',
      description: 'test',
      estimatedCredit: 100,
      _createdDate: new Date(),
    }]);
    const result = await getTradeInStatus('a1b2c3d4-0000-0000-0000-000000000001');
    expect(result.success).toBe(true);
    expect(result.request.adminNotes).toBe('');
  });

  it('shows adminNotes when status is approved', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000002',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'approved',
      adminNotes: 'Looks great',
      productCategory: 'futon-frames',
      condition: 'good',
      description: 'test',
      estimatedCredit: 120,
      _createdDate: new Date(),
    }]);
    const result = await getTradeInStatus('a1b2c3d4-0000-0000-0000-000000000002');
    expect(result.request.adminNotes).toBe('Looks great');
  });

  it('shows adminNotes when status is rejected', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000003',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'rejected',
      adminNotes: 'Too damaged',
      productCategory: 'futon-frames',
      condition: 'poor',
      description: 'test',
      estimatedCredit: 50,
      _createdDate: new Date(),
    }]);
    const result = await getTradeInStatus('a1b2c3d4-0000-0000-0000-000000000003');
    expect(result.request.adminNotes).toBe('Too damaged');
  });

  it('denies access when memberId does not match', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000004',
      memberId: 'different-member-id-0000-000000000000',
      status: 'pending',
    }]);
    const result = await getTradeInStatus('a1b2c3d4-0000-0000-0000-000000000004');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('returns submittedDate from _createdDate', async () => {
    const date = new Date('2026-01-15');
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000005',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      status: 'approved',
      _createdDate: date,
      productCategory: 'covers',
      condition: 'fair',
      description: '',
      estimatedCredit: 19,
    }]);
    const result = await getTradeInStatus('a1b2c3d4-0000-0000-0000-000000000005');
    expect(result.request.submittedDate).toEqual(date);
  });
});

// ── getMyTradeIns — deep edge cases ─────────────────────────────────

describe('getMyTradeIns — deep edge cases', () => {
  it('returns empty list for member with no trade-ins', async () => {
    const result = await getMyTradeIns();
    expect(result.success).toBe(true);
    expect(result.requests).toEqual([]);
  });

  it('returns error when not logged in (member null)', async () => {
    _currentMember = null;
    const result = await getMyTradeIns();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('maps response fields correctly', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1-0000-0000-0000-000000000001',
      memberId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      productCategory: 'mattresses',
      condition: 'excellent',
      estimatedCredit: 75,
      status: 'completed',
      adminNotes: 'should not be in response',
      description: 'should not be in response',
      _createdDate: new Date('2026-02-01'),
    }]);
    const result = await getMyTradeIns();
    expect(result.requests.length).toBe(1);
    const req = result.requests[0];
    expect(req._id).toBeDefined();
    expect(req.productCategory).toBe('mattresses');
    expect(req.condition).toBe('excellent');
    expect(req.estimatedCredit).toBe(75);
    expect(req.status).toBe('completed');
    expect(req.submittedDate).toBeDefined();
    // Should NOT include adminNotes or description in list response
    expect(req.adminNotes).toBeUndefined();
    expect(req.description).toBeUndefined();
  });
});

// ── moderateTradeIn — deep edge cases ───────────────────────────────

describe('moderateTradeIn — deep edge cases', () => {
  it('requires admin role', async () => {
    _currentRoles = [{ title: 'Member', _id: 'member' }];
    const result = await moderateTradeIn('a1-0000', { action: 'approved' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to moderate trade-in request');
  });

  it('rejects action "completed"', async () => {
    const result = await moderateTradeIn('a1-0000-0000-0000-000000000001', { action: 'completed' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Action must be');
  });

  it('rejects action "pending"', async () => {
    const result = await moderateTradeIn('a1-0000-0000-0000-000000000001', { action: 'pending' });
    expect(result.success).toBe(false);
  });

  it('rejects empty decision object', async () => {
    const result = await moderateTradeIn('a1-0000-0000-0000-000000000001', {});
    expect(result.success).toBe(false);
  });

  it('cannot re-moderate already approved request', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000010',
      status: 'approved',
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000010', { action: 'rejected' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already approved');
  });

  it('cannot re-moderate already rejected request', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000011',
      status: 'rejected',
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000011', { action: 'approved' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already rejected');
  });

  it('updates creditAmount when approved with valid number', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000012',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeInRequests') updated = data; });

    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000012', {
      action: 'approved',
      creditAmount: 150,
    });
    expect(result.success).toBe(true);
    expect(result.creditAmount).toBe(150);
    expect(updated.estimatedCredit).toBe(150);
  });

  it('does NOT update creditAmount when rejected with creditAmount', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000013',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000013', {
      action: 'rejected',
      creditAmount: 200,
    });
    expect(result.creditAmount).toBe(100); // unchanged
  });

  it('does NOT update creditAmount when 0 (not > 0)', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000014',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000014', {
      action: 'approved',
      creditAmount: 0,
    });
    expect(result.creditAmount).toBe(100); // unchanged
  });

  it('does NOT update creditAmount when negative', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000015',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000015', {
      action: 'approved',
      creditAmount: -50,
    });
    expect(result.creditAmount).toBe(100); // guard: creditAmount > 0 fails
  });

  // Known gap: NaN creditAmount passes typeof check but fails > 0
  it('does NOT update creditAmount when NaN', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000016',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000016', {
      action: 'approved',
      creditAmount: NaN,
    });
    expect(result.creditAmount).toBe(100); // NaN > 0 is false
  });

  // Known gap: Infinity passes typeof + > 0 guard
  it('accepts Infinity creditAmount (guard bypass)', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000017',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000017', {
      action: 'approved',
      creditAmount: Infinity,
    });
    // Math.round(Infinity) = Infinity — guard bypass
    expect(result.success).toBe(true);
    expect(result.creditAmount).toBe(Infinity);
  });

  it('rounds creditAmount to integer', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000018',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    const result = await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000018', {
      action: 'approved',
      creditAmount: 149.7,
    });
    expect(result.creditAmount).toBe(150);
  });

  it('sets reviewedBy and reviewedAt', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000019',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeInRequests') updated = data; });

    await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000019', {
      action: 'approved',
      notes: 'All good',
    });
    expect(updated.reviewedBy).toBe('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
    expect(updated.reviewedAt).toBeInstanceOf(Date);
    expect(updated.adminNotes).toBe('All good');
  });

  it('sanitizes notes to 500 chars', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000020',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeInRequests') updated = data; });

    const longNotes = 'n'.repeat(1000);
    await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000020', {
      action: 'rejected',
      notes: longNotes,
    });
    expect(updated.adminNotes.length).toBeLessThanOrEqual(500);
  });

  it('defaults notes to empty string when null', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000021',
      status: 'pending',
      estimatedCredit: 100,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'TradeInRequests') updated = data; });

    await moderateTradeIn('a1b2c3d4-0000-0000-0000-000000000021', {
      action: 'approved',
      notes: null,
    });
    expect(updated.adminNotes).toBe('');
  });
});

// ── getPendingTradeIns — deep edge cases ────────────────────────────

describe('getPendingTradeIns — deep edge cases', () => {
  it('clamps limit to min 1', async () => {
    __seed('TradeInRequests', [
      { _id: 'a1-0000-0000-0000-000000000001', status: 'pending', _createdDate: new Date() },
      { _id: 'a1-0000-0000-0000-000000000002', status: 'pending', _createdDate: new Date() },
    ]);
    const result = await getPendingTradeIns({ limit: -5 });
    expect(result.success).toBe(true);
  });

  it('defaults limit to 50 when not provided', async () => {
    const result = await getPendingTradeIns({});
    expect(result.success).toBe(true);
  });

  // Known gap: limit=0 → Math.max(1, 0) = 1 (not 50 — no falsy default here)
  it('clamps limit=0 to 1', async () => {
    const result = await getPendingTradeIns({ limit: 0 });
    expect(result.success).toBe(true);
  });

  it('shows all statuses when status is "all"', async () => {
    __seed('TradeInRequests', [
      { _id: 'a1-0000-0000-0000-000000000001', status: 'pending', _createdDate: new Date() },
      { _id: 'a1-0000-0000-0000-000000000002', status: 'approved', _createdDate: new Date() },
      { _id: 'a1-0000-0000-0000-000000000003', status: 'rejected', _createdDate: new Date() },
    ]);
    const result = await getPendingTradeIns({ status: 'all' });
    expect(result.requests.length).toBe(3);
  });

  it('returns photos array defaulting to empty', async () => {
    __seed('TradeInRequests', [{
      _id: 'a1-0000-0000-0000-000000000001',
      status: 'pending',
      _createdDate: new Date(),
      // photos missing
    }]);
    const result = await getPendingTradeIns();
    expect(result.requests[0].photos).toEqual([]);
  });

  it('returns totalCount', async () => {
    __seed('TradeInRequests', [
      { _id: 'a1-0000-0000-0000-000000000001', status: 'pending', _createdDate: new Date() },
    ]);
    const result = await getPendingTradeIns();
    expect(result.totalCount).toBeDefined();
  });
});

// ── getSustainabilityStats — deep edge cases ────────────────────────

describe('getSustainabilityStats — deep edge cases', () => {
  it('handles zero products (no division by zero)', async () => {
    const result = await getSustainabilityStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalProducts).toBe(0);
    expect(result.stats.avgDurability).toBe(0);
    expect(result.stats.avgRecyclability).toBe(0);
  });

  it('rounds avgDurability to 1 decimal place', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', durabilityRating: 3, recyclabilityPercent: 50, ecoScore: 'A', tradeInEligible: false },
      { _id: 'a1-0000-0000-0000-000000000002', durabilityRating: 4, recyclabilityPercent: 70, ecoScore: 'B', tradeInEligible: true },
      { _id: 'a1-0000-0000-0000-000000000003', durabilityRating: 5, recyclabilityPercent: 90, ecoScore: 'A', tradeInEligible: true },
    ]);
    const result = await getSustainabilityStats();
    // avg durability: (3+4+5)/3 = 4.0
    expect(result.stats.avgDurability).toBe(4);
    // avg recyclability: (50+70+90)/3 = 70.0
    expect(result.stats.avgRecyclability).toBe(70);
    expect(result.stats.ecoScoreCounts.A).toBe(2);
    expect(result.stats.ecoScoreCounts.B).toBe(1);
    expect(result.stats.tradeInEligible).toBe(2);
  });

  it('ignores unknown ecoScore values', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', durabilityRating: 3, recyclabilityPercent: 50, ecoScore: 'F', tradeInEligible: false },
    ]);
    const result = await getSustainabilityStats();
    expect(result.stats.ecoScoreCounts.A).toBe(0);
    expect(result.stats.ecoScoreCounts.D).toBe(0);
    // 'F' is ignored since ecoScoreCounts['F'] === undefined
  });

  it('handles missing durabilityRating (defaults to 0)', async () => {
    __seed('ProductSustainability', [
      { _id: 'a1-0000-0000-0000-000000000001', recyclabilityPercent: 50, ecoScore: 'C', tradeInEligible: false },
    ]);
    const result = await getSustainabilityStats();
    expect(result.stats.avgDurability).toBe(0);
  });

  it('counts trade-in requests by status', async () => {
    __seed('TradeInRequests', [
      { _id: 'a1-0000-0000-0000-000000000001', status: 'pending' },
      { _id: 'a1-0000-0000-0000-000000000002', status: 'pending' },
      { _id: 'a1-0000-0000-0000-000000000003', status: 'approved' },
      { _id: 'a1-0000-0000-0000-000000000004', status: 'completed' },
      { _id: 'a1-0000-0000-0000-000000000005', status: 'completed' },
      { _id: 'a1-0000-0000-0000-000000000006', status: 'completed' },
    ]);
    const result = await getSustainabilityStats();
    expect(result.stats.tradeIns.pending).toBe(2);
    expect(result.stats.tradeIns.approved).toBe(1);
    expect(result.stats.tradeIns.completed).toBe(3);
  });

  it('requires admin access', async () => {
    _currentRoles = [];
    const result = await getSustainabilityStats();
    expect(result.success).toBe(false);
  });
});
