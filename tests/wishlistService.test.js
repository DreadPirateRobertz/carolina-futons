/**
 * @file wishlistService.test.js
 * @description Tests for CF-ne83 Wishlist Service — CRUD + priceAtAdd tracking.
 *
 * Tests:
 *  - addToWishlist: adds item, stores priceAtAdd, rejects invalid input, dedup, cap
 *  - removeFromWishlist: removes item, not-found handling, auth check
 *  - getWishlist: returns items sorted by addedAt, unauthenticated returns empty
 *  - isOnWishlist: true/false by productId
 *  - updateWishlistStock: updates inStock for all items with productId
 *  - priceAtAdd tracking: field persisted and immutable on add
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate, __onRemove, __getInserted, __getUpdated, __getRemoved } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  isOnWishlist,
  updateWishlistStock,
  _WISHLIST_MAX_ITEMS,
} from '../src/backend/wishlistService.web.js';

function makeMember(id = 'member-1') {
  return { _id: id, loginEmail: `${id}@example.com` };
}

function makeWishlistItem(overrides = {}) {
  return {
    _id: 'wl-1',
    memberId: 'member-1',
    productId: 'prod-1',
    name: 'Classic Futon',
    price: 299,
    priceAtAdd: 299,
    imageUrl: 'https://cdn.example.com/img.jpg',
    productSlug: 'classic-futon',
    inStock: true,
    addedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  __seed('Wishlist', []);
  __setMember(null);
});

// ═══════════════════════════════════════════════════════════════════
// addToWishlist
// ═══════════════════════════════════════════════════════════════════

describe('addToWishlist', () => {
  it('returns success:false when not authenticated', async () => {
    const result = await addToWishlist('prod-1', 'Futon', 299);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
  });

  it('adds item to wishlist for authenticated member', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Classic Futon', 299, {
      imageUrl: 'https://cdn.example.com/img.jpg',
      productSlug: 'classic-futon',
      inStock: true,
    });
    expect(result.success).toBe(true);
    expect(result.item).toBeDefined();
    expect(result.item.productId).toBe('prod-1');
  });

  it('stores priceAtAdd equal to price at add time', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 399);
    expect(result.success).toBe(true);
    expect(result.item.priceAtAdd).toBe(399);
  });

  it('stores price and priceAtAdd as the same value on add', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 250);
    expect(result.item.price).toBe(250);
    expect(result.item.priceAtAdd).toBe(250);
  });

  it('returns success:false for missing productId', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('', 'Futon', 299);
    expect(result.success).toBe(false);
  });

  it('returns success:false for invalid price (NaN)', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', NaN);
    expect(result.success).toBe(false);
  });

  it('returns success:false for negative price', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', -10);
    expect(result.success).toBe(false);
  });

  it('returns alreadyExists:true when item already on wishlist', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem()]);
    const result = await addToWishlist('prod-1', 'Classic Futon', 299);
    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(true);
  });

  it('does not insert duplicate when item already on wishlist', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem()]);
    let insertCount = 0;
    __onInsert(() => { insertCount++; });
    await addToWishlist('prod-1', 'Classic Futon', 299);
    expect(insertCount).toBe(0);
  });

  it('stores imageUrl on item', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 299, {
      imageUrl: 'https://cdn.example.com/img.jpg',
    });
    expect(result.item.imageUrl).toBe('https://cdn.example.com/img.jpg');
  });

  it('stores productSlug on item', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 299, {
      productSlug: 'my-futon',
    });
    expect(result.item.productSlug).toBe('my-futon');
  });

  it('defaults inStock to true when not specified', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 299);
    expect(result.item.inStock).toBe(true);
  });

  it('respects inStock:false when explicitly passed', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 299, { inStock: false });
    expect(result.item.inStock).toBe(false);
  });

  it('returns error when wishlist is full', async () => {
    __setMember(makeMember());
    const items = Array.from({ length: _WISHLIST_MAX_ITEMS }, (_, i) => ({
      _id: `wl-${i}`,
      memberId: 'member-1',
      productId: `prod-${i}`,
      name: `Product ${i}`,
      price: 100,
      priceAtAdd: 100,
      inStock: true,
      addedAt: new Date(),
    }));
    __seed('Wishlist', items);
    const result = await addToWishlist('prod-new', 'New Product', 100);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/full/i);
  });

  it('includes addedAt timestamp on item', async () => {
    __setMember(makeMember());
    const result = await addToWishlist('prod-1', 'Futon', 299);
    expect(result.item.addedAt).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// removeFromWishlist
// ═══════════════════════════════════════════════════════════════════

describe('removeFromWishlist', () => {
  it('returns success:false when not authenticated', async () => {
    const result = await removeFromWishlist('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
  });

  it('removes item from wishlist', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem()]);
    const result = await removeFromWishlist('prod-1');
    expect(result.success).toBe(true);
  });

  it('calls wixData.remove with correct item id', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem({ _id: 'wl-abc' })]);
    let removedId = null;
    __onRemove((_collection, id) => { removedId = id; });
    await removeFromWishlist('prod-1');
    expect(removedId).toBe('wl-abc');
  });

  it('returns success:false when item not on wishlist', async () => {
    __setMember(makeMember());
    const result = await removeFromWishlist('prod-99');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns success:false for empty productId', async () => {
    __setMember(makeMember());
    const result = await removeFromWishlist('');
    expect(result.success).toBe(false);
  });

  it('only removes the authenticated member\'s item, not another member\'s', async () => {
    __setMember(makeMember('member-1'));
    // Both members have prod-1 in wishlist
    __seed('Wishlist', [
      makeWishlistItem({ _id: 'wl-1', memberId: 'member-1' }),
      makeWishlistItem({ _id: 'wl-2', memberId: 'member-2' }),
    ]);
    let removedId = null;
    __onRemove((_collection, id) => { removedId = id; });
    await removeFromWishlist('prod-1');
    expect(removedId).toBe('wl-1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// getWishlist
// ═══════════════════════════════════════════════════════════════════

describe('getWishlist', () => {
  it('returns success:false and empty items when not authenticated', async () => {
    const result = await getWishlist();
    expect(result.success).toBe(false);
    expect(result.items).toEqual([]);
  });

  it('returns member\'s wishlist items', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem()]);
    const result = await getWishlist();
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
  });

  it('includes priceAtAdd in returned items', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem({ priceAtAdd: 350 })]);
    const result = await getWishlist();
    expect(result.items[0].priceAtAdd).toBe(350);
  });

  it('returns total count', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem(), makeWishlistItem({ _id: 'wl-2', productId: 'prod-2' })]);
    const result = await getWishlist();
    expect(result.total).toBe(2);
  });

  it('returns empty list when wishlist is empty', async () => {
    __setMember(makeMember());
    const result = await getWishlist();
    expect(result.success).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('maps item fields correctly', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem({
      name: 'Classic Futon', price: 299, priceAtAdd: 320, productSlug: 'classic-futon',
    })]);
    const result = await getWishlist();
    const item = result.items[0];
    expect(item.name).toBe('Classic Futon');
    expect(item.price).toBe(299);
    expect(item.priceAtAdd).toBe(320);
    expect(item.productSlug).toBe('classic-futon');
  });
});

// ═══════════════════════════════════════════════════════════════════
// isOnWishlist
// ═══════════════════════════════════════════════════════════════════

describe('isOnWishlist', () => {
  it('returns onWishlist:false when not authenticated', async () => {
    const result = await isOnWishlist('prod-1');
    expect(result.onWishlist).toBe(false);
  });

  it('returns onWishlist:true when product is on wishlist', async () => {
    __setMember(makeMember());
    __seed('Wishlist', [makeWishlistItem()]);
    const result = await isOnWishlist('prod-1');
    expect(result.onWishlist).toBe(true);
  });

  it('returns onWishlist:false when product is not on wishlist', async () => {
    __setMember(makeMember());
    const result = await isOnWishlist('prod-99');
    expect(result.onWishlist).toBe(false);
  });

  it('returns onWishlist:false for empty productId', async () => {
    __setMember(makeMember());
    const result = await isOnWishlist('');
    expect(result.onWishlist).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// updateWishlistStock
// ═══════════════════════════════════════════════════════════════════

describe('updateWishlistStock', () => {
  it('updates inStock to true for all items with productId', async () => {
    __seed('Wishlist', [
      makeWishlistItem({ _id: 'wl-1', memberId: 'member-1', inStock: false }),
      makeWishlistItem({ _id: 'wl-2', memberId: 'member-2', inStock: false }),
    ]);
    const result = await updateWishlistStock('prod-1', true);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
  });

  it('updates inStock to false for all items with productId', async () => {
    __seed('Wishlist', [
      makeWishlistItem({ _id: 'wl-1', memberId: 'member-1', inStock: true }),
    ]);
    const result = await updateWishlistStock('prod-1', false);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
  });

  it('does not update items where inStock is already the target value', async () => {
    __seed('Wishlist', [
      makeWishlistItem({ _id: 'wl-1', inStock: true }),
    ]);
    let updateCount = 0;
    __onUpdate(() => { updateCount++; });
    await updateWishlistStock('prod-1', true);
    expect(updateCount).toBe(0);
  });

  it('returns updatedCount:0 when no matching items', async () => {
    const result = await updateWishlistStock('prod-99', true);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
  });

  it('returns success:false for empty productId', async () => {
    const result = await updateWishlistStock('', true);
    expect(result.success).toBe(false);
  });

  it('only updates items for the specified productId', async () => {
    __seed('Wishlist', [
      makeWishlistItem({ _id: 'wl-1', productId: 'prod-1', inStock: false }),
      makeWishlistItem({ _id: 'wl-2', productId: 'prod-2', inStock: false }),
    ]);
    const result = await updateWishlistStock('prod-1', true);
    expect(result.updatedCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// priceAtAdd tracking
// ═══════════════════════════════════════════════════════════════════

describe('priceAtAdd tracking', () => {
  it('priceAtAdd is persisted on insert', async () => {
    __setMember(makeMember());
    let insertedRecord = null;
    __onInsert((collection, item) => {
      if (collection === 'Wishlist') insertedRecord = item;
    });
    await addToWishlist('prod-1', 'Futon', 499);
    expect(insertedRecord).not.toBeNull();
    expect(insertedRecord.priceAtAdd).toBe(499);
  });

  it('priceAtAdd is separate from price in the DB record', async () => {
    __setMember(makeMember());
    let insertedRecord = null;
    __onInsert((collection, item) => {
      if (collection === 'Wishlist') insertedRecord = item;
    });
    await addToWishlist('prod-1', 'Futon', 499);
    expect(insertedRecord.price).toBe(499);
    expect(insertedRecord.priceAtAdd).toBe(499);
    // Both fields exist independently on the record
    expect(Object.prototype.hasOwnProperty.call(insertedRecord, 'priceAtAdd')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(insertedRecord, 'price')).toBe(true);
  });

  it('getWishlist returns priceAtAdd even if it differs from current price', async () => {
    __setMember(makeMember());
    // Simulate: added at $399, current price is $299
    __seed('Wishlist', [makeWishlistItem({ price: 299, priceAtAdd: 399 })]);
    const result = await getWishlist();
    expect(result.items[0].price).toBe(299);
    expect(result.items[0].priceAtAdd).toBe(399);
  });
});

// ═══════════════════════════════════════════════════════════════════
// module exports
// ═══════════════════════════════════════════════════════════════════

describe('module exports', () => {
  it('exports _WISHLIST_MAX_ITEMS as a positive number', () => {
    expect(typeof _WISHLIST_MAX_ITEMS).toBe('number');
    expect(_WISHLIST_MAX_ITEMS).toBeGreaterThan(0);
  });
});
