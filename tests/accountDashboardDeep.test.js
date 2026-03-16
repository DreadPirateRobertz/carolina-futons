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
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit' || field === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => {
          // support dot-notation fields like 'buyerInfo.id'
          const parts = field.split('.');
          let val = i;
          for (const p of parts) val = val?.[p];
          return val === f.value;
        });
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      const totalCount = items.length;
      if (filters._skip) items = items.slice(filters._skip);
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount };
    },
    count: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit' || field === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => {
          const parts = field.split('.');
          let val = i;
          for (const p of parts) val = val?.[p];
          return val === f.value;
        });
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
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
    remove: vi.fn(async (col, id) => {
      if (_collections[col]) {
        _collections[col] = _collections[col].filter(i => i._id !== id);
      }
      return { _id: id };
    }),
  },
}));

let _currentMember = null;

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => {
      if (_currentMember === null) throw new Error('Not logged in');
      return _currentMember;
    }),
  },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, maxLen) => {
    if (!val || typeof val !== 'string') return '';
    return val.slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    return /^[a-f0-9-]+$/i.test(id) ? id : null;
  },
}));

vi.mock('backend/utils/safeParse', () => ({
  safeParse: (str, fallback = null) => {
    if (str == null || str === '') return fallback;
    if (typeof str !== 'string') return str;
    try { return JSON.parse(str); } catch { return fallback; }
  },
}));

import {
  getAccountSummary,
  getOrderHistory,
  getActiveDeliveries,
  getWishlist,
  removeFromWishlist,
  addToWishlist,
  moveWishlistToCart,
  getWishlistAlertHistory,
  updatePreferences,
  getPreferences,
  getReorderItems,
} from '../src/backend/accountDashboard.web.js';

const MEMBER_ID = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';

beforeEach(() => {
  vi.clearAllMocks();
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
  _currentMember = {
    _id: MEMBER_ID,
    loginEmail: 'test@example.com',
    contactDetails: { firstName: 'Alice' },
  };
});

// ── getAccountSummary ───────────────────────────────────────────────

describe('getAccountSummary', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getAccountSummary();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns zero counts for fresh member', async () => {
    const r = await getAccountSummary();
    expect(r.success).toBe(true);
    expect(r.data.orderCount).toBe(0);
    expect(r.data.wishlistCount).toBe(0);
    expect(r.data.activeDeliveries).toBe(0);
  });

  it('returns correct memberId', async () => {
    const r = await getAccountSummary();
    expect(r.data.memberId).toBe(MEMBER_ID);
  });

  it('returns memberName from contactDetails.firstName', async () => {
    const r = await getAccountSummary();
    expect(r.data.memberName).toBe('Alice');
  });

  it('defaults memberName to "Member" when firstName missing', async () => {
    _currentMember = { _id: MEMBER_ID, loginEmail: 'x@x.com', contactDetails: {} };
    const r = await getAccountSummary();
    expect(r.data.memberName).toBe('Member');
  });

  it('defaults memberName to "Member" when contactDetails missing', async () => {
    _currentMember = { _id: MEMBER_ID, loginEmail: 'x@x.com' };
    const r = await getAccountSummary();
    expect(r.data.memberName).toBe('Member');
  });

  it('returns loginEmail', async () => {
    const r = await getAccountSummary();
    expect(r.data.memberEmail).toBe('test@example.com');
  });

  it('defaults memberEmail to empty string when loginEmail missing', async () => {
    _currentMember = { _id: MEMBER_ID, contactDetails: { firstName: 'Bob' } };
    const r = await getAccountSummary();
    expect(r.data.memberEmail).toBe('');
  });

  it('counts orders for member only', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: MEMBER_ID } },
      { _id: 'o2', buyerInfo: { id: MEMBER_ID } },
      { _id: 'o3', buyerInfo: { id: 'other-member' } },
    ]);
    const r = await getAccountSummary();
    expect(r.data.orderCount).toBe(2);
  });

  it('counts wishlist items for member only', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: MEMBER_ID },
      { _id: 'w2', memberId: 'other' },
    ]);
    const r = await getAccountSummary();
    expect(r.data.wishlistCount).toBe(1);
  });

  it('counts only non-delivered deliveries', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: MEMBER_ID, status: 'shipped' },
      { _id: 'd2', memberId: MEMBER_ID, status: 'delivered' },
      { _id: 'd3', memberId: MEMBER_ID, status: 'in_transit' },
    ]);
    const r = await getAccountSummary();
    expect(r.data.activeDeliveries).toBe(2);
  });

  it('handles exception gracefully', async () => {
    _currentMember = { _id: MEMBER_ID };
    // Force query to throw by using a getter that throws
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('DB down'); });
    const r = await getAccountSummary();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load account summary');
  });
});

