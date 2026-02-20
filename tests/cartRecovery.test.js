import { describe, it, expect } from 'vitest';
import {
  getAbandonedCartStats,
  getRecoverableCarts,
  markRecoveryEmailSent,
} from '../src/backend/cartRecovery.web.js';
import { __seed } from './__mocks__/wix-data.js';

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
