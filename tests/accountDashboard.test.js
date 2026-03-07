import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate, __onRemove } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
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

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com', contactDetails: { firstName: 'Alice' } });
});

// ── getAccountSummary ────────────────────────────────────────────────

describe('getAccountSummary', () => {
  it('returns aggregated account data', async () => {
    __seed('Stores/Orders', [
      { _id: 'o-1', buyerInfo: { id: 'member-1' } },
      { _id: 'o-2', buyerInfo: { id: 'member-1' } },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1' },
      { _id: 'w-2', memberId: 'member-1' },
      { _id: 'w-3', memberId: 'member-1' },
    ]);
    __seed('DeliveryTracking', [
      { _id: 'd-1', memberId: 'member-1', status: 'shipped' },
      { _id: 'd-2', memberId: 'member-1', status: 'delivered' },
    ]);

    const result = await getAccountSummary();
    expect(result.success).toBe(true);
    expect(result.data.orderCount).toBe(2);
    expect(result.data.wishlistCount).toBe(3);
    expect(result.data.activeDeliveries).toBe(1);
    expect(result.data.memberName).toBe('Alice');
    expect(result.data.memberEmail).toBe('test@example.com');
  });

  it('returns zero counts for new member', async () => {
    __seed('Stores/Orders', []);
    __seed('Wishlist', []);
    __seed('DeliveryTracking', []);

    const result = await getAccountSummary();
    expect(result.success).toBe(true);
    expect(result.data.orderCount).toBe(0);
    expect(result.data.wishlistCount).toBe(0);
    expect(result.data.activeDeliveries).toBe(0);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getAccountSummary();
    expect(result.success).toBe(false);
  });

  it('uses fallback name when firstName missing', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com', contactDetails: {} });
    __seed('Stores/Orders', []);
    __seed('Wishlist', []);
    __seed('DeliveryTracking', []);

    const result = await getAccountSummary();
    expect(result.data.memberName).toBe('Member');
  });
});

// ── getOrderHistory ──────────────────────────────────────────────────

describe('getOrderHistory', () => {
  it('returns paginated orders', async () => {
    __seed('Stores/Orders', [
      { _id: 'o-1', buyerInfo: { id: 'member-1' }, number: 1001, _createdDate: new Date('2026-02-01'), fulfillmentStatus: 'Shipped', totals: { total: 599, subtotal: 549 }, lineItems: [{ name: 'Futon Frame', quantity: 1, price: 549 }] },
      { _id: 'o-2', buyerInfo: { id: 'member-1' }, number: 1002, _createdDate: new Date('2026-02-10'), fulfillmentStatus: 'Delivered', totals: { total: 299, subtotal: 249 }, lineItems: [] },
    ]);

    const result = await getOrderHistory({ page: 1, pageSize: 10 });
    expect(result.success).toBe(true);
    expect(result.data.orders).toHaveLength(2);
    expect(result.data.orders[0].number).toBeDefined();
    expect(result.data.orders[0].total).toBeGreaterThan(0);
    expect(result.data.page).toBe(1);
    expect(result.data.totalCount).toBe(2);
  });

  it('defaults to page 1 with 10 per page', async () => {
    __seed('Stores/Orders', []);

    const result = await getOrderHistory();
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(10);
  });

  it('clamps page size to max 50', async () => {
    __seed('Stores/Orders', []);

    const result = await getOrderHistory({ pageSize: 100 });
    expect(result.data.pageSize).toBe(50);
  });

  it('clamps page to minimum 1', async () => {
    __seed('Stores/Orders', []);

    const result = await getOrderHistory({ page: -5 });
    expect(result.data.page).toBe(1);
  });

  it('maps order fields correctly', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'o-1', buyerInfo: { id: 'member-1' }, number: 1001,
        _createdDate: new Date('2026-02-15'),
        fulfillmentStatus: 'Shipped',
        totals: { total: 999.99, subtotal: 899.99 },
        shippingInfo: { trackingNumber: '1Z999' },
        lineItems: [
          { name: 'Futon Frame', quantity: 1, price: 549, mediaItem: { src: 'https://img.com/frame.jpg' } },
          { name: 'Mattress', quantity: 1, price: 350 },
        ],
      },
    ]);

    const result = await getOrderHistory();
    const order = result.data.orders[0];
    expect(order.number).toBe(1001);
    expect(order.status).toBe('Shipped');
    expect(order.total).toBe(999.99);
    expect(order.subtotal).toBe(899.99);
    expect(order.trackingNumber).toBe('1Z999');
    expect(order.itemCount).toBe(2);
    expect(order.lineItems[0].name).toBe('Futon Frame');
    expect(order.lineItems[0].imageUrl).toBe('https://img.com/frame.jpg');
    expect(order.lineItems[1].imageUrl).toBeNull();
  });

  it('defaults status to Processing when missing', async () => {
    __seed('Stores/Orders', [
      { _id: 'o-1', buyerInfo: { id: 'member-1' }, number: 1001, _createdDate: new Date() },
    ]);

    const result = await getOrderHistory();
    expect(result.data.orders[0].status).toBe('Processing');
  });

  it('calculates totalPages and hasNext', async () => {
    const orders = Array.from({ length: 5 }, (_, i) => ({
      _id: `o-${i}`, buyerInfo: { id: 'member-1' }, number: 1000 + i, _createdDate: new Date(),
    }));
    __seed('Stores/Orders', orders);

    const result = await getOrderHistory({ page: 1, pageSize: 3 });
    expect(result.data.orders).toHaveLength(3);
    expect(result.data.totalCount).toBe(5);
    expect(result.data.totalPages).toBe(2);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getOrderHistory();
    expect(result.success).toBe(false);
  });

  it('rejects invalid sort field', async () => {
    __seed('Stores/Orders', []);
    const result = await getOrderHistory({ sortField: 'hackme' });
    expect(result.success).toBe(true); // Falls back to _createdDate
  });
});

