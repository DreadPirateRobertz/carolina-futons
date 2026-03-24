/**
 * @file referralFirstPurchasePoints.test.js
 * @description Tests for CF-exxy: award 500pts to referrer on referred member's first purchase.
 *
 * Covers:
 *  - first purchase (isFirstPurchase=true) calls accounts.earnPoints for the referrer
 *  - earnPoints called with BONUS_POINTS.REFERRAL_COMPLETE (500) points
 *  - earnPoints called with deterministic idempotencyKey
 *  - pointsAwarded:500 included in return value on first purchase
 *  - rewardPaid=true is persisted on the referral record after reward
 *  - non-first purchase (isFirstPurchase=false) does not call earnPoints
 *  - no isFirstPurchase argument defaults to false — no earnPoints call
 *  - rewardPaid=true on referral record → earnPoints not called (no-op guard)
 *  - missing referral → no earnPoints call, returns {skipped:true}
 *  - earnPoints failure is non-fatal — returns {success:true} without pointsAwarded
 *  - rewardPaid NOT set when earnPoints throws
 *
 * CF-exxy
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed, __getUpdated } from './__mocks__/wix-data.js';
import { __reset as __resetLoyalty, accounts, __seedLoyaltyAccount } from './__mocks__/wix-loyalty.v2.js';
import { BONUS_POINTS } from '../src/backend/loyaltyBonusPoints.web.js';

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import { _processReferralOnOrderCreated } from '../src/backend/referralService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REFERRER_ID         = 'mem-referrer';
const REFERRER_ACCOUNT_ID = 'loyalty-acct-referrer';
const REFEREE_ID          = 'mem-referee';
const ORDER_NUM           = 'ORD-001';

function seedReferral(overrides = {}) {
  __seed('Referrals', [{
    _id:              'ref-1',
    refereeMemberId:  REFEREE_ID,
    referrerMemberId: REFERRER_ID,
    referralCode:     'ABCD1234',
    status:           'signed_up',
    rewardPaid:       false,
    ...overrides,
  }]);
  // Seed the referrer's loyalty account (distinct from member ID).
  // Override per-test with accounts.getAccountBySecondaryId.mockRejectedValueOnce()
  // to simulate a missing account.
  __seedLoyaltyAccount(REFERRER_ID, { _id: REFERRER_ACCOUNT_ID });
}

beforeEach(() => {
  __reset();
  __resetLoyalty();
});

// ── First purchase — earnPoints fired ────────────────────────────────────────

describe('first purchase reward', () => {
  it('calls accounts.earnPoints for the referrer on first purchase', async () => {
    seedReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(accounts.earnPoints).toHaveBeenCalledOnce();
    expect(accounts.earnPoints).toHaveBeenCalledWith(
      REFERRER_ACCOUNT_ID,
      expect.objectContaining({ points: BONUS_POINTS.REFERRAL_COMPLETE })
    );
  });

  it('awards BONUS_POINTS.REFERRAL_COMPLETE (500) points', async () => {
    seedReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    const [, opts] = accounts.earnPoints.mock.calls[0];
    expect(opts.points).toBe(500);
  });

  it('uses deterministic idempotencyKey based on referral _id', async () => {
    seedReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    const [, opts] = accounts.earnPoints.mock.calls[0];
    expect(opts.idempotencyKey).toBe('referral_ref-1_firstpurchase');
  });

  it('includes pointsAwarded in return value', async () => {
    seedReferral();
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(500);
  });

  it('persists rewardPaid=true on the referral record', async () => {
    seedReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    const updates = __getUpdated('Referrals');
    const finalUpdate = updates[updates.length - 1];
    expect(finalUpdate.rewardPaid).toBe(true);
  });
});

// ── No loyalty account for referrer ─────────────────────────────────────────

describe('referrer has no loyalty account', () => {
  it('does not call earnPoints and returns success:true when account lookup fails', async () => {
    seedReferral();
    accounts.getAccountBySecondaryId.mockRejectedValueOnce(new Error('Account not found'));
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeUndefined();
  });

  it('does not set rewardPaid=true when account lookup fails', async () => {
    seedReferral();
    accounts.getAccountBySecondaryId.mockRejectedValueOnce(new Error('Account not found'));
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    const updates = __getUpdated('Referrals');
    const finalUpdate = updates[updates.length - 1];
    expect(finalUpdate.rewardPaid).not.toBe(true);
  });
});

// ── No earnPoints for non-first purchase ────────────────────────────────────

describe('second purchase / no isFirstPurchase', () => {
  it('does not call earnPoints when isFirstPurchase=false', async () => {
    seedReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, false);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('does not include pointsAwarded when isFirstPurchase=false', async () => {
    seedReferral();
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, false);
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeUndefined();
  });

  it('does not call earnPoints when isFirstPurchase omitted (default false)', async () => {
    seedReferral();
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });
});

// ── rewardPaid guard ─────────────────────────────────────────────────────────

describe('rewardPaid=true guard', () => {
  it('does not call earnPoints when rewardPaid is already true', async () => {
    seedReferral({ rewardPaid: true });
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('does not include pointsAwarded when rewardPaid is already true', async () => {
    seedReferral({ rewardPaid: true });
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeUndefined();
  });
});

// ── Missing referral ─────────────────────────────────────────────────────────

describe('missing referral', () => {
  it('returns {skipped:true} and does not call earnPoints when no referral exists', async () => {
    __seed('Referrals', []);
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(result.skipped).toBe(true);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });
});

// ── earnPoints failure — non-fatal ───────────────────────────────────────────

describe('earnPoints failure', () => {
  it('returns success:true even when earnPoints throws', async () => {
    seedReferral();
    accounts.earnPoints.mockRejectedValueOnce(new Error('Loyalty API down'));
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(result.success).toBe(true);
  });

  it('does not include pointsAwarded when earnPoints throws', async () => {
    seedReferral();
    accounts.earnPoints.mockRejectedValueOnce(new Error('Loyalty API down'));
    const result = await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    expect(result.pointsAwarded).toBeUndefined();
  });

  it('does not set rewardPaid=true when earnPoints throws', async () => {
    seedReferral();
    accounts.earnPoints.mockRejectedValueOnce(new Error('Loyalty API down'));
    await _processReferralOnOrderCreated(REFEREE_ID, ORDER_NUM, true);
    const updates = __getUpdated('Referrals');
    const finalUpdate = updates[updates.length - 1];
    expect(finalUpdate.rewardPaid).not.toBe(true);
  });
});
