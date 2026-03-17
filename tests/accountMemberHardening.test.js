// accountMemberHardening.test.js — CF-lipy: Test hardening for account dashboard + member features
// TDD edge-case tests for accountDashboard, membershipService, loyaltyService, loyaltyBonusPoints.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

// ── accountDashboard imports ──────────────────────────────────────────
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

// ── loyaltyService imports ────────────────────────────────────────────
import {
  getMyLoyaltyAccount,
  getAvailableRewards,
  redeemReward,
  getLoyaltyTiers,
} from '../src/backend/loyaltyService.web.js';

// ── loyaltyBonusPoints imports ────────────────────────────────────────
import {
  getEarningConfig,
  awardBonusPoints,
  BONUS_POINTS,
} from '../src/backend/loyaltyBonusPoints.web.js';

import {
  __setAccount,
  __setRewards,
  __reset as __resetLoyalty,
} from 'wix-loyalty.v2';

// ── membershipService imports ─────────────────────────────────────────
vi.mock('wix-pricing-plans.v2', () => {
  let mockPlans = [];
  let mockOrders = [];
  return {
    plans: {
      listPublicPlans: vi.fn(() => Promise.resolve({ plans: mockPlans })),
    },
    orders: {
      listOrders: vi.fn(() => Promise.resolve({ orders: mockOrders })),
    },
    __setPlans: (p) => { mockPlans = p; },
    __setOrders: (o) => { mockOrders = o; },
    __reset: () => { mockPlans = []; mockOrders = []; },
  };
});

import {
  getMembershipPlans,
  getMembershipStatus,
  isCFPlusMember,
  getMemberBenefits,
  getMemberBadge,
  PLAN_SLUGS,
  CF_PLUS_BENEFITS,
} from '../src/backend/membershipService.web.js';

const MEMBER = { _id: 'mem-1', contactDetails: { firstName: 'Jane' }, loginEmail: 'jane@test.com' };

