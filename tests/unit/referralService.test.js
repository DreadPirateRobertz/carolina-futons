import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  getReferralLink,
  redeemReferralCode,
  completeReferral,
  getMyReferrals,
  getMyCredits,
  applyCredit,
  getReferralStats,
} from '../../src/backend/referralService.web.js';

beforeEach(() => {
  __seed('Referrals', []);
  __seed('ReferralCredits', []);
  __setMember(null);
});

// ── getReferralLink ──────────────────────────────────────────────────

describe('getReferralLink', () => {
  it('generates a referral code for logged-in member', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'alice@example.com', name: 'Alice' });

    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).toBeTruthy();
    expect(result.referralCode.length).toBe(8);
    expect(result.alreadyExists).toBe(false);
  });

  it('returns existing pending code if one exists', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'alice@example.com', name: 'Alice' });
    __seed('Referrals', [{
      _id: 'ref-001',
      referrerMemberId: 'member-001',
      referralCode: 'ABCD1234',
      status: 'pending',
      _createdDate: new Date(),
    }]);

    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).toBe('ABCD1234');
    expect(result.alreadyExists).toBe(true);
  });

  it('generates new code if existing code is not pending', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'alice@example.com', name: 'Alice' });
    __seed('Referrals', [{
      _id: 'ref-001',
      referrerMemberId: 'member-001',
      referralCode: 'USED1234',
      status: 'credited',
      _createdDate: new Date(),
    }]);

    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).not.toBe('USED1234');
    expect(result.alreadyExists).toBe(false);
  });

  it('fails when not logged in', async () => {
    const result = await getReferralLink();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('inserts referral record with correct fields', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'alice@example.com', name: 'Alice' });
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'Referrals') inserted = item;
    });

    await getReferralLink();
    expect(inserted).not.toBeNull();
    expect(inserted.referrerMemberId).toBe('member-001');
    expect(inserted.referrerEmail).toBe('alice@example.com');
    expect(inserted.referrerName).toBe('Alice');
    expect(inserted.status).toBe('pending');
    expect(inserted.referrerCredit).toBe(50);
    expect(inserted.refereeCredit).toBe(25);
    expect(inserted.refereeName).toBe('');
    expect(inserted.refereeEmail).toBe('');
    expect(inserted.orderNumber).toBe('');
  });

  it('uses firstName fallback for referrer name', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'alice@example.com', firstName: 'Ali' });
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'Referrals') inserted = item;
    });

    await getReferralLink();
    expect(inserted.referrerName).toBe('Ali');
  });

  it('generates code with only valid characters', async () => {
    __setMember({ _id: 'member-001', loginEmail: 'alice@example.com', name: 'Alice' });

    const result = await getReferralLink();
    const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    expect(result.referralCode).toMatch(validChars);
  });
});

// ── redeemReferralCode ──────────────────────────────────────────────

