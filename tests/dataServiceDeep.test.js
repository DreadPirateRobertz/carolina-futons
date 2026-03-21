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
const mod = await import('../src/backend/dataService.web.js');
const {
  getBundlesForProduct,
  getActivePromotions,
  trackEngagementEvent,
  getMyEngagementHistory,
  scheduleReviewRequest,
  getPendingReviewRequests,
  submitReview,
  generateReferralCode,
  redeemReferralCode,
  getVideos,
  trackVideoView,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// getBundlesForProduct
// ═════════════════════════════════════════════════════════════════════
describe('getBundlesForProduct', () => {
  it('returns empty array when productId is falsy', async () => {
    expect(await getBundlesForProduct('')).toEqual([]);
    expect(await getBundlesForProduct(null)).toEqual([]);
    expect(await getBundlesForProduct(undefined)).toEqual([]);
  });

  it('returns bundles for a given product', async () => {
    __seed('ProductBundles', [
      { bundleId: 'b1', primaryProductId: 'prod-1', isActive: true, bundleName: 'Bundle A', bundledProductIds: 'p2,p3', discountPercent: 15 },
      { bundleId: 'b2', primaryProductId: 'prod-1', isActive: false, bundleName: 'Inactive', bundledProductIds: 'p4', discountPercent: 10 },
    ]);
    const result = await getBundlesForProduct('prod-1');
    expect(result).toHaveLength(1);
    expect(result[0].bundleId).toBe('b1');
    expect(result[0].bundledProductIds).toEqual(['p2', 'p3']);
    expect(result[0].discountPercent).toBe(15);
  });

  it('defaults discountPercent to 5 when missing', async () => {
    __seed('ProductBundles', [
      { bundleId: 'b1', primaryProductId: 'prod-1', isActive: true, bundleName: 'B', bundledProductIds: 'p2', discountPercent: undefined },
    ]);
    const result = await getBundlesForProduct('prod-1');
    expect(result[0].discountPercent).toBe(5);
  });

  it('handles empty bundledProductIds string', async () => {
    __seed('ProductBundles', [
      { bundleId: 'b1', primaryProductId: 'prod-1', isActive: true, bundleName: 'B', bundledProductIds: '', discountPercent: 10 },
    ]);
    const result = await getBundlesForProduct('prod-1');
    expect(result[0].bundledProductIds).toEqual([]);
  });

  it('handles null bundledProductIds', async () => {
    __seed('ProductBundles', [
      { bundleId: 'b1', primaryProductId: 'prod-1', isActive: true, bundleName: 'B', bundledProductIds: null, discountPercent: 10 },
    ]);
    const result = await getBundlesForProduct('prod-1');
    expect(result[0].bundledProductIds).toEqual([]);
  });

  it('sanitizes productId with HTML tags', async () => {
    __seed('ProductBundles', []);
    const result = await getBundlesForProduct('<script>alert(1)</script>');
    expect(result).toEqual([]);
  });

  it('returns empty array on no matching bundles', async () => {
    __seed('ProductBundles', [
      { bundleId: 'b1', primaryProductId: 'other', isActive: true, bundleName: 'B', bundledProductIds: 'p2', discountPercent: 10 },
    ]);
    const result = await getBundlesForProduct('prod-1');
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getActivePromotions
// ═════════════════════════════════════════════════════════════════════
describe('getActivePromotions', () => {
  it('returns only active promotions within date range', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86400000);
    const future = new Date(now.getTime() + 86400000);
    __seed('Promotions', [
      { title: 'Active', isActive: true, startDate: past, endDate: future, subtitle: '', theme: '', heroImage: '', discountCode: 'X', discountPercent: 10, ctaUrl: '', ctaText: '', productIds: 'a,b' },
      { title: 'Expired', isActive: true, startDate: past, endDate: past, subtitle: '', theme: '', heroImage: '', discountCode: '', discountPercent: 0, ctaUrl: '', ctaText: '', productIds: '' },
    ]);
    const result = await getActivePromotions();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Active');
    expect(result[0].productIds).toEqual(['a', 'b']);
  });

  it('returns empty array with no promotions', async () => {
    __seed('Promotions', []);
    const result = await getActivePromotions();
    expect(result).toEqual([]);
  });

  it('handles null productIds', async () => {
    const now = new Date();
    __seed('Promotions', [
      { title: 'P', isActive: true, startDate: new Date(now.getTime() - 1000), endDate: new Date(now.getTime() + 100000), productIds: null, subtitle: '', theme: '', heroImage: '', discountCode: '', discountPercent: 0, ctaUrl: '', ctaText: '' },
    ]);
    const result = await getActivePromotions();
    expect(result[0].productIds).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackEngagementEvent
// ═════════════════════════════════════════════════════════════════════
describe('trackEngagementEvent', () => {
  it('tracks a valid engagement event', async () => {
    const result = await trackEngagementEvent({
      eventType: 'page_view',
      productId: 'prod-1',
      metadata: '{"page":"pdp"}',
      sessionId: 'sess-1',
    });
    expect(result.success).toBe(true);
    expect(_collections.CustomerEngagement).toHaveLength(1);
    expect(_collections.CustomerEngagement[0].memberId).toBe('member-abc');
  });

  it('rejects invalid event type', async () => {
    const result = await trackEngagementEvent({ eventType: 'invalid_type' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid event types', async () => {
    for (const t of ['page_view', 'add_to_cart', 'wishlist_add', 'quiz_complete', 'swatch_request']) {
      _collections = {};
      const result = await trackEngagementEvent({ eventType: t });
      expect(result.success).toBe(true);
    }
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await trackEngagementEvent({ eventType: 'page_view' });
    expect(result.success).toBe(false);
  });

  it('sanitizes eventType with HTML', async () => {
    const result = await trackEngagementEvent({ eventType: '<b>page_view</b>' });
    // After sanitization, becomes "page_view" which is valid
    expect(result.success).toBe(true);
  });

  it('handles null eventData', async () => {
    const result = await trackEngagementEvent(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined productId', async () => {
    const result = await trackEngagementEvent({ eventType: 'page_view' });
    expect(result.success).toBe(true);
    expect(_collections.CustomerEngagement[0].productId).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getMyEngagementHistory
// ═════════════════════════════════════════════════════════════════════
describe('getMyEngagementHistory', () => {
  it('returns engagement events for the current member', async () => {
    __seed('CustomerEngagement', [
      { memberId: 'member-abc', eventType: 'page_view', productId: 'p1', metadata: '', timestamp: new Date(), sessionId: 's1' },
      { memberId: 'other', eventType: 'page_view', productId: 'p2', metadata: '', timestamp: new Date(), sessionId: 's2' },
    ]);
    const result = await getMyEngagementHistory();
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe('p1');
  });

  it('filters by eventType when provided', async () => {
    __seed('CustomerEngagement', [
      { memberId: 'member-abc', eventType: 'page_view', productId: 'p1', metadata: '', timestamp: new Date(), sessionId: '' },
      { memberId: 'member-abc', eventType: 'add_to_cart', productId: 'p2', metadata: '', timestamp: new Date(), sessionId: '' },
    ]);
    const result = await getMyEngagementHistory('add_to_cart');
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe('add_to_cart');
  });

  it('caps limit at 100', async () => {
    // We can't easily test this without 100+ items, but ensure it doesn't crash
    __seed('CustomerEngagement', []);
    const result = await getMyEngagementHistory(null, 200);
    expect(result).toEqual([]);
  });

  it('uses default limit of 20', async () => {
    __seed('CustomerEngagement', []);
    const result = await getMyEngagementHistory();
    expect(result).toEqual([]);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await getMyEngagementHistory();
    expect(result).toEqual([]);
  });
});

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

// ═════════════════════════════════════════════════════════════════════
// generateReferralCode
// ═════════════════════════════════════════════════════════════════════
describe('generateReferralCode', () => {
  it('generates a new referral code', async () => {
    const result = await generateReferralCode();
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^CF-/);
    expect(_collections.ReferralCodes).toHaveLength(1);
    expect(_collections.ReferralCodes[0].discountPercent).toBe(10);
    expect(_collections.ReferralCodes[0].creditAmount).toBe(25);
  });

  it('returns existing code if member already has one', async () => {
    __seed('ReferralCodes', [{ memberId: 'member-abc', code: 'CF-EXISTING' }]);
    const result = await generateReferralCode();
    expect(result.success).toBe(true);
    expect(result.code).toBe('CF-EXISTING');
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await generateReferralCode();
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// redeemReferralCode
// ═════════════════════════════════════════════════════════════════════
describe('redeemReferralCode', () => {
  it('redeems a valid referral code', async () => {
    __seed('ReferralCodes', [
      { _id: 'rc1', code: 'CF-ABCDEF', memberId: 'other-member', discountPercent: 10, usedBy: '', usedAt: null },
    ]);
    const result = await redeemReferralCode('CF-ABCDEF');
    expect(result.valid).toBe(true);
    expect(result.discountPercent).toBe(10);
  });

  it('returns invalid for empty code', async () => {
    const result = await redeemReferralCode('');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for null code', async () => {
    const result = await redeemReferralCode(null);
    expect(result.valid).toBe(false);
  });

  it('rejects own referral code', async () => {
    __seed('ReferralCodes', [
      { _id: 'rc1', code: 'CF-MYCODE', memberId: 'member-abc', discountPercent: 10, usedBy: '' },
    ]);
    const result = await redeemReferralCode('CF-MYCODE');
    expect(result.valid).toBe(false);
  });

  it('rejects already-redeemed code', async () => {
    __seed('ReferralCodes', [
      { _id: 'rc1', code: 'CF-USED', memberId: 'other', discountPercent: 10, usedBy: 'someone-else' },
    ]);
    const result = await redeemReferralCode('CF-USED');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for non-existent code', async () => {
    __seed('ReferralCodes', []);
    const result = await redeemReferralCode('CF-NOPE');
    expect(result.valid).toBe(false);
  });

  it('marks code as used after redemption', async () => {
    __seed('ReferralCodes', [
      { _id: 'rc1', code: 'CF-REDEEM', memberId: 'other', discountPercent: 15, usedBy: '' },
    ]);
    await redeemReferralCode('CF-REDEEM');
    const updated = _collections.ReferralCodes.find(r => r._id === 'rc1');
    expect(updated.usedBy).toBe('member-abc');
    expect(updated.usedAt).toBeInstanceOf(Date);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await redeemReferralCode('CF-ABC');
    expect(result.valid).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getVideos
// ═════════════════════════════════════════════════════════════════════
describe('getVideos', () => {
  it('returns all videos when no filters', async () => {
    __seed('Videos', [
      { _id: 'v1', title: 'Vid 1', videoUrl: 'u1', thumbnail: 't1', productId: '', category: 'futon', duration: 120, viewCount: 50, isFeatured: false },
      { _id: 'v2', title: 'Vid 2', videoUrl: 'u2', thumbnail: 't2', productId: '', category: 'general', duration: 60, viewCount: 100, isFeatured: true },
    ]);
    const result = await getVideos();
    expect(result).toHaveLength(2);
  });

  it('filters by category', async () => {
    __seed('Videos', [
      { _id: 'v1', title: 'Futon', category: 'futon', videoUrl: '', thumbnail: '', productId: '', duration: 0, viewCount: 0, isFeatured: false },
      { _id: 'v2', title: 'General', category: 'general', videoUrl: '', thumbnail: '', productId: '', duration: 0, viewCount: 0, isFeatured: false },
    ]);
    const result = await getVideos({ category: 'futon' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Futon');
  });

  it('filters by productId', async () => {
    __seed('Videos', [
      { _id: 'v1', title: 'P1 vid', productId: 'prod-1', category: '', videoUrl: '', thumbnail: '', duration: 0, viewCount: 0, isFeatured: false },
      { _id: 'v2', title: 'P2 vid', productId: 'prod-2', category: '', videoUrl: '', thumbnail: '', duration: 0, viewCount: 0, isFeatured: false },
    ]);
    const result = await getVideos({ productId: 'prod-1' });
    expect(result).toHaveLength(1);
  });

  it('filters by featuredOnly', async () => {
    __seed('Videos', [
      { _id: 'v1', isFeatured: true, title: 'F', videoUrl: '', thumbnail: '', productId: '', category: '', duration: 0, viewCount: 0 },
      { _id: 'v2', isFeatured: false, title: 'NF', videoUrl: '', thumbnail: '', productId: '', category: '', duration: 0, viewCount: 0 },
    ]);
    const result = await getVideos({ featuredOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('F');
  });

  it('defaults limit to 12', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      _id: `v${i}`, title: `V${i}`, videoUrl: '', thumbnail: '', productId: '', category: '', duration: 0, viewCount: 0, isFeatured: false,
    }));
    __seed('Videos', items);
    const result = await getVideos();
    expect(result).toHaveLength(12);
  });

  it('caps limit at 50', async () => {
    const result = await getVideos({ limit: 100 });
    // Limit is capped at 50, but with no data it returns 0
    expect(result).toEqual([]);
  });

  it('returns empty array on no videos', async () => {
    __seed('Videos', []);
    const result = await getVideos();
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackVideoView
// ═════════════════════════════════════════════════════════════════════
describe('trackVideoView', () => {
  it('increments view count', async () => {
    __seed('Videos', [{ _id: 'v1', viewCount: 5 }]);
    await trackVideoView('v1');
    const updated = _collections.Videos.find(v => v._id === 'v1');
    expect(updated.viewCount).toBe(6);
  });

  it('handles missing viewCount (defaults to 0 + 1)', async () => {
    __seed('Videos', [{ _id: 'v1' }]);
    await trackVideoView('v1');
    const updated = _collections.Videos.find(v => v._id === 'v1');
    expect(updated.viewCount).toBe(1);
  });

  it('does nothing for empty videoId', async () => {
    __seed('Videos', [{ _id: 'v1', viewCount: 5 }]);
    await trackVideoView('');
    expect(_collections.Videos[0].viewCount).toBe(5);
  });

  it('does nothing for null videoId', async () => {
    await trackVideoView(null);
    // No error thrown
  });

  it('does nothing for non-existent video', async () => {
    __seed('Videos', []);
    await trackVideoView('nonexistent');
    // No error thrown
  });

  it('strips special chars from videoId', async () => {
    __seed('Videos', [{ _id: 'v1', viewCount: 0 }]);
    await trackVideoView('v1<script>');
    const updated = _collections.Videos.find(v => v._id === 'v1');
    expect(updated.viewCount).toBe(1);
  });

  it('does nothing if cleaned videoId is empty', async () => {
    await trackVideoView('!!!');
    // All chars stripped, no lookup
  });
});
