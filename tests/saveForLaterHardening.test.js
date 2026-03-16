import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ───────────
const { mockMemberRef, mockWixData, mockRemoveCartItem } = vi.hoisted(() => ({
  mockMemberRef: { value: { _id: 'member-1' } },
  mockWixData: {
    query: vi.fn(),
    insert: vi.fn().mockResolvedValue({ _id: 'wish-new-1' }),
  },
  mockRemoveCartItem: vi.fn().mockResolvedValue({}),
}));

function createQueryBuilder(items = []) {
  const qb = {
    eq: vi.fn().mockReturnThis(),
    find: vi.fn().mockResolvedValue({ items }),
  };
  return qb;
}

// ── Mock wix-members-frontend ──────────────────────────────────────
vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(mockMemberRef.value)),
  },
}));

// ── Mock wix-data ──────────────────────────────────────────────────
vi.mock('wix-data', () => ({
  default: mockWixData,
}));

// ── Mock cartService ───────────────────────────────────────────────
vi.mock('public/cartService', () => ({
  removeCartItem: mockRemoveCartItem,
}));

// ── Mock engagement / analytics ────────────────────────────────────
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
}));

import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';
import { saveForLater } from '../src/public/SaveForLater.js';

// ── Test setup ─────────────────────────────────────────────────────

const validCartItem = {
  _id: 'cart-item-1',
  productId: 'prod-1',
  name: 'Eureka Futon Frame',
  price: 499.99,
  image: 'https://img/eureka.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMemberRef.value = { _id: 'member-1' };
  mockWixData.query.mockReturnValue(createQueryBuilder([]));
  mockWixData.insert.mockResolvedValue({ _id: 'wish-new-1' });
  mockRemoveCartItem.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════
// 1. INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('saveForLater input validation', () => {
  it('rejects null cartItem', async () => {
    const result = await saveForLater(null);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  it('rejects undefined cartItem', async () => {
    const result = await saveForLater(undefined);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  it('rejects cartItem without _id', async () => {
    const result = await saveForLater({ productId: 'prod-1' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  it('rejects cartItem without productId', async () => {
    const result = await saveForLater({ _id: 'cart-1' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  it('rejects empty object', async () => {
    const result = await saveForLater({});
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════

describe('saveForLater authentication', () => {
  it('rejects unauthenticated user', async () => {
    mockMemberRef.value = null;
    const result = await saveForLater(validCartItem);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_authenticated');
    expect(mockRemoveCartItem).not.toHaveBeenCalled();
  });

  it('does not touch cart or wishlist when not authenticated', async () => {
    mockMemberRef.value = null;
    await saveForLater(validCartItem);
    expect(mockRemoveCartItem).not.toHaveBeenCalled();
    expect(mockWixData.insert).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. CART ITEM LOSS PREVENTION (critical bug fix)
// ═══════════════════════════════════════════════════════════════════

describe('saveForLater cart item loss prevention', () => {
  it('adds to wishlist BEFORE removing from cart', async () => {
    const callOrder = [];
    mockWixData.insert.mockImplementation(() => {
      callOrder.push('wishlist_insert');
      return Promise.resolve({ _id: 'wish-new-1' });
    });
    mockRemoveCartItem.mockImplementation(() => {
      callOrder.push('cart_remove');
      return Promise.resolve({});
    });

    await saveForLater(validCartItem);
    expect(callOrder[0]).toBe('wishlist_insert');
    expect(callOrder[1]).toBe('cart_remove');
  });

  it('preserves cart item when wishlist insert fails', async () => {
    mockWixData.insert.mockRejectedValueOnce(new Error('DB error'));
    const result = await saveForLater(validCartItem);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('wishlist_add_failed');
    // Cart item should NOT have been removed
    expect(mockRemoveCartItem).not.toHaveBeenCalled();
  });

  it('succeeds even if cart removal fails after wishlist add', async () => {
    mockRemoveCartItem.mockRejectedValueOnce(new Error('Cart API down'));
    const result = await saveForLater(validCartItem);
    // Should still succeed — item is in wishlist, cart removal is best-effort
    expect(result.success).toBe(true);
    expect(result.wishlistItemId).toBe('wish-new-1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════

describe('saveForLater deduplication', () => {
  it('returns existing wishlist ID if product already wishlisted', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-1' },
    ]));

    const result = await saveForLater(validCartItem);
    expect(result.success).toBe(true);
    expect(result.wishlistItemId).toBe('wish-existing');
    expect(mockWixData.insert).not.toHaveBeenCalled();
  });

  it('still removes from cart when product already wishlisted', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-1' },
    ]));

    await saveForLater(validCartItem);
    expect(mockRemoveCartItem).toHaveBeenCalledWith('cart-item-1');
  });

  it('returns cart_removal_failed when dedup path cart removal fails', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-1' },
    ]));
    mockRemoveCartItem.mockRejectedValueOnce(new Error('fail'));

    const result = await saveForLater(validCartItem);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('cart_removal_failed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. FIELD MAPPING (price & name fields)
// ═══════════════════════════════════════════════════════════════════

describe('saveForLater field mapping', () => {
  it('saves price as number to wishlist', async () => {
    await saveForLater(validCartItem);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[0]).toBe('Wishlist');
    expect(insertCall[1].price).toBe(499.99);
  });

  it('saves name field for wishlistAlerts compatibility', async () => {
    await saveForLater(validCartItem);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[1].name).toBe('Eureka Futon Frame');
    expect(insertCall[1].productName).toBe('Eureka Futon Frame');
  });

  it('saves inStock=true by default', async () => {
    await saveForLater(validCartItem);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[1].inStock).toBe(true);
  });

  it('handles missing price gracefully (saves null)', async () => {
    const itemNoPrice = { ...validCartItem, price: undefined };
    await saveForLater(itemNoPrice);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[1].price).toBeNull();
  });

  it('handles NaN price gracefully (saves null)', async () => {
    const itemBadPrice = { ...validCartItem, price: 'free' };
    await saveForLater(itemBadPrice);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[1].price).toBeNull();
  });

  it('saves productImage from cartItem.image', async () => {
    await saveForLater(validCartItem);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[1].productImage).toBe('https://img/eureka.jpg');
  });

  it('saves addedDate as Date', async () => {
    await saveForLater(validCartItem);
    const insertCall = mockWixData.insert.mock.calls[0];
    expect(insertCall[1].addedDate).toBeInstanceOf(Date);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. ANALYTICS EVENTS
// ═══════════════════════════════════════════════════════════════════

describe('saveForLater analytics', () => {
  it('fires trackEvent on successful save', async () => {
    await saveForLater(validCartItem);
    expect(trackEvent).toHaveBeenCalledWith('save_for_later', {
      productId: 'prod-1',
      source: 'cart',
    });
  });

  it('fires GA4 custom event on successful save', async () => {
    await saveForLater(validCartItem);
    expect(fireCustomEvent).toHaveBeenCalledWith('save_for_later', {
      productId: 'prod-1',
    });
  });

  it('does not fire events on validation failure', async () => {
    await saveForLater(null);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(fireCustomEvent).not.toHaveBeenCalled();
  });

  it('does not fire events on auth failure', async () => {
    mockMemberRef.value = null;
    await saveForLater(validCartItem);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(fireCustomEvent).not.toHaveBeenCalled();
  });

  it('fires events on dedup path (already wishlisted)', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-1' },
    ]));
    await saveForLater(validCartItem);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(fireCustomEvent).toHaveBeenCalledTimes(1);
  });
});