describe('redeemReferralCode', () => {
  beforeEach(() => {
    __seed('Referrals', [{
      _id: 'ref-001',
      referrerMemberId: 'member-001',
      referrerEmail: 'alice@example.com',
      referrerName: 'Alice',
      referralCode: 'ABCD1234',
      refereeName: '',
      refereeEmail: '',
      status: 'pending',
      referrerCredit: 50,
      refereeCredit: 25,
    }]);
  });

  it('redeems a valid referral code', async () => {
    const result = await redeemReferralCode('ABCD1234', {
      name: 'Bob',
      email: 'bob@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.referrerName).toBe('Alice');
    expect(result.refereeDiscount).toBe(25);
    expect(result.message).toContain('Alice');
    expect(result.message).toContain('$25');
  });

  it('updates referral status to signed_up', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'Referrals') updated = item;
    });

    await redeemReferralCode('ABCD1234', { name: 'Bob', email: 'bob@example.com' });
    expect(updated.status).toBe('signed_up');
    expect(updated.refereeName).toBe('Bob');
    expect(updated.refereeEmail).toBe('bob@example.com');
  });

  it('normalizes code to uppercase', async () => {
    const result = await redeemReferralCode('abcd1234', { name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
  });

  it('strips non-alphanumeric characters from code', async () => {
    const result = await redeemReferralCode('ABCD-1234', { name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
  });

  it('fails for invalid code', async () => {
    const result = await redeemReferralCode('XXXX9999', { email: 'test@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('fails for empty code', async () => {
    const result = await redeemReferralCode('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('fails for already redeemed code', async () => {
    __seed('Referrals', [{
      _id: 'ref-002',
      referralCode: 'USED5678',
      status: 'signed_up',
      referrerEmail: 'alice@example.com',
    }]);

    const result = await redeemReferralCode('USED5678');
    expect(result.success).toBe(false);
  });

  it('prevents self-referral by email', async () => {
    const result = await redeemReferralCode('ABCD1234', {
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('own referral');
  });

  it('rejects invalid email format', async () => {
    const result = await redeemReferralCode('ABCD1234', {
      name: 'Bob',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('requires email for redemption', async () => {
    const result = await redeemReferralCode('ABCD1234', { name: 'Bob' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('shows generic message when referrer has no name', async () => {
    __seed('Referrals', [{
      _id: 'ref-003',
      referrerMemberId: 'member-003',
      referrerEmail: 'anon@example.com',
      referrerName: '',
      referralCode: 'ANON5678',
      status: 'pending',
      referrerCredit: 50,
      refereeCredit: 25,
    }]);

    const result = await redeemReferralCode('ANON5678', { name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('a friend');
  });

  it('sanitizes referee name', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'Referrals') updated = item;
    });

    await redeemReferralCode('ABCD1234', {
      name: '<script>alert(1)</script>Bob',
      email: 'bob@example.com',
    });

    expect(updated.refereeName).not.toContain('<script>');
  });
});

// ── completeReferral ────────────────────────────────────────────────

describe('completeReferral', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-002', loginEmail: 'bob@example.com', name: 'Bob' });
    __seed('Referrals', [{
      _id: 'ref-001',
      referrerMemberId: 'member-001',
      referrerName: 'Alice',
      referralCode: 'ABCD1234',
      status: 'signed_up',
      referrerCredit: 50,
      refereeCredit: 25,
    }]);
  });

  it('completes a referral and returns credit amounts', async () => {
    const result = await completeReferral('ABCD1234', 'ORD-10042');
    expect(result.success).toBe(true);
    expect(result.referrerCredit).toBe(50);
    expect(result.refereeCredit).toBe(25);
  });

  it('issues referrer credit', async () => {
    const inserts = [];
    __onInsert((col, item) => {
      if (col === 'ReferralCredits') inserts.push(item);
    });

    await completeReferral('ABCD1234', 'ORD-10042');

    const referrerCredit = inserts.find(c => c.source === 'referrer_bonus');
    expect(referrerCredit).toBeDefined();
    expect(referrerCredit.memberId).toBe('member-001');
    expect(referrerCredit.amount).toBe(50);
    expect(referrerCredit.status).toBe('available');
    expect(referrerCredit.expiresAt).toBeInstanceOf(Date);
  });

  it('issues referee credit', async () => {
    const inserts = [];
    __onInsert((col, item) => {
      if (col === 'ReferralCredits') inserts.push(item);
    });

    await completeReferral('ABCD1234', 'ORD-10042');

    const refereeCredit = inserts.find(c => c.source === 'referee_bonus');
    expect(refereeCredit).toBeDefined();
    expect(refereeCredit.memberId).toBe('member-002');
    expect(refereeCredit.amount).toBe(25);
    expect(refereeCredit.status).toBe('available');
  });

  it('updates referral status to credited', async () => {
    const updates = [];
    __onUpdate((col, item) => {
      if (col === 'Referrals') updates.push({ ...item });
    });

    await completeReferral('ABCD1234', 'ORD-10042');

    const final = updates[updates.length - 1];
    expect(final.status).toBe('credited');
    expect(final.orderNumber).toBe('ORD-10042');
    expect(final.refereeMemberId).toBe('member-002');
  });

  it('sets credit expiry to 90 days', async () => {
    const inserts = [];
    __onInsert((col, item) => {
      if (col === 'ReferralCredits') inserts.push(item);
    });

    const before = Date.now();
    await completeReferral('ABCD1234', 'ORD-10042');
    const after = Date.now();

    const credit = inserts[0];
    const expiryMs = credit.expiresAt.getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThanOrEqual(before + ninetyDaysMs - 1000);
    expect(expiryMs).toBeLessThanOrEqual(after + ninetyDaysMs + 1000);
  });

  it('fails for non-signed-up referral', async () => {
    __seed('Referrals', [{
      _id: 'ref-002',
      referralCode: 'PEND5678',
      status: 'pending',
    }]);

    const result = await completeReferral('PEND5678', 'ORD-10042');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for empty code or order', async () => {
    const result = await completeReferral('', '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('fails for invalid referral code', async () => {
    const result = await completeReferral('XXXX9999', 'ORD-10042');
    expect(result.success).toBe(false);
  });
});

// ── getMyReferrals ──────────────────────────────────────────────────

describe('getMyReferrals', () => {
  it('returns referrals for logged-in member', async () => {
    __setMember({ _id: 'member-001' });
    __seed('Referrals', [
      {
        _id: 'ref-001',
        referrerMemberId: 'member-001',
        referralCode: 'CODE0001',
        refereeName: 'Bob',
        refereeEmail: 'bob@example.com',
        status: 'credited',
        referrerCredit: 50,
        orderNumber: 'ORD-001',
        _createdDate: new Date('2026-01-15'),
      },
      {
        _id: 'ref-002',
        referrerMemberId: 'member-001',
        referralCode: 'CODE0002',
        refereeName: '',
        refereeEmail: '',
        status: 'pending',
        referrerCredit: 50,
        orderNumber: '',
        _createdDate: new Date('2026-02-01'),
      },
    ]);

    const result = await getMyReferrals();
    expect(result.success).toBe(true);
    expect(result.referrals).toHaveLength(2);
    expect(result.referrals[0].code).toBeTruthy();
    expect(result.referrals[0].status).toBeTruthy();
  });

  it('returns correct referral fields', async () => {
    __setMember({ _id: 'member-001' });
    __seed('Referrals', [{
      _id: 'ref-001',
      referrerMemberId: 'member-001',
      referralCode: 'CODE0001',
      refereeName: 'Bob',
      refereeEmail: 'bob@example.com',
      status: 'credited',
      referrerCredit: 50,
      orderNumber: 'ORD-001',
      _createdDate: new Date('2026-01-15'),
    }]);

    const result = await getMyReferrals();
    const ref = result.referrals[0];
    expect(ref.code).toBe('CODE0001');
    expect(ref.refereeName).toBe('Bob');
    expect(ref.refereeEmail).toBe('bob@example.com');
    expect(ref.status).toBe('credited');
    expect(ref.credit).toBe(50);
    expect(ref.orderNumber).toBe('ORD-001');
  });

  it('does not return other members referrals', async () => {
    __setMember({ _id: 'member-001' });
    __seed('Referrals', [{
      _id: 'ref-999',
      referrerMemberId: 'member-999',
      referralCode: 'OTHER',
      status: 'pending',
    }]);

    const result = await getMyReferrals();
    expect(result.referrals).toHaveLength(0);
  });

  it('fails when not logged in', async () => {
    const result = await getMyReferrals();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('returns totalCount', async () => {
    __setMember({ _id: 'member-001' });
    __seed('Referrals', [
      { _id: 'r1', referrerMemberId: 'member-001', referralCode: 'A', status: 'pending', _createdDate: new Date() },
      { _id: 'r2', referrerMemberId: 'member-001', referralCode: 'B', status: 'credited', _createdDate: new Date() },
    ]);

    const result = await getMyReferrals();
    expect(result.totalCount).toBe(2);
  });
});

// ── getMyCredits ────────────────────────────────────────────────────

describe('getMyCredits', () => {
  it('returns available credits for logged-in member', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-001', amount: 50, source: 'referrer_bonus', status: 'available', _createdDate: new Date() },
      { _id: 'c2', memberId: 'member-001', amount: 25, source: 'referee_bonus', status: 'available', _createdDate: new Date() },
    ]);

    const result = await getMyCredits();
    expect(result.success).toBe(true);
    expect(result.totalAvailable).toBe(75);
    expect(result.credits).toHaveLength(2);
  });

  it('excludes applied and expired credits from total', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-001', amount: 50, status: 'available' },
      { _id: 'c2', memberId: 'member-001', amount: 25, status: 'applied' },
      { _id: 'c3', memberId: 'member-001', amount: 50, status: 'expired' },
    ]);

    const result = await getMyCredits();
    expect(result.totalAvailable).toBe(50);
    expect(result.credits).toHaveLength(1);
  });

  it('returns credit fields', async () => {
    __setMember({ _id: 'member-001' });
    const expires = new Date('2026-05-01');
    __seed('ReferralCredits', [{
      _id: 'c1', memberId: 'member-001', amount: 50, source: 'referrer_bonus',
      status: 'available', expiresAt: expires, _createdDate: new Date(),
    }]);

    const result = await getMyCredits();
    const credit = result.credits[0];
    expect(credit.amount).toBe(50);
    expect(credit.source).toBe('referrer_bonus');
    expect(credit.status).toBe('available');
    expect(credit.expiresAt).toEqual(expires);
  });

  it('does not return other members credits', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-999', amount: 50, status: 'available' },
    ]);

    const result = await getMyCredits();
    expect(result.totalAvailable).toBe(0);
    expect(result.credits).toHaveLength(0);
  });

  it('fails when not logged in', async () => {
    const result = await getMyCredits();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });
});

// ── applyCredit ─────────────────────────────────────────────────────

describe('applyCredit', () => {
  it('applies an available credit', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [{
      _id: 'credit-001',
      memberId: 'member-001',
      amount: 50,
      status: 'available',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }]);

    const result = await applyCredit('credit-001');
    expect(result.success).toBe(true);
    expect(result.amount).toBe(50);
    expect(result.message).toContain('$50');
  });

  it('updates credit status to applied', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [{
      _id: 'credit-001',
      memberId: 'member-001',
      amount: 50,
      status: 'available',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }]);

    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ReferralCredits') updated = item;
    });

    await applyCredit('credit-001');
    expect(updated.status).toBe('applied');
  });

  it('rejects credit belonging to another member', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [{
      _id: 'credit-002',
      memberId: 'member-999',
      amount: 50,
      status: 'available',
    }]);

    const result = await applyCredit('credit-002');
    expect(result.success).toBe(false);
    expect(result.error).toContain('belong');
  });

  it('rejects already applied credit', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [{
      _id: 'credit-003',
      memberId: 'member-001',
      amount: 50,
      status: 'applied',
    }]);

    const result = await applyCredit('credit-003');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('rejects expired credit and marks it expired', async () => {
    __setMember({ _id: 'member-001' });
    __seed('ReferralCredits', [{
      _id: 'credit-004',
      memberId: 'member-001',
      amount: 50,
      status: 'available',
      expiresAt: new Date('2020-01-01'),
    }]);

    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'ReferralCredits') updated = item;
    });

    const result = await applyCredit('credit-004');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
    expect(updated.status).toBe('expired');
  });

  it('rejects nonexistent credit', async () => {
    __setMember({ _id: 'member-001' });

    const result = await applyCredit('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when not logged in', async () => {
    const result = await applyCredit('credit-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('fails with empty credit ID', async () => {
    __setMember({ _id: 'member-001' });
    const result = await applyCredit('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});

// ── getReferralStats ────────────────────────────────────────────────

describe('getReferralStats', () => {
  it('returns referral statistics for logged-in member', async () => {
    __setMember({ _id: 'member-001' });
    __seed('Referrals', [
      { _id: 'r1', referrerMemberId: 'member-001', status: 'pending' },
      { _id: 'r2', referrerMemberId: 'member-001', status: 'signed_up' },
      { _id: 'r3', referrerMemberId: 'member-001', status: 'purchased' },
      { _id: 'r4', referrerMemberId: 'member-001', status: 'credited' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-001', amount: 50, status: 'available' },
      { _id: 'c2', memberId: 'member-001', amount: 50, status: 'applied' },
      { _id: 'c3', memberId: 'member-001', amount: 25, status: 'expired' },
    ]);

    const result = await getReferralStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalReferrals).toBe(4);
    expect(result.stats.pendingReferrals).toBe(1);
    expect(result.stats.signedUpReferrals).toBe(1);
    expect(result.stats.completedReferrals).toBe(2); // purchased + credited
    expect(result.stats.totalEarned).toBe(125);
    expect(result.stats.totalAvailable).toBe(50);
    expect(result.stats.totalApplied).toBe(50);
  });

  it('returns zeros for member with no referrals', async () => {
    __setMember({ _id: 'member-001' });

    const result = await getReferralStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalReferrals).toBe(0);
    expect(result.stats.totalEarned).toBe(0);
    expect(result.stats.totalAvailable).toBe(0);
  });

  it('does not include other members data', async () => {
    __setMember({ _id: 'member-001' });
    __seed('Referrals', [
      { _id: 'r1', referrerMemberId: 'member-999', status: 'credited' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-999', amount: 50, status: 'available' },
    ]);

    const result = await getReferralStats();
    expect(result.stats.totalReferrals).toBe(0);
    expect(result.stats.totalEarned).toBe(0);
  });

  it('fails when not logged in', async () => {
    const result = await getReferralStats();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });
});
