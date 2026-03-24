/**
 * @file referralOrderWiring.test.js
 * Tests for _processReferralOnOrderCreated (cf-bu2).
 *
 * Backend-callable function invoked from wixEcom_onOrderCreated when a member
 * places an order. Looks up any signed_up referral for the member and issues
 * credits — closing the loop that previously only worked on mobile.
 *
 * Not a webMethod — no session context available in event handlers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setQueryError,
} from './__mocks__/wix-data.js';
import { _processReferralOnOrderCreated } from '../src/backend/referralService.web.js';

const NOW = new Date('2026-03-24T12:00:00Z').getTime();

beforeEach(() => {
  __reset();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('_processReferralOnOrderCreated — input validation', () => {
  it('returns { skipped: true } when memberId is falsy', async () => {
    const result = await _processReferralOnOrderCreated(null, 'ORD-001');
    expect(result.skipped).toBe(true);
  });

  it('returns { skipped: true } when orderNumber is falsy', async () => {
    const result = await _processReferralOnOrderCreated('mem-1', '');
    expect(result.skipped).toBe(true);
  });
});

// ── No referral found ─────────────────────────────────────────────────────────

describe('_processReferralOnOrderCreated — no referral', () => {
  it('returns { skipped: true } when member has no signed_up referral', async () => {
    // No Referrals records for this member
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.skipped).toBe(true);
  });

  it('skips referrals with status other than signed_up', async () => {
    __seed('Referrals', [
      { _id: 'ref-1', refereeMemberId: 'mem-1', referrerMemberId: 'mem-r', status: 'credited', referralCode: 'ABC' },
    ]);
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.skipped).toBe(true);
  });
});

// ── Credit issuance ───────────────────────────────────────────────────────────

describe('_processReferralOnOrderCreated — credit issuance', () => {
  beforeEach(() => {
    __seed('Referrals', [
      {
        _id: 'ref-1',
        refereeMemberId: 'mem-1',
        referrerMemberId: 'mem-r',
        referralCode: 'ABCD1234',
        status: 'signed_up',
        refereeEmail: 'alice@test.com',
      },
    ]);
  });

  it('returns success: true when referral is found and credited', async () => {
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.success).toBe(true);
  });

  it('inserts referrer credit into ReferralCredits', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const referrerCredit = credits.find(c => c.source === 'referrer_bonus');
    expect(referrerCredit).toBeDefined();
    expect(referrerCredit.memberId).toBe('mem-r');
  });

  it('inserts referee credit into ReferralCredits', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const refereeCredit = credits.find(c => c.source === 'referee_bonus');
    expect(refereeCredit).toBeDefined();
    expect(refereeCredit.memberId).toBe('mem-1');
  });

  it('updates referral status to credited', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const updated = __getUpdated('Referrals');
    expect(updated[updated.length - 1].status).toBe('credited');
  });

  it('sets orderNumber on the referral record', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const updated = __getUpdated('Referrals');
    expect(updated[updated.length - 1].orderNumber).toBe('ORD-001');
  });

  it('returns referrerCredit and refereeCredit amounts', async () => {
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(typeof result.referrerCredit).toBe('number');
    expect(typeof result.refereeCredit).toBe('number');
    expect(result.referrerCredit).toBeGreaterThan(0);
    expect(result.refereeCredit).toBeGreaterThan(0);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('_processReferralOnOrderCreated — idempotency', () => {
  it('does not double-issue referrer credit when credit already exists', async () => {
    __seed('Referrals', [
      { _id: 'ref-1', refereeMemberId: 'mem-1', referrerMemberId: 'mem-r', referralCode: 'ABCD1234', status: 'signed_up' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'rc-1', referralId: 'ref-1', memberId: 'mem-r', source: 'referrer_bonus', amount: 50, status: 'available' },
    ]);
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const referrerCredits = credits.filter(c => c.source === 'referrer_bonus' && c.memberId === 'mem-r');
    // Only the already-seeded one — no new insert added
    expect(referrerCredits).toHaveLength(1);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('_processReferralOnOrderCreated — error handling', () => {
  it('returns { skipped: true } gracefully on DB error', async () => {
    __setQueryError('Referrals', new Error('DB down'));
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.skipped).toBe(true);
  });
});