// ── getOrderHistory ─────────────────────────────────────────────────

describe('getOrderHistory', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getOrderHistory();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns empty orders for fresh member', async () => {
    const r = await getOrderHistory();
    expect(r.success).toBe(true);
    expect(r.data.orders).toEqual([]);
    expect(r.data.totalCount).toBe(0);
  });

  it('defaults page to 1 when not provided', async () => {
    const r = await getOrderHistory();
    expect(r.data.page).toBe(1);
  });

  it('defaults pageSize to 10', async () => {
    const r = await getOrderHistory();
    expect(r.data.pageSize).toBe(10);
  });

  it('clamps page to minimum 1', async () => {
    const r = await getOrderHistory({ page: -5 });
    expect(r.data.page).toBe(1);
  });

  it('clamps page=0 to 1', async () => {
    const r = await getOrderHistory({ page: 0 });
    expect(r.data.page).toBe(1);
  });

  it('clamps pageSize to max 50', async () => {
    const r = await getOrderHistory({ pageSize: 100 });
    expect(r.data.pageSize).toBe(50);
  });

  it('clamps pageSize to min 1', async () => {
    const r = await getOrderHistory({ pageSize: -10 });
    expect(r.data.pageSize).toBe(1);
  });

  it('rounds fractional page', async () => {
    const r = await getOrderHistory({ page: 2.7 });
    expect(r.data.page).toBe(3);
  });

  it('rounds fractional pageSize', async () => {
    const r = await getOrderHistory({ pageSize: 7.3 });
    expect(r.data.pageSize).toBe(7);
  });

  it('handles NaN page (defaults to 1)', async () => {
    const r = await getOrderHistory({ page: 'abc' });
    expect(r.data.page).toBe(1);
  });

  it('handles NaN pageSize (defaults to 10)', async () => {
    const r = await getOrderHistory({ pageSize: 'abc' });
    expect(r.data.pageSize).toBe(10);
  });

  it('uses valid sortField', async () => {
    const r = await getOrderHistory({ sortField: 'number' });
    expect(r.success).toBe(true);
  });

  it('defaults invalid sortField to _createdDate', async () => {
    const r = await getOrderHistory({ sortField: 'hackerField' });
    expect(r.success).toBe(true);
  });

  it('uses valid sortDir asc', async () => {
    const r = await getOrderHistory({ sortDir: 'asc' });
    expect(r.success).toBe(true);
  });

  it('defaults invalid sortDir to desc', async () => {
    const r = await getOrderHistory({ sortDir: 'INVALID' });
    expect(r.success).toBe(true);
  });

  it('maps order fields correctly', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-1',
      buyerInfo: { id: MEMBER_ID },
      number: 1001,
      _createdDate: new Date('2026-01-01'),
      fulfillmentStatus: 'Fulfilled',
      totals: { total: 599.99, subtotal: 549.99 },
      lineItems: [
        { name: 'Futon A', quantity: 1, price: 549.99, mediaItem: { src: 'https://img.com/a.jpg' } },
      ],
      shippingInfo: { trackingNumber: 'TRK123' },
    }]);
    const r = await getOrderHistory();
    const o = r.data.orders[0];
    expect(o._id).toBe('ord-1');
    expect(o.number).toBe(1001);
    expect(o.status).toBe('Fulfilled');
    expect(o.total).toBe(599.99);
    expect(o.subtotal).toBe(549.99);
    expect(o.itemCount).toBe(1);
    expect(o.trackingNumber).toBe('TRK123');
    expect(o.lineItems[0].name).toBe('Futon A');
    expect(o.lineItems[0].imageUrl).toBe('https://img.com/a.jpg');
  });

  it('defaults fulfillmentStatus to Processing', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-2',
      buyerInfo: { id: MEMBER_ID },
    }]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].status).toBe('Processing');
  });

  it('defaults totals to 0 when missing', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-3',
      buyerInfo: { id: MEMBER_ID },
    }]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].total).toBe(0);
    expect(r.data.orders[0].subtotal).toBe(0);
  });

  it('defaults lineItems to empty array when missing', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-4',
      buyerInfo: { id: MEMBER_ID },
    }]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].itemCount).toBe(0);
    expect(r.data.orders[0].lineItems).toEqual([]);
  });

  it('defaults trackingNumber to null when shippingInfo missing', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-5',
      buyerInfo: { id: MEMBER_ID },
    }]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].trackingNumber).toBeNull();
  });

  it('defaults lineItem imageUrl to null when mediaItem missing', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-6',
      buyerInfo: { id: MEMBER_ID },
      lineItems: [{ name: 'X', quantity: 1, price: 10 }],
    }]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].lineItems[0].imageUrl).toBeNull();
  });

  it('calculates totalPages correctly', async () => {
    __seed('Stores/Orders', Array.from({ length: 25 }, (_, i) => ({
      _id: `ord-${i}`,
      buyerInfo: { id: MEMBER_ID },
    })));
    const r = await getOrderHistory({ pageSize: 10 });
    expect(r.data.totalPages).toBe(3); // ceil(25/10)
  });

  it('calculates hasNext correctly', async () => {
    __seed('Stores/Orders', Array.from({ length: 15 }, (_, i) => ({
      _id: `ord-${i}`,
      buyerInfo: { id: MEMBER_ID },
    })));
    const r1 = await getOrderHistory({ page: 1, pageSize: 10 });
    expect(r1.data.hasNext).toBe(true);
    const r2 = await getOrderHistory({ page: 2, pageSize: 10 });
    expect(r2.data.hasNext).toBe(false);
  });

  it('totalPages is 0 when no orders', async () => {
    const r = await getOrderHistory();
    expect(r.data.totalPages).toBe(0);
  });

  it('handles Infinity pageSize (clamped to 50)', async () => {
    const r = await getOrderHistory({ pageSize: Infinity });
    expect(r.data.pageSize).toBe(50);
  });

  it('handles Infinity page (rounds to Infinity, max gives Infinity)', async () => {
    // Math.max(1, Math.round(Infinity)) = Infinity
    const r = await getOrderHistory({ page: Infinity });
    expect(r.success).toBe(true);
  });

  it('handles opts as undefined', async () => {
    const r = await getOrderHistory(undefined);
    expect(r.success).toBe(true);
    expect(r.data.page).toBe(1);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getOrderHistory();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load order history');
  });

  it('sortField totals.total is accepted', async () => {
    const r = await getOrderHistory({ sortField: 'totals.total' });
    expect(r.success).toBe(true);
  });
});

