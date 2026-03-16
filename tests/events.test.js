/**
 * Tests for events.js — Wix platform event handlers
 * Covers abandoned cart wiring and inventory restock notifications.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as __resetData } from './__mocks__/wix-data.js';

// Mock the dynamic import of emailAutomation
const mockTriggerRestockNotifications = vi.fn().mockResolvedValue({ success: true, notified: 1 });
vi.mock('backend/emailAutomation.web', () => ({
  triggerRestockNotifications: mockTriggerRestockNotifications,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
}));

import {
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
  wixStores_onInventoryVariantUpdated,
} from '../src/backend/events.js';

beforeEach(() => {
  __resetData();
  vi.clearAllMocks();
});

// ── wixEcom_onAbandonedCheckoutCreated ──────────────────────────────

describe('wixEcom_onAbandonedCheckoutCreated', () => {
  it('inserts a record into AbandonedCarts', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('AbandonedCarts', []);

    await wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'checkout-1',
        buyerInfo: { email: 'alice@test.com', firstName: 'Alice' },
        priceSummary: { total: { amount: 499 } },
        lineItems: [
          { productName: { original: 'Eureka Futon' }, quantity: 1, price: { amount: 499 } },
        ],
      },
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].col).toBe('AbandonedCarts');
    expect(inserted[0].item.checkoutId).toBe('checkout-1');
    expect(inserted[0].item.buyerEmail).toBe('alice@test.com');
    expect(inserted[0].item.buyerName).toBe('Alice');
    expect(inserted[0].item.cartTotal).toBe(499);
    expect(inserted[0].item.status).toBe('abandoned');
    expect(inserted[0].item.recoveryEmailSent).toBe(false);
  });

  it('stores lineItems as JSON string', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('AbandonedCarts', []);

    await wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'checkout-2',
        buyerInfo: { email: 'bob@test.com' },
        lineItems: [
          { name: 'Item A', quantity: 2, price: 100 },
        ],
      },
    });

    const parsed = JSON.parse(inserted[0].item.lineItems);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Item A');
    expect(parsed[0].quantity).toBe(2);
  });

  it('skips if checkoutId is empty', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('AbandonedCarts', []);

    await wixEcom_onAbandonedCheckoutCreated({ entity: {} });
    expect(inserted).toHaveLength(0);
  });

  it('skips duplicate checkouts (idempotent)', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('AbandonedCarts', [{ checkoutId: 'checkout-dup', status: 'abandoned' }]);

    await wixEcom_onAbandonedCheckoutCreated({
      entity: { _id: 'checkout-dup', buyerInfo: { email: 'dup@test.com' } },
    });

    expect(inserted).toHaveLength(0);
  });

  it('handles missing buyer info gracefully', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    __seed('AbandonedCarts', []);

    await wixEcom_onAbandonedCheckoutCreated({
      entity: { _id: 'checkout-3', lineItems: [] },
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].item.buyerEmail).toBe('');
    expect(inserted[0].item.buyerName).toBe('');
    expect(inserted[0].item.cartTotal).toBe(0);
  });

  it('does not throw on error', async () => {
    // No seed = query will work but insert might fail
    __seed('AbandonedCarts', []);
    __onInsert(() => { throw new Error('DB error'); });

    await expect(
      wixEcom_onAbandonedCheckoutCreated({
        entity: { _id: 'checkout-err', buyerInfo: { email: 'err@test.com' } },
      })
    ).resolves.not.toThrow();
  });
});

// ── wixEcom_onAbandonedCheckoutRecovered ────────────────────────────

describe('wixEcom_onAbandonedCheckoutRecovered', () => {
  it('updates cart status to recovered', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));
    __seed('AbandonedCarts', [
      { _id: 'cart-1', checkoutId: 'checkout-r1', status: 'abandoned', recoveryEmailSent: false },
    ]);

    await wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-r1' },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].item.status).toBe('recovered');
  });

  it('skips if checkout not found in AbandonedCarts', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));
    __seed('AbandonedCarts', []);

    await wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-missing' },
    });

    expect(updated).toHaveLength(0);
  });

  it('skips if checkoutId is empty', async () => {
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));

    await wixEcom_onAbandonedCheckoutRecovered({ entity: {} });
    expect(updated).toHaveLength(0);
  });

  it('does not throw on error', async () => {
    __seed('AbandonedCarts', [
      { _id: 'cart-err', checkoutId: 'checkout-err', status: 'abandoned' },
    ]);
    __onUpdate(() => { throw new Error('DB error'); });

    await expect(
      wixEcom_onAbandonedCheckoutRecovered({ entity: { _id: 'checkout-err' } })
    ).resolves.not.toThrow();
  });
});

// ── wixStores_onInventoryVariantUpdated ─────────────────────────────

describe('wixStores_onInventoryVariantUpdated', () => {
  it('triggers restock notifications when quantity goes 0 → positive', async () => {
    __seed('BackInStockSignups', [
      { _id: 'sub-1', email: 'subscriber@test.com', productId: 'prod-1', productName: 'Futon', notified: false },
    ]);

    await wixStores_onInventoryVariantUpdated({
      entity: { productId: 'prod-1', variantId: 'var-1', quantity: 5 },
      previousEntity: { quantity: 0 },
    });

    expect(mockTriggerRestockNotifications).toHaveBeenCalledWith(
      'prod-1',
      expect.arrayContaining([
        expect.objectContaining({ email: 'subscriber@test.com', productId: 'prod-1' }),
      ]),
    );
  });

  it('does not trigger when old quantity was positive', async () => {
    __seed('BackInStockSignups', [
      { _id: 'sub-2', email: 'sub@test.com', productId: 'prod-2', notified: false },
    ]);

    await wixStores_onInventoryVariantUpdated({
      entity: { productId: 'prod-2', quantity: 10 },
      previousEntity: { quantity: 3 },
    });

    expect(mockTriggerRestockNotifications).not.toHaveBeenCalled();
  });

  it('does not trigger when new quantity is still 0', async () => {
    __seed('BackInStockSignups', []);

    await wixStores_onInventoryVariantUpdated({
      entity: { productId: 'prod-3', quantity: 0 },
      previousEntity: { quantity: 0 },
    });

    expect(mockTriggerRestockNotifications).not.toHaveBeenCalled();
  });

  it('does not trigger when no subscribers exist', async () => {
    __seed('BackInStockSignups', []);

    await wixStores_onInventoryVariantUpdated({
      entity: { productId: 'prod-no-subs', quantity: 5 },
      previousEntity: { quantity: 0 },
    });

    expect(mockTriggerRestockNotifications).not.toHaveBeenCalled();
  });

  it('skips when productId is empty', async () => {
    await wixStores_onInventoryVariantUpdated({
      entity: { productId: '', quantity: 5 },
      previousEntity: { quantity: 0 },
    });

    expect(mockTriggerRestockNotifications).not.toHaveBeenCalled();
  });

  it('does not throw on error', async () => {
    __seed('BackInStockSignups', [
      { _id: 'sub-err', email: 'err@test.com', productId: 'prod-err', notified: false },
    ]);
    mockTriggerRestockNotifications.mockRejectedValueOnce(new Error('fail'));

    await expect(
      wixStores_onInventoryVariantUpdated({
        entity: { productId: 'prod-err', quantity: 5 },
        previousEntity: { quantity: 0 },
      })
    ).resolves.not.toThrow();
  });
});
