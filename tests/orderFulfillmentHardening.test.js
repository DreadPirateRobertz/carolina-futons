/**
 * Hardening tests for orderTracking and postPurchaseCare.
 * Covers uncovered branches, edge cases, and bug-fix regressions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared inline mocks ────────────────────────────────────────────

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
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
}));

let _mockMember = { _id: 'admin1' };
let _mockRoles = [{ title: 'Admin', _id: 'admin' }];
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
    getRoles: async () => _mockRoles,
  },
}));

let _shipmentResult = { success: true, trackingNumber: '1Z999', totalCharge: 35.50, labels: [{ labelBase64: 'base64label' }] };
let _trackResult = { success: true, status: 'In Transit', statusCode: 'I', activities: [], estimatedDelivery: '2026-03-20' };
vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => _shipmentResult),
  trackShipment: vi.fn(async () => _trackResult),
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
    ne: (field, val) => { filters[`${field}_ne_${val}`] = { type: 'ne', field, value: val }; return chain; },
    le: (field, val) => { filters[field] = { type: 'le', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
        if (f.type === 'le') items = items.filter(i => i[key] <= f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[key]));
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
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      for (const cb of _insertCbs) cb(collection, record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

// ── Module imports (after mocks) ────────────────────────────────────

let orderTrackingMod, postPurchaseMod;

beforeEach(async () => {
  _collections = {};
  _insertCbs = [];
  _mockMember = { _id: 'admin1' };
  _mockRoles = [{ title: 'Admin', _id: 'admin' }];
  _shipmentResult = { success: true, trackingNumber: '1Z999', totalCharge: 35.50, labels: [{ labelBase64: 'base64label' }] };
  _trackResult = { success: true, status: 'In Transit', statusCode: 'I', activities: [], estimatedDelivery: '2026-03-20' };
  vi.resetModules();
  [orderTrackingMod, postPurchaseMod] = await Promise.all([
    import('../src/backend/orderTracking.web.js'),
    import('../src/backend/postPurchaseCare.web.js'),
  ]);
});

// ═════════════════════════════════════════════════════════════════════
// orderTracking — uncovered branches
// ═════════════════════════════════════════════════════════════════════

describe('orderTracking hardening', () => {
  describe('getTrackingTimeline status mapping', () => {
    it('maps P status to PICKED_UP', async () => {
      _trackResult = { success: true, statusCode: 'P', status: 'Picked Up', activities: [] };
      const r = await orderTrackingMod.getTrackingTimeline('1Z999');
      expect(r.fulfillmentStatus).toBe('PICKED_UP');
      expect(r.statusLabel).toBe('Picked Up');
      expect(r.timeline[2].completed).toBe(true); // step 2
    });

    it('maps M status to LABEL_CREATED', async () => {
      _trackResult = { success: true, statusCode: 'M', status: 'Manifest', activities: [] };
      const r = await orderTrackingMod.getTrackingTimeline('1Z999');
      expect(r.fulfillmentStatus).toBe('LABEL_CREATED');
      expect(r.statusLabel).toBe('Label Created');
      expect(r.timeline[1].completed).toBe(true); // step 1
      expect(r.timeline[2].completed).toBe(false); // step 2 not yet
    });

    it('maps RS status to RETURNED', async () => {
      _trackResult = { success: true, statusCode: 'RS', status: 'Returned to Sender', activities: [] };
      const r = await orderTrackingMod.getTrackingTimeline('1Z999');
      expect(r.fulfillmentStatus).toBe('RETURNED');
      expect(r.statusLabel).toBe('Returned');
      // step = -1, so no timeline steps are completed
      expect(r.timeline[0].completed).toBe(false);
    });

    it('defaults unknown status to IN_TRANSIT', async () => {
      _trackResult = { success: true, statusCode: 'ZZ', status: 'Unknown Code', activities: [] };
      const r = await orderTrackingMod.getTrackingTimeline('1Z999');
      expect(r.fulfillmentStatus).toBe('IN_TRANSIT');
    });

    it('handles null statusCode', async () => {
      _trackResult = { success: true, statusCode: null, status: 'Unknown', activities: [] };
      const r = await orderTrackingMod.getTrackingTimeline('1Z999');
      expect(r.fulfillmentStatus).toBe('IN_TRANSIT');
    });

    it('handles empty statusCode string', async () => {
      _trackResult = { success: true, statusCode: '', status: '', activities: [] };
      const r = await orderTrackingMod.getTrackingTimeline('1Z999');
      expect(r.fulfillmentStatus).toBe('IN_TRANSIT');
    });
  });

  describe('lookupOrder — EXCEPTION and RETURNED status display', () => {
    it('shows EXCEPTION status with step -1', async () => {
      __seed('Stores/Orders', [{
        _id: 'o1', number: 'ORD-1', buyerInfo: { email: 'a@b.com' },
        totals: {}, lineItems: [],
      }]);
      __seed('Fulfillments', [{ _id: 'f1', orderId: 'o1', status: 'EXCEPTION' }]);
      __seed('TrackingNotifications', []);

      const r = await orderTrackingMod.lookupOrder('ORD-1', 'a@b.com');
      expect(r.success).toBe(true);
      expect(r.order.status).toBe('Exception');
      // step = -1 means no timeline steps completed
      expect(r.timeline.every(s => s.completed === false)).toBe(true);
    });

    it('shows RETURNED status', async () => {
      __seed('Stores/Orders', [{
        _id: 'o1', number: 'ORD-1', buyerInfo: { email: 'a@b.com' },
        totals: {}, lineItems: [],
      }]);
      __seed('Fulfillments', [{ _id: 'f1', orderId: 'o1', status: 'RETURNED' }]);
      __seed('TrackingNotifications', []);

      const r = await orderTrackingMod.lookupOrder('ORD-1', 'a@b.com');
      expect(r.success).toBe(true);
      expect(r.order.status).toBe('Returned');
    });

    it('shows UNKNOWN status for unrecognized fulfillment status', async () => {
      __seed('Stores/Orders', [{
        _id: 'o1', number: 'ORD-1', buyerInfo: { email: 'a@b.com' },
        totals: {}, lineItems: [],
      }]);
      __seed('Fulfillments', [{ _id: 'f1', orderId: 'o1', status: 'BIZARRE_STATUS' }]);
      __seed('TrackingNotifications', []);

      const r = await orderTrackingMod.lookupOrder('ORD-1', 'a@b.com');
      expect(r.success).toBe(true);
      expect(r.order.status).toBe('Unknown');
    });
  });

  describe('lookupOrder — line item edge cases', () => {
    it('handles line items with missing fields', async () => {
      __seed('Stores/Orders', [{
        _id: 'o1', number: 'ORD-1', buyerInfo: { email: 'a@b.com' },
        totals: {}, lineItems: [{ /* empty item */ }],
      }]);
      __seed('Fulfillments', []);
      __seed('TrackingNotifications', []);

      const r = await orderTrackingMod.lookupOrder('ORD-1', 'a@b.com');
      expect(r.lineItems[0].name).toBe('');
      expect(r.lineItems[0].quantity).toBe(1);
      expect(r.lineItems[0].price).toBe(0);
      expect(r.lineItems[0].image).toBeNull();
    });

    it('handles null lineItems array', async () => {
      __seed('Stores/Orders', [{
        _id: 'o1', number: 'ORD-1', buyerInfo: { email: 'a@b.com' },
        totals: {}, lineItems: null,
      }]);
      __seed('Fulfillments', []);
      __seed('TrackingNotifications', []);

      const r = await orderTrackingMod.lookupOrder('ORD-1', 'a@b.com');
      expect(r.lineItems).toEqual([]);
    });
  });

  describe('unsubscribeFromNotifications — email validation', () => {
    it('rejects null order number', async () => {
      const r = await orderTrackingMod.unsubscribeFromNotifications(null, 'a@b.com');
      expect(r.success).toBe(false);
    });

    it('rejects null email', async () => {
      const r = await orderTrackingMod.unsubscribeFromNotifications('ORD-1', null);
      expect(r.success).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// postPurchaseCare — bug fixes and uncovered branches
// ═════════════════════════════════════════════════════════════════════

describe('postPurchaseCare hardening', () => {
  describe('getUpsellRecommendations — delayDays zero-value bug fix', () => {
    it('preserves delayDays of 0 in output (regression: || vs ??)', async () => {
      __seed('PostPurchaseUpsells', [
        { _id: 'u1', sourceCategory: 'futons', active: true, delayDays: 0, priority: 1, recommendedProductId: 'p1', recommendedProductName: 'Instant Rec' },
      ]);
      const r = await postPurchaseMod.getUpsellRecommendations('futons', null, 5);
      expect(r.recommendations[0].delayDays).toBe(0);
    });

    it('defaults null delayDays to 3 in output', async () => {
      __seed('PostPurchaseUpsells', [
        { _id: 'u1', sourceCategory: 'futons', active: true, delayDays: null, priority: 1, recommendedProductId: 'p1', recommendedProductName: 'Rec' },
      ]);
      const r = await postPurchaseMod.getUpsellRecommendations('futons', null, 5);
      // null ?? 3 = 3, confirming nullish coalescing works
      expect(r.recommendations[0].delayDays).toBe(3);
    });
  });

  describe('getUpsellRecommendations — daysSincePurchase zero-value bug fix', () => {
    it('allows daysSincePurchase of 0 (regression: || vs ??)', async () => {
      __seed('PostPurchaseUpsells', [
        { _id: 'u1', sourceCategory: 'futons', active: true, delayDays: 0, priority: 1 },
        { _id: 'u2', sourceCategory: 'futons', active: true, delayDays: 3, priority: 2 },
      ]);
      const r = await postPurchaseMod.getUpsellRecommendations('futons', null, 0);
      // Only delayDays <= 0 should match
      expect(r.recommendations).toHaveLength(1);
    });

    it('handles NaN daysSincePurchase by defaulting to 3', async () => {
      __seed('PostPurchaseUpsells', [
        { _id: 'u1', sourceCategory: 'futons', active: true, delayDays: 3, priority: 1 },
        { _id: 'u2', sourceCategory: 'futons', active: true, delayDays: 7, priority: 2 },
      ]);
      const r = await postPurchaseMod.getUpsellRecommendations('futons', null, 'invalid');
      // NaN → defaults to 3, so only delayDays <= 3
      expect(r.recommendations).toHaveLength(1);
    });
  });

  describe('getUpsellRecommendations — invalid productId', () => {
    it('falls back to category recs with invalid productId', async () => {
      __seed('PostPurchaseUpsells', [
        { _id: 'u1', sourceCategory: 'futons', active: true, delayDays: 3, priority: 1, recommendedProductName: 'Generic' },
      ]);
      const r = await postPurchaseMod.getUpsellRecommendations('futons', '<script>xss</script>', 5);
      // Invalid productId (cleans to empty) falls back to category query
      expect(r.recommendations).toHaveLength(1);
    });
  });

  describe('trackGuideEngagement — orderId handling', () => {
    it('stores empty orderId when not provided', async () => {
      const r = await postPurchaseMod.trackGuideEngagement({
        guideId: 'g1', action: 'view',
      });
      expect(r.success).toBe(true);
      expect(_collections.GuideEngagement[0].orderId).toBe('');
    });

    it('validates and stores orderId when provided', async () => {
      const r = await postPurchaseMod.trackGuideEngagement({
        guideId: 'g1', action: 'view', orderId: 'order-123',
      });
      expect(r.success).toBe(true);
      expect(_collections.GuideEngagement[0].orderId).toBe('order-123');
    });

    it('stores productCategory', async () => {
      const r = await postPurchaseMod.trackGuideEngagement({
        guideId: 'g1', action: 'complete', productCategory: 'futon-frames',
      });
      expect(r.success).toBe(true);
      expect(_collections.GuideEngagement[0].productCategory).toBe('futon-frames');
    });

    it('defaults productCategory to empty string', async () => {
      const r = await postPurchaseMod.trackGuideEngagement({
        guideId: 'g1', action: 'view',
      });
      expect(r.success).toBe(true);
      expect(_collections.GuideEngagement[0].productCategory).toBe('');
    });
  });

  describe('logUpsellConversion — discount/revenue clamping', () => {
    it('rounds discount to integer', async () => {
      await postPurchaseMod.logUpsellConversion({
        sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', discount: 15.7,
      });
      expect(_collections.UpsellConversions[0].discount).toBe(16);
    });

    it('handles NaN discount', async () => {
      await postPurchaseMod.logUpsellConversion({
        sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', discount: 'not-a-number',
      });
      expect(_collections.UpsellConversions[0].discount).toBe(0);
    });

    it('handles NaN revenue', async () => {
      await postPurchaseMod.logUpsellConversion({
        sourceOrderId: 'o1', sourceProductId: 'p1', recommendedProductId: 'p2', revenue: 'nope',
      });
      expect(_collections.UpsellConversions[0].revenue).toBe(0);
    });
  });

  describe('getAssemblyFollowUpData — empty categories after sanitize', () => {
    it('returns empty guides for all-empty categories', async () => {
      const r = await postPurchaseMod.getAssemblyFollowUpData('o1', ['', '', '']);
      expect(r.success).toBe(true);
      expect(r.guides).toEqual([]);
      expect(r.supportPhone).toBeTruthy();
    });

    it('returns guides with steps parsed', async () => {
      __seed('ProductCareGuides', [
        { _id: 'g1', productCategory: 'futons', guideType: 'assembly', active: true, priority: 1, title: 'Build It', steps: '["step1","step2"]' },
      ]);
      const r = await postPurchaseMod.getAssemblyFollowUpData('o1', ['futons']);
      expect(r.guides[0].steps).toEqual(['step1', 'step2']);
    });
  });

  describe('getReviewSolicitationData — product reviewUrl construction', () => {
    it('builds per-product review URLs', async () => {
      const r = await postPurchaseMod.getReviewSolicitationData('o1', 'Jane', [
        { name: 'Futon', productId: 'prod-123' },
        { name: 'Cover', productId: '' },
      ]);
      expect(r.products[0].reviewUrl).toContain('prod-123');
      expect(r.products[0].reviewUrl).toContain('#reviews');
      // Empty productId falls back to order review URL
      expect(r.products[1].reviewUrl).toContain('o1');
    });

    it('sanitizes product names', async () => {
      const r = await postPurchaseMod.getReviewSolicitationData('o1', 'Jane', [
        { name: '<b>Bold Product</b>', productId: 'p1' },
      ]);
      expect(r.products[0].name).toBe('Bold Product');
      expect(r.products[0].name).not.toContain('<');
    });
  });

  describe('getProductGuides — steps JSON parsing', () => {
    it('parses non-array JSON to empty array', async () => {
      __seed('ProductCareGuides', [
        { _id: 'g1', productCategory: 'futons', active: true, priority: 1, steps: '"just a string"' },
      ]);
      const r = await postPurchaseMod.getProductGuides('futons');
      expect(r.guides[0].steps).toEqual([]);
    });

    it('parses object JSON to empty array', async () => {
      __seed('ProductCareGuides', [
        { _id: 'g1', productCategory: 'futons', active: true, priority: 1, steps: '{"key":"val"}' },
      ]);
      const r = await postPurchaseMod.getProductGuides('futons');
      expect(r.guides[0].steps).toEqual([]);
    });
  });

  describe('deliverGuidesForOrder — non-string category sanitize', () => {
    it('filters out numeric categories', async () => {
      const r = await postPurchaseMod.deliverGuidesForOrder('o1', [123, null, 'futons']);
      expect(r.success).toBe(true);
    });
  });
});
