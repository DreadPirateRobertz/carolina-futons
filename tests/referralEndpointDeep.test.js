/**
 * Deeper auth + idempotency tests for referral HTTP endpoints and completeReferral.
 * Bead: CF-efbi
 *
 * Covers gaps not in referralEndpoint.test.js / referralService.test.js:
 * - Self-referral guard: error body content + referral record NOT mutated
 * - Duplicate prevention: rapid double-submission (60s window scenario)
 * - completeReferral reward fires ONLY on first referee purchase, not subsequent
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted, __getUpdated } from './__mocks__/wix-data.js';
import { __reset as __resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import { post_trackReferral } from '../src/backend/http-functions.js';
import { completeReferral } from '../src/backend/referralService.web.js';

function makeTrackRequest(body = {}) {
  return {
    body: {
      json: async () => body,
    },
  };
}

const REFERRER_ID = 'member-referrer-abc';
const NEW_MEMBER_ID = 'member-new-xyz';
const REFERRAL_CODE = 'TRACK1234';

const pendingReferral = {
  _id: 'ref-pending-1',
  referrerMemberId: REFERRER_ID,
  referralCode: REFERRAL_CODE,
  status: 'pending',
  refereeMemberId: '',
};

beforeEach(() => {
  __reset();
  __resetMembers();
});

// ── Self-referral: error body + no state mutation ────────────────────

describe('post_trackReferral — self-referral guard detail', () => {
  beforeEach(() => {
    __setMember({ _id: REFERRER_ID, loginEmail: 'referrer@example.com' });
    __seed('Referrals', [{ ...pendingReferral }]);
  });

  it('returns 400 for self-referral attempt', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    expect(response.status).toBe(400);
  });

  it('self-referral response body has error field', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe('string');
  });

  it('self-referral response body does not include tracked:true', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    const body = JSON.parse(response.body);
    expect(body.tracked).toBeUndefined();
  });

  it('self-referral attempt does NOT update refereeMemberId on the referral record', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    await post_trackReferral(req);

    // The referral record should remain untouched
    const updated = __getUpdated('Referrals');
    expect(updated).toHaveLength(0);
  });

  it('self-referral attempt leaves referral status as pending', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    await post_trackReferral(req);

    const records = __getInserted('Referrals');
    const ref = records.find(r => r._id === 'ref-pending-1');
    expect(ref.status).toBe('pending');
  });

  it('self-referral response has JSON Content-Type header', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    expect(response.headers['Content-Type']).toBe('application/json');
  });
});

// ── Duplicate prevention — rapid double submission ────────────────────
//
// "60s window" scenario: a new member rapidly submits the same referral code
// twice in quick succession. The first must succeed; the second must fail
// because the first atomically changed the status from 'pending' to 'signed_up'.

describe('post_trackReferral — duplicate prevention (rapid re-submission)', () => {
  beforeEach(() => {
    __setMember({ _id: NEW_MEMBER_ID, loginEmail: 'new@example.com' });
    __seed('Referrals', [{ ...pendingReferral }]);
  });

  it('first submission returns 200 with tracked=true', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.tracked).toBe(true);
  });

  it('first submission sets referral status to signed_up', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    await post_trackReferral(req);

    const updated = __getUpdated('Referrals');
    const ref = updated.find(r => r._id === 'ref-pending-1');
    expect(ref).toBeDefined();
    expect(ref.status).toBe('signed_up');
  });

  it('first submission stores the new member ID on the referral', async () => {
    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    await post_trackReferral(req);

    const updated = __getUpdated('Referrals');
    const ref = updated.find(r => r._id === 'ref-pending-1');
    expect(ref.refereeMemberId).toBe(NEW_MEMBER_ID);
  });

  it('second submission with same code by same member returns 409', async () => {
    // Simulate the state after the first submission has already claimed the code:
    // referral is now signed_up, and this member is the attributed referee.
    __seed('Referrals', [
      {
        _id: 'ref-pending-1',
        referrerMemberId: REFERRER_ID,
        referralCode: REFERRAL_CODE,
        status: 'signed_up',     // already claimed
        refereeMemberId: NEW_MEMBER_ID,
      },
    ]);

    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    expect(response.status).toBe(409);
  });

  it('second submission returns JSON error body', async () => {
    __seed('Referrals', [
      {
        _id: 'ref-pending-1',
        referrerMemberId: REFERRER_ID,
        referralCode: REFERRAL_CODE,
        status: 'signed_up',
        refereeMemberId: NEW_MEMBER_ID,
      },
    ]);

    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });

  it('second submission by a different member for already-claimed code returns 409', async () => {
    __setMember({ _id: 'member-third-party', loginEmail: 'third@example.com' });
    __seed('Referrals', [
      {
        _id: 'ref-pending-1',
        referrerMemberId: REFERRER_ID,
        referralCode: REFERRAL_CODE,
        status: 'signed_up',
        refereeMemberId: NEW_MEMBER_ID,
      },
    ]);

    const req = makeTrackRequest({ referralCode: REFERRAL_CODE });
    const response = await post_trackReferral(req);
    expect(response.status).toBe(409);
  });
});

// ── completeReferral — reward fires only on FIRST referee purchase ────
//
// completeReferral queries for referrals with status='signed_up'. Once a referral
// is credited (status='credited'), the query finds nothing and returns
// success:false — the second-purchase attempt is rejected, preventing
// duplicate credit issuance. This is the mechanism that guarantees the reward
// fires only on the first purchase.

describe('completeReferral — reward fires only on first purchase', () => {
  it('second call on already-credited referral returns success:false (not a duplicate)', async () => {
    // The referral has already been processed — status is 'credited'.
    // completeReferral queries for status='signed_up', so it finds nothing.
    __seed('Referrals', [
      {
        _id: 'ref-credited',
        referralCode: 'CREDIT01',
        status: 'credited',   // already processed
        referrerMemberId: REFERRER_ID,
        orderNumber: 'ORD-0001',
      },
    ]);
    __seed('ReferralCredits', []);
    __setMember({ _id: NEW_MEMBER_ID });

    const result = await completeReferral('CREDIT01', 'ORD-0002');
    expect(result.success).toBe(false);
  });

  it('second call on credited referral does NOT insert new credit records', async () => {
    __seed('Referrals', [
      {
        _id: 'ref-credited',
        referralCode: 'CREDIT01',
        status: 'credited',
        referrerMemberId: REFERRER_ID,
        orderNumber: 'ORD-0001',
      },
    ]);
    __seed('ReferralCredits', []);
    __setMember({ _id: NEW_MEMBER_ID });

    await completeReferral('CREDIT01', 'ORD-0002');

    const credits = __getInserted('ReferralCredits');
    expect(credits).toHaveLength(0);
  });

  it('second call on credited referral returns an error field', async () => {
    __seed('Referrals', [
      {
        _id: 'ref-credited',
        referralCode: 'CREDIT01',
        status: 'credited',
        referrerMemberId: REFERRER_ID,
        orderNumber: 'ORD-0001',
      },
    ]);
    __seed('ReferralCredits', []);
    __setMember({ _id: NEW_MEMBER_ID });

    const result = await completeReferral('CREDIT01', 'ORD-0002');
    expect(result.error).toBeDefined();
  });

  it('first call on signed_up referral succeeds and issues credits', async () => {
    __seed('Referrals', [
      {
        _id: 'ref-first-purchase',
        referralCode: 'FIRST001',
        status: 'signed_up',
        referrerMemberId: REFERRER_ID,
        orderNumber: '',
      },
    ]);
    __seed('ReferralCredits', []);
    __setMember({ _id: NEW_MEMBER_ID });

    const firstResult = await completeReferral('FIRST001', 'ORD-1111');
    expect(firstResult.success).toBe(true);

    const creditsAfterFirst = __getInserted('ReferralCredits').length;
    expect(creditsAfterFirst).toBeGreaterThan(0); // credits were issued on first purchase
  });

  it('second call (after first credited the referral) issues no additional credits', async () => {
    __seed('Referrals', [
      {
        _id: 'ref-first-purchase',
        referralCode: 'FIRST001',
        status: 'signed_up',
        referrerMemberId: REFERRER_ID,
        orderNumber: '',
      },
    ]);
    __seed('ReferralCredits', []);
    __setMember({ _id: NEW_MEMBER_ID });

    // First purchase — credits issued, referral transitions to 'credited'
    await completeReferral('FIRST001', 'ORD-1111');
    const creditsAfterFirst = __getInserted('ReferralCredits').length;
    expect(creditsAfterFirst).toBeGreaterThan(0);

    // Second purchase attempt — referral is now 'credited', not 'signed_up',
    // so the query finds nothing and no new credits are inserted.
    await completeReferral('FIRST001', 'ORD-2222');
    const creditsAfterSecond = __getInserted('ReferralCredits').length;
    expect(creditsAfterSecond).toBe(creditsAfterFirst); // no new credits added
  });
});
