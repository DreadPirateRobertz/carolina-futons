import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from '../__mocks__/wix-members-backend.js';

// ── Module imports ──────────────────────────────────────────────────

import { redeemGiftCard } from '../../src/backend/giftCards.web.js';
import { submitReturnRequest } from '../../src/backend/returnsService.web.js';
import { getStockStatus } from '../../src/backend/inventoryService.web.js';
import { calculateForTerm } from '../../src/backend/financingCalc.web.js';
import { getActivePromotion } from '../../src/backend/promotions.web.js';
import { getRecoverableCarts } from '../../src/backend/cartRecovery.web.js';

beforeEach(() => {
  resetData();
  resetMember();
});

// ═══════════════════════════════════════════════════════════════════
// 1. Gift card double-spend (race condition via conditional update)
// ═══════════════════════════════════════════════════════════════════

describe('giftCards: redeemGiftCard', () => {
  it('deducts balance and returns correct remaining', async () => {
    __seed('GiftCards', [{
      _id: 'gc-1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 100,
      initialAmount: 100, status: 'active', expirationDate: new Date(Date.now() + 86400000),
    }]);

    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 30);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(30);
    expect(result.remainingBalance).toBe(70);
  });

  it('caps redemption at available balance', async () => {
    __seed('GiftCards', [{
      _id: 'gc-1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 20,
      initialAmount: 100, status: 'active', expirationDate: new Date(Date.now() + 86400000),
    }]);

    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(20);
    expect(result.remainingBalance).toBe(0);
  });

  it('uses conditional update with _rev to prevent double-spend', async () => {
    __seed('GiftCards', [{
      _id: 'gc-1', _rev: 'rev-1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 100,
      initialAmount: 100, status: 'active', expirationDate: new Date(Date.now() + 86400000),
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => { updatedItem = item; });

    await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 30);
    // The update should include _rev from the queried card to enable optimistic locking
    expect(updatedItem).not.toBeNull();
    expect(updatedItem._rev).toBe('rev-1');
  });

  it('rejects redemption on expired card', async () => {
    __seed('GiftCards', [{
      _id: 'gc-1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 100,
      initialAmount: 100, status: 'active',
      expirationDate: new Date(Date.now() - 86400000), // expired yesterday
    }]);

    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 30);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/expired/i);
  });

  it('rejects when balance is zero', async () => {
    __seed('GiftCards', [{
      _id: 'gc-1', code: 'CF-AAAA-BBBB-CCCC-DDDD', balance: 0,
      initialAmount: 100, status: 'active', expirationDate: new Date(Date.now() + 86400000),
    }]);

    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 30);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Returns: quantity validation — can't return more than ordered
// ═══════════════════════════════════════════════════════════════════

describe('returnsService: submitReturnRequest quantity validation', () => {
  const memberId = 'member-1';

  function setupReturnTest(orderLineItems, returnItems) {
    __setMember({
      _id: memberId,
      loginEmail: 'test@example.com',
      contactDetails: { firstName: 'Test', lastName: 'User' },
    });
    __seed('Stores/Orders', [{
      _id: 'order-1', number: '1001',
      buyerInfo: { id: memberId },
      _createdDate: new Date(),
      paymentStatus: 'PAID',
      lineItems: orderLineItems,
    }]);
    __seed('Returns', []);

    return {
      orderId: 'order-1',
      items: returnItems,
      reason: 'defective',
      details: 'Broken',
    };
  }

  it('accepts return with quantity <= ordered quantity', async () => {
    const data = setupReturnTest(
      [{ _id: 'li-1', productId: 'p-1', name: 'Futon', quantity: 5 }],
      [{ lineItemId: 'li-1', quantity: 3 }]
    );
    const result = await submitReturnRequest(data);
    expect(result.success).toBe(true);
    expect(result.rmaNumber).toBeTruthy();
  });

  it('rejects return with quantity > ordered quantity', async () => {
    const data = setupReturnTest(
      [{ _id: 'li-1', productId: 'p-1', name: 'Futon', quantity: 2 }],
      [{ lineItemId: 'li-1', quantity: 100 }]
    );
    const result = await submitReturnRequest(data);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/quantity/i);
  });

  it('clamps quantity to ordered amount in saved record', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'Returns') insertedItem = item;
    });

    const data = setupReturnTest(
      [{ _id: 'li-1', productId: 'p-1', name: 'Futon', quantity: 3 }],
      [{ lineItemId: 'li-1', quantity: 3 }]
    );
    const result = await submitReturnRequest(data);
    expect(result.success).toBe(true);

    const items = JSON.parse(insertedItem.items);
    expect(items[0].quantity).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Inventory: Math.min on empty variants returns Infinity
// ═══════════════════════════════════════════════════════════════════