beforeEach(async () => {
  __reset();
  __resetLoyalty();
  __setMember(MEMBER);
  __setRoles([{ title: 'Admin' }]);
  const { __reset: resetPlans } = await import('wix-pricing-plans.v2');
  resetPlans();
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getAccountSummary edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getAccountSummary — edge cases', () => {
  it('returns zero counts when member has no orders, wishlist, or deliveries', async () => {
    const r = await getAccountSummary();
    expect(r.success).toBe(true);
    expect(r.data.orderCount).toBe(0);
    expect(r.data.wishlistCount).toBe(0);
    expect(r.data.activeDeliveries).toBe(0);
  });

  it('returns memberName from contactDetails.firstName', async () => {
    const r = await getAccountSummary();
    expect(r.data.memberName).toBe('Jane');
  });

  it('defaults memberName to "Member" when firstName missing', async () => {
    __setMember({ _id: 'mem-2', contactDetails: {}, loginEmail: 'x@x.com' });
    const r = await getAccountSummary();
    expect(r.data.memberName).toBe('Member');
  });

  it('defaults memberEmail to empty string when loginEmail missing', async () => {
    __setMember({ _id: 'mem-3', contactDetails: { firstName: 'X' } });
    const r = await getAccountSummary();
    expect(r.data.memberEmail).toBe('');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getAccountSummary();
    expect(r.success).toBe(false);
  });

  it('excludes delivered items from activeDeliveries count', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: 'mem-1', status: 'shipped' },
      { _id: 'd2', memberId: 'mem-1', status: 'delivered' },
    ]);
    const r = await getAccountSummary();
    expect(r.data.activeDeliveries).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getOrderHistory edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getOrderHistory — edge cases', () => {
  it('returns empty orders for member with no purchases', async () => {
    const r = await getOrderHistory();
    expect(r.success).toBe(true);
    expect(r.data.orders).toHaveLength(0);
    expect(r.data.totalCount).toBe(0);
    expect(r.data.totalPages).toBe(0);
  });

  it('defaults to page 1 and pageSize 10', async () => {
    const r = await getOrderHistory();
    expect(r.data.page).toBe(1);
    expect(r.data.pageSize).toBe(10);
  });

  it('clamps negative page to 1', async () => {
    const r = await getOrderHistory({ page: -5 });
    expect(r.data.page).toBe(1);
  });

  it('clamps pageSize to MAX_PAGE_SIZE (50)', async () => {
    const r = await getOrderHistory({ pageSize: 999 });
    expect(r.data.pageSize).toBe(50);
  });

  it('clamps pageSize 0 to default (10) since 0 is falsy', async () => {
    const r = await getOrderHistory({ pageSize: 0 });
    expect(r.data.pageSize).toBe(10);
  });

  it('defaults invalid sortField to _createdDate', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, _createdDate: new Date(), number: 1, totals: { total: 100 }, lineItems: [] },
    ]);
    const r = await getOrderHistory({ sortField: 'hackField' });
    expect(r.success).toBe(true);
    expect(r.data.orders).toHaveLength(1);
  });

  it('defaults invalid sortDir to desc', async () => {
    const r = await getOrderHistory({ sortDir: 'sideways' });
    expect(r.success).toBe(true);
  });

  it('ascending sort works', async () => {
    const r = await getOrderHistory({ sortDir: 'asc' });
    expect(r.success).toBe(true);
  });

  it('sorts by number field', async () => {
    const r = await getOrderHistory({ sortField: 'number' });
    expect(r.success).toBe(true);
  });

  it('sorts by totals.total field', async () => {
    const r = await getOrderHistory({ sortField: 'totals.total' });
    expect(r.success).toBe(true);
  });

  it('defaults fulfillmentStatus to Processing', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, _createdDate: new Date(), number: 1, totals: { total: 50 }, lineItems: [] },
    ]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].status).toBe('Processing');
  });

  it('maps lineItems with mediaItem.src', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, _createdDate: new Date(), number: 1, totals: { total: 50 },
        lineItems: [{ name: 'Frame', quantity: 1, price: 50, mediaItem: { src: 'https://img.jpg' } }] },
    ]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].lineItems[0].imageUrl).toBe('https://img.jpg');
  });

  it('defaults imageUrl to null when mediaItem missing', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, _createdDate: new Date(), number: 1, totals: { total: 50 },
        lineItems: [{ name: 'Frame', quantity: 1, price: 50 }] },
    ]);
    const r = await getOrderHistory();
    expect(r.data.orders[0].lineItems[0].imageUrl).toBeNull();
  });

  it('hasNext is false when all orders fit on one page', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, _createdDate: new Date(), number: 1, totals: { total: 50 }, lineItems: [] },
    ]);
    const r = await getOrderHistory();
    expect(r.data.hasNext).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getOrderHistory();
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getActiveDeliveries edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getActiveDeliveries — edge cases', () => {
  it('returns empty when no active deliveries', async () => {
    const r = await getActiveDeliveries();
    expect(r.success).toBe(true);
    expect(r.data.deliveries).toHaveLength(0);
    expect(r.data.count).toBe(0);
  });

  it('excludes delivered items', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: 'mem-1', status: 'shipped', _createdDate: new Date() },
      { _id: 'd2', memberId: 'mem-1', status: 'delivered', _createdDate: new Date() },
    ]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries).toHaveLength(1);
    expect(r.data.deliveries[0].status).toBe('shipped');
  });

  it('defaults deliveryTier to standard when missing', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: 'mem-1', status: 'pending', _createdDate: new Date() },
    ]);
    const r = await getActiveDeliveries();
    expect(r.data.deliveries[0].deliveryTier).toBe('standard');
  });

  it('handles malformed milestones JSON gracefully', async () => {
    __seed('DeliveryTracking', [
      { _id: 'd1', memberId: 'mem-1', status: 'pending', _createdDate: new Date(), milestones: 'not-json{{' },
    ]);
    const r = await getActiveDeliveries();
    expect(r.success).toBe(true);
    expect(r.data.deliveries[0].milestones).toEqual([]);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getActiveDeliveries();
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getWishlist edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getWishlist — edge cases', () => {
  it('returns empty for member with no wishlist items', async () => {
    const r = await getWishlist();
    expect(r.success).toBe(true);
    expect(r.data.items).toHaveLength(0);
    expect(r.data.totalCount).toBe(0);
  });

  it('returns items when wishlist has entries', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Frame', productPrice: 500, addedAt: new Date() },
      { _id: 'w2', memberId: 'mem-1', productId: 'p2', productName: 'Mattress', productPrice: 300, addedAt: new Date() },
    ]);
    const r = await getWishlist();
    expect(r.data.items).toHaveLength(2);
  });

  it('sort=price-asc works', async () => {
    const r = await getWishlist({ sort: 'price-asc' });
    expect(r.success).toBe(true);
  });

  it('sort=price-desc works', async () => {
    const r = await getWishlist({ sort: 'price-desc' });
    expect(r.success).toBe(true);
  });

  it('sort=name works', async () => {
    const r = await getWishlist({ sort: 'name' });
    expect(r.success).toBe(true);
  });

  it('invalid sort defaults to date-desc', async () => {
    const r = await getWishlist({ sort: 'invalid' });
    expect(r.success).toBe(true);
  });

  it('defaults imageUrl to null when missing', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Frame', productPrice: 500, addedAt: new Date() },
    ]);
    const r = await getWishlist();
    expect(r.data.items[0].imageUrl).toBeNull();
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getWishlist();
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — addToWishlist / removeFromWishlist edge cases
// ════════════════════════════════════════════════════════════════════════

