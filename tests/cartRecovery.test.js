import { describe, it, expect } from 'vitest';
import {
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
} from '../src/backend/cartRecovery.web.js';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';

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

// ── wixEcom_onAbandonedCheckoutRecovered ─────────────────────────────

describe('wixEcom_onAbandonedCheckoutRecovered', () => {
  it('marks an abandoned cart as recovered', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-to-recover',
      checkoutId: 'ck-recover-1',
      buyerEmail: 'recovered@test.com',
      status: 'abandoned',
      abandonedAt: new Date().toISOString(),
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'ck-recover-1' },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(updatedItem).not.toBeNull();
    expect(updatedItem.status).toBe('recovered');
    expect(updatedItem.recoveredAt).toBeTruthy();
  });

  it('does nothing when checkoutId has no matching abandoned cart', async () => {
    __seed('AbandonedCarts', []);

    let updateCount = 0;
    __onUpdate(() => { updateCount++; });

    wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'ck-nonexistent' },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(updateCount).toBe(0);
  });

  it('does nothing when checkoutId is empty', async () => {
    let updateCount = 0;
    __onUpdate(() => { updateCount++; });

    wixEcom_onAbandonedCheckoutRecovered({ entity: {} });

    await new Promise(r => setTimeout(r, 50));

    expect(updateCount).toBe(0);
  });

  it('only recovers carts with abandoned status, not already recovered', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-already-recovered',
      checkoutId: 'ck-already',
      buyerEmail: 'already@test.com',
      status: 'recovered',
      abandonedAt: new Date().toISOString(),
    }]);

    let updateCount = 0;
    __onUpdate(() => { updateCount++; });

    wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'ck-already' },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(updateCount).toBe(0);
  });

  it('handles event without entity wrapper', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-direct',
      checkoutId: 'ck-direct',
      buyerEmail: 'direct@test.com',
      status: 'abandoned',
      abandonedAt: new Date().toISOString(),
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    // Event passed directly (no entity wrapper)
    wixEcom_onAbandonedCheckoutRecovered({ _id: 'ck-direct' });

    await new Promise(r => setTimeout(r, 50));

    expect(updatedItem).not.toBeNull();
    expect(updatedItem.status).toBe('recovered');
  });
});

// ── getRecoverableCarts edge cases ──────────────────────────────────

describe('getRecoverableCarts edge cases', () => {
  it('excludes carts abandoned less than 1 hour ago', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-recent',
      checkoutId: 'ck-recent',
      buyerEmail: 'recent@test.com',
      buyerName: 'Recent',
      cartTotal: 300,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min ago
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    const result = await getRecoverableCarts();
    expect(result).toHaveLength(0);
  });

  it('excludes carts that already had recovery email sent', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-sent',
      checkoutId: 'ck-sent',
      buyerEmail: 'sent@test.com',
      buyerName: 'Sent',
      cartTotal: 500,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: true, // Already emailed
    }]);

    const result = await getRecoverableCarts();
    expect(result).toHaveLength(0);
  });

  it('excludes recovered carts', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-rec',
      checkoutId: 'ck-rec',
      buyerEmail: 'rec@test.com',
      buyerName: 'Rec',
      cartTotal: 200,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      status: 'recovered', // Already recovered
      recoveryEmailSent: false,
    }]);

    const result = await getRecoverableCarts();
    expect(result).toHaveLength(0);
  });

  it('returns correct fields in recoverable cart objects', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-fields',
      checkoutId: 'ck-fields',
      buyerEmail: 'fields@test.com',
      buyerName: 'Fields',
      cartTotal: 899,
      lineItems: [{ name: 'Eureka', quantity: 1 }],
      abandonedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: false,
      // Extra field that should NOT appear in output
      internalNote: 'should be stripped',
    }]);

    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('_id');
    expect(result[0]).toHaveProperty('checkoutId', 'ck-fields');
    expect(result[0]).toHaveProperty('buyerEmail', 'fields@test.com');
    expect(result[0]).toHaveProperty('buyerName', 'Fields');
    expect(result[0]).toHaveProperty('cartTotal', 899);
    expect(result[0]).toHaveProperty('lineItems');
    expect(result[0]).toHaveProperty('abandonedAt');
    expect(result[0]).not.toHaveProperty('internalNote');
  });
});

// ── getAbandonedCartStats edge cases ────────────────────────────────

