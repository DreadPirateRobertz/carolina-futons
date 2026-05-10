import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
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
    le: (field, val) => { filters[field] = { type: 'le', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
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
        if (f.type === 'le') items = items.filter(i => i[field] <= f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      for (const cb of _insertCbs) cb(collection, record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      for (const cb of _updateCbs) cb(collection, item);
      return item;
    },
  },
}));

let _mockMemberId = 'member-abc';
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => (_mockMemberId ? { _id: _mockMemberId } : null),
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

beforeEach(() => {
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _mockMemberId = 'member-abc';
});

// ── Import under test ───────────────────────────────────────────────
// cf-4x7e Pass 2 chunk 6 retired the unrelated webMethods that used to
// share this file; the remaining 3 methods form the post-purchase
// review-request pipeline (schedule → pending → submit). See
// dataService.web.js header for the rationale per dropped method.
const mod = await import('../src/backend/dataService.web.js');
const {
  scheduleReviewRequest,
  getPendingReviewRequests,
  submitReview,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// scheduleReviewRequest
// ═════════════════════════════════════════════════════════════════════
describe('scheduleReviewRequest', () => {
  it('schedules a review request with all fields', async () => {
    const result = await scheduleReviewRequest({
      orderId: 'order-1',
      customerEmail: 'test@example.com',
      productIds: 'p1,p2',
      scheduledDate: new Date(Date.now() + 86400000),
    });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeTruthy();
  });

  it('defaults scheduledDate to 7 days out', async () => {
    const before = Date.now();
    await scheduleReviewRequest({ orderId: 'o1', customerEmail: 'e@e.com', productIds: 'p1' });
    const record = _collections.ReviewRequests[0];
    const expected = before + 7 * 86400000;
    expect(record.scheduledDate.getTime()).toBeGreaterThanOrEqual(expected - 1000);
    expect(record.scheduledDate.getTime()).toBeLessThanOrEqual(expected + 1000);
  });

  it('requires orderId', async () => {
    const result = await scheduleReviewRequest({ customerEmail: 'e@e.com', productIds: 'p1' });
    expect(result.success).toBe(false);
  });

  it('requires customerEmail', async () => {
    const result = await scheduleReviewRequest({ orderId: 'o1', productIds: 'p1' });
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await scheduleReviewRequest({ orderId: 'o1', customerEmail: 'e@e.com', productIds: 'p1' });
    expect(result.success).toBe(false);
  });

  it('sanitizes email to 254 chars', async () => {
    const longEmail = 'a'.repeat(300) + '@test.com';
    await scheduleReviewRequest({ orderId: 'o1', customerEmail: longEmail, productIds: 'p1' });
    expect(_collections.ReviewRequests[0].customerEmail.length).toBeLessThanOrEqual(254);
  });

  it('handles null requestData', async () => {
    const result = await scheduleReviewRequest(null);
    expect(result.success).toBe(false);
  });
});
// ═════════════════════════════════════════════════════════════════════
// getPendingReviewRequests
// ═════════════════════════════════════════════════════════════════════
describe('getPendingReviewRequests', () => {
  it('returns pending requests with scheduledDate in the past', async () => {
    const past = new Date(Date.now() - 86400000);
    __seed('ReviewRequests', [
      { _id: 'rr1', orderId: 'o1', customerEmail: 'e@e.com', productIds: 'p1', scheduledDate: past, status: 'pending' },
      { _id: 'rr2', orderId: 'o2', customerEmail: 'e@e.com', productIds: 'p2', scheduledDate: past, status: 'completed' },
    ]);
    const result = await getPendingReviewRequests();
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });

  it('returns empty when no pending requests', async () => {
    __seed('ReviewRequests', []);
    const result = await getPendingReviewRequests();
    expect(result).toEqual([]);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await getPendingReviewRequests();
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// submitReview
// ═════════════════════════════════════════════════════════════════════
describe('submitReview', () => {
  it('submits a valid review', async () => {
    __seed('ReviewRequests', [
      { _id: 'rr1', customerEmail: 'user@example.com', status: 'pending', rating: null, reviewText: null },
    ]);
    const result = await submitReview('rr1', 5, 'Great product!');
    expect(result.success).toBe(true);
    const updated = _collections.ReviewRequests.find(r => r._id === 'rr1');
    expect(updated.status).toBe('completed');
    expect(updated.rating).toBe(5);
  });

  it('requires requestId', async () => {
    const result = await submitReview('', 5, 'text');
    expect(result.success).toBe(false);
  });

  it('requires rating between 1 and 5', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending' }]);
    expect((await submitReview('rr1', 0, 'text')).success).toBe(false);
    expect((await submitReview('rr1', 6, 'text')).success).toBe(false);
    expect((await submitReview('rr1', -1, 'text')).success).toBe(false);
  });

  it('rejects non-number rating', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending' }]);
    expect((await submitReview('rr1', 'five', 'text')).success).toBe(false);
  });

  it('returns false if request not found', async () => {
    __seed('ReviewRequests', []);
    const result = await submitReview('nonexistent', 5, 'text');
    expect(result.success).toBe(false);
  });

  it('sanitizes requestId — strips special chars', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending' }]);
    // ID with special chars gets cleaned to 'rr1'
    const result = await submitReview('rr1!!!', 5, 'text');
    // After cleaning "rr1!!!" becomes "rr1" which exists
    expect(result.success).toBe(true);
  });

  it('sanitizes reviewText to 5000 chars', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending', rating: null, reviewText: null }]);
    const longText = 'x'.repeat(6000);
    await submitReview('rr1', 4, longText);
    const updated = _collections.ReviewRequests.find(r => r._id === 'rr1');
    expect(updated.reviewText.length).toBeLessThanOrEqual(5000);
  });

  it('NaN rating bypasses guard — typeof number, not < 1, not > 5 (known gap)', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending', rating: null, reviewText: null }]);
    const result = await submitReview('rr1', NaN, 'text');
    // NaN passes: typeof NaN === 'number' && !(NaN < 1) && !(NaN > 5)
    expect(result.success).toBe(true);
  });

  it('Infinity rating is rejected (> 5)', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending' }]);
    const result = await submitReview('rr1', Infinity, 'text');
    expect(result.success).toBe(false);
  });

  it('rating 1 is minimum valid', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending', rating: null, reviewText: null }]);
    const result = await submitReview('rr1', 1, 'ok');
    expect(result.success).toBe(true);
  });

  it('rating 5 is maximum valid', async () => {
    __seed('ReviewRequests', [{ _id: 'rr1', customerEmail: 'user@example.com', status: 'pending', rating: null, reviewText: null }]);
    const result = await submitReview('rr1', 5, 'great');
    expect(result.success).toBe(true);
  });
});