// ── getActiveDeliveries ─────────────────────────────────────────────

describe('getActiveDeliveries', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getActiveDeliveries();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns empty deliveries for fresh member', async () => {
    const r = await getActiveDeliveries();
    expect(r.success).toBe(true);
    expect(r.data.deliveries).toEqual([]);
    expect(r.data.count).toBe(0);
  });

  it('excludes delivered items', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1', _createdDate: new Date() },
      { _id: 'd2', memberId: MEMBER_ID, status: 'delivered', orderId: 'o2', _createdDate: new Date() },
    ]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries.length).toBe(1);
    expect(r.data.deliveries[0]._id).toBe('d1');
  });

  it('maps delivery fields correctly', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1',
      memberId: MEMBER_ID,
      status: 'in_transit',
      orderId: 'o1',
      deliveryTier: 'express',
      trackingNumber: 'TRK456',
      estimatedDelivery: '2026-03-20',
      milestones: JSON.stringify([{ step: 'picked_up' }]),
      _createdDate: new Date(),
    }]);
    const r = await getActiveDeliveries();
    const d = r.data.deliveries[0];
    expect(d.orderId).toBe('o1');
    expect(d.status).toBe('in_transit');
    expect(d.deliveryTier).toBe('express');
    expect(d.trackingNumber).toBe('TRK456');
    expect(d.estimatedDelivery).toBe('2026-03-20');
    expect(d.milestones).toEqual([{ step: 'picked_up' }]);
  });

  it('defaults deliveryTier to standard', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1', _createdDate: new Date(),
    }]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries[0].deliveryTier).toBe('standard');
  });

  it('defaults trackingNumber to null', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1', _createdDate: new Date(),
    }]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries[0].trackingNumber).toBeNull();
  });

  it('defaults estimatedDelivery to null', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1', _createdDate: new Date(),
    }]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries[0].estimatedDelivery).toBeNull();
  });

  it('defaults milestones to [] via safeParse', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1', _createdDate: new Date(),
    }]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries[0].milestones).toEqual([]);
  });

  it('handles invalid milestones JSON gracefully', async () => {
    __seed('DeliveryTracking', [{
      _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1',
      milestones: '{broken json',
      _createdDate: new Date(),
    }]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries[0].milestones).toEqual([]);
  });

  it('returns count matching deliveries length', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: MEMBER_ID, status: 'shipped', orderId: 'o1', _createdDate: new Date() },
      { _id: 'd2', memberId: MEMBER_ID, status: 'in_transit', orderId: 'o2', _createdDate: new Date() },
    ]);
    const r = await getActiveDeliveries();
    expect(r.data.count).toBe(2);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getActiveDeliveries();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load active deliveries');
  });
});

