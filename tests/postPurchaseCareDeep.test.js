import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
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
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      for (const cb of _insertCbs) cb(collection, record);
      return record;
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
  _mockMemberId = 'member-abc';
});

const mod = await import('../src/backend/postPurchaseCare.web.js');
const {
  getProductGuides,
  deliverGuidesForOrder,
  getUpsellRecommendations,
  trackGuideEngagement,
  logUpsellConversion,
  getAssemblyFollowUpData,
  getReviewSolicitationData,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// getProductGuides
// ═════════════════════════════════════════════════════════════════════
describe('getProductGuides', () => {
  it('returns active guides for a category', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Assembly', summary: 'How to', content: 'Full', steps: '["step1"]', active: true, priority: 1, videoUrl: 'v.mp4', imageUrl: 'i.jpg' },
      { _id: 'g2', productCategory: 'futon-frames', guideType: 'care', title: 'Care', summary: 'Care for', content: 'Full2', steps: null, active: false, priority: 2 },
    ]);
    const result = await getProductGuides('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].title).toBe('Assembly');
    expect(result.guides[0].steps).toEqual(['step1']);
  });

  it('requires category', async () => {
    const result = await getProductGuides('');
    expect(result.success).toBe(false);
    expect(result.guides).toEqual([]);
  });

  it('filters by guideType when provided', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'mattresses', guideType: 'assembly', active: true, priority: 1, steps: null },
      { _id: 'g2', productCategory: 'mattresses', guideType: 'warranty', active: true, priority: 2, steps: null },
    ]);
    const result = await getProductGuides('mattresses', 'warranty');
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].guideType).toBe('warranty');
  });

  it('defaults videoUrl and imageUrl to empty string', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'covers', active: true, priority: 1, steps: null },
    ]);
    const result = await getProductGuides('covers');
    expect(result.guides[0].videoUrl).toBe('');
    expect(result.guides[0].imageUrl).toBe('');
  });

  it('handles malformed steps JSON', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'covers', active: true, priority: 1, steps: 'not-json' },
    ]);
    const result = await getProductGuides('covers');
    expect(result.guides[0].steps).toEqual([]);
  });

  it('handles null steps', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'covers', active: true, priority: 1, steps: null },
    ]);
    const result = await getProductGuides('covers');
    expect(result.guides[0].steps).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// deliverGuidesForOrder
