/**
 * Tests for CF-73zw: referral deep links + canonical URLs.
 *
 * Covers:
 * - getReferralLinkOwnerName: found, not found, empty code, error resilience
 * - _getReferralLinkForMember canonical URL uses /referral path
 * - getCanonicalReferralUrl, getAppDeepLink, getInstagramShareContent (see referralShareLinks.test.js for full coverage)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue(null) },
}));


import {
  getReferralLinkOwnerName,
  _getReferralLinkForMember,
} from '../src/backend/referralService.web.js';

beforeEach(() => {
  __seed('Referrals', []);
});

// ── getReferralLinkOwnerName ───────────────────────────────────────

describe('getReferralLinkOwnerName', () => {
  it('returns referrerName when code exists', async () => {
    __seed('Referrals', [{
      _id: 'ref-001',
      referralCode: 'TESTCODE',
      referrerName: 'Alice Smith',
      referrerMemberId: 'mem-001',
      status: 'pending',
    }]);

    const result = await getReferralLinkOwnerName('TESTCODE');
    expect(result.success).toBe(true);
    expect(result.referrerName).toBe('Alice Smith');
  });

  it('returns success:false for unknown code', async () => {
    const result = await getReferralLinkOwnerName('UNKNOWN1');
    expect(result.success).toBe(false);
    expect(result.referrerName).toBeUndefined();
  });

  it('sanitizes code input — strips non-alphanumeric', async () => {
    __seed('Referrals', [{
      _id: 'ref-002',
      referralCode: 'GOODCODE',
      referrerName: 'Bob Jones',
      referrerMemberId: 'mem-002',
      status: 'pending',
    }]);

    const result = await getReferralLinkOwnerName('good-code!');
    expect(result.success).toBe(true);
    expect(result.referrerName).toBe('Bob Jones');
  });

  it('returns success:false for empty code', async () => {
    const result = await getReferralLinkOwnerName('');
    expect(result.success).toBe(false);
  });

  it('returns success:false for null code', async () => {
    const result = await getReferralLinkOwnerName(null);
    expect(result.success).toBe(false);
  });

  it('returns success:true with empty referrerName when name field is blank', async () => {
    __seed('Referrals', [{
      _id: 'ref-003',
      referralCode: 'NONAME00',
      referrerName: '',
      referrerMemberId: 'mem-003',
      status: 'pending',
    }]);

    const result = await getReferralLinkOwnerName('NONAME00');
    expect(result.success).toBe(true);
    expect(result.referrerName).toBe('');
  });
});

// ── _getReferralLinkForMember canonical URL ────────────────────────

describe('_getReferralLinkForMember — canonical URL', () => {
  it('uses /referral path in referralUrl (not /?ref=)', async () => {
    const result = await _getReferralLinkForMember('mem-100');
    expect(result).not.toBeNull();
    expect(result.referralUrl).toMatch(/\/referral\?ref=/);
  });

  it('includes the generated code in the URL', async () => {
    const result = await _getReferralLinkForMember('mem-101');
    expect(result.referralUrl).toContain(result.referralCode);
  });

  it('returns existing code canonical URL', async () => {
    __seed('Referrals', [{
      _id: 'ref-existing',
      referralCode: 'EXIST123',
      referrerMemberId: 'mem-200',
      status: 'pending',
      referrerCredit: 50,
      refereeCredit: 25,
      refereeEmail: '',
      refereeName: '',
      refereeMemberId: '',
      orderNumber: '',
    }]);

    const result = await _getReferralLinkForMember('mem-200');
    expect(result.referralCode).toBe('EXIST123');
    expect(result.referralUrl).toBe('https://www.carolinafutons.com/referral?ref=EXIST123');
  });

  it('returns null for missing memberId', async () => {
    const result = await _getReferralLinkForMember(null);
    expect(result).toBeNull();
  });
});