describe('addToWishlist — edge cases', () => {
  it('rejects missing product object', async () => {
    const r = await addToWishlist(null);
    expect(r.success).toBe(false);
  });

  it('rejects product without productId', async () => {
    const r = await addToWishlist({ productName: 'Frame' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/productId/i);
  });

  it('deduplicates — returns existing item on re-add', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Frame', productPrice: 500 },
    ]);
    const r = await addToWishlist({ productId: 'p1', productName: 'Frame', productPrice: 500 });
    expect(r.success).toBe(true);
    expect(r.data._id).toBe('w1');
  });

  it('rejects negative price', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: -10 });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/price/i);
  });

  it('rejects Infinity price', async () => {
    const r = await addToWishlist({ productId: 'p1', productPrice: Infinity });
    expect(r.success).toBe(false);
  });

  it('accepts null price (optional)', async () => {
    const r = await addToWishlist({ productId: 'p1', productName: 'Frame' });
    expect(r.success).toBe(true);
  });

  it('rejects non-http imageUrl', async () => {
    const r = await addToWishlist({ productId: 'p1', productName: 'Frame', imageUrl: 'javascript:alert(1)' });
    expect(r.success).toBe(true);
    expect(r.data.imageUrl).toBeNull();
  });

  it('accepts valid https imageUrl', async () => {
    const r = await addToWishlist({ productId: 'p1', productName: 'Frame', imageUrl: 'https://img.com/pic.jpg' });
    expect(r.success).toBe(true);
    expect(r.data.imageUrl).toBe('https://img.com/pic.jpg');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await addToWishlist({ productId: 'p1' });
    expect(r.success).toBe(false);
  });
});