describe('getAbandonedCartStats edge cases', () => {
  it('sorts recent carts by most recent first', async () => {
    const now = Date.now();
    __seed('AbandonedCarts', [
      { _id: 'ac-old', checkoutId: 'ck-old', buyerEmail: 'old@test.com', cartTotal: 100, status: 'abandoned', abandonedAt: new Date(now - 3 * 3600000).toISOString() },
      { _id: 'ac-new', checkoutId: 'ck-new', buyerEmail: 'new@test.com', cartTotal: 200, status: 'abandoned', abandonedAt: new Date(now - 1 * 3600000).toISOString() },
      { _id: 'ac-mid', checkoutId: 'ck-mid', buyerEmail: 'mid@test.com', cartTotal: 150, status: 'abandoned', abandonedAt: new Date(now - 2 * 3600000).toISOString() },
    ]);

    const result = await getAbandonedCartStats();
    expect(result.recentCarts[0].checkoutId).toBe('ck-new');
    expect(result.recentCarts[1].checkoutId).toBe('ck-mid');
    expect(result.recentCarts[2].checkoutId).toBe('ck-old');
  });

  it('returns only specified fields in recentCarts', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-strip',
      checkoutId: 'ck-strip',
      buyerEmail: 'strip@test.com',
      cartTotal: 500,
      status: 'abandoned',
      abandonedAt: new Date().toISOString(),
      buyerName: 'should not appear',
      recoveryEmailSent: false,
    }]);

    const result = await getAbandonedCartStats();
    const cart = result.recentCarts[0];
    expect(cart).toHaveProperty('checkoutId');
    expect(cart).toHaveProperty('buyerEmail');
    expect(cart).toHaveProperty('cartTotal');
    expect(cart).toHaveProperty('status');
    expect(cart).toHaveProperty('abandonedAt');
    expect(cart).not.toHaveProperty('buyerName');
    expect(cart).not.toHaveProperty('recoveryEmailSent');
  });

  it('rounds recovery rate to nearest integer', async () => {
    __seed('AbandonedCarts', [
      { _id: 'ac-1', checkoutId: 'ck-1', buyerEmail: 'a@t.com', cartTotal: 100, status: 'recovered', abandonedAt: new Date().toISOString() },
      { _id: 'ac-2', checkoutId: 'ck-2', buyerEmail: 'b@t.com', cartTotal: 100, status: 'abandoned', abandonedAt: new Date().toISOString() },
      { _id: 'ac-3', checkoutId: 'ck-3', buyerEmail: 'c@t.com', cartTotal: 100, status: 'abandoned', abandonedAt: new Date().toISOString() },
    ]);

    const result = await getAbandonedCartStats();
    // 1/3 = 33.33... → rounds to 33
    expect(result.recoveryRate).toBe(33);
    expect(Number.isInteger(result.recoveryRate)).toBe(true);
  });

  it('excludes carts older than 30 days', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 3600000).toISOString();
    __seed('AbandonedCarts', [
      { _id: 'ac-old', checkoutId: 'ck-old', buyerEmail: 'old@t.com', cartTotal: 100, status: 'abandoned', abandonedAt: oldDate },
      { _id: 'ac-new', checkoutId: 'ck-new', buyerEmail: 'new@t.com', cartTotal: 200, status: 'abandoned', abandonedAt: new Date().toISOString() },
    ]);

    const result = await getAbandonedCartStats();
    expect(result.totalAbandoned).toBe(1);
  });
});

// ── Input sanitization ──────────────────────────────────────────────

describe('input sanitization', () => {
  it('sanitizes XSS in buyer email when recording cart', async () => {
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((collection, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-xss',
        buyerInfo: { email: '<script>alert("x")</script>@test.com', firstName: '<b>Bold</b>' },
        payNow: { total: { amount: 100 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(insertedItem).not.toBeNull();
    expect(insertedItem.buyerEmail).not.toContain('<script>');
    expect(insertedItem.buyerName).not.toContain('<b>');
  });

  it('sanitizes checkoutId to prevent injection', async () => {
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((collection, item) => { insertedItem = item; });

    const longId = 'x'.repeat(100);
    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: longId,
        buyerInfo: { email: 'clean@test.com', firstName: 'Clean' },
        payNow: { total: { amount: 50 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(insertedItem).not.toBeNull();
    expect(insertedItem.checkoutId.length).toBeLessThanOrEqual(50);
  });

  it('coerces non-numeric cartTotal to 0', async () => {
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((collection, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-nan',
        buyerInfo: { email: 'nan@test.com', firstName: 'Nan' },
        payNow: { total: { amount: 'not-a-number' } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(insertedItem).not.toBeNull();
    expect(insertedItem.cartTotal).toBe(0);
  });

  it('markRecoveryEmailSent sanitizes cart ID', async () => {
    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    const longId = 'a'.repeat(100);
    await markRecoveryEmailSent(longId);

    expect(updatedItem).not.toBeNull();
    expect(updatedItem._id.length).toBeLessThanOrEqual(50);
    expect(updatedItem.recoveryEmailSent).toBe(true);
  });
});
