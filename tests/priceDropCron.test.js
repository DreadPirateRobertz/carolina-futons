/**
 * Tests for priceDropCron.web.js — detectPriceDrops + queuePriceDropNotifications
 * (cf-zubx)
 *
 * Covers:
 * - No products / empty catalog
 * - No existing price history → no queue entry on first run
 * - Price unchanged → no queue entry
 * - Price increased → no queue entry
 * - Price drop below threshold (<5%) → no queue entry
 * - Price drop at threshold (exactly 5%) → queue entry created
 * - Price drop above threshold → queue entry created
 * - Dedup: second drop within 24h window → no duplicate queue entry
 * - Dedup: drop outside 24h window → new queue entry allowed
 * - Wishlist notifications sent to all members who wishlisted the product
 * - Members with no memberId skipped
 * - Products with null price skipped
 * - Products scanned count is correct
 * - queuePriceDropNotifications: direct call behavior
 * - Error resilience: wixData failures return success:false
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setQueryError,
  __onInsert,
} from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

import {
  detectPriceDrops,
  queuePriceDropNotifications,
  _MIN_DROP_FRACTION,
  _DEDUP_WINDOW_MS,
  _PRICE_DROP_EMAIL_TEMPLATE,
  _emailPriceAlertSubscribers,
} from '../src/backend/priceDropCron.web.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const product = (overrides = {}) => ({
  _id: 'prod-a',
  name: 'Monterey Futon Frame',
  price: 499,
  ...overrides,
});

const priceRecord = (productId, price, msAgo = 0) => ({
  _id: `pr-${productId}`,
  productId,
  price,
  recordedAt: new Date(Date.now() - msAgo),
});

const wishlistItem = (memberId, productId, name = 'Monterey Futon Frame') => ({
  _id: `wl-${memberId}-${productId}`,
  memberId,
  productId,
  name,
});

const queueEntry = (productId, msAgo = 0) => ({
  _id: `pdq-${productId}`,
  productId,
  oldPrice: 499,
  newPrice: 450,
  pctDrop: 0.10,
  detectedAt: new Date(Date.now() - msAgo),
});

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  __setMember({ _id: 'system' });
  __setRoles([{ title: 'Admin' }]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════════

describe('module constants', () => {
  it('MIN_DROP_FRACTION is 0.05 (5%)', () => {
    expect(_MIN_DROP_FRACTION).toBe(0.05);
  });

  it('DEDUP_WINDOW_MS is 24 hours', () => {
    expect(_DEDUP_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Empty catalog
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — empty catalog', () => {
  it('returns success with zero counts', async () => {
    __seed('Stores/Products', []);
    const result = await detectPriceDrops();
    expect(result.success).toBe(true);
    expect(result.productsScanned).toBe(0);
    expect(result.dropsDetected).toBe(0);
    expect(result.notificationsSent).toBe(0);
  });

  it('does not insert any queue entries', async () => {
    __seed('Stores/Products', []);
    await detectPriceDrops();
    expect(__getInserted('PriceDropQueue')).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// First run — no price history
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — no existing price history', () => {
  it('does not queue a drop on the first run (no previous price to compare)', async () => {
    __seed('Stores/Products', [product()]);
    __seed('ProductPriceHistory', []);

    const result = await detectPriceDrops();
    expect(result.success).toBe(true);
    expect(result.dropsDetected).toBe(0);
    expect(__getInserted('PriceDropQueue')).toHaveLength(0);
  });

  it('creates a price history record for next run', async () => {
    __seed('Stores/Products', [product({ price: 499 })]);
    __seed('ProductPriceHistory', []);

    await detectPriceDrops();
    const history = __getInserted('ProductPriceHistory');
    expect(history).toHaveLength(1);
    expect(history[0].productId).toBe('prod-a');
    expect(history[0].price).toBe(499);
    expect(history[0].recordedAt).toBeInstanceOf(Date);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Price unchanged
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — price unchanged', () => {
  it('does not queue a drop', async () => {
    __seed('Stores/Products', [product({ price: 499 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 499, 25 * 60 * 60 * 1000)]);

    const result = await detectPriceDrops();
    expect(result.dropsDetected).toBe(0);
    expect(__getInserted('PriceDropQueue')).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Price increased
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — price increased', () => {
  it('does not queue a drop when price goes up', async () => {
    __seed('Stores/Products', [product({ price: 549 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 499, 25 * 60 * 60 * 1000)]);

    const result = await detectPriceDrops();
    expect(result.dropsDetected).toBe(0);
    expect(__getInserted('PriceDropQueue')).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Drop below threshold
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — drop below 5% threshold', () => {
  it('does not queue a drop for a 4% price reduction', async () => {
    const oldPrice = 500;
    const newPrice = 480; // 4% drop
    __seed('Stores/Products', [product({ price: newPrice })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', oldPrice, 25 * 60 * 60 * 1000)]);

    const result = await detectPriceDrops();
    expect(result.dropsDetected).toBe(0);
    expect(__getInserted('PriceDropQueue')).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Drop at threshold (exactly 5%)
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — drop exactly at 5% threshold', () => {
  it('queues the drop', async () => {
    const oldPrice = 500;
    const newPrice = 475; // exactly 5%
    __seed('Stores/Products', [product({ price: newPrice })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', oldPrice, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', []);

    const result = await detectPriceDrops();
    expect(result.dropsDetected).toBe(1);

    const queued = __getInserted('PriceDropQueue');
    expect(queued).toHaveLength(1);
    expect(queued[0].productId).toBe('prod-a');
    expect(queued[0].oldPrice).toBe(oldPrice);
    expect(queued[0].newPrice).toBe(newPrice);
    expect(queued[0].pctDrop).toBeCloseTo(0.05, 2);
    expect(queued[0].detectedAt).toBeInstanceOf(Date);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Drop above threshold
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — significant price drop', () => {
  it('queues the drop and returns correct counts', async () => {
    const oldPrice = 599;
    const newPrice = 499; // ~16.7% drop
    __seed('Stores/Products', [product({ price: newPrice })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', oldPrice, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', []);

    const result = await detectPriceDrops();
    expect(result.success).toBe(true);
    expect(result.productsScanned).toBe(1);
    expect(result.dropsDetected).toBe(1);
  });

  it('queue entry has all required fields', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', []);

    await detectPriceDrops();
    const entry = __getInserted('PriceDropQueue')[0];
    expect(entry).toMatchObject({
      productId: 'prod-a',
      oldPrice: 550,
      newPrice: 450,
    });
    expect(typeof entry.pctDrop).toBe('number');
    expect(entry.detectedAt).toBeInstanceOf(Date);
  });

  it('pctDrop is stored as a fraction (not a percentage)', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 500, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', []);

    await detectPriceDrops();
    const entry = __getInserted('PriceDropQueue')[0];
    // 10% drop stored as 0.10, not 10
    expect(entry.pctDrop).toBeGreaterThan(0);
    expect(entry.pctDrop).toBeLessThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Dedup within 24h window
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — dedup within 24h window', () => {
  it('does not insert a duplicate entry when one exists in the dedup window', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    // Existing queue entry from 2 hours ago (within 24h window)
    __seed('PriceDropQueue', [queueEntry('prod-a', 2 * 60 * 60 * 1000)]);
    __seed('Wishlist', []);

    const result = await detectPriceDrops();
    expect(result.dropsDetected).toBe(0);
    // __getInserted returns seeded items too; count stays at 1 (no new insert)
    expect(__getInserted('PriceDropQueue')).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Dedup outside 24h window
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — drop after dedup window expired', () => {
  it('allows a new entry after the 24h dedup window', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    // Existing queue entry from 25 hours ago (outside 24h window)
    __seed('PriceDropQueue', [queueEntry('prod-a', 25 * 60 * 60 * 1000)]);
    __seed('Wishlist', []);

    const result = await detectPriceDrops();
    expect(result.dropsDetected).toBe(1);
    // __getInserted returns seeded + newly inserted items (2 total)
    expect(__getInserted('PriceDropQueue')).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Multiple products
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — multiple products', () => {
  it('correctly counts scanned and dropped products', async () => {
    __seed('Stores/Products', [
      product({ _id: 'prod-1', price: 450 }), // drop from 550 (>5%)
      product({ _id: 'prod-2', price: 499 }), // no change
      product({ _id: 'prod-3', price: 399 }), // drop from 410 (2.7% — below threshold)
    ]);
    __seed('ProductPriceHistory', [
      priceRecord('prod-1', 550, 25 * 60 * 60 * 1000),
      priceRecord('prod-2', 499, 25 * 60 * 60 * 1000),
      priceRecord('prod-3', 410, 25 * 60 * 60 * 1000),
    ]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', []);

    const result = await detectPriceDrops();
    expect(result.productsScanned).toBe(3);
    expect(result.dropsDetected).toBe(1); // only prod-1
    expect(__getInserted('PriceDropQueue')).toHaveLength(1);
    expect(__getInserted('PriceDropQueue')[0].productId).toBe('prod-1');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Product with null price skipped
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — null price products', () => {
  it('skips products with null price', async () => {
    __seed('Stores/Products', [
      product({ _id: 'prod-cfp', price: null, name: 'Call for Price Item' }),
    ]);
    __seed('ProductPriceHistory', []);

    const result = await detectPriceDrops();
    expect(result.productsScanned).toBe(0);
    expect(result.dropsDetected).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Wishlist notifications
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — wishlist notifications', () => {
  it('sends notifications to all wishlisted members', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', [
      wishlistItem('member-1', 'prod-a'),
      wishlistItem('member-2', 'prod-a'),
      wishlistItem('member-3', 'prod-a'),
    ]);

    const result = await detectPriceDrops();
    expect(result.notificationsSent).toBe(3);
    expect(__getInserted('Notifications')).toHaveLength(3);
  });

  it('notification contains required fields', async () => {
    __seed('Stores/Products', [product({ price: 450, name: 'Monterey Futon Frame' })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', [wishlistItem('member-1', 'prod-a', 'Monterey Futon Frame')]);

    await detectPriceDrops();
    const notif = __getInserted('Notifications')[0];
    expect(notif.memberId).toBe('member-1');
    expect(notif.type).toBe('price_drop');
    expect(notif.message).toContain('Price drop');
    expect(notif.productId).toBe('prod-a');
    expect(notif.oldPrice).toBe(550);
    expect(notif.newPrice).toBe(450);
    expect(typeof notif.pctDrop).toBe('number');
    expect(notif.read).toBe(false);
    expect(notif.createdAt).toBeInstanceOf(Date);
  });

  it('skips wishlist items without memberId', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', [
      { _id: 'wl-anon', memberId: null, productId: 'prod-a', name: 'Item' },
      wishlistItem('member-1', 'prod-a'),
    ]);

    const result = await detectPriceDrops();
    expect(result.notificationsSent).toBe(1); // only member-1
  });

  it('sends no notifications when product has no wishlist entries', async () => {
    __seed('Stores/Products', [product({ price: 450 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 550, 25 * 60 * 60 * 1000)]);
    __seed('PriceDropQueue', []);
    __seed('Wishlist', []); // nobody wishlisted prod-a

    const result = await detectPriceDrops();
    expect(result.notificationsSent).toBe(0);
    expect(__getInserted('Notifications')).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// queuePriceDropNotifications — direct call
// ═════════════════════════════════════════════════════════════════════════════

describe('queuePriceDropNotifications', () => {
  it('sends notifications to wishlisted members', async () => {
    __seed('Wishlist', [
      wishlistItem('member-1', 'prod-x'),
      wishlistItem('member-2', 'prod-x'),
    ]);

    const result = await queuePriceDropNotifications('prod-x', 500, 450);
    expect(result.success).toBe(true);
    expect(result.notificationsSent).toBe(2);
  });

  it('returns success:false for invalid input — missing productId', async () => {
    const result = await queuePriceDropNotifications('', 500, 450);
    expect(result.success).toBe(false);
    expect(result.notificationsSent).toBe(0);
  });

  it('returns success:false when oldPrice is zero', async () => {
    const result = await queuePriceDropNotifications('prod-x', 0, 450);
    expect(result.success).toBe(false);
  });

  it('returns success:false when prices are non-finite', async () => {
    const result = await queuePriceDropNotifications('prod-x', NaN, 450);
    expect(result.success).toBe(false);
  });

  it('returns 0 notifications when no wishlist entries exist', async () => {
    __seed('Wishlist', []);
    const result = await queuePriceDropNotifications('prod-x', 500, 450);
    expect(result.success).toBe(true);
    expect(result.notificationsSent).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error resilience
// ═════════════════════════════════════════════════════════════════════════════

describe('detectPriceDrops — error resilience', () => {
  it('returns success:false when Stores/Products query fails', async () => {
    __setQueryError('Stores/Products', new Error('Database unavailable'));

    const result = await detectPriceDrops();
    expect(result.success).toBe(false);
    expect(result.dropsDetected).toBe(0);
  });

  it('logs an error message on failure', async () => {
    __setQueryError('Stores/Products', new Error('boom'));

    await detectPriceDrops();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[priceDropCron] detectPriceDrops failed:'),
      expect.any(String)
    );
  });
});

describe('queuePriceDropNotifications — error resilience', () => {
  it('returns success:false when wixData throws', async () => {
    __setQueryError('Wishlist', new Error('Network error'));

    const result = await queuePriceDropNotifications('prod-x', 500, 450);
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// emailPriceAlertSubscribers (CF-hwr1.3)
// ═════════════════════════════════════════════════════════════════════════════

// ── Fixtures ──────────────────────────────────────────────────────────────────

const alertSub = (email, productId = 'prod-a', active = true) => ({
  _id: `pa-${email}`,
  productId,
  email,
  active,
  subscribedAt: new Date(Date.now() - 60_000),
});

const emailQueueEntry = (email, productId, msAgo = 0) => ({
  _id: `eq-${email}-${productId}`,
  sequenceType: 'price_drop_alert',
  recipientEmail: email,
  checkoutId: productId,
  createdAt: new Date(Date.now() - msAgo),
});

describe('emailPriceAlertSubscribers — no subscribers', () => {
  it('returns 0 when no active subscribers exist', async () => {
    __seed('PriceAlerts', []);
    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(0);
  });

  it('returns 0 when all subscribers are inactive', async () => {
    __seed('PriceAlerts', [alertSub('a@example.com', 'prod-a', false)]);
    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(0);
  });
});

describe('emailPriceAlertSubscribers — queues emails', () => {
  it('inserts one EmailQueue entry per active subscriber', async () => {
    __seed('PriceAlerts', [
      alertSub('alice@example.com'),
      alertSub('bob@example.com'),
    ]);

    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(2);
  });

  it('sets correct templateId and sequenceType', async () => {
    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });
    __seed('PriceAlerts', [alertSub('alice@example.com')]);

    await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);

    expect(captured).toHaveLength(1);
    expect(captured[0].templateId).toBe(_PRICE_DROP_EMAIL_TEMPLATE);
    expect(captured[0].sequenceType).toBe('price_drop_alert');
    expect(captured[0].sequenceStep).toBe(1);
    expect(captured[0].status).toBe('pending');
  });

  it('sets correct email variables: newPrice, oldPrice, savings, savingsPct, pdpUrl', async () => {
    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });
    __seed('PriceAlerts', [alertSub('alice@example.com')]);

    await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 500, 450, 0.10);

    expect(captured[0].variables.oldPrice).toBe('500.00');
    expect(captured[0].variables.newPrice).toBe('450.00');
    expect(captured[0].variables.savings).toBe('50.00');
    expect(captured[0].variables.savingsPct).toBe('10');
    expect(captured[0].variables.productName).toBe('Monterey Futon');
    expect(captured[0].variables.pdpUrl).toBe('/product-page/monterey-futon');
  });

  it('falls back to productId in pdpUrl when slug is empty', async () => {
    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });
    __seed('PriceAlerts', [alertSub('alice@example.com')]);

    await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', '', 500, 450, 0.10);

    expect(captured[0].variables.pdpUrl).toBe('/product-page/prod-a');
  });

  it('uses productId as checkoutId dedup key', async () => {
    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });
    __seed('PriceAlerts', [alertSub('alice@example.com')]);

    await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);

    expect(captured[0].checkoutId).toBe('prod-a');
  });

  it('falls back to generic product name when name is empty', async () => {
    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });
    __seed('PriceAlerts', [alertSub('alice@example.com')]);

    await _emailPriceAlertSubscribers('prod-a', '', 'monterey-futon', 499, 449, 0.10);

    expect(captured[0].variables.productName).toBe('A product you saved');
  });
});

describe('emailPriceAlertSubscribers — deduplication', () => {
  it('skips subscriber already emailed within 24h window', async () => {
    __seed('PriceAlerts', [alertSub('alice@example.com')]);
    __seed('EmailQueue', [emailQueueEntry('alice@example.com', 'prod-a', 60_000)]); // 1 min ago

    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });

    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(0);
    expect(captured).toHaveLength(0);
  });

  it('allows email outside 24h window', async () => {
    const beyond24h = _DEDUP_WINDOW_MS + 60_000; // 1 min past window
    __seed('PriceAlerts', [alertSub('alice@example.com')]);
    __seed('EmailQueue', [emailQueueEntry('alice@example.com', 'prod-a', beyond24h)]);

    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(1);
  });

  it('sends to non-deduped subscriber when another is deduped', async () => {
    __seed('PriceAlerts', [
      alertSub('alice@example.com'),
      alertSub('bob@example.com'),
    ]);
    __seed('EmailQueue', [emailQueueEntry('alice@example.com', 'prod-a', 60_000)]);

    const captured = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') captured.push(item); });

    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(1);

    expect(captured[0].recipientEmail).toBe('bob@example.com');
  });

  it('dedup is scoped to productId — different product not suppressed', async () => {
    __seed('PriceAlerts', [alertSub('alice@example.com', 'prod-b')]);
    __seed('EmailQueue', [emailQueueEntry('alice@example.com', 'prod-a', 60_000)]); // different productId

    const count = await _emailPriceAlertSubscribers('prod-b', 'Eureka Futon', 'eureka-futon', 699, 629, 0.10);
    expect(count).toBe(1);
  });
});

describe('emailPriceAlertSubscribers — skips invalid entries', () => {
  it('skips subscriber with missing email field', async () => {
    __seed('PriceAlerts', [{ _id: 'pa-1', productId: 'prod-a', active: true, email: '' }]);

    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(0);
  });
});

describe('emailPriceAlertSubscribers — error resilience', () => {
  it('continues processing other subscribers if one insert fails', async () => {
    __seed('PriceAlerts', [
      alertSub('fail@example.com'),
      alertSub('success@example.com'),
    ]);

    let callCount = 0;
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') {
        callCount++;
        if (callCount === 1) throw new Error('insert failed');
      }
    });

    const count = await _emailPriceAlertSubscribers('prod-a', 'Monterey Futon', 'monterey-futon', 499, 449, 0.10);
    expect(count).toBe(1);
  });
});

describe('detectPriceDrops — emailsQueued integration', () => {
  it('increments emailsQueued when subscribers exist for a dropped product', async () => {
    __seed('Stores/Products', [product({ price: 449, slug: 'monterey-futon' })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 499, 25 * 60 * 60 * 1000)]);
    __seed('PriceAlerts', [alertSub('alice@example.com', 'prod-a')]);

    const result = await detectPriceDrops();
    expect(result.success).toBe(true);
    expect(result.emailsQueued).toBe(1);
  });

  it('emailsQueued is 0 when no subscribers exist', async () => {
    __seed('Stores/Products', [product({ slug: 'monterey-futon' })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 499, 25 * 60 * 60 * 1000)]);
    __seed('PriceAlerts', []);

    const result = await detectPriceDrops();
    expect(result.emailsQueued).toBe(0);
  });

  it('emailsQueued is 0 when no price drop detected', async () => {
    __seed('Stores/Products', [product({ price: 499 })]);
    __seed('ProductPriceHistory', [priceRecord('prod-a', 449, 25 * 60 * 60 * 1000)]); // price went UP
    __seed('PriceAlerts', [alertSub('alice@example.com', 'prod-a')]);

    const result = await detectPriceDrops();
    expect(result.emailsQueued).toBe(0);
  });

  it('result includes emailsQueued:0 on total failure', async () => {
    __setQueryError('Stores/Products', new Error('boom'));
    const result = await detectPriceDrops();
    expect(result.emailsQueued).toBe(0);
  });
});
