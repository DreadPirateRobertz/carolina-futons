/**
 * eventsErrorHandling.test.js — Tests for hardened error handling in event handlers.
 * CF-bntg: Fix catch-and-swallow patterns, add structured logging + dead-letter queue.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as __resetData } from './__mocks__/wix-data.js';

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

// ── Structured Error Logging ─────────────────────────────────────────

describe('wixEcom_onAbandonedCheckoutCreated — structured error logging', () => {
  it('logs checkoutId and buyerEmail on insert failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __seed('AbandonedCarts', []);
    __onInsert(() => { throw new Error('DB insert failed'); });

    await wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'checkout-log-1',
        buyerInfo: { email: 'alice@test.com' },
      },
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logArgs = consoleSpy.mock.calls[0].join(' ');
    expect(logArgs).toContain('checkout-log-1');
    expect(logArgs).toContain('alice@test.com');
    consoleSpy.mockRestore();
  });

  it('writes to FailedEvents dead-letter queue on insert failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inserted = [];
    let insertCount = 0;
    __seed('AbandonedCarts', []);
    __onInsert((col, item) => {
      insertCount++;
      if (col === 'AbandonedCarts') throw new Error('DB insert failed');
      inserted.push({ col, item });
    });

    await wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'checkout-dl-1',
        buyerInfo: { email: 'dl@test.com' },
      },
    });

    const deadLetterInserts = inserted.filter(i => i.col === 'FailedEvents');
    expect(deadLetterInserts).toHaveLength(1);
    expect(deadLetterInserts[0].item.handler).toBe('wixEcom_onAbandonedCheckoutCreated');
    expect(deadLetterInserts[0].item.checkoutId).toBe('checkout-dl-1');
    expect(deadLetterInserts[0].item.error).toContain('DB insert failed');

    vi.restoreAllMocks();
  });
});

describe('wixEcom_onAbandonedCheckoutRecovered — structured error logging', () => {
  it('logs checkoutId on update failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __seed('AbandonedCarts', [
      { _id: 'cart-r1', checkoutId: 'checkout-r-log', status: 'abandoned' },
    ]);
    __onUpdate(() => { throw new Error('DB update failed'); });

    await wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-r-log' },
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logArgs = consoleSpy.mock.calls[0].join(' ');
    expect(logArgs).toContain('checkout-r-log');
    consoleSpy.mockRestore();
  });

  it('writes to FailedEvents on update failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inserted = [];
    __seed('AbandonedCarts', [
      { _id: 'cart-r2', checkoutId: 'checkout-r-dl', status: 'abandoned' },
    ]);
    __onUpdate(() => { throw new Error('DB update failed'); });
    __onInsert((col, item) => inserted.push({ col, item }));

    await wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-r-dl' },
    });

    const deadLetterInserts = inserted.filter(i => i.col === 'FailedEvents');
    expect(deadLetterInserts).toHaveLength(1);
    expect(deadLetterInserts[0].item.handler).toBe('wixEcom_onAbandonedCheckoutRecovered');
    expect(deadLetterInserts[0].item.checkoutId).toBe('checkout-r-dl');
    expect(deadLetterInserts[0].item.severity).toBe('CRITICAL');
  });

  it('marks recovery failure as CRITICAL severity (double-email risk)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inserted = [];
    __seed('AbandonedCarts', [
      { _id: 'cart-crit', checkoutId: 'checkout-crit', status: 'abandoned', buyerEmail: 'crit@test.com' },
    ]);
    __onUpdate(() => { throw new Error('DB down'); });
    __onInsert((col, item) => inserted.push({ col, item }));

    await wixEcom_onAbandonedCheckoutRecovered({
      entity: { _id: 'checkout-crit' },
    });

    const dl = inserted.find(i => i.col === 'FailedEvents');
    expect(dl).toBeDefined();
    expect(dl.item.severity).toBe('CRITICAL');
    expect(dl.item.impact).toContain('recovery emails');
    vi.restoreAllMocks();
  });
});

describe('wixStores_onInventoryVariantUpdated — structured error logging', () => {
  it('logs productId on restock notification failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __seed('BackInStockSignups', [
      { _id: 'sub-1', email: 's@test.com', productId: 'prod-log-1', notified: false },
    ]);
    mockTriggerRestockNotifications.mockRejectedValueOnce(new Error('Email service down'));

    await wixStores_onInventoryVariantUpdated({
      entity: { productId: 'prod-log-1', quantity: 5 },
      previousEntity: { quantity: 0 },
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logArgs = consoleSpy.mock.calls[0].join(' ');
    expect(logArgs).toContain('prod-log-1');
    consoleSpy.mockRestore();
  });

  it('writes to FailedEvents on restock notification failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inserted = [];
    __seed('BackInStockSignups', [
      { _id: 'sub-dl', email: 'dl@test.com', productId: 'prod-dl-1', notified: false },
    ]);
    mockTriggerRestockNotifications.mockRejectedValueOnce(new Error('Queue failed'));
    __onInsert((col, item) => inserted.push({ col, item }));

    await wixStores_onInventoryVariantUpdated({
      entity: { productId: 'prod-dl-1', quantity: 5 },
      previousEntity: { quantity: 0 },
    });

    const deadLetterInserts = inserted.filter(i => i.col === 'FailedEvents');
    expect(deadLetterInserts).toHaveLength(1);
    expect(deadLetterInserts[0].item.handler).toBe('wixStores_onInventoryVariantUpdated');
    expect(deadLetterInserts[0].item.productId).toBe('prod-dl-1');
    vi.restoreAllMocks();
  });
});

// ── Dead-letter queue does not break handler on its own failure ──────

describe('dead-letter queue resilience', () => {
  it('handler still completes if FailedEvents insert also fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    __seed('AbandonedCarts', []);
    __onInsert(() => { throw new Error('All DB writes fail'); });

    await expect(
      wixEcom_onAbandonedCheckoutCreated({
        entity: { _id: 'checkout-double-fail', buyerInfo: { email: 'x@test.com' } },
      })
    ).resolves.not.toThrow();

    vi.restoreAllMocks();
  });
});