// ── getActiveDeliveries ──────────────────────────────────────────────

describe('getActiveDeliveries', () => {
  it('returns in-flight deliveries only', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd-1', memberId: 'member-1', orderId: 'o-1', status: 'shipped', deliveryTier: 'standard', milestones: '[]', _createdDate: new Date() },
      { _id: 'd-2', memberId: 'member-1', orderId: 'o-2', status: 'out_for_delivery', deliveryTier: 'white_glove_local', milestones: '[]', _createdDate: new Date() },
      { _id: 'd-3', memberId: 'member-1', orderId: 'o-3', status: 'delivered', milestones: '[]', _createdDate: new Date() },
    ]);

    const result = await getActiveDeliveries();
    expect(result.success).toBe(true);
    expect(result.data.deliveries).toHaveLength(2);
    expect(result.data.count).toBe(2);
    expect(result.data.deliveries.every(d => d.status !== 'delivered')).toBe(true);
  });

  it('returns empty when no active deliveries', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd-1', memberId: 'member-1', orderId: 'o-1', status: 'delivered', milestones: '[]', _createdDate: new Date() },
    ]);

    const result = await getActiveDeliveries();
    expect(result.success).toBe(true);
    expect(result.data.deliveries).toHaveLength(0);
  });

  it('parses milestones JSON', async () => {
    __seed('DeliveryTracking', [
      {
        _id: 'd-1', memberId: 'member-1', orderId: 'o-1', status: 'shipped',
        milestones: JSON.stringify([{ status: 'shipped', timestamp: '2026-02-20T14:00:00Z' }]),
        _createdDate: new Date(),
      },
    ]);

    const result = await getActiveDeliveries();
    expect(result.data.deliveries[0].milestones).toHaveLength(1);
    expect(result.data.deliveries[0].milestones[0].status).toBe('shipped');
  });

  it('handles invalid milestones JSON gracefully', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd-1', memberId: 'member-1', orderId: 'o-1', status: 'shipped', milestones: 'not-json', _createdDate: new Date() },
    ]);

    const result = await getActiveDeliveries();
    expect(result.data.deliveries[0].milestones).toEqual([]);
  });

  it('defaults deliveryTier to standard', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd-1', memberId: 'member-1', orderId: 'o-1', status: 'shipped', milestones: '[]', _createdDate: new Date() },
    ]);

    const result = await getActiveDeliveries();
    expect(result.data.deliveries[0].deliveryTier).toBe('standard');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getActiveDeliveries();
    expect(result.success).toBe(false);
  });
});

// ── getWishlist ──────────────────────────────────────────────────────

