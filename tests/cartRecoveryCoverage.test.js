/**
 * cartRecoveryCoverage.test.js — CF-672y
 * Fills remaining coverage gaps in cartRecovery backend module.
 * Focuses on: catch blocks, parseLineItems non-array, event handler graceful fallbacks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, { __seed, __reset as resetData, __onInsert, __onUpdate } from 'wix-data';
import { __reset as resetMembers } from 'wix-members-backend';

import {
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
} from '../src/backend/cartRecovery.web.js';

beforeEach(() => {
  resetData();
  resetMembers();
});

describe('cartRecovery — error catch paths', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('getAbandonedCartStats returns zeros on query error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getAbandonedCartStats();
    expect(result.totalAbandoned).toBe(0);
    expect(result.totalRecovered).toBe(0);
    expect(result.recoveryRate).toBe(0);
    expect(result.recentCarts).toEqual([]);
  });

  it('getRecoverableCarts returns [] on query error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getRecoverableCarts();
    expect(result).toEqual([]);
  });

  it('markRecoveryEmailSent returns failure on get error', async () => {
    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB down'));
    const result = await markRecoveryEmailSent('some-id');
    expect(result.success).toBe(false);
  });

  it('parseLineItems returns [] for non-array non-string input (number)', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-num',
      checkoutId: 'ck-num',
      buyerEmail: 'num@test.com',
      buyerName: 'Num',
      cartTotal: 100,
      lineItems: 42,
      abandonedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);
    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    expect(result[0].lineItems).toEqual([]);
  });

  it('parseLineItems validates item structure', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-struct',
      checkoutId: 'ck-struct',
      buyerEmail: 'struct@test.com',
      buyerName: 'Struct',
      cartTotal: 100,
      lineItems: JSON.stringify([
        { productId: 'p1', name: 'Valid', quantity: 1, price: 100 },
        null,
        42,
        'string-item',
        { productId: 'p2', name: 'Also Valid', quantity: 2, price: 50 },
      ]),
      abandonedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);
    const result = await getRecoverableCarts();
    expect(result).toHaveLength(1);
    // null (falsy), 42 (number), and 'string-item' (string) all filtered by typeof === 'object' check
    expect(result[0].lineItems.length).toBe(2);
    expect(result[0].lineItems[0].name).toBe('Valid');
    expect(result[0].lineItems[1].name).toBe('Also Valid');
  });

  it('onAbandonedCheckoutCreated handles missing buyerInfo gracefully', async () => {
    __seed('AbandonedCarts', []);
    let insertedItem = null;
    __onInsert((col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'ck-nobuyerinfo',
        lineItems: [],
      },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.buyerEmail).toBe('');
    expect(insertedItem.buyerName).toBe('');
    expect(insertedItem.cartTotal).toBe(0);
  });

  it('onAbandonedCheckoutCreated uses event directly when no entity wrapper', async () => {
    __seed('AbandonedCarts', []);
    let insertedItem = null;
    __onInsert((col, item) => { insertedItem = item; });

    wixEcom_onAbandonedCheckoutCreated({
      _id: 'ck-direct-event',
      buyerInfo: { email: 'direct@test.com', firstName: 'Direct' },
      payNow: { total: { amount: 250 } },
      lineItems: [],
    });
    await new Promise(r => setTimeout(r, 50));
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.buyerEmail).toContain('direct');
  });

  it('onAbandonedCheckoutRecovered does nothing for empty checkoutId', async () => {
    let updateCount = 0;
    __onUpdate(() => { updateCount++; });
    wixEcom_onAbandonedCheckoutRecovered({ entity: { _id: '' } });
    await new Promise(r => setTimeout(r, 50));
    expect(updateCount).toBe(0);
  });

  it('markRecoveryEmailSent returns false for non-existent cart', async () => {
    __seed('AbandonedCarts', []);
    const result = await markRecoveryEmailSent('nonexistent-id');
    expect(result.success).toBe(false);
  });
});