// ── getWishlist ─────────────────────────────────────────────────────

describe('getWishlist', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getWishlist();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns empty items for fresh member', async () => {
    const r = await getWishlist();
    expect(r.success).toBe(true);
    expect(r.data.items).toEqual([]);
  });

  it('defaults page to 1', async () => {
    const r = await getWishlist();
    expect(r.data.page).toBe(1);
  });

  it('defaults pageSize to 20', async () => {
    const r = await getWishlist();
    expect(r.data.pageSize).toBe(20);
  });

  it('clamps pageSize to max 50', async () => {
    const r = await getWishlist({ pageSize: 100 });
    expect(r.data.pageSize).toBe(50);
  });

  it('pageSize 0 falls through to default 20 (0 || WISHLIST_PAGE_SIZE)', async () => {
    const r = await getWishlist({ pageSize: 0 });
    expect(r.data.pageSize).toBe(20);
  });

  it('clamps pageSize -10 to min 1', async () => {
    const r = await getWishlist({ pageSize: -10 });
    expect(r.data.pageSize).toBe(1);
  });

  it('clamps page to min 1', async () => {
    const r = await getWishlist({ page: -3 });
    expect(r.data.page).toBe(1);
  });

  it('accepts sort price-asc', async () => {
    const r = await getWishlist({ sort: 'price-asc' });
    expect(r.success).toBe(true);
  });

  it('accepts sort price-desc', async () => {
    const r = await getWishlist({ sort: 'price-desc' });
    expect(r.success).toBe(true);
  });

  it('accepts sort name', async () => {
    const r = await getWishlist({ sort: 'name' });
    expect(r.success).toBe(true);
  });

  it('defaults invalid sort to date-desc', async () => {
    const r = await getWishlist({ sort: 'hacked' });
    expect(r.success).toBe(true);
  });

  it('maps wishlist fields correctly', async () => {
    const addedAt = new Date('2026-02-15');
    __seed('Wishlist', [{
      _id: 'w1', memberId: MEMBER_ID, productId: 'p1', productName: 'Futon X',
      productPrice: 299, imageUrl: 'https://img.com/x.jpg', addedAt,
    }]);
    const r = await getWishlist();
    const item = r.data.items[0];
    expect(item._id).toBe('w1');
    expect(item.productId).toBe('p1');
    expect(item.productName).toBe('Futon X');
    expect(item.productPrice).toBe(299);
    expect(item.imageUrl).toBe('https://img.com/x.jpg');
    expect(item.addedAt).toEqual(addedAt);
  });

  it('defaults imageUrl to null when missing', async () => {
    __seed('Wishlist', [{ _id: 'w1', memberId: MEMBER_ID, productId: 'p1' }]);
    const r = await getWishlist();
    expect(r.data.items[0].imageUrl).toBeNull();
  });

  it('calculates totalPages correctly', async () => {
    __seed('Wishlist', Array.from({ length: 45 }, (_, i) => ({
      _id: `w-${i}`, memberId: MEMBER_ID, productId: `p${i}`,
    })));
    const r = await getWishlist({ pageSize: 20 });
    expect(r.data.totalPages).toBe(3);
  });

  it('totalPages is 0 when no items', async () => {
    const r = await getWishlist();
    expect(r.data.totalPages).toBe(0);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getWishlist();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load wishlist');
  });
});