describe('getWishlist', () => {
  it('returns paginated wishlist items', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'p-1', productName: 'Futon Frame', productPrice: 549, addedAt: new Date() },
      { _id: 'w-2', memberId: 'member-1', productId: 'p-2', productName: 'Mattress', productPrice: 299, addedAt: new Date() },
    ]);

    const result = await getWishlist();
    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0].productName).toBeDefined();
    expect(result.data.totalCount).toBe(2);
  });

  it('supports sort by price ascending', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productName: 'A', productPrice: 500, addedAt: new Date() },
      { _id: 'w-2', memberId: 'member-1', productName: 'B', productPrice: 200, addedAt: new Date() },
    ]);

    const result = await getWishlist({ sort: 'price-asc' });
    expect(result.success).toBe(true);
  });

  it('supports sort by name', async () => {
    __seed('Wishlist', []);
    const result = await getWishlist({ sort: 'name' });
    expect(result.success).toBe(true);
  });

  it('defaults sort to date-desc for unknown sort', async () => {
    __seed('Wishlist', []);
    const result = await getWishlist({ sort: 'invalid' });
    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getWishlist();
    expect(result.success).toBe(false);
  });
});

// ── removeFromWishlist ───────────────────────────────────────────────

describe('removeFromWishlist', () => {
  it('removes a wishlist item owned by the member', async () => {
    let removed = null;
    __onRemove((col, id) => { removed = { col, id }; });
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'p-1', productName: 'Futon' },
    ]);

    const result = await removeFromWishlist('w-1');
    expect(result.success).toBe(true);
    expect(removed).toBeTruthy();
  });

  it('rejects removal of another member item', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'other-member', productId: 'p-1', productName: 'Futon' },
    ]);

    const result = await removeFromWishlist('w-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for invalid item ID', async () => {
    const result = await removeFromWishlist('');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await removeFromWishlist('w-1');
    expect(result.success).toBe(false);
  });
});

// ── addToWishlist ────────────────────────────────────────────────────

describe('addToWishlist', () => {
  it('adds a product to the wishlist', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    const result = await addToWishlist({
      productId: 'p-1',
      productName: 'Futon Frame',
      productPrice: 549,
      imageUrl: 'https://img.com/frame.jpg',
    });

    expect(result.success).toBe(true);
    expect(result.data.productId).toBe('p-1');
    expect(inserted).not.toBeNull();
    expect(inserted.memberId).toBe('member-1');
    expect(inserted.productName).toBe('Futon Frame');
    expect(inserted.productPrice).toBe(549);
    expect(inserted.imageUrl).toBe('https://img.com/frame.jpg');
    expect(inserted.addedAt).toBeInstanceOf(Date);
  });

  it('deduplicates — returns existing if already wishlisted', async () => {
    let insertCount = 0;
    __onInsert(() => { insertCount++; });
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'p-1', productName: 'Futon Frame' },
    ]);

    const result = await addToWishlist({ productId: 'p-1', productName: 'Futon Frame' });
    expect(result.success).toBe(true);
    expect(result.data._id).toBe('w-1');
    expect(insertCount).toBe(0);
  });

  it('rejects missing productId', async () => {
    const result = await addToWishlist({ productName: 'Futon' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('productId');
  });

  it('rejects empty input', async () => {
    const result = await addToWishlist(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes productName input', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    await addToWishlist({
      productId: 'p-1',
      productName: '<script>alert("xss")</script>Futon',
      productPrice: 100,
    });

    expect(inserted.productName).not.toContain('<script>');
  });

  it('rejects negative price', async () => {
    __seed('Wishlist', []);
    const result = await addToWishlist({ productId: 'p-1', productName: 'X', productPrice: -50 });
    expect(result.success).toBe(false);
  });

  it('rejects NaN price', async () => {
    __seed('Wishlist', []);
    const result = await addToWishlist({ productId: 'p-1', productName: 'X', productPrice: NaN });
    expect(result.success).toBe(false);
  });

  it('rejects Infinity price', async () => {
    __seed('Wishlist', []);
    const result = await addToWishlist({ productId: 'p-1', productName: 'X', productPrice: Infinity });
    expect(result.success).toBe(false);
  });

  it('stores null price when price is omitted', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    await addToWishlist({ productId: 'p-1', productName: 'Futon' });
    expect(inserted.productPrice).toBeNull();
  });

  it('rejects javascript: imageUrl (stored XSS prevention)', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    await addToWishlist({
      productId: 'p-1',
      productName: 'Futon',
      imageUrl: 'javascript:alert("xss")',
      productPrice: 100,
    });

    expect(inserted.imageUrl).toBeNull();
  });

  it('accepts valid https imageUrl', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    await addToWishlist({
      productId: 'p-1',
      productName: 'Futon',
      imageUrl: 'https://static.wixstatic.com/media/frame.jpg',
      productPrice: 100,
    });

    expect(inserted.imageUrl).toBe('https://static.wixstatic.com/media/frame.jpg');
  });

  it('rejects data: URI imageUrl', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    await addToWishlist({
      productId: 'p-1',
      productName: 'Futon',
      imageUrl: 'data:text/html,<script>alert(1)</script>',
      productPrice: 100,
    });

    expect(inserted.imageUrl).toBeNull();
  });

  it('stores null imageUrl when not provided', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'Wishlist') inserted = item; });
    __seed('Wishlist', []);

    await addToWishlist({ productId: 'p-1', productName: 'Futon', productPrice: 100 });
    expect(inserted.imageUrl).toBeNull();
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await addToWishlist({ productId: 'p-1', productName: 'Futon' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('authenticated');
  });
});

