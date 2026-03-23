/**
 * Tests for events.js — Wix platform event handlers
 * Covers abandoned cart wiring and inventory restock notifications.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as __resetData } from './__mocks__/wix-data.js';

// Mock the dynamic import of emailAutomation
const mockTriggerRestockNotifications = vi.fn().mockResolvedValue({ success: true, notified: 1 });
const mockTriggerWelcomeSequence = vi.fn().mockResolvedValue({ success: true, queued: 3 });
const mockTriggerPostPurchaseSequence = vi.fn().mockResolvedValue({ success: true, queued: 3 });
const mockCancelSequenceForOrder = vi.fn().mockResolvedValue({ success: true, cancelled: 1 });
vi.mock('backend/emailAutomation.web', () => ({
  triggerRestockNotifications: mockTriggerRestockNotifications,
  triggerWelcomeSequence: mockTriggerWelcomeSequence,
  triggerPostPurchaseSequence: mockTriggerPostPurchaseSequence,
  cancelSequenceForOrder: mockCancelSequenceForOrder,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
}));

const mockRecordChallengeProgress = vi.fn().mockResolvedValue({ success: true });
vi.mock('backend/gamificationEventReceiver.web', () => ({
  recordChallengeProgress: mockRecordChallengeProgress,
}));

import {
  wixEcom_onAbandonedCheckoutCreated,
  wixEcom_onAbandonedCheckoutRecovered,
  wixStores_onInventoryVariantUpdated,
  wixMembers_onMemberCreated,
  wixEcom_onOrderCreated,
  wixEcom_onOrderCanceled,
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

// ── wixMembers_onMemberCreated ──────────────────────────────────────

describe('wixMembers_onMemberCreated', () => {
  it('triggers welcome sequence with member email and name', async () => {
    await wixMembers_onMemberCreated({
      entity: {
        _id: 'member-1',
        loginEmail: 'alice@test.com',
        contactDetails: { firstName: 'Alice' },
      },
    });

    expect(mockTriggerWelcomeSequence).toHaveBeenCalledWith(
      'member-1',
      'alice@test.com',
      'Alice',
    );
  });

  it('falls back to contactDetails email when loginEmail missing', async () => {
    await wixMembers_onMemberCreated({
      entity: {
        _id: 'member-2',
        contactDetails: { emails: ['bob@test.com'], firstName: 'Bob' },
      },
    });

    expect(mockTriggerWelcomeSequence).toHaveBeenCalledWith(
      'member-2',
      'bob@test.com',
      'Bob',
    );
  });

  it('falls back to profile.nickname when firstName missing', async () => {
    await wixMembers_onMemberCreated({
      entity: {
        _id: 'member-3',
        loginEmail: 'carol@test.com',
        profile: { nickname: 'Carol' },
      },
    });

    expect(mockTriggerWelcomeSequence).toHaveBeenCalledWith(
      'member-3',
      'carol@test.com',
      'Carol',
    );
  });

  it('skips when email is empty', async () => {
    await wixMembers_onMemberCreated({
      entity: { _id: 'member-4' },
    });

    expect(mockTriggerWelcomeSequence).not.toHaveBeenCalled();
  });

  it('does not throw when triggerWelcomeSequence fails', async () => {
    mockTriggerWelcomeSequence.mockRejectedValueOnce(new Error('fail'));

    await expect(
      wixMembers_onMemberCreated({
        entity: { _id: 'm-err', loginEmail: 'err@test.com' },
      })
    ).resolves.not.toThrow();
  });
});

// ── wixEcom_onOrderCreated ──────────────────────────────────────────

describe('wixEcom_onOrderCreated', () => {
  it('triggers post-purchase sequence with order details', async () => {
    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-001',
        buyerInfo: { email: 'alice@test.com', contactId: 'c1' },
        billingInfo: { firstName: 'Alice' },
        priceSummary: { total: { amount: 899 } },
        lineItems: [
          { productName: { original: 'Eureka Futon' }, quantity: 1, price: { amount: 899 } },
        ],
      },
    });

    expect(mockTriggerPostPurchaseSequence).toHaveBeenCalledWith(
      'c1',
      'alice@test.com',
      'Alice',
      'ORD-001',
      899,
      [{ name: 'Eureka Futon', quantity: 1, price: 899 }],
    );
  });

  it('uses buyerInfo.firstName when billingInfo missing', async () => {
    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-002',
        buyerInfo: { email: 'bob@test.com', firstName: 'Bob', contactId: 'c2' },
        lineItems: [],
      },
    });

    expect(mockTriggerPostPurchaseSequence).toHaveBeenCalledWith(
      'c2', 'bob@test.com', 'Bob', 'ORD-002', 0, [],
    );
  });

  it('skips when buyer email is empty', async () => {
    await wixEcom_onOrderCreated({
      entity: { number: 'ORD-003', buyerInfo: {} },
    });

    expect(mockTriggerPostPurchaseSequence).not.toHaveBeenCalled();
  });

  it('handles totals.total fallback', async () => {
    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-004',
        buyerInfo: { email: 'x@test.com', contactId: 'c4' },
        totals: { total: 499 },
        lineItems: [],
      },
    });

    expect(mockTriggerPostPurchaseSequence).toHaveBeenCalledWith(
      'c4', 'x@test.com', '', 'ORD-004', 499, [],
    );
  });

  it('maps lineItems with name fallback', async () => {
    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-005',
        buyerInfo: { email: 'y@test.com', contactId: 'c5' },
        lineItems: [
          { name: 'Night Frame', quantity: 2, price: 299 },
        ],
      },
    });

    const callArgs = mockTriggerPostPurchaseSequence.mock.calls[0];
    expect(callArgs[5]).toEqual([{ name: 'Night Frame', quantity: 2, price: 299 }]);
  });

  it('does not throw when triggerPostPurchaseSequence fails', async () => {
    mockTriggerPostPurchaseSequence.mockRejectedValueOnce(new Error('fail'));

    await expect(
      wixEcom_onOrderCreated({
        entity: { number: 'ORD-ERR', buyerInfo: { email: 'err@test.com' }, lineItems: [] },
      })
    ).resolves.not.toThrow();
  });
});

// ── wixEcom_onOrderCanceled ─────────────────────────────────────────

describe('wixEcom_onOrderCanceled', () => {
  it('cancels pending email sequences for the order', async () => {
    await wixEcom_onOrderCanceled({
      entity: {
        number: 'ORD-001',
        buyerInfo: { email: 'alice@test.com' },
      },
    });

    expect(mockCancelSequenceForOrder).toHaveBeenCalledWith(
      'alice@test.com',
      'ORD-001',
    );
  });

  it('skips when buyer email is empty', async () => {
    await wixEcom_onOrderCanceled({
      entity: { number: 'ORD-002', buyerInfo: {} },
    });

    expect(mockCancelSequenceForOrder).not.toHaveBeenCalled();
  });

  it('does not throw when cancelSequenceForOrder fails', async () => {
    mockCancelSequenceForOrder.mockRejectedValueOnce(new Error('fail'));

    await expect(
      wixEcom_onOrderCanceled({
        entity: { number: 'ORD-ERR', buyerInfo: { email: 'err@test.com' } },
      })
    ).resolves.not.toThrow();
  });
});

// ── wixEcom_onOrderCreated — purchase challenge hookup ───────────────

describe('wixEcom_onOrderCreated — purchase challenge hookup', () => {
  it('calls recordChallengeProgress for each active ORDER_COMPLETE challenge when memberId present', async () => {
    __seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', conditionType: 'ORDER_COMPLETE', active: true, targetCount: 3 },
      { _id: 'ch-2', challengeId: 'ch-2', conditionType: 'ORDER_COMPLETE', active: true, targetCount: 5 },
      { _id: 'ch-3', challengeId: 'ch-3', conditionType: 'REVIEW', active: true, targetCount: 1 },
    ]);
    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-001',
        buyerInfo: { email: 'alice@test.com', contactId: 'c1', memberId: 'mem-1' },
        priceSummary: { total: { amount: 299 } },
        lineItems: [],
      },
    });
    expect(mockRecordChallengeProgress).toHaveBeenCalledTimes(2);
    expect(mockRecordChallengeProgress).toHaveBeenCalledWith({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(mockRecordChallengeProgress).toHaveBeenCalledWith({ memberId: 'mem-1', challengeId: 'ch-2' });
    expect(mockRecordChallengeProgress).not.toHaveBeenCalledWith({ memberId: 'mem-1', challengeId: 'ch-3' });
  });

  it('does not call recordChallengeProgress when no memberId on order', async () => {
    __seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', conditionType: 'ORDER_COMPLETE', active: true, targetCount: 3 },
    ]);
    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-002',
        buyerInfo: { email: 'bob@test.com', contactId: 'c2' },
        lineItems: [],
      },
    });
    expect(mockRecordChallengeProgress).not.toHaveBeenCalled();
  });

  it('does not throw when recordChallengeProgress fails', async () => {
    __seed('Challenges', [
      { _id: 'ch-1', challengeId: 'ch-1', conditionType: 'ORDER_COMPLETE', active: true, targetCount: 3 },
    ]);
    mockRecordChallengeProgress.mockRejectedValueOnce(new Error('fail'));
    await expect(
      wixEcom_onOrderCreated({
        entity: {
          number: 'ORD-ERR',
          buyerInfo: { email: 'err@test.com', memberId: 'mem-err' },
          lineItems: [],
        },
      })
    ).resolves.not.toThrow();
  });
});