// ── removeFromWishlist ──────────────────────────────────────────────

describe('removeFromWishlist', () => {
  it('returns error for null id', async () => {
    const r = await removeFromWishlist(null);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('returns error for undefined id', async () => {
    const r = await removeFromWishlist(undefined);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('returns error for numeric id', async () => {
    const r = await removeFromWishlist(12345);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('returns error for empty string id', async () => {
    const r = await removeFromWishlist('');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await removeFromWishlist('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns error when item not found', async () => {
    const r = await removeFromWishlist('a1b2c3d4-0000-0000-0000-000000000099');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Item not found');
  });

  it('returns error when item belongs to different member', async () => {
    __seed('Wishlist', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      memberId: 'different-member-id',
    }]);
    const r = await removeFromWishlist('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Item not found');
  });

  it('removes item successfully when owned by member', async () => {
    __seed('Wishlist', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      memberId: MEMBER_ID,
    }]);
    const r = await removeFromWishlist('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(true);
  });

  it('returns error for id with special characters', async () => {
    const r = await removeFromWishlist('<script>alert(1)</script>');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockRejectedValueOnce(new Error('DB fail'));
    const r = await removeFromWishlist('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to remove wishlist item');
  });
});

// ── addToWishlist ───────────────────────────────────────────────────

describe('addToWishlist', () => {
  it('returns error for null product', async () => {
    const r = await addToWishlist(null);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Missing productId');
  });

  it('returns error for undefined product', async () => {
    const r = await addToWishlist(undefined);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Missing productId');
  });

  it('returns error for product without productId', async () => {
    const r = await addToWishlist({});
    expect(r.success).toBe(false);
    expect(r.error).toBe('Missing productId');
  });

  it('returns error for product with empty string productId', async () => {
    const r = await addToWishlist({ productId: '' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Missing productId');
  });

  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await addToWishlist({ productId: 'p1' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('inserts new wishlist item successfully', async () => {
    const r = await addToWishlist({
      productId: 'prod-abc',
      productName: 'Futon Deluxe',
      productPrice: 499,
      imageUrl: 'https://img.com/futon.jpg',
    });
    expect(r.success).toBe(true);
    expect(r.data.productId).toBe('prod-abc');
    expect(r.data.productName).toBe('Futon Deluxe');
    expect(r.data.memberId).toBe(MEMBER_ID);
  });

  it('deduplicates — returns existing item', async () => {
    __seed('Wishlist', [{
      _id: 'existing-1',
      memberId: MEMBER_ID,
      productId: 'prod-abc',
      productName: 'Old Name',
    }]);
    const r = await addToWishlist({ productId: 'prod-abc', productName: 'New Name' });
    expect(r.success).toBe(true);
    expect(r.data._id).toBe('existing-1');
    expect(r.data.productName).toBe('Old Name');
  });

  it('returns error for negative price', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: -10 });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid price');
  });

  it('returns error for Infinity price', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: Infinity });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid price');
  });

  it('returns error for -Infinity price', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: -Infinity });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid price');
  });

  it('accepts NaN price (Number(undefined) is NaN, < 0 is false, null check skipped)', async () => {
    // price = NaN; price < 0 → false; productPrice != null check: undefined != null → false
    // So NaN from undefined productPrice passes the guard
    const r = await addToWishlist({ productId: 'p1' });
    expect(r.success).toBe(true);
  });

  it('accepts zero price', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: 0 });
    expect(r.success).toBe(true);
    expect(r.data.productPrice).toBe(0);
  });

  it('stores null for non-http imageUrl', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1', imageUrl: 'javascript:alert(1)' });
    expect(inserted.imageUrl).toBeNull();
  });

  it('stores null when imageUrl is empty string', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1', imageUrl: '' });
    expect(inserted.imageUrl).toBeNull();
  });

  it('accepts valid https imageUrl', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1', imageUrl: 'https://cdn.com/img.png' });
    expect(inserted.imageUrl).toBe('https://cdn.com/img.png');
  });

  it('accepts valid http imageUrl', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1', imageUrl: 'http://cdn.com/img.png' });
    expect(inserted.imageUrl).toBe('http://cdn.com/img.png');
  });

  it('truncates productId to 50 chars via sanitize', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    const longId = 'a'.repeat(100);
    await addToWishlist({ productId: longId });
    expect(inserted.productId.length).toBe(50);
  });

  it('truncates productName to 200 chars via sanitize', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1', productName: 'x'.repeat(300) });
    expect(inserted.productName.length).toBe(200);
  });

  it('truncates imageUrl to 500 chars via sanitize', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    const longUrl = 'https://' + 'x'.repeat(600);
    await addToWishlist({ productId: 'p1', imageUrl: longUrl });
    // Truncated to 500 chars, starts with https:// so passes regex
    expect(inserted.imageUrl.length).toBe(500);
  });

  it('sets addedAt to a Date', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1' });
    expect(inserted.addedAt).toBeInstanceOf(Date);
  });

  it('stores null price when isFinite fails (NaN from missing)', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    await addToWishlist({ productId: 'p1', productPrice: 'not-a-number' });
    // Number('not-a-number') = NaN; NaN < 0 → false; 'not-a-number' != null → true; isFinite(NaN) → false → error
    expect(inserted).toBeNull(); // should fail with Invalid price
  });

  it('returns Invalid price for NaN string productPrice', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: 'not-a-number' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid price');
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await addToWishlist({ productId: 'p1' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to add to wishlist');
  });
});

