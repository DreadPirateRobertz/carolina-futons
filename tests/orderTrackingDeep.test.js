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
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
}));

let _trackResult = { success: true, status: 'In Transit', statusCode: 'I', activities: [], estimatedDelivery: '2026-03-20' };
vi.mock('backend/ups-shipping.web', () => ({
  trackShipment: vi.fn(async () => _trackResult),
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[`${field}_ne`] = { type: 'ne', field, value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[f.field] !== f.value);
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
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

let mod;
beforeEach(async () => {
  _collections = {};
  _trackResult = { success: true, status: 'In Transit', statusCode: 'I', activities: [], estimatedDelivery: '2026-03-20' };
  vi.resetModules();
  mod = await import('../src/backend/orderTracking.web.js');
});

// ── lookupOrder ────────────────────────────────────────────────────

describe('lookupOrder', () => {
  it('rejects empty order number', async () => {
    const r = await mod.lookupOrder('', 'test@example.com');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Order number');
  });

  it('rejects invalid email', async () => {
    const r = await mod.lookupOrder('ORD-123', 'bad');
    expect(r.success).toBe(false);
    expect(r.error).toContain('email');
  });

  it('returns error for non-existent order', async () => {
    __seed('Stores/Orders', []);
    const r = await mod.lookupOrder('ORD-123', 'test@example.com');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('rejects mismatched email', async () => {
    __seed('Stores/Orders', [{ _id: 'o1', number: 'ORD-123', buyerInfo: { email: 'other@example.com' } }]);
    const r = await mod.lookupOrder('ORD-123', 'test@example.com');
    expect(r.success).toBe(false);
  });

  it('returns order with tracking', async () => {
    __seed('Stores/Orders', [{
      _id: 'o1', number: 'ORD-123', buyerInfo: { email: 'test@example.com' },
      totals: { subtotal: 400, shipping: 50, total: 450 }, lineItems: [{ name: 'Futon', quantity: 1 }],
      shippingInfo: { shipmentDetails: { address: { city: 'Asheville', subdivision: 'NC', postalCode: '28801' } } },
    }]);
    __seed('Fulfillments', [{ _id: 'f1', orderId: 'o1', trackingNumber: '1Z999', carrier: 'UPS', status: 'IN_TRANSIT' }]);
    __seed('TrackingNotifications', []);

    const r = await mod.lookupOrder('ORD-123', 'test@example.com');
    expect(r.success).toBe(true);
    expect(r.order.number).toBe('ORD-123');
    expect(r.shipping.trackingNumber).toBe('1Z999');
    expect(r.tracking).toBeTruthy();
    expect(r.totals.total).toBe(450);
  });

  it('returns timeline with completed steps', async () => {
    __seed('Stores/Orders', [{
      _id: 'o1', number: 'ORD-123', buyerInfo: { email: 'test@example.com' },
      totals: {}, lineItems: [],
    }]);
    __seed('Fulfillments', [{ _id: 'f1', orderId: 'o1', status: 'IN_TRANSIT' }]);

    const r = await mod.lookupOrder('ORD-123', 'test@example.com');
    expect(r.timeline).toHaveLength(5);
    expect(r.timeline[0].label).toBe('Order Placed');
  });

  it('works without fulfillment', async () => {
    __seed('Stores/Orders', [{
      _id: 'o1', number: 'ORD-123', buyerInfo: { email: 'test@example.com' },
      totals: {}, lineItems: [],
    }]);
    __seed('Fulfillments', []);

    const r = await mod.lookupOrder('ORD-123', 'test@example.com');
    expect(r.success).toBe(true);
    expect(r.order.status).toBe('Processing');
    expect(r.shipping.trackingNumber).toBeNull();
  });
});

// ── subscribeToNotifications ───────────────────────────────────────

describe('subscribeToNotifications', () => {
  it('rejects invalid inputs', async () => {
    const r = await mod.subscribeToNotifications('', '');
    expect(r.success).toBe(false);
  });

  it('rejects non-existent order', async () => {
    __seed('Stores/Orders', []);
    const r = await mod.subscribeToNotifications('ORD-123', 'test@example.com');
    expect(r.success).toBe(false);
  });

  it('creates notification subscription', async () => {
    __seed('Stores/Orders', [{ _id: 'o1', number: 'ORD-123', buyerInfo: { email: 'test@example.com' } }]);
    __seed('Fulfillments', [{ _id: 'f1', orderId: 'o1', trackingNumber: '1Z999' }]);
    __seed('TrackingNotifications', []);

    const r = await mod.subscribeToNotifications('ORD-123', 'test@example.com');
    expect(r.success).toBe(true);
    expect(r.alreadySubscribed).toBe(false);
    expect(_collections['TrackingNotifications']).toHaveLength(1);
  });

  it('re-enables existing disabled subscription', async () => {
    __seed('Stores/Orders', [{ _id: 'o1', number: 'ORD-123', buyerInfo: { email: 'test@example.com' } }]);
    __seed('Fulfillments', []);
    __seed('TrackingNotifications', [{ _id: 'tn1', orderNumber: 'ORD-123', email: 'test@example.com', enabled: false }]);

    const r = await mod.subscribeToNotifications('ORD-123', 'test@example.com');
    expect(r.success).toBe(true);
    expect(_collections['TrackingNotifications'][0].enabled).toBe(true);
  });
});

// ── unsubscribeFromNotifications ───────────────────────────────────

describe('unsubscribeFromNotifications', () => {
  it('rejects empty inputs', async () => {
    const r = await mod.unsubscribeFromNotifications('', '');
    expect(r.success).toBe(false);
  });

  it('disables notification', async () => {
    __seed('TrackingNotifications', [{ _id: 'tn1', orderNumber: 'ORD-123', email: 'test@example.com', enabled: true }]);
    const r = await mod.unsubscribeFromNotifications('ORD-123', 'test@example.com');
    expect(r.success).toBe(true);
    expect(_collections['TrackingNotifications'][0].enabled).toBe(false);
  });

  it('succeeds even without existing subscription', async () => {
    __seed('TrackingNotifications', []);
    const r = await mod.unsubscribeFromNotifications('ORD-123', 'test@example.com');
    expect(r.success).toBe(true);
  });
});

// ── getTrackingTimeline ────────────────────────────────────────────

describe('getTrackingTimeline', () => {
  it('rejects empty tracking number', async () => {
    const r = await mod.getTrackingTimeline('');
    expect(r.success).toBe(false);
  });

  it('returns timeline for valid tracking', async () => {
    const r = await mod.getTrackingTimeline('1Z999AA10000000001');
    expect(r.success).toBe(true);
    expect(r.fulfillmentStatus).toBe('IN_TRANSIT');
    expect(r.timeline).toHaveLength(5);
  });

  it('maps D status to DELIVERED', async () => {
    _trackResult = { success: true, statusCode: 'D', status: 'Delivered', activities: [] };
    const r = await mod.getTrackingTimeline('1Z999');
    expect(r.fulfillmentStatus).toBe('DELIVERED');
    expect(r.timeline[4].completed).toBe(true);
  });

  it('maps OD status to OUT_FOR_DELIVERY', async () => {
    _trackResult = { success: true, statusCode: 'OD', status: 'Out for Delivery', activities: [] };
    const r = await mod.getTrackingTimeline('1Z999');
    expect(r.fulfillmentStatus).toBe('OUT_FOR_DELIVERY');
  });

  it('handles tracking failure', async () => {
    _trackResult = { success: false, error: 'Not found' };
    const r = await mod.getTrackingTimeline('1Z999');
    expect(r.success).toBe(false);
  });
});
