import { describe, it, expect } from 'vitest';
import {
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
  wixEcom_onAbandonedCheckoutCreated,
} from '../src/backend/cartRecovery.web.js';
import { __seed, __onInsert } from './__mocks__/wix-data.js';

// ── getAbandonedCartStats ────────────────────────────────────────────

describe('getAbandonedCartStats', () => {
  it('returns zero stats when no abandoned carts', async () => {
    const result = await getAbandonedCartStats();
    expect(result.totalAbandoned).toBe(0);
    expect(result.totalRecovered).toBe(0);
    expect(result.recoveryRate).toBe(0);
    expect(result.recentCarts).toEqual([]);
  });

  it('calculates recovery rate correctly', async () => {
    __seed('AbandonedCarts', [
      { _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'a@test.com', cartTotal: 100, status: 'abandoned', abandonedAt: new Date().toISOString() },
      { _id: 'ac-2', checkoutId: 'ck-2', buyerEmail: 'b@test.com', cartTotal: 200, status: 'recovered', abandonedAt: new Date().toISOString() },
      { _id: 'ac-3', checkoutId: 'ck-3', buyerEmail: 'c@test.com', cartTotal: 300, status: 'abandoned', abandonedAt: new Date().toISOString() },
      { _id: 'ac-4', checkoutId: 'ck-4', buyerEmail: 'd@test.com', cartTotal: 150, status: 'recovered', abandonedAt: new Date().toISOString() },
    ]);
    const result = await getAbandonedCartStats();
    expect(result.totalAbandoned).toBe(4);
    expect(result.totalRecovered).toBe(2);
    expect(result.recoveryRate).toBe(50);
  });

  it('limits recent carts to 10', async () => {
    const carts = Array.from({ length: 15 }, (_, i) => ({
      _id: `ac-${i}`,
      checkoutId: `ck-${i}`,
      buyerEmail: `user${i}@test.com`,
      cartTotal: 100,
      status: 'abandoned',
      abandonedAt: new Date(Date.now() - i * 3600000).toISOString(),
    }));
    __seed('AbandonedCarts', carts);
    const result = await getAbandonedCartStats();
    expect(result.recentCarts).toHaveLength(10);
  });
});

// ── getRecoverableCarts ──────────────────────────────────────────────

describe('getRecoverableCarts', () => {
  it('returns carts abandoned over 1 hour ago with no email sent', async () => {
    __seed('AbandonedCarts', [
      { _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'a@test.com', buyerName: 'Alice', cartTotal: 500, lineItems: [], abandonedAt: new Date(Date.now() - 7200000).toISOString(), status: 'abandoned', recoveryEmailSent: false },
    ]);
    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    expect(result[0].buyerEmail).toBe('a@test.com');
  });

  it('returns empty when no carts are recoverable', async () => {
    // No seeded data (reset clears between tests)
    const result = await getRecoverableCarts();
    expect(result).toEqual([]);
  });
});

// ── markRecoveryEmailSent ────────────────────────────────────────────

describe('markRecoveryEmailSent', () => {
  it('returns success when marking email sent', async () => {
    const result = await markRecoveryEmailSent('ac-1');
    expect(result.success).toBe(true);
  });

  it('returns failure for missing cart ID', async () => {
    const result = await markRecoveryEmailSent(null);
    expect(result.success).toBe(false);
  });
});

// ── recordAbandonedCart (via event handler) ──────────────────────────

describe('recordAbandonedCart duplicate detection', () => {
  it('does not insert duplicate record for same checkoutId', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-existing',
      checkoutId: 'ck-dup',
      buyerEmail: 'first@test.com',
      buyerName: 'First',
      cartTotal: 250,
      lineItems: [],
      status: 'abandoned',
      abandonedAt: new Date().toISOString(),
      recoveryEmailSent: false,
    }]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-dup',
        buyerInfo: { email: 'second@test.com', firstName: 'Second' },
        payNow: { total: { amount: 300 } },
        lineItems: [],
      },
    });

    // Wait for async fire-and-forget to settle
    await new Promise(r => setTimeout(r, 50));

    expect(insertCount).toBe(0);
  });

  it('inserts record when checkoutId is new', async () => {
    __seed('AbandonedCarts', []);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-new',
        buyerInfo: { email: 'new@test.com', firstName: 'New' },
        payNow: { total: { amount: 400 } },
        lineItems: [{ productName: { original: 'Futon Frame' }, quantity: 1, price: { amount: 400 } }],
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(insertCount).toBe(1);
  });

  it('allows insert when same checkoutId exists but status is recovered', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-recovered',
      checkoutId: 'ck-re',
      buyerEmail: 'old@test.com',
      status: 'recovered',
      abandonedAt: new Date().toISOString(),
    }]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-re',
        buyerInfo: { email: 're@test.com', firstName: 'Re' },
        payNow: { total: { amount: 100 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(insertCount).toBe(1);
  });
});

// ── Line item validation ─────────────────────────────────────────────

describe('recordAbandonedCart line item validation', () => {
  it('filters out line items missing name or with quantity <= 0', async () => {
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((collection, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-validate',
        buyerInfo: { email: 'val@test.com', firstName: 'Val' },
        payNow: { total: { amount: 500 } },
        lineItems: [
          { productName: { original: 'Valid Item' }, quantity: 2, price: { amount: 200 } },
          { productName: { original: '' }, quantity: 1, price: { amount: 50 } },
          { productName: { original: 'Negative Qty' }, quantity: -1, price: { amount: 100 } },
          { catalogReference: { catalogItemId: 'Fallback Name' }, quantity: 1, price: { amount: 150 } },
        ],
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(insertedItem).not.toBeNull();
    expect(insertedItem.lineItems).toHaveLength(2);
    expect(insertedItem.lineItems[0].name).toBe('Valid Item');
    expect(insertedItem.lineItems[1].name).toBe('Fallback Name');
  });
});