// ── moveWishlistToCart ──────────────────────────────────────────────

describe('moveWishlistToCart', () => {
  it('returns error for null id', async () => {
    const r = await moveWishlistToCart(null);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('returns error for numeric id', async () => {
    const r = await moveWishlistToCart(42);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid item ID');
  });

  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await moveWishlistToCart('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns error when item not found', async () => {
    const r = await moveWishlistToCart('a1b2c3d4-0000-0000-0000-000000000099');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Item not found');
  });

  it('returns error when item belongs to different member', async () => {
    __seed('Wishlist', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      memberId: 'other-member',
    }]);
    const r = await moveWishlistToCart('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Item not found');
  });

  it('removes item and returns product data', async () => {
    __seed('Wishlist', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      memberId: MEMBER_ID,
      productId: 'prod-1',
      productName: 'Futon Y',
      productPrice: 350,
      imageUrl: 'https://img.com/y.jpg',
    }]);
    const r = await moveWishlistToCart('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(true);
    expect(r.data.productId).toBe('prod-1');
    expect(r.data.productName).toBe('Futon Y');
    expect(r.data.productPrice).toBe(350);
    expect(r.data.imageUrl).toBe('https://img.com/y.jpg');
  });

  it('defaults imageUrl to null when missing', async () => {
    __seed('Wishlist', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      memberId: MEMBER_ID,
      productId: 'prod-1',
    }]);
    const r = await moveWishlistToCart('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.data.imageUrl).toBeNull();
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.get.mockRejectedValueOnce(new Error('fail'));
    const r = await moveWishlistToCart('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to move item to cart');
  });
});

// ── getWishlistAlertHistory ─────────────────────────────────────────

