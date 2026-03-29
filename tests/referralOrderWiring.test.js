/**
 * @file referralOrderWiring.test.js
 * Tests for _processReferralOnOrderCreated (cf-bu2).
 *
 * Backend-callable function invoked from wixEcom_onOrderCreated when a member
 * places an order. Looks up any signed_up (or processing) referral for the
 * member and issues credits — closing the loop that previously only worked on mobile.
 *
 * Not a webMethod — no session context available in event handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setQueryError,
} from './__mocks__/wix-data.js';
import { _processReferralOnOrderCreated } from '../src/backend/referralService.web.js';

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn().mockResolvedValue({ success: true }),
}));

const NOW = new Date('2026-03-24T12:00:00Z').getTime();
const REFERRER_CREDIT = 50;
const REFEREE_CREDIT = 25;

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
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.skipped).toBe(true);
  });

  it('skips referrals with status credited (already done)', async () => {
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

  it('inserts referrer credit with exact REFERRER_CREDIT_AMOUNT ($50)', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const referrerCredit = credits.find(c => c.source === 'referrer_bonus');
    expect(referrerCredit).toBeDefined();
    expect(referrerCredit.memberId).toBe('mem-r');
    expect(referrerCredit.amount).toBe(REFERRER_CREDIT);
  });

  it('inserts referee credit with exact REFEREE_CREDIT_AMOUNT ($25)', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const refereeCredit = credits.find(c => c.source === 'referee_bonus');
    expect(refereeCredit).toBeDefined();
    expect(refereeCredit.memberId).toBe('mem-1');
    expect(refereeCredit.amount).toBe(REFEREE_CREDIT);
  });

  it('returns referrerCredit = 50 and refereeCredit = 25 in result', async () => {
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.referrerCredit).toBe(REFERRER_CREDIT);
    expect(result.refereeCredit).toBe(REFEREE_CREDIT);
  });

  it('updates referral status to credited', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const updated = __getUpdated('Referrals');
    expect(updated[updated.length - 1].status).toBe('credited');
  });

  it('sets orderNumber on the intermediate processing update', async () => {
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const updated = __getUpdated('Referrals');
    // First update sets status='processing' with orderNumber
    expect(updated[0].status).toBe('processing');
    expect(updated[0].orderNumber).toBe('ORD-001');
  });
});

// ── Recovery from processing state ───────────────────────────────────────────

describe('_processReferralOnOrderCreated — processing state recovery', () => {
  it('processes a referral already at status=processing (orphan recovery)', async () => {
    __seed('Referrals', [
      {
        _id: 'ref-1',
        refereeMemberId: 'mem-1',
        referrerMemberId: 'mem-r',
        referralCode: 'ABCD1234',
        status: 'processing', // left in this state by a previous failed execution
        orderNumber: 'ORD-001',
      },
    ]);
    const result = await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    expect(result.success).toBe(true);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('_processReferralOnOrderCreated — idempotency', () => {
  it('does not double-issue referrer credit when credit already exists', async () => {
    __seed('Referrals', [
      { _id: 'ref-1', refereeMemberId: 'mem-1', referrerMemberId: 'mem-r', referralCode: 'ABCD1234', status: 'signed_up' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'rc-1', referralId: 'ref-1', memberId: 'mem-r', source: 'referrer_bonus', amount: REFERRER_CREDIT, status: 'available' },
    ]);
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const referrerCredits = credits.filter(c => c.source === 'referrer_bonus' && c.memberId === 'mem-r');
    // Only the already-seeded one — no new insert
    expect(referrerCredits).toHaveLength(1);
  });

  it('does not double-issue referee credit when credit already exists', async () => {
    __seed('Referrals', [
      { _id: 'ref-1', refereeMemberId: 'mem-1', referrerMemberId: 'mem-r', referralCode: 'ABCD1234', status: 'signed_up' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'rc-2', referralId: 'ref-1', memberId: 'mem-1', source: 'referee_bonus', amount: REFEREE_CREDIT, status: 'available' },
    ]);
    await _processReferralOnOrderCreated('mem-1', 'ORD-001');
    const credits = __getInserted('ReferralCredits');
    const refereeCredits = credits.filter(c => c.source === 'referee_bonus' && c.memberId === 'mem-1');
    expect(refereeCredits).toHaveLength(1);
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
