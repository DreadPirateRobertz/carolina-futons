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
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
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

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[`${field}_ne_${val}`] = { type: 'ne', field, value: val }; return chain; },
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
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
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
  _mockMember = { _id: 'admin1' };
  _mockRoles = [{ title: 'Admin', _id: 'admin' }];
  _shipmentResult = { success: true, trackingNumber: '1Z999', totalCharge: 35.50, labels: [{ labelBase64: 'base64label' }] };
  _trackResult = { success: true, status: 'In Transit', statusCode: 'I', activities: [], estimatedDelivery: '2026-03-20' };
  vi.resetModules();
  mod = await import('../src/backend/fulfillment.web.js');
});

// ── getPendingOrders ───────────────────────────────────────────────

describe('getPendingOrders', () => {
  it('returns empty when no pending orders', async () => {
    __seed('Stores/Orders', []);
    const r = await mod.getPendingOrders();
    expect(r).toEqual([]);
  });

  it('returns pending paid orders', async () => {
    __seed('Stores/Orders', [{
      _id: 'o1', number: 'ORD-1', paymentStatus: 'PAID', fulfillmentStatus: 'NOT_FULFILLED',
      billingInfo: { firstName: 'Jane', lastName: 'Doe' }, buyerInfo: { email: 'jane@test.com' },
      totals: { subtotal: 400, shipping: 50, total: 450 }, lineItems: [{ name: 'Futon', quantity: 1, sku: 'FF-001' }],
      shippingInfo: { shipmentDetails: { address: { city: 'Asheville' } }, title: 'Ground' },
    }]);
    const r = await mod.getPendingOrders();
    expect(r).toHaveLength(1);
    expect(r[0].number).toBe('ORD-1');
    expect(r[0].buyerName).toBe('Jane Doe');
    expect(r[0].total).toBe(450);
  });

  it('returns empty for non-admin', async () => {
    _mockRoles = [];
    const r = await mod.getPendingOrders();
    expect(r).toEqual([]);
  });

  it('returns empty for unauthenticated', async () => {
    _mockMember = null;
    const r = await mod.getPendingOrders();
    expect(r).toEqual([]);
  });
});

// ── fulfillOrder ───────────────────────────────────────────────────

describe('fulfillOrder', () => {
  it('rejects invalid order ID', async () => {
    const r = await mod.fulfillOrder(null, {});
    expect(r.success).toBe(false);
  });

  it('fulfills order and stores record', async () => {
    __seed('Stores/Orders', [{
      _id: 'o1', number: 'ORD-1',
      billingInfo: { firstName: 'Jane', lastName: 'Doe', phone: '555-1234' },
      shippingInfo: { shipmentDetails: { address: { addressLine: '123 Main', city: 'Asheville', subdivision: 'NC', postalCode: '28801' } } },
    }]);

    const r = await mod.fulfillOrder('o1', { serviceCode: '03' });
    expect(r.success).toBe(true);
    expect(r.trackingNumber).toBe('1Z999');
    expect(r.shippingCost).toBe(35.50);
    expect(_collections['Fulfillments']).toHaveLength(1);
    expect(_collections['Fulfillments'][0].carrier).toBe('UPS');
    expect(_collections['Fulfillments'][0].serviceName).toBe('UPS Ground');
  });

  it('handles shipment creation failure', async () => {
    __seed('Stores/Orders', [{ _id: 'o1', number: 'ORD-1', billingInfo: {}, shippingInfo: {} }]);
    _shipmentResult = { success: false, error: 'Address invalid' };
    const r = await mod.fulfillOrder('o1', {});
    expect(r.success).toBe(false);
  });

  it('rejects non-admin', async () => {
    _mockRoles = [];
    const r = await mod.fulfillOrder('o1', {});
    expect(r.success).toBe(false);
  });
});

// ── getTrackingUpdate ──────────────────────────────────────────────

describe('getTrackingUpdate', () => {
  it('rejects empty tracking number', async () => {
    const r = await mod.getTrackingUpdate('');
    expect(r.success).toBe(false);
  });

  it('returns tracking and updates fulfillment record', async () => {
    __seed('Fulfillments', [{ _id: 'f1', trackingNumber: '1Z999', status: 'LABEL_CREATED' }]);
    const r = await mod.getTrackingUpdate('1Z999');
    expect(r.success).toBe(true);
    expect(_collections['Fulfillments'][0].status).toBe('IN_TRANSIT');
  });

  it('maps DELIVERED status', async () => {
    __seed('Fulfillments', [{ _id: 'f1', trackingNumber: '1Z999', status: 'IN_TRANSIT' }]);
    _trackResult = { success: true, statusCode: 'D', status: 'Delivered', activities: [] };
    await mod.getTrackingUpdate('1Z999');
    expect(_collections['Fulfillments'][0].status).toBe('DELIVERED');
  });
});

// ── updateAllTracking ──────────────────────────────────────────────

describe('updateAllTracking', () => {
  it('returns zeros for no active shipments', async () => {
    __seed('Fulfillments', []);
    const r = await mod.updateAllTracking();
    expect(r.success).toBe(true);
    expect(r.updated).toBe(0);
  });

  it('updates active shipments', async () => {
    __seed('Fulfillments', [
      { _id: 'f1', trackingNumber: '1Z001', status: 'IN_TRANSIT' },
      { _id: 'f2', trackingNumber: '1Z002', status: 'LABEL_CREATED' },
    ]);
    const r = await mod.updateAllTracking();
    expect(r.success).toBe(true);
    expect(r.updated).toBe(2);
  });

  it('skips delivered shipments', async () => {
    __seed('Fulfillments', [
      { _id: 'f1', trackingNumber: '1Z001', status: 'DELIVERED' },
    ]);
    const r = await mod.updateAllTracking();
    expect(r.updated).toBe(0);
  });
});

// ── getFulfillmentHistory ──────────────────────────────────────────

describe('getFulfillmentHistory', () => {
  it('returns empty for no records', async () => {
    __seed('Fulfillments', []);
    const r = await mod.getFulfillmentHistory();
    expect(r).toEqual([]);
  });

  it('returns fulfillment records', async () => {
    __seed('Fulfillments', [
      { _id: 'f1', orderNumber: 'ORD-1', trackingNumber: '1Z001', status: 'DELIVERED', createdDate: new Date() },
    ]);
    const r = await mod.getFulfillmentHistory();
    expect(r).toHaveLength(1);
    expect(r[0].orderNumber).toBe('ORD-1');
  });
});