describe('getWishlistAlertHistory', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getWishlistAlertHistory();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns empty alerts for fresh member', async () => {
    const r = await getWishlistAlertHistory();
    expect(r.success).toBe(true);
    expect(r.data.alerts).toEqual([]);
  });

  it('maps alert fields correctly', async () => {
    const sentAt = new Date('2026-03-01');
    __seed('WishlistAlertsSent', [{
      _id: 'alert-1',
      memberId: MEMBER_ID,
      productId: 'p1',
      productName: 'Futon Z',
      alertType: 'price-drop',
      sentAt,
      price: 399,
      previousHigh: 499,
      dropPercent: 20,
      quantityInStock: 5,
    }]);
    const r = await getWishlistAlertHistory();
    const a = r.data.alerts[0];
    expect(a._id).toBe('alert-1');
    expect(a.productId).toBe('p1');
    expect(a.productName).toBe('Futon Z');
    expect(a.alertType).toBe('price-drop');
    expect(a.sentAt).toEqual(sentAt);
    expect(a.price).toBe(399);
    expect(a.previousHigh).toBe(499);
    expect(a.dropPercent).toBe(20);
    expect(a.quantityInStock).toBe(5);
  });

  it('defaults productName to empty string when missing', async () => {
    __seed('WishlistAlertsSent', [{
      _id: 'alert-1', memberId: MEMBER_ID, alertType: 'back-in-stock',
    }]);
    const r = await getWishlistAlertHistory();
    expect(r.data.alerts[0].productName).toBe('');
  });

  it('returns alerts only for current member', async () => {
    __seed('WishlistAlertsSent', [
      { _id: 'a1', memberId: MEMBER_ID, alertType: 'price-drop' },
      { _id: 'a2', memberId: 'other', alertType: 'price-drop' },
    ]);
    const r = await getWishlistAlertHistory();
    expect(r.data.alerts.length).toBe(1);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getWishlistAlertHistory();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load alert history');
  });
});

// ── updatePreferences ───────────────────────────────────────────────

describe('updatePreferences', () => {
  it('returns error for null prefs', async () => {
    const r = await updatePreferences(null);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid preferences data');
  });

  it('returns error for undefined prefs', async () => {
    const r = await updatePreferences(undefined);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid preferences data');
  });

  it('returns error for string prefs', async () => {
    const r = await updatePreferences('newsletter');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid preferences data');
  });

  it('returns error for array prefs (typeof array is object)', async () => {
    // Arrays pass typeof === 'object', but empty keys → 'No valid preferences'
    const r = await updatePreferences([]);
    expect(r.success).toBe(false);
    expect(r.error).toBe('No valid preferences provided');
  });

  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await updatePreferences({ newsletter: true });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns error when no valid keys provided', async () => {
    const r = await updatePreferences({ hackerKey: true });
    expect(r.success).toBe(false);
    expect(r.error).toBe('No valid preferences provided');
  });

  it('returns error for empty object', async () => {
    const r = await updatePreferences({});
    expect(r.success).toBe(false);
    expect(r.error).toBe('No valid preferences provided');
  });

  it('inserts new preferences when none exist', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'MemberPreferences') inserted = item; });
    const r = await updatePreferences({ newsletter: false });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ newsletter: false });
    expect(inserted.memberId).toBe(MEMBER_ID);
    expect(inserted.newsletter).toBe(false);
    expect(inserted.saleAlerts).toBe(true); // default
    expect(inserted.backInStock).toBe(true); // default
  });

  it('updates existing preferences', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID, newsletter: true, saleAlerts: true, backInStock: true,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'MemberPreferences') updated = data; });
    const r = await updatePreferences({ saleAlerts: false });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ saleAlerts: false });
    expect(updated.saleAlerts).toBe(false);
    expect(updated.newsletter).toBe(true); // unchanged
  });

  it('coerces truthy values to boolean', async () => {
    const r = await updatePreferences({ newsletter: 1, saleAlerts: 'yes', backInStock: 0 });
    expect(r.success).toBe(true);
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(false);
  });

  it('ignores unknown keys mixed with valid keys', async () => {
    const r = await updatePreferences({ newsletter: true, hackerKey: true });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ newsletter: true });
    expect(r.data.hackerKey).toBeUndefined();
  });

  it('sets updatedAt on insert', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'MemberPreferences') inserted = item; });
    await updatePreferences({ newsletter: true });
    expect(inserted.updatedAt).toBeInstanceOf(Date);
    expect(inserted.createdAt).toBeInstanceOf(Date);
  });

  it('sets updatedAt on update', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID, newsletter: true,
    }]);
    let updated = null;
    __onUpdate((col, data) => { if (col === 'MemberPreferences') updated = data; });
    await updatePreferences({ newsletter: false });
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await updatePreferences({ newsletter: true });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to update preferences');
  });
});

// ── getPreferences ──────────────────────────────────────────────────