describe('removeFromWishlist — edge cases', () => {
  it('rejects empty item ID', async () => {
    const r = await removeFromWishlist('');
    expect(r.success).toBe(false);
  });

  it('returns error when item not found', async () => {
    const r = await removeFromWishlist('nonexistent-id');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it('rejects removing item owned by another member', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'other-member', productId: 'p1' },
    ]);
    const r = await removeFromWishlist('w1');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it('successfully removes own item', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1' },
    ]);
    const r = await removeFromWishlist('w1');
    expect(r.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await removeFromWishlist('w1');
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — moveWishlistToCart edge cases
// ════════════════════════════════════════════════════════════════════════

describe('moveWishlistToCart — edge cases', () => {
  it('rejects empty item ID', async () => {
    const r = await moveWishlistToCart('');
    expect(r.success).toBe(false);
  });

  it('returns error when item not found', async () => {
    const r = await moveWishlistToCart('nonexistent');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it('rejects moving item owned by another member', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'other-member', productId: 'p1', productName: 'Frame' },
    ]);
    const r = await moveWishlistToCart('w1');
    expect(r.success).toBe(false);
  });

  it('returns product data and removes from wishlist', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Frame', productPrice: 500, imageUrl: 'https://img.jpg' },
    ]);
    const r = await moveWishlistToCart('w1');
    expect(r.success).toBe(true);
    expect(r.data.productId).toBe('p1');
    expect(r.data.productName).toBe('Frame');
    expect(r.data.productPrice).toBe(500);
  });

  it('defaults imageUrl to null when missing', async () => {
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Frame' },
    ]);
    const r = await moveWishlistToCart('w1');
    expect(r.data.imageUrl).toBeNull();
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await moveWishlistToCart('w1');
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getWishlistAlertHistory edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getWishlistAlertHistory — edge cases', () => {
  it('returns empty alerts for member with no history', async () => {
    const r = await getWishlistAlertHistory();
    expect(r.success).toBe(true);
    expect(r.data.alerts).toHaveLength(0);
  });

  it('returns mapped alert data', async () => {
    __seed('WishlistAlertsSent', [
      { _id: 'a1', memberId: 'mem-1', productId: 'p1', productName: 'Frame', alertType: 'price_drop',
        sentAt: new Date(), price: 400, previousHigh: 500, dropPercent: 20, quantityInStock: 5 },
    ]);
    const r = await getWishlistAlertHistory();
    expect(r.data.alerts).toHaveLength(1);
    expect(r.data.alerts[0].alertType).toBe('price_drop');
    expect(r.data.alerts[0].dropPercent).toBe(20);
  });

  it('defaults productName to empty string when missing', async () => {
    __seed('WishlistAlertsSent', [
      { _id: 'a1', memberId: 'mem-1', productId: 'p1', alertType: 'back_in_stock', sentAt: new Date() },
    ]);
    const r = await getWishlistAlertHistory();
    expect(r.data.alerts[0].productName).toBe('');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getWishlistAlertHistory();
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — updatePreferences edge cases
// ════════════════════════════════════════════════════════════════════════

describe('updatePreferences — edge cases', () => {
  it('rejects null preferences', async () => {
    const r = await updatePreferences(null);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid/i);
  });

  it('rejects non-object preferences', async () => {
    const r = await updatePreferences('string');
    expect(r.success).toBe(false);
  });

  it('rejects preferences with no valid keys', async () => {
    const r = await updatePreferences({ unknownKey: true });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no valid/i);
  });

  it('coerces truthy values to boolean', async () => {
    const r = await updatePreferences({ newsletter: 1 });
    expect(r.success).toBe(true);
    expect(r.data.newsletter).toBe(true);
  });

  it('coerces falsy values to boolean', async () => {
    const r = await updatePreferences({ newsletter: 0 });
    expect(r.success).toBe(true);
    expect(r.data.newsletter).toBe(false);
  });

  it('creates new preferences record for new member', async () => {
    const r = await updatePreferences({ saleAlerts: false });
    expect(r.success).toBe(true);
    expect(r.data.saleAlerts).toBe(false);
  });

  it('updates existing preferences record', async () => {
    __seed('MemberPreferences', [
      { _id: 'mp1', memberId: 'mem-1', newsletter: true, saleAlerts: true, backInStock: true },
    ]);
    const r = await updatePreferences({ backInStock: false });
    expect(r.success).toBe(true);
    expect(r.data.backInStock).toBe(false);
  });

  it('ignores unknown keys alongside valid ones', async () => {
    const r = await updatePreferences({ newsletter: false, hackerKey: true });
    expect(r.success).toBe(true);
    expect(r.data.newsletter).toBe(false);
    expect(r.data.hackerKey).toBeUndefined();
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await updatePreferences({ newsletter: false });
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getPreferences edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getPreferences — edge cases', () => {
  it('returns all-true defaults for new member', async () => {
    const r = await getPreferences();
    expect(r.success).toBe(true);
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(true);
  });

  it('returns stored preferences when they exist', async () => {
    __seed('MemberPreferences', [
      { _id: 'mp1', memberId: 'mem-1', newsletter: false, saleAlerts: true, backInStock: false },
    ]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(false);
    expect(r.data.saleAlerts).toBe(true);
    expect(r.data.backInStock).toBe(false);
  });

  it('treats missing fields as true (opt-in default)', async () => {
    __seed('MemberPreferences', [
      { _id: 'mp1', memberId: 'mem-1' },
    ]);
    const r = await getPreferences();
    expect(r.data.newsletter).toBe(true);
    expect(r.data.saleAlerts).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getPreferences();
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// accountDashboard — getReorderItems edge cases
// ════════════════════════════════════════════════════════════════════════

describe('getReorderItems — edge cases', () => {
  it('rejects empty order ID', async () => {
    const r = await getReorderItems('');
    expect(r.success).toBe(false);
  });

  it('returns error when order not found', async () => {
    const r = await getReorderItems('nonexistent-order');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it('returns line items from valid order', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, number: 1001, lineItems: [
        { productId: 'p1', name: 'Frame', quantity: 1, price: 500, options: [{ key: 'color', value: 'Cherry' }] },
      ] },
    ]);
    const r = await getReorderItems('o1');
    expect(r.success).toBe(true);
    expect(r.data.items).toHaveLength(1);
    expect(r.data.items[0].productId).toBe('p1');
    expect(r.data.items[0].options).toHaveLength(1);
    expect(r.data.orderNumber).toBe(1001);
  });

  it('defaults options to empty array when missing', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, number: 1, lineItems: [
        { productId: 'p1', name: 'Frame', quantity: 1, price: 500 },
      ] },
    ]);
    const r = await getReorderItems('o1');
    expect(r.data.items[0].options).toEqual([]);
  });

  it('handles order with empty lineItems', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, number: 1, lineItems: [] },
    ]);
    const r = await getReorderItems('o1');
    expect(r.success).toBe(true);
    expect(r.data.items).toHaveLength(0);
  });

  it('handles order with missing lineItems (defaults to empty)', async () => {
    __seed('Stores/Orders', [
      { _id: 'o1', buyerInfo: { id: 'mem-1' }, number: 1 },
    ]);
    const r = await getReorderItems('o1');
    expect(r.success).toBe(true);
    expect(r.data.items).toHaveLength(0);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const r = await getReorderItems('o1');
    expect(r.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// membershipService — edge cases
// ════════════════════════════════════════════════════════════════════════

describe('membershipService — edge cases', () => {
  it('getMembershipPlans returns empty when no plans exist', async () => {
    const r = await getMembershipPlans();
    expect(r).toEqual([]);
  });

  it('getMembershipPlans filters non-CF+ plans', async () => {
    const { __setPlans } = await import('wix-pricing-plans.v2');
    __setPlans([
      { slug: 'cf-plus-monthly', active: true, name: 'Monthly' },
      { slug: 'random-plan', active: true, name: 'Other' },
      { slug: 'cf-plus-annual', active: false, name: 'Annual (inactive)' },
    ]);
    const r = await getMembershipPlans();
    expect(r).toHaveLength(1);
    expect(r[0].slug).toBe('cf-plus-monthly');
  });

  it('getMembershipStatus returns inactive when no order', async () => {
    const r = await getMembershipStatus();
    expect(r.active).toBe(false);
  });

  it('getMembershipStatus returns active with plan details', async () => {
    const { __setOrders } = await import('wix-pricing-plans.v2');
    __setOrders([
      { _id: 'ord-1', status: 'ACTIVE', planSlug: 'cf-plus-annual', planName: 'CF+ Annual', startDate: '2026-01-01', endDate: '2027-01-01' },
    ]);
    const r = await getMembershipStatus();
    expect(r.active).toBe(true);
    expect(r.planName).toBe('CF+ Annual');
    expect(r.orderId).toBe('ord-1');
  });

  it('isCFPlusMember returns false when no active order', async () => {
    const r = await isCFPlusMember();
    expect(r).toBe(false);
  });

  it('isCFPlusMember returns true with active CF+ order', async () => {
    const { __setOrders } = await import('wix-pricing-plans.v2');
    __setOrders([{ _id: 'ord-1', status: 'ACTIVE', planSlug: 'cf-plus-monthly' }]);
    const r = await isCFPlusMember();
    expect(r).toBe(true);
  });

  it('isCFPlusMember returns false for non-CF+ active plan', async () => {
    const { __setOrders } = await import('wix-pricing-plans.v2');
    __setOrders([{ _id: 'ord-1', status: 'ACTIVE', planSlug: 'some-other-plan' }]);
    const r = await isCFPlusMember();
    expect(r).toBe(false);
  });

  it('getMemberBenefits returns defaults for non-members', async () => {
    const r = await getMemberBenefits();
    expect(r.freeShipping).toBe(false);
    expect(r.discountPercent).toBe(0);
    expect(r.earlyAccess).toBe(false);
    expect(r.badge).toBeNull();
  });

  it('getMemberBenefits returns full benefits for CF+ members', async () => {
    const { __setOrders } = await import('wix-pricing-plans.v2');
    __setOrders([{ _id: 'ord-1', status: 'ACTIVE', planSlug: 'cf-plus-monthly' }]);
    const r = await getMemberBenefits();
    expect(r.freeShipping).toBe(true);
    expect(r.discountPercent).toBe(CF_PLUS_BENEFITS.discountPercent);
    expect(r.badge).toBe('CF+');
  });

  it('getMemberBadge returns null for non-members', async () => {
    const r = await getMemberBadge();
    expect(r).toBeNull();
  });

  it('getMemberBadge returns badge config for CF+ members', async () => {
    const { __setOrders } = await import('wix-pricing-plans.v2');
    __setOrders([{ _id: 'ord-1', status: 'ACTIVE', planSlug: 'cf-plus-annual', planName: 'CF+ Annual' }]);
    const r = await getMemberBadge();
    expect(r.label).toBe('CF+');
    expect(r.color).toBe('#1a5276');
    expect(r.planName).toBe('CF+ Annual');
  });

  it('PLAN_SLUGS constants are correct', () => {
    expect(PLAN_SLUGS.MONTHLY).toBe('cf-plus-monthly');
    expect(PLAN_SLUGS.ANNUAL).toBe('cf-plus-annual');
  });

  it('ignores CANCELLED orders', async () => {
    const { __setOrders } = await import('wix-pricing-plans.v2');
    __setOrders([{ _id: 'ord-1', status: 'CANCELLED', planSlug: 'cf-plus-monthly' }]);
    const r = await isCFPlusMember();
    expect(r).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// loyaltyService — edge cases
// ════════════════════════════════════════════════════════════════════════

describe('loyaltyService — edge cases', () => {
  it('getMyLoyaltyAccount returns defaults when no account', async () => {
    __setAccount(null);
    const r = await getMyLoyaltyAccount();
    expect(r.points).toBe(0);
    expect(r.tier).toBe('Bronze');
    expect(r.nextTier).toBe('Silver');
    expect(r.pointsToNext).toBe(500);
  });

  it('getMyLoyaltyAccount returns Bronze for 0 points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 0 } });
    const r = await getMyLoyaltyAccount();
    expect(r.tier).toBe('Bronze');
    expect(r.nextTier).toBe('Silver');
    expect(r.progress).toBe(0);
  });

  it('getMyLoyaltyAccount returns Silver for 500 points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 500 } });
    const r = await getMyLoyaltyAccount();
    expect(r.tier).toBe('Silver');
    expect(r.nextTier).toBe('Gold');
  });

  it('getMyLoyaltyAccount returns Gold for 1500+ points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 2000 } });
    const r = await getMyLoyaltyAccount();
    expect(r.tier).toBe('Gold');
    expect(r.nextTier).toBeNull();
    expect(r.pointsToNext).toBe(0);
    expect(r.progress).toBe(100);
  });

  it('getMyLoyaltyAccount progress capped at 100', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 3000 } });
    const r = await getMyLoyaltyAccount();
    expect(r.progress).toBe(100);
  });

  it('getAvailableRewards returns empty when no rewards', async () => {
    __setRewards([]);
    const r = await getAvailableRewards();
    expect(r).toEqual([]);
  });

  it('getAvailableRewards filters inactive rewards', async () => {
    __setRewards([
      { _id: 'r1', name: 'Active', active: true, requiredPoints: 100 },
      { _id: 'r2', name: 'Inactive', active: false, requiredPoints: 50 },
    ]);
    const r = await getAvailableRewards();
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Active');
  });

  it('redeemReward rejects empty rewardId', async () => {
    const r = await redeemReward('');
    expect(r.success).toBe(false);
  });

  it('redeemReward rejects when not enough points', async () => {
    __setAccount({ _id: 'acc-1', points: { balance: 50 } });
    __setRewards([{ _id: 'r1', name: 'Big Prize', active: true, requiredPoints: 500 }]);
    const r = await redeemReward('r1');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/not enough/i);
  });

  it('getLoyaltyTiers returns 3 tiers', async () => {
    const r = await getLoyaltyTiers();
    expect(r).toHaveLength(3);
    expect(r[0].name).toBe('Bronze');
    expect(r[1].name).toBe('Silver');
    expect(r[2].name).toBe('Gold');
  });

  it('getLoyaltyTiers includes benefits arrays', async () => {
    const r = await getLoyaltyTiers();
    for (const tier of r) {
      expect(Array.isArray(tier.benefits)).toBe(true);
      expect(tier.benefits.length).toBeGreaterThan(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// loyaltyBonusPoints — edge cases
// ════════════════════════════════════════════════════════════════════════

describe('loyaltyBonusPoints — edge cases', () => {
  it('getEarningConfig returns point values and tier multipliers', async () => {
    const r = await getEarningConfig();
    expect(r.pointsPerDollar).toBe(1);
    expect(r.bonusPoints.review).toBe(BONUS_POINTS.REVIEW);
    expect(r.bonusPoints.photoReview).toBe(BONUS_POINTS.PHOTO_REVIEW);
    expect(r.bonusPoints.referralComplete).toBe(BONUS_POINTS.REFERRAL_COMPLETE);
    expect(r.tierMultipliers.Gold).toBe(1.5);
    expect(r.tierMultipliers.Platinum).toBe(2);
  });

  it('awardBonusPoints rejects empty accountId', async () => {
    const r = await awardBonusPoints('', 'review');
    expect(r.success).toBe(false);
  });

  it('awardBonusPoints rejects null accountId', async () => {
    const r = await awardBonusPoints(null, 'review');
    expect(r.success).toBe(false);
  });

  it('awardBonusPoints rejects unknown activity type', async () => {
    const r = await awardBonusPoints('acc-1', 'unknownActivity');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/unknown/i);
  });

  it('awardBonusPoints awards correct default points for review', async () => {
    const r = await awardBonusPoints('acc-1', 'review');
    expect(r.success).toBe(true);
    expect(r.pointsAwarded).toBe(BONUS_POINTS.REVIEW);
    expect(r.reason).toBe('review');
  });

  it('awardBonusPoints awards correct points for photoReview', async () => {
    const r = await awardBonusPoints('acc-1', 'photoReview');
    expect(r.success).toBe(true);
    expect(r.pointsAwarded).toBe(BONUS_POINTS.PHOTO_REVIEW);
  });

  it('awardBonusPoints awards correct points for referralComplete', async () => {
    const r = await awardBonusPoints('acc-1', 'referralComplete');
    expect(r.success).toBe(true);
    expect(r.pointsAwarded).toBe(BONUS_POINTS.REFERRAL_COMPLETE);
  });

  it('awardBonusPoints awards correct points for accountCreation', async () => {
    const r = await awardBonusPoints('acc-1', 'accountCreation');
    expect(r.success).toBe(true);
    expect(r.pointsAwarded).toBe(BONUS_POINTS.ACCOUNT_CREATION);
  });

  it('awardBonusPoints awards correct points for birthday', async () => {
    const r = await awardBonusPoints('acc-1', 'birthday');
    expect(r.success).toBe(true);
    expect(r.pointsAwarded).toBe(BONUS_POINTS.BIRTHDAY);
  });

  it('awardBonusPoints accepts custom point override', async () => {
    const r = await awardBonusPoints('acc-1', 'review', { points: 999 });
    expect(r.success).toBe(true);
    expect(r.pointsAwarded).toBe(999);
  });

  it('awardBonusPoints rejects zero custom points', async () => {
    const r = await awardBonusPoints('acc-1', 'review', { points: 0 });
    expect(r.success).toBe(false);
  });

  it('awardBonusPoints rejects negative custom points', async () => {
    const r = await awardBonusPoints('acc-1', 'review', { points: -50 });
    expect(r.success).toBe(false);
  });

  it('BONUS_POINTS constants are correct', () => {
    expect(BONUS_POINTS.REVIEW).toBe(50);
    expect(BONUS_POINTS.PHOTO_REVIEW).toBe(100);
    expect(BONUS_POINTS.REFERRAL_COMPLETE).toBe(200);
    expect(BONUS_POINTS.ACCOUNT_CREATION).toBe(25);
    expect(BONUS_POINTS.BIRTHDAY).toBe(100);
  });
});