// ── moveWishlistToCart ───────────────────────────────────────────────

describe('moveWishlistToCart', () => {
  it('removes wishlist item and returns product info for cart', async () => {
    let removed = null;
    __onRemove((col, id) => { if (col === 'Wishlist') removed = id; });
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'p-1', productName: 'Futon Frame', productPrice: 549 },
    ]);

    const result = await moveWishlistToCart('w-1');
    expect(result.success).toBe(true);
    expect(result.data.productId).toBe('p-1');
    expect(result.data.productName).toBe('Futon Frame');
    expect(removed).toBe('w-1');
  });

  it('rejects item owned by another member', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'other-member', productId: 'p-1', productName: 'Futon' },
    ]);

    const result = await moveWishlistToCart('w-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects non-existent item', async () => {
    __seed('Wishlist', []);
    const result = await moveWishlistToCart('w-nonexistent');
    expect(result.success).toBe(false);
  });

  it('rejects empty item ID', async () => {
    const result = await moveWishlistToCart('');
    expect(result.success).toBe(false);
  });

  it('rejects null item ID', async () => {
    const result = await moveWishlistToCart(null);
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await moveWishlistToCart('w-1');
    expect(result.success).toBe(false);
  });
});

// ── getWishlistAlertHistory ─────────────────────────────────────────

describe('getWishlistAlertHistory', () => {
  it('returns recent alert history for the member', async () => {
    __seed('WishlistAlertsSent', [
      { _id: 'a-1', memberId: 'member-1', productId: 'p-1', alertType: 'price_drop', sentAt: new Date('2026-03-05'), price: 449, previousHigh: 549, dropPercent: 18, productName: 'Futon Frame' },
      { _id: 'a-2', memberId: 'member-1', productId: 'p-2', alertType: 'back_in_stock', sentAt: new Date('2026-03-04'), productName: 'Mattress' },
    ]);

    const result = await getWishlistAlertHistory();
    expect(result.success).toBe(true);
    expect(result.data.alerts).toHaveLength(2);
    expect(result.data.alerts[0].alertType).toBe('price_drop');
    expect(result.data.alerts[0].productName).toBe('Futon Frame');
    expect(result.data.alerts[0].dropPercent).toBe(18);
    expect(result.data.alerts[1].alertType).toBe('back_in_stock');
  });

  it('returns empty array when no alerts', async () => {
    __seed('WishlistAlertsSent', []);
    const result = await getWishlistAlertHistory();
    expect(result.success).toBe(true);
    expect(result.data.alerts).toEqual([]);
  });

  it('only returns own alerts', async () => {
    __seed('WishlistAlertsSent', [
      { _id: 'a-1', memberId: 'other-member', productId: 'p-1', alertType: 'price_drop', sentAt: new Date() },
      { _id: 'a-2', memberId: 'member-1', productId: 'p-2', alertType: 'back_in_stock', sentAt: new Date() },
    ]);

    const result = await getWishlistAlertHistory();
    expect(result.data.alerts).toHaveLength(1);
    expect(result.data.alerts[0].productId).toBe('p-2');
  });

  it('limits results to 50', async () => {
    const alerts = Array.from({ length: 60 }, (_, i) => ({
      _id: `a-${i}`, memberId: 'member-1', productId: `p-${i}`,
      alertType: 'price_drop', sentAt: new Date(),
    }));
    __seed('WishlistAlertsSent', alerts);

    const result = await getWishlistAlertHistory();
    expect(result.data.alerts.length).toBeLessThanOrEqual(50);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getWishlistAlertHistory();
    expect(result.success).toBe(false);
  });
});