describe('getPreferences', () => {
  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getPreferences();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns defaults when no preferences exist', async () => {
    const r = await getPreferences();
    expect(r.success).toBe(true);
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(true);
  });

  it('returns stored preferences', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID, newsletter: false, saleAlerts: true, backInStock: false,
    }]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(false);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(false);
  });

  it('treats explicit false as false (not defaulted to true)', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID, newsletter: false, saleAlerts: false, backInStock: false,
    }]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(false);
    expect(r.data.saleAlerts).toBe(false);
    expect(r.data.backInStock).toBe(false);
  });

  it('treats undefined/missing fields as true (prefs.x !== false)', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID,
      // newsletter, saleAlerts, backInStock all missing
    }]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(true);
  });

  it('treats null fields as true (null !== false → true)', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID, newsletter: null, saleAlerts: null, backInStock: null,
    }]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(true);
  });

  it('treats 0 as true (0 !== false → true)', async () => {
    __seed('MemberPreferences', [{
      _id: 'pref-1', memberId: MEMBER_ID, newsletter: 0, saleAlerts: 0, backInStock: 0,
    }]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(true);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getPreferences();
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load preferences');
  });
});

// ── getReorderItems ─────────────────────────────────────────────────

describe('getReorderItems', () => {
  it('returns error for null orderId', async () => {
    const r = await getReorderItems(null);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid order ID');
  });

  it('returns error for undefined orderId', async () => {
    const r = await getReorderItems(undefined);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid order ID');
  });

  it('returns error for numeric orderId', async () => {
    const r = await getReorderItems(42);
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid order ID');
  });

  it('returns error for empty string orderId', async () => {
    const r = await getReorderItems('');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid order ID');
  });

  it('returns error for orderId with special chars', async () => {
    const r = await getReorderItems('order; DROP TABLE');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Invalid order ID');
  });

  it('returns error when not authenticated', async () => {
    _currentMember = null;
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not authenticated');
  });

  it('returns error when order not found', async () => {
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000099');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Order not found');
  });

  it('returns error when order belongs to different member', async () => {
    __seed('Stores/Orders', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      buyerInfo: { id: 'other-member' },
    }]);
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Order not found');
  });

  it('returns line items from order', async () => {
    __seed('Stores/Orders', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      buyerInfo: { id: MEMBER_ID },
      number: 2001,
      lineItems: [
        { productId: 'p1', name: 'Futon A', quantity: 2, price: 299, options: [{ name: 'Color', value: 'Blue' }], mediaItem: { src: 'https://img.com/a.jpg' } },
        { productId: 'p2', name: 'Mattress B', quantity: 1, price: 199, mediaItem: { src: 'https://img.com/b.jpg' } },
      ],
    }]);
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(true);
    expect(r.data.orderId).toBe('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.data.orderNumber).toBe(2001);
    expect(r.data.items.length).toBe(2);
    expect(r.data.items[0].productId).toBe('p1');
    expect(r.data.items[0].quantity).toBe(2);
    expect(r.data.items[0].options).toEqual([{ name: 'Color', value: 'Blue' }]);
    expect(r.data.items[0].imageUrl).toBe('https://img.com/a.jpg');
  });

  it('defaults options to empty array when missing', async () => {
    __seed('Stores/Orders', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      buyerInfo: { id: MEMBER_ID },
      number: 2002,
      lineItems: [{ productId: 'p1', name: 'X', quantity: 1, price: 10 }],
    }]);
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.data.items[0].options).toEqual([]);
  });

  it('defaults imageUrl to null when mediaItem missing', async () => {
    __seed('Stores/Orders', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      buyerInfo: { id: MEMBER_ID },
      number: 2003,
      lineItems: [{ productId: 'p1', name: 'X', quantity: 1, price: 10 }],
    }]);
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.data.items[0].imageUrl).toBeNull();
  });

  it('handles order with no lineItems (defaults to empty array)', async () => {
    __seed('Stores/Orders', [{
      _id: 'a1b2c3d4-0000-0000-0000-000000000001',
      buyerInfo: { id: MEMBER_ID },
      number: 2004,
    }]);
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.data.items).toEqual([]);
  });

  it('catches and returns error on exception', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockImplementationOnce(() => { throw new Error('fail'); });
    const r = await getReorderItems('a1b2c3d4-0000-0000-0000-000000000001');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to load order items');
  });
});