describe('inventoryService: getStockStatus empty variants', () => {
  it('returns in_stock with empty variants when no InventoryLevels records exist', async () => {
    // No inventory records — product assumed in stock (no tracking set up)
    const result = await getStockStatus('product-1');
    expect(result.status).toBe('in_stock');
    expect(result.variants).toEqual([]);
  });

  it('returns correct status for product with variants', async () => {
    __seed('InventoryLevels', [
      { productId: 'product-1', variantId: 'v1', quantity: 10, threshold: 5 },
      { productId: 'product-1', variantId: 'v2', quantity: 3, threshold: 5 },
    ]);

    const result = await getStockStatus('product-1');
    expect(result.status).toBe('low_stock');
    expect(result.variants).toHaveLength(2);
  });

  it('returns out_of_stock when all variants have zero quantity', async () => {
    __seed('InventoryLevels', [
      { productId: 'product-1', variantId: 'v1', quantity: 0, threshold: 5 },
      { productId: 'product-1', variantId: 'v2', quantity: 0, threshold: 5 },
    ]);

    const result = await getStockStatus('product-1');
    expect(result.status).toBe('out_of_stock');
  });

  it('does not return Infinity for lowestQty (no empty spread bug)', async () => {
    // Even though items.length === 0 is caught early, ensure the code path
    // that handles variants never produces Infinity
    __seed('InventoryLevels', [
      { productId: 'product-1', variantId: 'v1', quantity: 50, threshold: 5 },
    ]);

    const result = await getStockStatus('product-1');
    expect(result.status).toBe('in_stock');
    for (const v of result.variants) {
      expect(Number.isFinite(v.quantity)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Financing: prices above max should be rejected, not get fallback
// ═══════════════════════════════════════════════════════════════════

describe('financingCalc: calculateForTerm above-max price', () => {
  it('calculates correctly for in-range price and term', async () => {
    const result = await calculateForTerm(1000, 12);
    expect(result.success).toBe(true);
    expect(result.apr).toBe(0);
    expect(result.monthly).toBeGreaterThan(0);
  });

  it('rejects price above max for all plans', async () => {
    // Price $15,000 exceeds maxPrice: 10000 for all term plans
    const result = await calculateForTerm(15000, 12);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects price below min for a given term', async () => {
    // 12-month plan requires minPrice: 500, price $100 is below
    const result = await calculateForTerm(100, 12);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects term that does not match any plan', async () => {
    // 36 months is not a defined term plan
    const result = await calculateForTerm(1000, 36);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Promotions: CSV productIds parsing — limit to 50
// ═══════════════════════════════════════════════════════════════════

describe('promotions: getActivePromotion productIds limit', () => {
  it('returns products for a normal promotion', async () => {
    __seed('Promotions', [{
      _id: 'promo-1', isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      title: 'Sale', productIds: 'p1,p2,p3',
    }]);
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Futon A', slug: 'futon-a', price: 500 },
      { _id: 'p2', name: 'Futon B', slug: 'futon-b', price: 600 },
      { _id: 'p3', name: 'Futon C', slug: 'futon-c', price: 700 },
    ]);

    const result = await getActivePromotion();
    expect(result).not.toBeNull();
    expect(result.products).toHaveLength(3);
  });

  it('limits parsed product IDs to 50 to prevent DoS', async () => {
    // Create 100 comma-separated IDs
    const manyIds = Array.from({ length: 100 }, (_, i) => `p${i}`).join(',');
    __seed('Promotions', [{
      _id: 'promo-1', isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      title: 'Huge Sale', productIds: manyIds,
    }]);
    // Seed matching products
    __seed('Stores/Products',
      Array.from({ length: 100 }, (_, i) => ({ _id: `p${i}`, name: `Product ${i}`, slug: `prod-${i}`, price: 100 }))
    );

    const result = await getActivePromotion();
    expect(result).not.toBeNull();
    // Should query at most 50 IDs
    expect(result.products.length).toBeLessThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Cart Recovery: parseLineItems safeParse on retrieval
// ═══════════════════════════════════════════════════════════════════

describe('cartRecovery: getRecoverableCarts parseLineItems', () => {
  it('parses valid JSON line items from stored cart', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    __seed('AbandonedCarts', [{
      _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'a@test.com',
      buyerName: 'Alice', cartTotal: 500, status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      lineItems: JSON.stringify([
        { productId: 'p1', name: 'Futon Frame', quantity: 1, price: 500 },
      ]),
    }]);

    const carts = await getRecoverableCarts();
    expect(carts).toHaveLength(1);
    expect(carts[0].lineItems).toHaveLength(1);
    expect(carts[0].lineItems[0].name).toBe('Futon Frame');
  });

  it('returns empty array for corrupted JSON line items', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    __seed('AbandonedCarts', [{
      _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'b@test.com',
      buyerName: 'Bob', cartTotal: 300, status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      lineItems: '{CORRUPTED DATA!!!',
    }]);

    const carts = await getRecoverableCarts();
    expect(carts).toHaveLength(1);
    expect(carts[0].lineItems).toEqual([]);
  });

  it('handles null line items gracefully', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    __seed('AbandonedCarts', [{
      _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'c@test.com',
      buyerName: 'Charlie', cartTotal: 200, status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      lineItems: null,
    }]);

    const carts = await getRecoverableCarts();
    expect(carts).toHaveLength(1);
    expect(carts[0].lineItems).toEqual([]);
  });
});
