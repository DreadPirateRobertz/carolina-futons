import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { __reset as __resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import {
  get_generateReferralLink,
  post_trackReferral,
} from '../src/backend/http-functions.js';

function makeRequest(body = {}) {
  return {
    body: {
      json: async () => body,
    },
  };
}

const testMember = {
  _id: 'member-abc',
  loginEmail: 'alice@example.com',
  name: 'Alice',
};

// ── get_generateReferralLink ─────────────────────────────────────────

describe('get_generateReferralLink', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
  });

  it('returns 200 with referralCode, shareUrl, and stats for authenticated member', async () => {
    __setMember(testMember);
    __seed('Referrals', []);
    __seed('ReferralCredits', []);

    const response = await get_generateReferralLink({});

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(typeof body.referralCode).toBe('string');
    expect(body.referralCode.length).toBeGreaterThan(0);
    expect(body.shareUrl).toContain(body.referralCode);
    expect(body.stats).toBeDefined();
    expect(typeof body.stats.totalReferrals).toBe('number');
    expect(typeof body.stats.pendingRewards).toBe('number');
    expect(typeof body.stats.earnedRewards).toBe('number');
  });

  it('returns existing referral code if member already has one', async () => {
    __setMember(testMember);
    __seed('Referrals', [
      {
        _id: 'ref-1',
        referrerMemberId: 'member-abc',
        referralCode: 'EXISTING1',
        status: 'pending',
        refereeMemberId: '',
      },
    ]);
    __seed('ReferralCredits', []);

    const response = await get_generateReferralLink({});

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.referralCode).toBe('EXISTING1');
  });

  it('includes stats: totalReferrals counts attributed referrals', async () => {
    __setMember(testMember);
    __seed('Referrals', [
      { _id: 'ref-1', referrerMemberId: 'member-abc', referralCode: 'CODE1111', status: 'signed_up', refereeMemberId: 'member-new1' },
      { _id: 'ref-2', referrerMemberId: 'member-abc', referralCode: 'CODE2222', status: 'credited', refereeMemberId: 'member-new2' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'cred-1', memberId: 'member-abc', amount: 50, status: 'available' },
    ]);

    const response = await get_generateReferralLink({});

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.stats.totalReferrals).toBe(2);
    expect(body.stats.earnedRewards).toBe(50);
  });

  it('returns 401 when not authenticated', async () => {
    // no member set
    const response = await get_generateReferralLink({});

    expect(response.status).toBe(401);
  });

  it('returns 500 on unexpected error', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setMember(testMember);
    __setQueryError('Referrals', new Error('DB down'));

    const response = await get_generateReferralLink({});

    expect(response.status).toBe(500);
  });
});

// ── post_trackReferral ───────────────────────────────────────────────

describe('post_trackReferral', () => {
  beforeEach(() => {
    __reset();
    __resetMembers();
  });

  it('returns 401 when not authenticated', async () => {
    // no member set
    const req = makeRequest({ referralCode: 'CODE1234' });
    const response = await post_trackReferral(req);

    expect(response.status).toBe(401);
  });

  it('returns 200 with tracked=true for valid code and authenticated new member', async () => {
    __setMember({ _id: 'member-new', loginEmail: 'new@example.com' });
    __seed('Referrals', [
      {
        _id: 'ref-1',
        referrerMemberId: 'member-abc',
        referralCode: 'CODE1234',
        status: 'pending',
        refereeMemberId: '',
      },
    ]);

    const req = makeRequest({ referralCode: 'CODE1234' });
    const response = await post_trackReferral(req);

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.tracked).toBe(true);
    expect(body.referrerId).toBe('member-abc');
  });

  it('stores referral attribution after successful tracking', async () => {
    __setMember({ _id: 'member-new', loginEmail: 'new@example.com' });
    __seed('Referrals', [
      {
        _id: 'ref-1',
        referrerMemberId: 'member-abc',
        referralCode: 'CODE1234',
        status: 'pending',
        refereeMemberId: '',
      },
    ]);

    const req = makeRequest({ referralCode: 'CODE1234' });
    await post_trackReferral(req);

    const stored = __getInserted('Referrals');
    const updated = stored.find(r => r._id === 'ref-1');
    expect(updated.refereeMemberId).toBe('member-new');
    expect(updated.status).toBe('signed_up');
  });

  it('returns 400 for self-referral (authenticated member is the referrer)', async () => {
    __setMember({ _id: 'member-abc', loginEmail: 'alice@example.com' });
    __seed('Referrals', [
      {
        _id: 'ref-1',
        referrerMemberId: 'member-abc',
        referralCode: 'CODE1234',
        status: 'pending',
        refereeMemberId: '',
      },
    ]);

    const req = makeRequest({ referralCode: 'CODE1234' });
    const response = await post_trackReferral(req);

    expect(response.status).toBe(400);
  });

  it('returns 409 for duplicate attribution (member already attributed to this code)', async () => {
    __setMember({ _id: 'member-new', loginEmail: 'new@example.com' });
    __seed('Referrals', [
      {
        _id: 'ref-1',
        referrerMemberId: 'member-abc',
        referralCode: 'CODE1234',
        status: 'signed_up',
        refereeMemberId: 'member-new',
      },
    ]);

    const req = makeRequest({ referralCode: 'CODE1234' });
    const response = await post_trackReferral(req);

    expect(response.status).toBe(409);
  });

  it('returns 400 for invalid/nonexistent referral code', async () => {
    __setMember({ _id: 'member-new', loginEmail: 'new@example.com' });
    __seed('Referrals', []);

    const req = makeRequest({ referralCode: 'NOTEXIST' });
    const response = await post_trackReferral(req);

    expect(response.status).toBe(400);
  });

  it('returns 400 when referralCode is missing', async () => {
    __setMember({ _id: 'member-new', loginEmail: 'new@example.com' });

    const req = makeRequest({});
    const response = await post_trackReferral(req);

    expect(response.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    const { __setQueryError } = await import('./__mocks__/wix-data.js');
    __setMember({ _id: 'member-new', loginEmail: 'new@example.com' });
    __setQueryError('Referrals', new Error('DB down'));

    const req = makeRequest({ referralCode: 'CODE1234' });
    const response = await post_trackReferral(req);

    expect(response.status).toBe(500);
  });
});
