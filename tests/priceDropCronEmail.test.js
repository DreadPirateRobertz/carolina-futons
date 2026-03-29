/**
 * Tests for CF-hwr1.3: priceDropCron subscriber email notifications.
 * Covers emailSubscribers helper and integration through detectPriceDrops.
 *
 * CF-hwr1.3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
} from 'wix-data';

import {
  detectPriceDrops,
  _emailSubscribers,
  _PRICE_DROP_EMAIL_TEMPLATE,
  _SENT_PRICE_DROP_ALERTS_COLLECTION,
  _DEDUP_WINDOW_MS,
} from '../src/backend/priceDropCron.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return { _id: 'prod-1', name: 'Monterey Futon Frame', price: 499, ...overrides };
}

function makePriceRecord(price, msAgo = 100) {
  return {
    _id: 'pr-1',
    productId: 'prod-1',
    price,
    recordedAt: new Date(Date.now() - msAgo),
  };
}

function makeAlert(email, active = true) {
  return {
    _id: `alert-${email}`,
    productId: 'prod-1',
    email,
    active,
    subscribedAt: new Date(),
  };
}

beforeEach(() => {
  __reset();
  __seed('Stores/Products', []);
  __seed('ProductPriceHistory', []);
  __seed('PriceDropQueue', []);
  __seed('Wishlist', []);
  __seed('Notifications', []);
  __seed('PriceAlerts', []);
  __seed('EmailQueue', []);
  __seed('SentPriceDropAlerts', []);
});

// ── _emailSubscribers unit tests ──────────────────────────────────────

describe('_emailSubscribers', () => {
  it('queues an email for each active subscriber', async () => {
    __seed('PriceAlerts', [makeAlert('alice@example.com'), makeAlert('bob@example.com')]);

    await _emailSubscribers('prod-1', 'Monterey Frame', 499, 449, 0.10);

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(2);
    const emails = queued.map(q => q.recipientEmail);
    expect(emails).toContain('alice@example.com');
    expect(emails).toContain('bob@example.com');
  });

  it('uses correct template ID', async () => {
    __seed('PriceAlerts', [makeAlert('test@example.com')]);
    await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);
    const queued = __getInserted('EmailQueue');
    expect(queued[0].templateId).toBe(_PRICE_DROP_EMAIL_TEMPLATE);
    expect(queued[0].templateId).toBe('price_drop_alert');
  });

  it('includes correct variables in email', async () => {
    __seed('PriceAlerts', [makeAlert('hal@example.com')]);
    await _emailSubscribers('prod-1', 'Monterey Futon Frame', 499, 449, 0.10);
    const queued = __getInserted('EmailQueue');
    const vars = queued[0].variables;
    expect(vars.productName).toBe('Monterey Futon Frame');
    expect(vars.oldPrice).toBe('499.00');
    expect(vars.newPrice).toBe('449.00');
    expect(vars.savings).toBe('50.00');
    expect(vars.pctDrop).toBe('10');
    expect(vars.pdpUrl).toContain('prod-1');
  });

  it('records dedup entry in SentPriceDropAlerts', async () => {
    __seed('PriceAlerts', [makeAlert('sub@example.com')]);
    await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);
    const sent = __getInserted('SentPriceDropAlerts');
    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe('sub@example.com');
    expect(sent[0].productId).toBe('prod-1');
  });

  it('skips subscriber already emailed within 24h window', async () => {
    __seed('PriceAlerts', [makeAlert('repeat@example.com')]);
    __seed('SentPriceDropAlerts', [{
      _id: 'sa-1',
      productId: 'prod-1',
      email: 'repeat@example.com',
      sentAt: new Date(Date.now() - 1000), // 1 second ago — within window
    }]);

    await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(0);
  });

  it('sends again after 24h window has expired', async () => {
    __seed('PriceAlerts', [makeAlert('old@example.com')]);
    __seed('SentPriceDropAlerts', [{
      _id: 'sa-2',
      productId: 'prod-1',
      email: 'old@example.com',
      sentAt: new Date(Date.now() - (_DEDUP_WINDOW_MS + 1000)), // outside window
    }]);

    await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(1);
  });

  it('skips inactive subscribers', async () => {
    __seed('PriceAlerts', [makeAlert('inactive@example.com', false)]);
    await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);
    expect(__getInserted('EmailQueue')).toHaveLength(0);
  });

  it('returns 0 when no subscribers', async () => {
    const count = await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);
    expect(count).toBe(0);
  });

  it('sets email status to pending', async () => {
    __seed('PriceAlerts', [makeAlert('check@example.com')]);
    await _emailSubscribers('prod-1', 'Frame', 499, 449, 0.10);
    const queued = __getInserted('EmailQueue');
    expect(queued[0].status).toBe('pending');
  });
});

// ── Integration: detectPriceDrops queues subscriber emails ────────────

describe('detectPriceDrops — subscriber email integration', () => {
  it('queues subscriber email when a >=5% drop is detected', async () => {
    __seed('Stores/Products', [makeProduct({ price: 449 })]);
    __seed('ProductPriceHistory', [makePriceRecord(499)]);
    __seed('PriceAlerts', [makeAlert('watcher@example.com')]);

    await detectPriceDrops();

    const queued = __getInserted('EmailQueue');
    expect(queued.some(q => q.recipientEmail === 'watcher@example.com')).toBe(true);
  });

  it('does NOT queue subscriber email when price drop is below 5%', async () => {
    // 1% drop — below threshold
    __seed('Stores/Products', [makeProduct({ price: 494 })]);
    __seed('ProductPriceHistory', [makePriceRecord(499)]);
    __seed('PriceAlerts', [makeAlert('watcher@example.com')]);

    await detectPriceDrops();

    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(0);
  });

  it('does NOT queue subscriber email when price unchanged', async () => {
    __seed('Stores/Products', [makeProduct({ price: 499 })]);
    __seed('ProductPriceHistory', [makePriceRecord(499)]);
    __seed('PriceAlerts', [makeAlert('watcher@example.com')]);

    await detectPriceDrops();

    expect(__getInserted('EmailQueue')).toHaveLength(0);
  });
});
