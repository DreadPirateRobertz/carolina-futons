/**
 * @file priceLock.test.js
 * @description Tests for Price Lock Guarantee backend (CF-tjf0).
 * Covers: create, check, redeem, expire, rate limiting, validation,
 * duplicate prevention, active lock limits.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate, __setInsertError, __setUpdateError, __setQueryError } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { withRateLimit } from './helpers/withRateLimit.js';

import {
  createPriceLock,
  getMyPriceLocks,
  checkPriceLock,
  redeemPriceLock,
  expireStale,
  _COLLECTION,
  _DEPOSIT_AMOUNT,
  _MAX_ACTIVE_LOCKS_PER_MEMBER,
  _TIERS,
} from '../src/backend/priceLock.web.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  __reset();
  __setMember({ _id: 'member-1', contactDetails: { firstName: 'Jane' } });
});

// ── Constants ────────────────────────────────────────────────────────

describe('Price Lock constants', () => {
  it('deposit is $25', () => {
    expect(_DEPOSIT_AMOUNT).toBe(25);
  });

  it('supports 30, 60, 90 day tiers', () => {
    expect(Object.keys(_TIERS)).toEqual(['30', '60', '90']);
    expect(_TIERS['30'].days).toBe(30);
    expect(_TIERS['60'].days).toBe(60);
    expect(_TIERS['90'].days).toBe(90);
  });

  it('max 5 active locks per member', () => {
    expect(_MAX_ACTIVE_LOCKS_PER_MEMBER).toBe(5);
  });
});

// ── createPriceLock ──────────────────────────────────────────────────

describe('createPriceLock', () => {
  it('creates a 30-day price lock', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await createPriceLock({
      productId: 'prod-1',
      currentPrice: 549.99,
      productName: 'Asheville Futon Frame',
      email: 'jane@example.com',
      tier: 30,
    });

    expect(result.success).toBe(true);
    expect(result.data.lockedPrice).toBe(549.99);
    expect(result.data.deposit).toBe(25);
    expect(result.data.tier).toBe('30');
    expect(result.data.tierLabel).toBe('30-day lock');
    expect(inserted.status).toBe('active');
    expect(inserted.memberId).toBe('member-1');
  });

  it('creates a 90-day price lock', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });

    const result = await createPriceLock({
      productId: 'prod-2',
      currentPrice: 999.00,
      productName: 'Murphy Cabinet Bed',
      email: 'jane@example.com',
      tier: 90,
    });

    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('90');
    const expiresAt = new Date(result.data.expiresAt);
    const now = new Date();
    const daysDiff = Math.round((expiresAt - now) / MS_PER_DAY);
    expect(daysDiff).toBeGreaterThanOrEqual(89);
    expect(daysDiff).toBeLessThanOrEqual(91);
  });

  it('rejects without memberId', async () => {
    __setMember(null);
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 500, productName: 'Test', email: 'a@b.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('rejects invalid tier', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 500, productName: 'Test', email: 'a@b.com', tier: 45,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid tier');
  });

  it('rejects invalid price', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: -10, productName: 'Test', email: 'a@b.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid price');
  });

  it('rejects missing productId', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    const result = await createPriceLock({
      productId: '', currentPrice: 500, productName: 'Test', email: 'a@b.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID');
  });

  it('prevents duplicate lock on same product', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    __seed(_COLLECTION, [{
      _id: 'lock-existing',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 549.99,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * MS_PER_DAY),
    }]);

    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 549.99, productName: 'Test', email: 'a@b.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already have an active');
    expect(result.existingLock).toBeDefined();
  });

  it('enforces max active locks per member', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    __seed(_COLLECTION, Array.from({ length: 5 }, (_, i) => ({
      _id: `lock-${i}`,
      memberId: 'member-1',
      productId: `prod-${i}`,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * MS_PER_DAY),
    })));

    const result = await createPriceLock({
      productId: 'prod-new', currentPrice: 500, productName: 'Test', email: 'a@b.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });
});

// ── checkPriceLock ───────────────────────────────────────────────────

describe('checkPriceLock', () => {
  it('returns hasLock true for active lock', async () => {
    __seed(_COLLECTION, [{
      _id: 'lock-1',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 549.99,
      deposit: 25,
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * MS_PER_DAY),
    }]);

    const result = await checkPriceLock('prod-1');
    expect(result.hasLock).toBe(true);
    expect(result.lock.lockedPrice).toBe(549.99);
    expect(result.lock.daysRemaining).toBeGreaterThan(0);
  });

  it('returns hasLock false when no lock exists', async () => {
    const result = await checkPriceLock('prod-1');
    expect(result.hasLock).toBe(false);
  });

  it('auto-expires stale locks on read', async () => {
    let updatedStatus = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updatedStatus = item.status; });

    __seed(_COLLECTION, [{
      _id: 'lock-expired',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 549.99,
      status: 'active',
      expiresAt: new Date(Date.now() - MS_PER_DAY), // expired yesterday
    }]);

    const result = await checkPriceLock('prod-1');
    expect(result.hasLock).toBe(false);
    expect(updatedStatus).toBe('expired');
  });
});

// ── redeemPriceLock ──────────────────────────────────────────────────

describe('redeemPriceLock', () => {
  it('redeems active lock and credits deposit', async () => {
    __seed(_COLLECTION, [{
      _id: 'lock-redeem',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 549.99,
      deposit: 25,
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * MS_PER_DAY),
    }]);

    const result = await redeemPriceLock('lock-redeem', 'member-1');
    expect(result.success).toBe(true);
    expect(result.data.lockedPrice).toBe(549.99);
    expect(result.data.depositCredit).toBe(25);
    expect(result.data.effectivePrice).toBe(524.99);
  });

  it('rejects redemption of expired lock', async () => {
    __seed(_COLLECTION, [{
      _id: 'lock-old',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 549.99,
      status: 'active',
      expiresAt: new Date(Date.now() - MS_PER_DAY),
    }]);

    const result = await redeemPriceLock('lock-old', 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('rejects redemption by wrong member', async () => {
    __seed(_COLLECTION, [{
      _id: 'lock-other',
      memberId: 'member-2',
      productId: 'prod-1',
      lockedPrice: 549.99,
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * MS_PER_DAY),
    }]);

    const result = await redeemPriceLock('lock-other', 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized');
  });

  it('rejects redemption of already-redeemed lock', async () => {
    __seed(_COLLECTION, [{
      _id: 'lock-used',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 549.99,
      status: 'redeemed',
      expiresAt: new Date(Date.now() + 15 * MS_PER_DAY),
    }]);

    const result = await redeemPriceLock('lock-used', 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('redeemed');
  });
});

// ── expireStale ──────────────────────────────────────────────────────

describe('expireStale', () => {
  it('expires all past-due active locks', async () => {
    __seed(_COLLECTION, [
      { _id: 'lock-exp-1', memberId: 'm1', productId: 'p1', status: 'active', expiresAt: new Date(Date.now() - MS_PER_DAY) },
      { _id: 'lock-exp-2', memberId: 'm2', productId: 'p2', status: 'active', expiresAt: new Date(Date.now() - 2 * MS_PER_DAY) },
      { _id: 'lock-fresh', memberId: 'm3', productId: 'p3', status: 'active', expiresAt: new Date(Date.now() + 10 * MS_PER_DAY) },
    ]);

    const result = await expireStale();
    expect(result.expired).toBe(2);
  });

  it('does not expire already-redeemed locks', async () => {
    __seed(_COLLECTION, [
      { _id: 'lock-redeemed', memberId: 'm1', productId: 'p1', status: 'redeemed', expiresAt: new Date(Date.now() - MS_PER_DAY) },
    ]);

    const result = await expireStale();
    expect(result.expired).toBe(0);
  });

  it('handles empty collection', async () => {
    const result = await expireStale();
    expect(result.expired).toBe(0);
  });

  it('continues when individual lock update fails', async () => {
    __seed(_COLLECTION, [
      { _id: 'lock-fail', memberId: 'm1', productId: 'p1', status: 'active', expiresAt: new Date(Date.now() - MS_PER_DAY) },
      { _id: 'lock-ok',   memberId: 'm2', productId: 'p2', status: 'active', expiresAt: new Date(Date.now() - MS_PER_DAY) },
    ]);
    __setUpdateError(_COLLECTION, new Error('DB write failed'));
    const result = await expireStale();
    // First update throws (caught silently), second succeeds
    expect(result.expired).toBe(1);
  });
});

// ── createPriceLock — additional branch coverage ──────────────────────

describe('createPriceLock — branch coverage', () => {
  it('rejects invalid email format', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 500, productName: 'Test', email: 'not@@valid',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email');
  });

  it('rejects when currentPrice is not a number', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 'free', productName: 'Test', email: 'a@b.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid price');
  });

  it('rejects when rate limit is exceeded', async () => {
    withRateLimit('PriceLockRateLimit', { blocked: true, key: 'member-1' });
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 500, productName: 'Test', email: 'a@b.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many requests');
  });

  it('returns error on database insert failure', async () => {
    withRateLimit('PriceLockRateLimit', { key: 'member-1' });
    __setInsertError(_COLLECTION, new Error('DB down'));
    const result = await createPriceLock({
      productId: 'prod-1', currentPrice: 500, productName: 'Test', email: 'a@b.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to create');
  });
});

// ── checkPriceLock — additional branch coverage ───────────────────────

describe('checkPriceLock — branch coverage', () => {
  it('returns hasLock false when member is unauthenticated', async () => {
    __setMember(null);
    const result = await checkPriceLock('prod-1');
    expect(result.hasLock).toBe(false);
  });

  it('returns hasLock false when productId is missing', async () => {
    const result = await checkPriceLock(null);
    expect(result.hasLock).toBe(false);
  });

  it('returns hasLock false on database error', async () => {
    __setQueryError(_COLLECTION, new Error('DB error'));
    const result = await checkPriceLock('prod-1');
    expect(result.hasLock).toBe(false);
  });
});

// ── redeemPriceLock — additional branch coverage ──────────────────────

describe('redeemPriceLock — branch coverage', () => {
  it('rejects when lockId is missing', async () => {
    const result = await redeemPriceLock(null, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('rejects when memberId is missing', async () => {
    const result = await redeemPriceLock('lock-1', null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request');
  });

  it('rejects when lock does not exist', async () => {
    const result = await redeemPriceLock('nonexistent-lock', 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error on database update failure', async () => {
    __seed(_COLLECTION, [{
      _id: 'lock-db-fail',
      memberId: 'member-1',
      productId: 'prod-1',
      lockedPrice: 500,
      deposit: 25,
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * MS_PER_DAY),
    }]);
    __setUpdateError(_COLLECTION, new Error('DB write failed'));
    const result = await redeemPriceLock('lock-db-fail', 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to redeem');
  });
});

// ── getMyPriceLocks ───────────────────────────────────────────────────

describe('getMyPriceLocks', () => {
  it('returns empty when memberId is null', async () => {
    const result = await getMyPriceLocks(null);
    expect(result.success).toBe(false);
    expect(result.locks).toEqual([]);
  });

  it('returns empty when caller does not match memberId', async () => {
    __setMember({ _id: 'member-1' });
    const result = await getMyPriceLocks('member-2');
    expect(result.success).toBe(false);
    expect(result.locks).toEqual([]);
  });

  it('returns active locks with daysRemaining', async () => {
    __setMember({ _id: 'member-1' });
    __seed(_COLLECTION, [{
      _id: 'lock-a',
      memberId: 'member-1',
      productId: 'prod-1',
      productName: 'Asheville Frame',
      lockedPrice: 549.99,
      deposit: 25,
      tier: '30',
      status: 'active',
      expiresAt: new Date(Date.now() + 20 * MS_PER_DAY),
    }]);
    const result = await getMyPriceLocks('member-1');
    expect(result.success).toBe(true);
    expect(result.locks).toHaveLength(1);
    expect(result.locks[0].daysRemaining).toBeGreaterThan(0);
    expect(result.locks[0].tierLabel).toBe('30-day lock');
  });

  it('marks lock as expiring soon when under 7 days remain', async () => {
    __setMember({ _id: 'member-1' });
    __seed(_COLLECTION, [{
      _id: 'lock-soon',
      memberId: 'member-1',
      productId: 'prod-2',
      productName: 'Murphy Bed',
      lockedPrice: 999,
      deposit: 25,
      tier: '60',
      status: 'active',
      expiresAt: new Date(Date.now() + 3 * MS_PER_DAY),
    }]);
    const result = await getMyPriceLocks('member-1');
    expect(result.success).toBe(true);
    expect(result.locks[0].isExpiringSoon).toBe(true);
    expect(result.locks[0].daysRemaining).toBeLessThanOrEqual(4);
  });

  it('returns error on database failure', async () => {
    __setMember({ _id: 'member-1' });
    __setQueryError(_COLLECTION, new Error('DB error'));
    const result = await getMyPriceLocks('member-1');
    expect(result.success).toBe(false);
    expect(result.locks).toEqual([]);
  });
});
