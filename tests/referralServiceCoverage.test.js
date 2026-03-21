/**
 * Tests for referralService.web.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __onInsert, __onUpdate } from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

import {
  getReferralLink,
  redeemReferralCode,
  completeReferral,
  getMyReferrals,
  getMyCredits,
  applyCredit,
  getReferralStats,
} from 'backend/referralService.web';

beforeEach(() => {
  resetData();
  resetMembers();
});

// ── getReferralLink ──────────────────────────────────────────────────

describe('referralService — getReferralLink', () => {
  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getReferralLink();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('fails when member has no _id', async () => {
    __setMember({ name: 'No ID' });
    const result = await getReferralLink();
    expect(result.success).toBe(false);
  });

  it('returns existing pending referral code', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com', name: 'Test' });
    __seed('Referrals', [{
      _id: 'ref-1',
      referrerMemberId: 'member-1',
      referralCode: 'ABCD1234',
      status: 'pending',
      _createdDate: new Date(),
    }]);
    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).toBe('ABCD1234');
    expect(result.alreadyExists).toBe(true);
  });

  it('generates new code when no pending referral exists', async () => {
    __setMember({ _id: 'member-2', loginEmail: 'new@example.com', name: 'New User' });
    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.referralCode).toBeTruthy();
    expect(result.referralCode.length).toBe(8);
    expect(result.alreadyExists).toBe(false);
  });

  it('skips completed referrals when looking for existing code', async () => {
    __setMember({ _id: 'member-3', loginEmail: 'test@example.com' });
    __seed('Referrals', [{
      _id: 'ref-2',
      referrerMemberId: 'member-3',
      referralCode: 'USED1234',
      status: 'credited', // not 'pending', should be skipped
      _createdDate: new Date(),
    }]);
    const result = await getReferralLink();
    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(false);
    expect(result.referralCode).not.toBe('USED1234');
  });

  it('creates referral record with correct fields', async () => {
    __setMember({ _id: 'member-4', loginEmail: 'ref@example.com', name: 'Referrer' });
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'Referrals') inserted = item;
    });
    await getReferralLink();
    expect(inserted).not.toBeNull();
    expect(inserted.referrerMemberId).toBe('member-4');
    expect(inserted.referrerEmail).toBe('ref@example.com');
    expect(inserted.referrerName).toBe('Referrer');
    expect(inserted.status).toBe('pending');
    expect(inserted.referrerCredit).toBe(50);
    expect(inserted.refereeCredit).toBe(25);
  });

  it('uses firstName when name is empty', async () => {
    __setMember({ _id: 'member-5', loginEmail: 'fn@example.com', firstName: 'FirstOnly' });
    let inserted = null;
    __onInsert((collection, item) => {
      if (collection === 'Referrals') inserted = item;
    });
    await getReferralLink();
    expect(inserted.referrerName).toBe('FirstOnly');
  });

  it('generated code contains only valid characters', async () => {
    __setMember({ _id: 'member-6', loginEmail: 'chars@example.com' });
    const result = await getReferralLink();
    const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    expect(result.referralCode).toMatch(validChars);
  });
});

// ── redeemReferralCode ──────────────────────────────────────────────

describe('referralService — redeemReferralCode', () => {
  it('rejects empty code', async () => {
    const result = await redeemReferralCode('', { email: 'test@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects missing email', async () => {
    const result = await redeemReferralCode('ABCD1234', { name: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects invalid email format', async () => {
    const result = await redeemReferralCode('ABCD1234', { email: 'notanemail' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects expired/invalid referral code', async () => {
    const result = await redeemReferralCode('NOTACODE', { email: 'test@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid or expired');
  });

  it('prevents self-referral', async () => {
    __seed('Referrals', [{
      _id: 'ref-1',
      referrerMemberId: 'member-1',
      referrerEmail: 'self@example.com',
      referralCode: 'SELF1234',
      status: 'pending',
    }]);
    const result = await redeemReferralCode('SELF1234', { email: 'self@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own referral');
  });

  it('prevents self-referral case-insensitive', async () => {
    __seed('Referrals', [{
      _id: 'ref-1',
      referrerMemberId: 'member-1',
      referrerEmail: 'Self@Example.com',
      referralCode: 'CASE1234',
      status: 'pending',
    }]);
    const result = await redeemReferralCode('CASE1234', { email: 'SELF@EXAMPLE.COM' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own referral');
  });

  it('succeeds with valid code and email', async () => {
    __seed('Referrals', [{
      _id: 'ref-2',
      referrerMemberId: 'member-1',
      referrerEmail: 'referrer@example.com',
      referrerName: 'Alice',
      referralCode: 'GOOD1234',
      status: 'pending',
    }]);
    const result = await redeemReferralCode('GOOD1234', { name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
    expect(result.referrerName).toBe('Alice');
    expect(result.refereeDiscount).toBe(25);
    expect(result.message).toContain('Alice');
    expect(result.message).toContain('$25');
  });

  it('updates referral status to signed_up', async () => {
    __seed('Referrals', [{
      _id: 'ref-3',
      referrerMemberId: 'member-1',
      referrerEmail: 'referrer@example.com',
      referralCode: 'UPDT1234',
      status: 'pending',
    }]);
    let updated = null;
    __onUpdate((collection, item) => {
      if (collection === 'Referrals') updated = item;
    });
    await redeemReferralCode('UPDT1234', { name: 'Charlie', email: 'charlie@test.com' });
    expect(updated.status).toBe('signed_up');
    expect(updated.refereeEmail).toBe('charlie@test.com');
    expect(updated.refereeName).toBe('Charlie');
  });

  it('normalizes code to uppercase and strips special chars', async () => {
    __seed('Referrals', [{
      _id: 'ref-4',
      referrerMemberId: 'member-1',
      referrerEmail: 'referrer@example.com',
      referralCode: 'ABCD5678',
      status: 'pending',
    }]);
    const result = await redeemReferralCode('abcd-5678', { email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('handles missing referrerName gracefully', async () => {
    __seed('Referrals', [{
      _id: 'ref-5',
      referrerMemberId: 'member-1',
      referrerEmail: 'ref@example.com',
      referralCode: 'NONAME12',
      status: 'pending',
    }]);
    const result = await redeemReferralCode('NONAME12', { email: 'test@example.com' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('a friend');
  });
});

// ── completeReferral ────────────────────────────────────────────────

describe('referralService — completeReferral', () => {
  it('rejects missing code', async () => {
    const result = await completeReferral('', 'ORD-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects missing order number', async () => {
    const result = await completeReferral('ABCD1234', '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await completeReferral('ABCD1234', 'ORD-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('fails when referral not found', async () => {
    __setMember({ _id: 'member-1' });
    const result = await completeReferral('NOPE1234', 'ORD-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when referral is still pending (not signed_up)', async () => {
    __setMember({ _id: 'member-1' });
    __seed('Referrals', [{
      _id: 'ref-1',
      referralCode: 'PEND1234',
      status: 'pending', // not 'signed_up'
      referrerMemberId: 'member-0',
    }]);
    const result = await completeReferral('PEND1234', 'ORD-123');
    expect(result.success).toBe(false);
  });

  it('completes referral and creates credits', async () => {
    __setMember({ _id: 'member-referee', loginEmail: 'referee@test.com' });
    __seed('Referrals', [{
      _id: 'ref-complete',
      referralCode: 'COMP1234',
      status: 'signed_up',
      referrerMemberId: 'member-referrer',
      referrerEmail: 'referrer@test.com',
      refereeEmail: 'referee@test.com',
    }]);
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    const result = await completeReferral('COMP1234', 'ORD-456');
    expect(result.success).toBe(true);
    expect(result.referrerCredit).toBe(50);
    expect(result.refereeCredit).toBe(25);

    // Should have created 2 credit records
    const creditInserts = inserts.filter(i => i.collection === 'ReferralCredits');
    expect(creditInserts).toHaveLength(2);

    // Referrer credit
    const referrerCredit = creditInserts.find(i => i.item.source === 'referrer_bonus');
    expect(referrerCredit.item.memberId).toBe('member-referrer');
    expect(referrerCredit.item.amount).toBe(50);
    expect(referrerCredit.item.status).toBe('available');
    expect(referrerCredit.item.expiresAt).toBeInstanceOf(Date);

    // Referee credit
    const refereeCredit = creditInserts.find(i => i.item.source === 'referee_bonus');
    expect(refereeCredit.item.memberId).toBe('member-referee');
    expect(refereeCredit.item.amount).toBe(25);
  });

  it('sets referral status to credited after completion', async () => {
    __setMember({ _id: 'member-ref', loginEmail: 'ref@test.com' });
    __seed('Referrals', [{
      _id: 'ref-status',
      referralCode: 'STAT1234',
      status: 'signed_up',
      referrerMemberId: 'member-other',
      refereeEmail: 'ref@test.com',
    }]);
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, item }));

    await completeReferral('STAT1234', 'ORD-789');

    // Last update to Referrals should be status='credited'
    const referralUpdates = updates.filter(u => u.collection === 'Referrals');
    const lastUpdate = referralUpdates[referralUpdates.length - 1];
    expect(lastUpdate.item.status).toBe('credited');
  });

  it('sets order number on the referral', async () => {
    __setMember({ _id: 'member-ord', loginEmail: 'ord@test.com' });
    __seed('Referrals', [{
      _id: 'ref-ord',
      referralCode: 'ORDR1234',
      status: 'signed_up',
      referrerMemberId: 'member-other',
      refereeEmail: 'ord@test.com',
    }]);
    const updates = [];
    __onUpdate((collection, item) => updates.push({ collection, item }));

    await completeReferral('ORDR1234', 'ORD-ABC');

    const firstUpdate = updates.find(u => u.collection === 'Referrals');
    expect(firstUpdate.item.orderNumber).toBe('ORD-ABC');
  });

  it('credit expiry is approximately 90 days from now', async () => {
    __setMember({ _id: 'member-exp', loginEmail: 'exp@test.com' });
    __seed('Referrals', [{
      _id: 'ref-exp',
      referralCode: 'EXPR1234',
      status: 'signed_up',
      referrerMemberId: 'member-other',
      refereeEmail: 'exp@test.com',
    }]);
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    const before = Date.now();
    await completeReferral('EXPR1234', 'ORD-EXP');

    const credit = inserts.find(i => i.collection === 'ReferralCredits');
    const expiry = credit.item.expiresAt.getTime();
    const expectedExpiry = before + 90 * 24 * 60 * 60 * 1000;
    // Allow 5 seconds tolerance
    expect(Math.abs(expiry - expectedExpiry)).toBeLessThan(5000);
  });
});

// ── getMyReferrals ──────────────────────────────────────────────────

describe('referralService — getMyReferrals', () => {
  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getMyReferrals();
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('returns empty list for member with no referrals', async () => {
    __setMember({ _id: 'member-empty' });
    const result = await getMyReferrals();
    expect(result.success).toBe(true);
    expect(result.referrals).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('returns mapped referral data', async () => {
    __setMember({ _id: 'member-refs' });
    __seed('Referrals', [
      {
        _id: 'r1',
        referrerMemberId: 'member-refs',
        referralCode: 'CODE1111',
        refereeName: 'Alice',
        refereeEmail: 'alice@test.com',
        status: 'credited',
        referrerCredit: 50,
        orderNumber: 'ORD-1',
        _createdDate: new Date('2025-01-01'),
      },
      {
        _id: 'r2',
        referrerMemberId: 'member-refs',
        referralCode: 'CODE2222',
        status: 'pending',
        referrerCredit: 50,
        _createdDate: new Date('2025-02-01'),
      },
    ]);
    const result = await getMyReferrals();
    expect(result.success).toBe(true);
    expect(result.referrals).toHaveLength(2);
    // Sorted descending by _createdDate: CODE2222 (Feb) before CODE1111 (Jan)
    expect(result.referrals[0].code).toBe('CODE2222');
    expect(result.referrals[0].refereeName).toBe('');
    expect(result.referrals[0].orderNumber).toBe('');
    expect(result.referrals[1].code).toBe('CODE1111');
    expect(result.referrals[1].refereeName).toBe('Alice');
    expect(result.referrals[1].status).toBe('credited');
  });

  it('does not include referrals from other members', async () => {
    __setMember({ _id: 'member-mine' });
    __seed('Referrals', [{
      _id: 'r3',
      referrerMemberId: 'member-other',
      referralCode: 'OTHER111',
      status: 'pending',
    }]);
    const result = await getMyReferrals();
    expect(result.referrals).toHaveLength(0);
  });
});

// ── getMyCredits ────────────────────────────────────────────────────

describe('referralService — getMyCredits', () => {
  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getMyCredits();
    expect(result.success).toBe(false);
  });

  it('returns zero total for no credits', async () => {
    __setMember({ _id: 'member-nocreds' });
    const result = await getMyCredits();
    expect(result.success).toBe(true);
    expect(result.totalAvailable).toBe(0);
    expect(result.credits).toHaveLength(0);
  });

  it('sums available credits and maps fields', async () => {
    __setMember({ _id: 'member-creds' });
    const expiry = new Date('2026-06-01');
    __seed('ReferralCredits', [
      {
        _id: 'c1',
        memberId: 'member-creds',
        amount: 50,
        source: 'referrer_bonus',
        status: 'available',
        expiresAt: expiry,
        _createdDate: new Date('2025-01-01'),
      },
      {
        _id: 'c2',
        memberId: 'member-creds',
        amount: 25,
        source: 'referee_bonus',
        status: 'available',
        expiresAt: expiry,
        _createdDate: new Date('2025-02-01'),
      },
    ]);
    const result = await getMyCredits();
    expect(result.success).toBe(true);
    expect(result.totalAvailable).toBe(75);
    expect(result.credits).toHaveLength(2);
    expect(result.credits[0].source).toBe('referrer_bonus');
    expect(result.credits[0].amount).toBe(50);
  });

  it('excludes applied and expired credits from query', async () => {
    __setMember({ _id: 'member-mixed' });
    __seed('ReferralCredits', [
      { _id: 'c3', memberId: 'member-mixed', amount: 50, status: 'available' },
      { _id: 'c4', memberId: 'member-mixed', amount: 25, status: 'applied' },
      { _id: 'c5', memberId: 'member-mixed', amount: 25, status: 'expired' },
    ]);
    const result = await getMyCredits();
    expect(result.totalAvailable).toBe(50);
    expect(result.credits).toHaveLength(1);
  });
});

// ── applyCredit ─────────────────────────────────────────────────────

describe('referralService — applyCredit', () => {
  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await applyCredit('credit-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('logged in');
  });

  it('rejects empty creditId', async () => {
    __setMember({ _id: 'member-1' });
    const result = await applyCredit('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Credit ID required');
  });

  it('fails when credit not found', async () => {
    __setMember({ _id: 'member-1' });
    const result = await applyCredit('nonexistent-credit');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects credit belonging to another member', async () => {
    __setMember({ _id: 'member-1' });
    __seed('ReferralCredits', [{
      _id: 'credit-other',
      memberId: 'member-other',
      amount: 50,
      status: 'available',
    }]);
    const result = await applyCredit('credit-other');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not belong');
  });

  it('rejects already-applied credit', async () => {
    __setMember({ _id: 'member-1' });
    __seed('ReferralCredits', [{
      _id: 'credit-applied',
      memberId: 'member-1',
      amount: 50,
      status: 'applied',
    }]);
    const result = await applyCredit('credit-applied');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('detects and marks expired credit', async () => {
    __setMember({ _id: 'member-1' });
    __seed('ReferralCredits', [{
      _id: 'credit-expired',
      memberId: 'member-1',
      amount: 50,
      status: 'available',
      expiresAt: new Date('2020-01-01'), // in the past
    }]);
    let updated = null;
    __onUpdate((collection, item) => {
      if (collection === 'ReferralCredits') updated = item;
    });
    const result = await applyCredit('credit-expired');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
    expect(updated.status).toBe('expired');
  });

  it('successfully applies valid credit', async () => {
    __setMember({ _id: 'member-1' });
    __seed('ReferralCredits', [{
      _id: 'credit-good',
      memberId: 'member-1',
      amount: 50,
      status: 'available',
      expiresAt: new Date('2030-01-01'),
    }]);
    const result = await applyCredit('credit-good');
    expect(result.success).toBe(true);
    expect(result.amount).toBe(50);
    expect(result.message).toContain('$50');
  });

  it('applies credit with no expiry date', async () => {
    __setMember({ _id: 'member-1' });
    __seed('ReferralCredits', [{
      _id: 'credit-noexp',
      memberId: 'member-1',
      amount: 25,
      status: 'available',
      // no expiresAt
    }]);
    const result = await applyCredit('credit-noexp');
    expect(result.success).toBe(true);
    expect(result.amount).toBe(25);
  });
});

// ── getReferralStats ────────────────────────────────────────────────

describe('referralService — getReferralStats', () => {
  it('fails when not logged in', async () => {
    __setMember(null);
    const result = await getReferralStats();
    expect(result.success).toBe(false);
  });

  it('returns zero stats for new member', async () => {
    __setMember({ _id: 'member-new' });
    const result = await getReferralStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalReferrals).toBe(0);
    expect(result.stats.pendingReferrals).toBe(0);
    expect(result.stats.signedUpReferrals).toBe(0);
    expect(result.stats.completedReferrals).toBe(0);
    expect(result.stats.totalEarned).toBe(0);
    expect(result.stats.totalAvailable).toBe(0);
    expect(result.stats.totalApplied).toBe(0);
  });

  it('counts referrals by status correctly', async () => {
    __setMember({ _id: 'member-stats' });
    __seed('Referrals', [
      { _id: 'r1', referrerMemberId: 'member-stats', status: 'pending' },
      { _id: 'r2', referrerMemberId: 'member-stats', status: 'pending' },
      { _id: 'r3', referrerMemberId: 'member-stats', status: 'signed_up' },
      { _id: 'r4', referrerMemberId: 'member-stats', status: 'purchased' },
      { _id: 'r5', referrerMemberId: 'member-stats', status: 'credited' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-stats', amount: 50, status: 'available' },
      { _id: 'c2', memberId: 'member-stats', amount: 50, status: 'applied' },
      { _id: 'c3', memberId: 'member-stats', amount: 25, status: 'expired' },
    ]);

    const result = await getReferralStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalReferrals).toBe(5);
    expect(result.stats.pendingReferrals).toBe(2);
    expect(result.stats.signedUpReferrals).toBe(1);
    expect(result.stats.completedReferrals).toBe(2); // purchased + credited
    expect(result.stats.totalEarned).toBe(125); // 50 + 50 + 25
    expect(result.stats.totalAvailable).toBe(50);
    expect(result.stats.totalApplied).toBe(50);
  });

  it('does not count other members referrals', async () => {
    __setMember({ _id: 'member-iso' });
    __seed('Referrals', [
      { _id: 'r1', referrerMemberId: 'member-other', status: 'pending' },
    ]);
    __seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-other', amount: 50, status: 'available' },
    ]);
    const result = await getReferralStats();
    expect(result.stats.totalReferrals).toBe(0);
    expect(result.stats.totalEarned).toBe(0);
  });
});
