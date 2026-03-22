/**
 * @file cartRecoveryEdgeCases.test.js
 * @description Edge case and timing-sensitive tests for cart recovery.
 *
 * Focus areas (CF-mjvo):
 * - Zero-item checkout abandonment edge cases
 * - Deduplication when same cart abandoned multiple times in 24h
 * - Email sent timestamp recorded to prevent duplicate sends
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  wixEcom_onAbandonedCheckoutCreated,
  getRecoverableCarts,
  markRecoveryEmailSent,
} from '../src/backend/cartRecovery.web.js';
import { __seed, __reset, __onInsert, __onUpdate } from './__mocks__/wix-data.js';

beforeEach(() => __reset());

// ── Zero-item checkout abandonment ────────────────────────────────────────────

describe('zero-item checkout abandonment', () => {
  it('records a cart even when lineItems array is empty', async () => {
    __seed('AbandonedCarts', []);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-empty',
        buyerInfo: { email: 'buyer@test.com', firstName: 'Buyer' },
        payNow: { total: { amount: 0 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));
    expect(insertCount).toBe(1);
  });

  it('stores lineItems as an empty JSON array when no items are present', async () => {
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((_col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-noline',
        buyerInfo: { email: 'noline@test.com', firstName: 'NoLine' },
        payNow: { total: { amount: 50 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.lineItems).toBe('[]');
    expect(JSON.parse(insertedItem.lineItems)).toEqual([]);
  });

  it('records cart as empty when all line items have negative quantity', async () => {
    // Note: quantity=0 is coerced to 1 by the event handler (item.quantity || 1),
    // so only truly negative quantities are filtered out by recordAbandonedCart.
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((_col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-invalid-qty',
        buyerInfo: { email: 'inv@test.com', firstName: 'Inv' },
        payNow: { total: { amount: 200 } },
        lineItems: [
          { productName: { original: 'Item A' }, quantity: -1, price: { amount: 100 } },
          { productName: { original: 'Item B' }, quantity: -5, price: { amount: 100 } },
        ],
      },
    });

    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    const items = JSON.parse(insertedItem.lineItems);
    expect(items).toHaveLength(0);
  });

  it('getRecoverableCarts includes zero-item carts — no minimum item count required', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-zero',
      checkoutId: 'ck-zero',
      buyerEmail: 'zero@test.com',
      buyerName: 'Zero',
      cartTotal: 0,
      lineItems: '[]',
      abandonedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    expect(result[0].lineItems).toEqual([]);
  });

  it('records cartTotal as 0 when checkout has no items and no total', async () => {
    __seed('AbandonedCarts', []);

    let insertedItem = null;
    __onInsert((_col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-zero-total',
        buyerInfo: { email: 'zt@test.com', firstName: 'ZT' },
        payNow: undefined,
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.cartTotal).toBe(0);
    expect(insertedItem.lineItems).toBe('[]');
  });
});

// ── Deduplication: same cart abandoned multiple times in 24h ─────────────────

describe('cart deduplication — multiple abandonment events in 24h', () => {
  it('fires same event twice → second event does not produce a second insert', async () => {
    __seed('AbandonedCarts', []);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    const event = {
      entity: {
        _id: 'ck-dedup24',
        buyerInfo: { email: 'dedup@test.com', firstName: 'Dedup' },
        payNow: { total: { amount: 150 } },
        lineItems: [],
      },
    };

    // First abandonment — inserts
    wixEcom_onAbandonedCheckoutCreated(event);
    await new Promise(r => setTimeout(r, 50));
    expect(insertCount).toBe(1);

    // Seed the DB record as it would exist after first insert
    __seed('AbandonedCarts', [{
      _id: 'ac-dedup24',
      checkoutId: 'ck-dedup24',
      status: 'abandoned',
      abandonedAt: new Date().toISOString(),
    }]);
    insertCount = 0;

    // Second abandonment within 24h — same checkout, still abandoned
    wixEcom_onAbandonedCheckoutCreated(event);
    await new Promise(r => setTimeout(r, 50));
    expect(insertCount).toBe(0);
  });

  it('dedup holds across multiple sequential firings (simulates cron re-triggering same cart)', async () => {
    // First firing inserts the record
    __seed('AbandonedCarts', []);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    const event = {
      entity: {
        _id: 'ck-seq',
        buyerInfo: { email: 'seq@test.com', firstName: 'Seq' },
        payNow: { total: { amount: 200 } },
        lineItems: [],
      },
    };

    wixEcom_onAbandonedCheckoutCreated(event);
    await new Promise(r => setTimeout(r, 50));
    expect(insertCount).toBe(1);

    // DB now has the record — simulate re-trigger from cron or second event
    __seed('AbandonedCarts', [{
      _id: 'ac-seq',
      checkoutId: 'ck-seq',
      status: 'abandoned',
      abandonedAt: new Date().toISOString(),
    }]);
    insertCount = 0;

    // Second firing (several seconds later, same checkout still in abandoned state)
    wixEcom_onAbandonedCheckoutCreated(event);
    await new Promise(r => setTimeout(r, 50));

    // Third firing (hours later, checkout still not completed)
    wixEcom_onAbandonedCheckoutCreated(event);
    await new Promise(r => setTimeout(r, 50));

    expect(insertCount).toBe(0);
  });

  it('dedup uses checkoutId+status: abandoned 23h ago is still deduplicated', async () => {
    // Simulates customer abandoning cart, leaving, and triggering the event again
    // within the same 24-hour window
    __seed('AbandonedCarts', [{
      _id: 'ac-23h',
      checkoutId: 'ck-23h',
      status: 'abandoned',
      abandonedAt: new Date(Date.now() - 23 * 3600000).toISOString(),
    }]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-23h',
        buyerInfo: { email: 'old@test.com', firstName: 'Old' },
        payNow: { total: { amount: 300 } },
        lineItems: [],
      },
    });

    await new Promise(r => setTimeout(r, 50));
    // Should NOT insert because checkoutId already has abandoned status
    expect(insertCount).toBe(0);
  });
});

// ── Email sent timestamp — duplicate send prevention ─────────────────────────

describe('markRecoveryEmailSent — timestamp prevents duplicate sends', () => {
  it('sets recoveryEmailSentAt when marking email sent', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-ts',
      checkoutId: 'ck-ts',
      buyerEmail: 'ts@test.com',
      cartTotal: 100,
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    await markRecoveryEmailSent('ac-ts');

    expect(updatedItem).not.toBeNull();
    expect(updatedItem.recoveryEmailSentAt).toBeDefined();
  });

  it('recoveryEmailSentAt is a valid ISO 8601 timestamp string', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-iso',
      checkoutId: 'ck-iso',
      buyerEmail: 'iso@test.com',
      cartTotal: 200,
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    await markRecoveryEmailSent('ac-iso');

    const ts = updatedItem.recoveryEmailSentAt;
    expect(typeof ts).toBe('string');
    expect(new Date(ts).toString()).not.toBe('Invalid Date');
    // ISO 8601 strings contain 'T' and 'Z' or timezone offset
    expect(ts).toMatch(/T/);
  });

  it('recoveryEmailSentAt timestamp is current (within last 5 seconds)', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-recent-ts',
      checkoutId: 'ck-recent-ts',
      buyerEmail: 'rts@test.com',
      cartTotal: 300,
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'AbandonedCarts') updatedItem = item;
    });

    const before = Date.now();
    await markRecoveryEmailSent('ac-recent-ts');
    const after = Date.now();

    const ts = new Date(updatedItem.recoveryEmailSentAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });

  it('returns failure when cart ID does not exist (cannot record timestamp)', async () => {
    __seed('AbandonedCarts', []);
    const result = await markRecoveryEmailSent('no-such-id');
    expect(result.success).toBe(false);
  });
});