// ── updatePreferences ────────────────────────────────────────────────

describe('updatePreferences', () => {
  it('inserts new preferences for first-time member', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('MemberPreferences', []);

    const result = await updatePreferences({ newsletter: false, saleAlerts: true });
    expect(result.success).toBe(true);
    expect(result.data.newsletter).toBe(false);
    expect(result.data.saleAlerts).toBe(true);
    expect(inserted.memberId).toBe('member-1');
  });

  it('updates existing preferences', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('MemberPreferences', [
      { _id: 'pref-1', memberId: 'member-1', newsletter: true, saleAlerts: true, backInStock: true },
    ]);

    const result = await updatePreferences({ newsletter: false });
    expect(result.success).toBe(true);
    expect(updated.newsletter).toBe(false);
  });

  it('rejects empty preferences object', async () => {
    const result = await updatePreferences({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid');
  });

  it('rejects null input', async () => {
    const result = await updatePreferences(null);
    expect(result.success).toBe(false);
  });

  it('ignores unknown preference keys', async () => {
    __seed('MemberPreferences', []);
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    const result = await updatePreferences({ newsletter: true, hackField: 'evil' });
    expect(result.success).toBe(true);
    expect(inserted.hackField).toBeUndefined();
  });

  it('coerces values to boolean', async () => {
    __seed('MemberPreferences', []);
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await updatePreferences({ newsletter: 1, saleAlerts: 0 });
    expect(inserted.newsletter).toBe(true);
    expect(inserted.saleAlerts).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await updatePreferences({ newsletter: false });
    expect(result.success).toBe(false);
  });
});

// ── getPreferences ───────────────────────────────────────────────────

describe('getPreferences', () => {
  it('returns saved preferences', async () => {
    __seed('MemberPreferences', [
      { _id: 'pref-1', memberId: 'member-1', newsletter: false, saleAlerts: true, backInStock: false },
    ]);

    const result = await getPreferences();
    expect(result.success).toBe(true);
    expect(result.data.newsletter).toBe(false);
    expect(result.data.saleAlerts).toBe(true);
    expect(result.data.backInStock).toBe(false);
  });

  it('returns defaults for new member', async () => {
    __seed('MemberPreferences', []);

    const result = await getPreferences();
    expect(result.success).toBe(true);
    expect(result.data.newsletter).toBe(true);
    expect(result.data.saleAlerts).toBe(true);
    expect(result.data.backInStock).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getPreferences();
    expect(result.success).toBe(false);
  });
});

// ── getReorderItems ──────────────────────────────────────────────────

describe('getReorderItems', () => {
  it('returns line items from a past order', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'o-1', buyerInfo: { id: 'member-1' }, number: 1001,
        lineItems: [
          { productId: 'p-1', name: 'Futon Frame', quantity: 1, price: 549, options: [{ key: 'color', value: 'walnut' }], mediaItem: { src: 'https://img.com/frame.jpg' } },
          { productId: 'p-2', name: 'Mattress', quantity: 1, price: 299 },
        ],
      },
    ]);

    const result = await getReorderItems('o-1');
    expect(result.success).toBe(true);
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0].productId).toBe('p-1');
    expect(result.data.items[0].name).toBe('Futon Frame');
    expect(result.data.items[0].options).toHaveLength(1);
    expect(result.data.items[1].imageUrl).toBeNull();
    expect(result.data.orderNumber).toBe(1001);
  });

  it('fails for non-existent order', async () => {
    __seed('Stores/Orders', []);
    const result = await getReorderItems('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('only returns own orders', async () => {
    __seed('Stores/Orders', [
      { _id: 'o-1', buyerInfo: { id: 'other-member' }, number: 1001, lineItems: [] },
    ]);

    const result = await getReorderItems('o-1');
    expect(result.success).toBe(false);
  });

  it('fails for empty order ID', async () => {
    const result = await getReorderItems('');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getReorderItems('o-1');
    expect(result.success).toBe(false);
  });
});
