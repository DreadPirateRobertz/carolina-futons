// saveForLater.test.js - CF-x8c: Save for Later (cart → wishlist)
// TDD tests for moving cart items to wishlist with member auth,
// cart removal, CMS persistence, analytics, and error handling.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockRemoveCartItem = vi.fn().mockResolvedValue({});
vi.mock('public/cartService', () => ({
  removeCartItem: (...args) => mockRemoveCartItem(...args),
}));

const mockInsert = vi.fn().mockResolvedValue({ _id: 'wl-001' });
const mockQuery = vi.fn();
const mockFind = vi.fn().mockResolvedValue({ items: [] });
vi.mock('wix-data', () => ({
  default: {
    insert: (...args) => mockInsert(...args),
    query: (...args) => {
      mockQuery(...args);
      return {
        eq: vi.fn().mockReturnThis(),
        find: mockFind,
      };
    },
  },
}));

const mockGetMember = vi.fn().mockResolvedValue({ _id: 'member-123' });
vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: () => mockGetMember(),
  },
}));

const mockTrackEvent = vi.fn();
vi.mock('public/engagementTracker', () => ({
  trackEvent: (...args) => mockTrackEvent(...args),
}));

const mockFireCustomEvent = vi.fn();
vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: (...args) => mockFireCustomEvent(...args),
}));

import { saveForLater } from '../src/public/SaveForLater.js';

// ── Test Data ────────────────────────────────────────────────────────

const cartItem = {
  _id: 'cart-item-1',
  productId: 'prod-abc',
  name: 'Blue Ridge Futon Frame',
  price: 899,
  image: 'https://static.wixstatic.com/media/futon.jpg',
};

// ── Tests ────────────────────────────────────────────────────────────

describe('saveForLater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMember.mockResolvedValue({ _id: 'member-123' });
    mockFind.mockResolvedValue({ items: [] });
    mockInsert.mockResolvedValue({ _id: 'wl-001' });
    mockRemoveCartItem.mockResolvedValue({});
  });

  // ── Happy path ──────────────────────────────────────────────────

  it('removes item from cart', async () => {
    await saveForLater(cartItem);
    expect(mockRemoveCartItem).toHaveBeenCalledWith('cart-item-1');
  });

  it('adds item to Wishlist collection', async () => {
    await saveForLater(cartItem);
    expect(mockInsert).toHaveBeenCalledWith('Wishlist', expect.objectContaining({
      memberId: 'member-123',
      productId: 'prod-abc',
      productName: 'Blue Ridge Futon Frame',
    }));
  });

  it('includes productImage and addedDate in wishlist record', async () => {
    await saveForLater(cartItem);
    const insertedData = mockInsert.mock.calls[0][1];
    expect(insertedData.productImage).toBe('https://static.wixstatic.com/media/futon.jpg');
    expect(insertedData.addedDate).toBeInstanceOf(Date);
  });

  it('returns success with wishlist item ID', async () => {
    const result = await saveForLater(cartItem);
    expect(result.success).toBe(true);
    expect(result.wishlistItemId).toBe('wl-001');
  });

  it('tracks save_for_later event', async () => {
    await saveForLater(cartItem);
    expect(mockTrackEvent).toHaveBeenCalledWith('save_for_later', expect.objectContaining({
      productId: 'prod-abc',
      source: 'cart',
    }));
  });

  it('fires GA4 custom event', async () => {
    await saveForLater(cartItem);
    expect(mockFireCustomEvent).toHaveBeenCalledWith('save_for_later', expect.objectContaining({
      productId: 'prod-abc',
    }));
  });

  // ── Deduplication ───────────────────────────────────────────────

  it('skips wishlist insert if item already wishlisted', async () => {
    mockFind.mockResolvedValue({ items: [{ _id: 'existing-wl' }] });
    const result = await saveForLater(cartItem);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    // Still removes from cart
    expect(mockRemoveCartItem).toHaveBeenCalledWith('cart-item-1');
  });

  // ── Auth required ───────────────────────────────────────────────

  it('returns error when user is not logged in', async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await saveForLater(cartItem);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_authenticated');
    // Should NOT remove from cart if not authenticated
    expect(mockRemoveCartItem).not.toHaveBeenCalled();
  });

  // ── Input validation ────────────────────────────────────────────

  it('returns error for null cart item', async () => {
    const result = await saveForLater(null);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  it('returns error for cart item without productId', async () => {
    const result = await saveForLater({ _id: 'x', name: 'test' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  it('returns error for cart item without _id', async () => {
    const result = await saveForLater({ productId: 'x', name: 'test' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_item');
  });

  // ── Error handling ──────────────────────────────────────────────

  it('returns error if cart removal fails', async () => {
    mockRemoveCartItem.mockRejectedValue(new Error('Cart API down'));
    const result = await saveForLater(cartItem);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('cart_removal_failed');
    // Should NOT add to wishlist if cart removal failed
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns partial success if wishlist insert fails after cart removal', async () => {
    mockInsert.mockRejectedValue(new Error('DB error'));
    const result = await saveForLater(cartItem);
    // Cart was removed but wishlist failed — report the issue
    expect(result.success).toBe(false);
    expect(result.reason).toBe('wishlist_add_failed');
    expect(mockRemoveCartItem).toHaveBeenCalled();
  });

  it('does not leak internal error details', async () => {
    mockRemoveCartItem.mockRejectedValue(new Error('Sensitive: DB connection string xyz'));
    const result = await saveForLater(cartItem);
    expect(JSON.stringify(result)).not.toContain('Sensitive');
    expect(JSON.stringify(result)).not.toContain('xyz');
  });
});