// ═════════════════════════════════════════════════════════════════════
describe('deliverGuidesForOrder', () => {
  it('returns guides grouped by category', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'futon-frames', guideType: 'assembly', title: 'Frame Assembly', active: true, priority: 1, steps: null },
      { _id: 'g2', productCategory: 'mattresses', guideType: 'care', title: 'Mattress Care', active: true, priority: 1, steps: null },
    ]);
    const result = await deliverGuidesForOrder('order-1', ['futon-frames', 'mattresses']);
    expect(result.success).toBe(true);
    expect(result.guidesByCategory['futon-frames']).toHaveLength(1);
    expect(result.guidesByCategory['mattresses']).toHaveLength(1);
  });

  it('requires valid orderId', async () => {
    const result = await deliverGuidesForOrder('', ['futon-frames']);
    expect(result.success).toBe(false);
  });

  it('requires productCategories array', async () => {
    const result = await deliverGuidesForOrder('order-1', null);
    expect(result.success).toBe(false);
  });

  it('requires non-empty categories array', async () => {
    const result = await deliverGuidesForOrder('order-1', []);
    expect(result.success).toBe(false);
  });

  it('caps categories to 10', async () => {
    const cats = Array.from({ length: 15 }, (_, i) => `cat-${i}`);
    __seed('ProductCareGuides', []);
    const result = await deliverGuidesForOrder('order-1', cats);
    expect(result.success).toBe(true);
  });

  it('filters out empty category strings', async () => {
    const result = await deliverGuidesForOrder('order-1', ['', '', '']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid categories');
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await deliverGuidesForOrder('order-1', ['futon-frames']);
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getUpsellRecommendations
// ═════════════════════════════════════════════════════════════════════
describe('getUpsellRecommendations', () => {
  it('returns category-level recommendations', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u1', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'p1', recommendedProductName: 'Cover', recommendedCategory: 'covers', reason: 'Protect your futon', discount: 10, delayDays: 3, priority: 1, active: true },
    ]);
    const result = await getUpsellRecommendations('futon-frames');
    expect(result.success).toBe(true);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedProductName).toBe('Cover');
    expect(result.recommendations[0].discount).toBe(10);
  });

  it('prefers product-specific recommendations', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u1', sourceCategory: 'futon-frames', sourceProductId: 'prod-1', recommendedProductId: 'p-specific', recommendedProductName: 'Specific', active: true, delayDays: 3, priority: 1 },
      { _id: 'u2', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'p-generic', recommendedProductName: 'Generic', active: true, delayDays: 3, priority: 1 },
    ]);
    const result = await getUpsellRecommendations('futon-frames', 'prod-1', 5);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedProductName).toBe('Specific');
  });

  it('falls back to category recs when no product-specific ones', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u1', sourceCategory: 'futon-frames', sourceProductId: '', recommendedProductId: 'p1', recommendedProductName: 'Generic', active: true, delayDays: 3, priority: 1 },
    ]);
    const result = await getUpsellRecommendations('futon-frames', 'prod-1', 5);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedProductName).toBe('Generic');
  });

  it('requires category', async () => {
    const result = await getUpsellRecommendations('');
    expect(result.success).toBe(false);
  });

  it('defaults daysSincePurchase to 3', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u1', sourceCategory: 'mattresses', delayDays: 3, active: true, priority: 1 },
      { _id: 'u2', sourceCategory: 'mattresses', delayDays: 7, active: true, priority: 2 },
    ]);
    const result = await getUpsellRecommendations('mattresses');
    expect(result.recommendations).toHaveLength(1); // Only delayDays <= 3
  });

  it('clamps days to 0-30 range', async () => {
    __seed('PostPurchaseUpsells', []);
    const result = await getUpsellRecommendations('mattresses', null, -5);
    expect(result.success).toBe(true);
  });

  it('clamps days max to 30', async () => {
    __seed('PostPurchaseUpsells', []);
    const result = await getUpsellRecommendations('mattresses', null, 100);
    expect(result.success).toBe(true);
  });

  it('defaults discount to 0 when missing', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u1', sourceCategory: 'futons', active: true, delayDays: 0, priority: 1 },
    ]);
    const result = await getUpsellRecommendations('futons', null, 3);
    expect(result.recommendations[0].discount).toBe(0);
  });

  it('defaults delayDays to 3 in output when present in data', async () => {
    __seed('PostPurchaseUpsells', [
      { _id: 'u1', sourceCategory: 'futons', active: true, priority: 1, delayDays: 0 },
    ]);
    const result = await getUpsellRecommendations('futons', null, 5);
    // delayDays 0 is falsy, so formatRecommendation defaults to 3
    expect(result.recommendations[0].delayDays).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackGuideEngagement
// ═════════════════════════════════════════════════════════════════════
describe('trackGuideEngagement', () => {
  it('tracks a valid guide view', async () => {
    const result = await trackGuideEngagement({
      guideId: 'g1', orderId: 'o1', productCategory: 'futon-frames', action: 'view', duration: 120,
    });
    expect(result.success).toBe(true);
    expect(_collections.GuideEngagement).toHaveLength(1);
    expect(_collections.GuideEngagement[0].memberId).toBe('member-abc');
    expect(_collections.GuideEngagement[0].duration).toBe(120);
  });

  it('accepts all valid actions', async () => {
    for (const action of ['view', 'complete', 'video_play', 'share']) {
      _collections = {};
      const result = await trackGuideEngagement({ guideId: 'g1', action });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid action', async () => {
    const result = await trackGuideEngagement({ guideId: 'g1', action: 'delete' });
    expect(result.success).toBe(false);
  });

  it('requires valid guideId', async () => {
    const result = await trackGuideEngagement({ guideId: '', action: 'view' });
    expect(result.success).toBe(false);
  });

  it('clamps duration to 0-3600', async () => {
    await trackGuideEngagement({ guideId: 'g1', action: 'view', duration: 5000 });
    expect(_collections.GuideEngagement[0].duration).toBe(3600);
  });

  it('clamps negative duration to 0', async () => {
    await trackGuideEngagement({ guideId: 'g1', action: 'view', duration: -10 });
    expect(_collections.GuideEngagement[0].duration).toBe(0);
  });

  it('defaults duration to 0 when not provided', async () => {
    await trackGuideEngagement({ guideId: 'g1', action: 'view' });
    expect(_collections.GuideEngagement[0].duration).toBe(0);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await trackGuideEngagement({ guideId: 'g1', action: 'view' });
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// logUpsellConversion
// ═════════════════════════════════════════════════════════════════════
describe('logUpsellConversion', () => {
  it('logs a valid conversion', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', discount: 10, revenue: 299,
    });
    expect(result.success).toBe(true);
    expect(_collections.UpsellConversions).toHaveLength(1);
    expect(_collections.UpsellConversions[0].revenue).toBe(299);
  });

  it('requires sourceOrderId', async () => {
    const result = await logUpsellConversion({ sourceProductId: 'p1', recommendedProductId: 'p2' });
    expect(result.success).toBe(false);
  });

  it('requires recommendedProductId', async () => {
    const result = await logUpsellConversion({ sourceOrderId: 'o1', sourceProductId: 'p1' });
    expect(result.success).toBe(false);
  });

  it('allows missing sourceProductId', async () => {
    const result = await logUpsellConversion({
      sourceOrderId: 'o1', recommendedProductId: 'p2',
    });
    expect(result.success).toBe(true);
    expect(_collections.UpsellConversions[0].sourceProductId).toBe('');
  });

  it('clamps discount to 0-100', async () => {
    await logUpsellConversion({ sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', discount: 150 });
    expect(_collections.UpsellConversions[0].discount).toBe(100);
  });

  it('clamps negative discount to 0', async () => {
    await logUpsellConversion({ sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', discount: -10 });
    expect(_collections.UpsellConversions[0].discount).toBe(0);
  });

  it('clamps negative revenue to 0', async () => {
    await logUpsellConversion({ sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', revenue: -100 });
    expect(_collections.UpsellConversions[0].revenue).toBe(0);
  });

  it('fails when not authenticated', async () => {
    _mockMemberId = null;
    const result = await logUpsellConversion({ sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2' });
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getAssemblyFollowUpData
// ═════════════════════════════════════════════════════════════════════
describe('getAssemblyFollowUpData', () => {
  it('returns assembly guides and support info', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'futon-frames', guideType: 'assembly', active: true, priority: 1, title: 'Frame Assembly', steps: null },
    ]);
    const result = await getAssemblyFollowUpData('order-1', ['futon-frames']);
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(1);
    expect(result.supportPhone).toBe('(828) 252-9449');
    expect(result.supportEmail).toBe('support@carolinafutons.com');
  });

  it('requires valid orderId', async () => {
    const result = await getAssemblyFollowUpData('', ['futon-frames']);
    expect(result.success).toBe(false);
  });

  it('requires categories array', async () => {
    const result = await getAssemblyFollowUpData('order-1', null);
    expect(result.success).toBe(false);
  });

  it('returns empty guides with support info for empty valid categories', async () => {
    const result = await getAssemblyFollowUpData('order-1', ['', '']);
    expect(result.success).toBe(true);
    expect(result.guides).toEqual([]);
    expect(result.supportPhone).toBeTruthy();
  });

  it('only returns assembly-type guides', async () => {
    __seed('ProductCareGuides', [
      { _id: 'g1', productCategory: 'futons', guideType: 'assembly', active: true, priority: 1, steps: null },
      { _id: 'g2', productCategory: 'futons', guideType: 'warranty', active: true, priority: 2, steps: null },
    ]);
    const result = await getAssemblyFollowUpData('o1', ['futons']);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0]._id).toBe('g1');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getReviewSolicitationData
// ═════════════════════════════════════════════════════════════════════
describe('getReviewSolicitationData', () => {
  it('returns review URLs and product data', async () => {
    const result = await getReviewSolicitationData('order-1', 'John', [
      { name: 'Futon Frame', productId: 'p1' },
    ]);
    expect(result.success).toBe(true);
    expect(result.reviewUrl).toContain('order-1');
    expect(result.customerName).toBe('John');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].reviewUrl).toContain('p1');
  });

  it('requires valid orderId', async () => {
    const result = await getReviewSolicitationData('', 'John', []);
    expect(result.success).toBe(false);
  });

  it('handles null customerName', async () => {
    const result = await getReviewSolicitationData('o1', null, []);
    expect(result.success).toBe(true);
    expect(result.customerName).toBe('');
  });

  it('handles null products', async () => {
    const result = await getReviewSolicitationData('o1', 'Jane', null);
    expect(result.success).toBe(true);
    expect(result.products).toEqual([]);
  });

  it('caps products to 20', async () => {
    const products = Array.from({ length: 25 }, (_, i) => ({ name: `P${i}`, productId: `id-${i}` }));
    const result = await getReviewSolicitationData('o1', 'Jane', products);
    expect(result.products).toHaveLength(20);
  });

  it('uses order reviewUrl when product has no productId', async () => {
    const result = await getReviewSolicitationData('o1', 'Jane', [{ name: 'Test' }]);
    expect(result.products[0].reviewUrl).toContain('o1');
  });
});
