import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __setInsertError,
  __setQueryError,
  __getInserted,
  __getUpdated,
} from './__mocks__/wix-data.js';
import {
  subscribe,
  unsubscribe,
  getSubscribers,
} from '../src/backend/priceAlertService.web.js';

// ── Test Data ──────────────────────────────────────────────────────────────

const ACTIVE_SUB = {
  _id: 'sub-001',
  productId: 'prod-001',
  email: 'alice@example.com',
  subscribedAt: new Date('2026-01-01'),
  active: true,
};

const INACTIVE_SUB = {
  _id: 'sub-002',
  productId: 'prod-001',
  email: 'bob@example.com',
  subscribedAt: new Date('2026-01-01'),
  active: false,
};

const OTHER_PRODUCT_SUB = {
  _id: 'sub-003',
  productId: 'prod-002',
  email: 'carol@example.com',
  subscribedAt: new Date('2026-01-01'),
  active: true,
};

beforeEach(() => {
  __reset();
  __seed('PriceAlerts', [ACTIVE_SUB, INACTIVE_SUB, OTHER_PRODUCT_SUB]);
});

// ── subscribe ──────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('creates a new subscription for a new productId+email pair', async () => {
    const result = await subscribe('prod-001', 'newuser@example.com');

    expect(result.success).toBe(true);
    const stored = __getInserted('PriceAlerts');
    const newSub = stored.find(i => i.email === 'newuser@example.com');
    expect(newSub).toBeDefined();
    expect(newSub.productId).toBe('prod-001');
    expect(newSub.active).toBe(true);
    expect(newSub.subscribedAt).toBeInstanceOf(Date);
  });

  it('returns already_subscribed when active subscription already exists', async () => {
    const result = await subscribe('prod-001', 'alice@example.com');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_subscribed');
  });

  it('reactivates an inactive subscription instead of creating a duplicate', async () => {
    const result = await subscribe('prod-001', 'bob@example.com');

    expect(result.success).toBe(true);
    const updated = __getUpdated('PriceAlerts');
    const reactivated = updated.find(i => i._id === 'sub-002');
    expect(reactivated).toBeDefined();
    expect(reactivated.active).toBe(true);
    expect(reactivated.subscribedAt).toBeInstanceOf(Date);
  });

  it('returns error for empty productId', async () => {
    const result = await subscribe('', 'user@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for empty email', async () => {
    const result = await subscribe('prod-001', '');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for invalid email format', async () => {
    const result = await subscribe('prod-001', 'not-an-email');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for null productId', async () => {
    const result = await subscribe(null, 'user@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for null email', async () => {
    const result = await subscribe('prod-001', null);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles wix-data insert errors gracefully', async () => {
    __setInsertError('PriceAlerts', new Error('DB write failed'));
    const result = await subscribe('prod-001', 'new@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('normalizes email to lowercase before storing', async () => {
    const result = await subscribe('prod-001', 'New@Example.COM');

    expect(result.success).toBe(true);
    const stored = __getInserted('PriceAlerts');
    const newSub = stored.find(i => i.email === 'new@example.com');
    expect(newSub).toBeDefined();
  });

  it('treats the same email with different case as already subscribed', async () => {
    // alice@example.com is already active in seed data
    const result = await subscribe('prod-001', 'ALICE@EXAMPLE.COM');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_subscribed');
  });
});

// ── unsubscribe ────────────────────────────────────────────────────────────

describe('unsubscribe', () => {
  it('deactivates an active subscription', async () => {
    const result = await unsubscribe('prod-001', 'alice@example.com');

    expect(result.success).toBe(true);
    const updated = __getUpdated('PriceAlerts');
    const deactivated = updated.find(i => i._id === 'sub-001');
    expect(deactivated).toBeDefined();
    expect(deactivated.active).toBe(false);
  });

  it('returns not_found when no subscription exists for that productId+email', async () => {
    const result = await unsubscribe('prod-001', 'nobody@example.com');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('returns already_unsubscribed when subscription is already inactive', async () => {
    const result = await unsubscribe('prod-001', 'bob@example.com');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_unsubscribed');
  });

  it('returns error for empty productId', async () => {
    const result = await unsubscribe('', 'alice@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for empty email', async () => {
    const result = await unsubscribe('prod-001', '');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for invalid email format', async () => {
    const result = await unsubscribe('prod-001', 'not-an-email');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('normalizes email to lowercase before querying', async () => {
    const result = await unsubscribe('prod-001', 'ALICE@EXAMPLE.COM');

    expect(result.success).toBe(true);
    const updated = __getUpdated('PriceAlerts');
    expect(updated.find(i => i._id === 'sub-001')).toBeDefined();
  });

  it('handles wix-data query errors gracefully', async () => {
    __setQueryError('PriceAlerts', new Error('DB read failed'));
    const result = await unsubscribe('prod-001', 'alice@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── getSubscribers ─────────────────────────────────────────────────────────

describe('getSubscribers', () => {
  it('returns active subscribers for a product', async () => {
    const result = await getSubscribers('prod-001');

    expect(result.success).toBe(true);
    expect(result.subscribers).toHaveLength(1);
    expect(result.subscribers[0].email).toBe('alice@example.com');
    expect(result.subscribers[0].productId).toBe('prod-001');
    expect(result.count).toBe(1);
  });

  it('does not return inactive subscriptions', async () => {
    const result = await getSubscribers('prod-001');

    // bob@example.com is inactive — must not appear
    const emails = result.subscribers.map(s => s.email);
    expect(emails).not.toContain('bob@example.com');
  });

  it('returns empty list for product with no subscribers', async () => {
    const result = await getSubscribers('prod-unknown');

    expect(result.success).toBe(true);
    expect(result.subscribers).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('does not return subscribers from other products', async () => {
    const result = await getSubscribers('prod-001');

    const emails = result.subscribers.map(s => s.email);
    expect(emails).not.toContain('carol@example.com');
  });

  it('returns error for empty productId', async () => {
    const result = await getSubscribers('');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for null productId', async () => {
    const result = await getSubscribers(null);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles wix-data query errors gracefully', async () => {
    __setQueryError('PriceAlerts', new Error('DB read failed'));
    const result = await getSubscribers('prod-001');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('includes subscribedAt in each subscriber record', async () => {
    const result = await getSubscribers('prod-001');

    expect(result.subscribers[0].subscribedAt).toBeInstanceOf(Date);
  });
});
