/**
 * Tests for referralPageHelpers.js — Referral page utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  formatReferralLink,
  formatCreditAmount,
  getReferralStatusLabel,
  getReferralStatusColor,
  getHowItWorksSteps,
  getSocialShareLinks,
  calculateReferralProgress,
  formatExpiryDate,
  buildReferralHistoryItems,
} from '../src/public/referralPageHelpers.js';

// ── formatReferralLink ────────────────────────────────────────────────

describe('formatReferralLink', () => {
  it('builds referral URL from code', () => {
    const url = formatReferralLink('ABC123');
    expect(url).toBe('https://www.carolinafutons.com?ref=ABC123');
  });

  it('uppercases and strips non-alphanumeric chars', () => {
    const url = formatReferralLink('abc-123!@#');
    expect(url).toBe('https://www.carolinafutons.com?ref=ABC123');
  });

  it('returns base URL for null/empty code', () => {
    expect(formatReferralLink(null)).toBe('https://www.carolinafutons.com');
    expect(formatReferralLink('')).toBe('https://www.carolinafutons.com');
  });

  it('returns base URL when code is only special chars', () => {
    expect(formatReferralLink('!@#$%')).toBe('https://www.carolinafutons.com');
  });
});

// ── formatCreditAmount ────────────────────────────────────────────────

describe('formatCreditAmount', () => {
  it('formats whole dollar amount', () => {
    expect(formatCreditAmount(50)).toBe('$50');
  });

  it('formats fractional amount', () => {
    expect(formatCreditAmount(25.5)).toBe('$25.50');
  });

  it('returns $0 for NaN/non-number', () => {
    expect(formatCreditAmount(NaN)).toBe('$0');
    expect(formatCreditAmount('abc')).toBe('$0');
    expect(formatCreditAmount(null)).toBe('$0');
  });

  it('clamps negative to zero', () => {
    expect(formatCreditAmount(-10)).toBe('$0');
  });
});

// ── getReferralStatusLabel ────────────────────────────────────────────

describe('getReferralStatusLabel', () => {
  it('maps known statuses to labels', () => {
    expect(getReferralStatusLabel('pending')).toBe('Invite Sent');
    expect(getReferralStatusLabel('credited')).toBe('Credit Earned');
    expect(getReferralStatusLabel('expired')).toBe('Expired');
  });

  it('returns Unknown for unrecognized status', () => {
    expect(getReferralStatusLabel('bogus')).toBe('Unknown');
  });
});

// ── getReferralStatusColor ────────────────────────────────────────────

describe('getReferralStatusColor', () => {
  it('returns correct design-token colors for known statuses', () => {
    expect(getReferralStatusColor('pending')).toBe('#5B8FA8'); // mountainBlue
    expect(getReferralStatusColor('signed_up')).toBe('#E8845C'); // sunsetCoral
    expect(getReferralStatusColor('purchased')).toBe('#E8845C'); // sunsetCoral
    expect(getReferralStatusColor('processing')).toBe('#5B8FA8'); // mountainBlue
    expect(getReferralStatusColor('credited')).toBe('#4A7C59'); // success
    expect(getReferralStatusColor('expired')).toBe('#767676'); // muted
  });

  it('returns muted fallback for unknown status', () => {
    expect(getReferralStatusColor('bogus')).toBe('#767676');
  });

  it('returns muted for null/undefined status', () => {
    expect(getReferralStatusColor(null)).toBe('#767676');
    expect(getReferralStatusColor(undefined)).toBe('#767676');
  });
});

// ── getHowItWorksSteps ────────────────────────────────────────────────

describe('getHowItWorksSteps', () => {
  it('returns 3 steps', () => {
    const steps = getHowItWorksSteps();
    expect(steps).toHaveLength(3);
  });

  it('each step has _id, title, description, icon', () => {
    getHowItWorksSteps().forEach(s => {
      expect(s).toHaveProperty('_id');
      expect(s).toHaveProperty('title');
      expect(s).toHaveProperty('description');
      expect(s).toHaveProperty('icon');
    });
  });

  it('mentions credit amounts in descriptions', () => {
    const steps = getHowItWorksSteps();
    const allText = steps.map(s => s.description).join(' ');
    expect(allText).toContain('$25');
    expect(allText).toContain('$50');
  });
});

// ── getSocialShareLinks ───────────────────────────────────────────────

describe('getSocialShareLinks', () => {
  it('returns email, sms, facebook links', () => {
    const links = getSocialShareLinks('ABC123');
    expect(links.email).toContain('mailto:');
    expect(links.sms).toContain('sms:');
    expect(links.facebook).toContain('facebook.com');
  });

  it('includes referral URL in link bodies', () => {
    const links = getSocialShareLinks('XYZ');
    expect(links.email).toContain('ref%3DXYZ');
  });

  it('returns empty object for null/empty code', () => {
    expect(getSocialShareLinks(null)).toEqual({});
    expect(getSocialShareLinks('')).toEqual({});
  });

  it('returns empty for code that is only special chars', () => {
    expect(getSocialShareLinks('!@#')).toEqual({});
  });
});

// ── calculateReferralProgress ─────────────────────────────────────────

describe('calculateReferralProgress', () => {
  it('calculates progress from stats', () => {
    const stats = { totalReferrals: 10, completedReferrals: 3, totalEarned: 150, totalAvailable: 50 };
    const result = calculateReferralProgress(stats);
    expect(result.totalFriends).toBe(10);
    expect(result.successRate).toBe(30);
    expect(result.totalEarned).toBe(150);
    expect(result.availableCredit).toBe(50);
  });

  it('returns zeros for null stats', () => {
    const result = calculateReferralProgress(null);
    expect(result.totalFriends).toBe(0);
    expect(result.successRate).toBe(0);
  });

  it('handles zero referrals without division error', () => {
    const result = calculateReferralProgress({ totalReferrals: 0, completedReferrals: 0 });
    expect(result.successRate).toBe(0);
  });

  it('floors success rate percentage', () => {
    const stats = { totalReferrals: 3, completedReferrals: 1 };
    expect(calculateReferralProgress(stats).successRate).toBe(33);
  });
});

// ── formatExpiryDate ──────────────────────────────────────────────────

describe('formatExpiryDate', () => {
  it('formats date string', () => {
    const result = formatExpiryDate('2026-12-25T12:00:00');
    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2026');
  });

  it('formats Date object', () => {
    const result = formatExpiryDate(new Date('2026-06-15'));
    expect(result).toContain('Jun');
  });

  it('returns "No expiry" for null', () => {
    expect(formatExpiryDate(null)).toBe('No expiry');
  });

  it('returns "No expiry" for invalid date', () => {
    expect(formatExpiryDate('invalid')).toBe('No expiry');
  });

  it('returns "No expiry" for undefined', () => {
    expect(formatExpiryDate(undefined)).toBe('No expiry');
  });
});

// ── buildReferralHistoryItems ─────────────────────────────────────────

describe('buildReferralHistoryItems', () => {
  it('transforms referrals to repeater items', () => {
    const referrals = [
      { code: 'ABC', refereeName: 'Jane', status: 'credited', credit: 50, createdDate: '2026-01-15' },
      { code: 'DEF', refereeName: null, status: 'pending', credit: 0, createdDate: null },
    ];
    const items = buildReferralHistoryItems(referrals);
    expect(items).toHaveLength(2);
    expect(items[0].friendName).toBe('Jane');
    expect(items[0].statusLabel).toBe('Credit Earned');
    expect(items[0].creditText).toBe('$50');
    expect(items[1].friendName).toBe('Awaiting friend');
  });

  it('returns empty for null/non-array', () => {
    expect(buildReferralHistoryItems(null)).toEqual([]);
    expect(buildReferralHistoryItems(undefined)).toEqual([]);
  });

  it('generates unique _id for each item', () => {
    const items = buildReferralHistoryItems([
      { status: 'pending', credit: 0 },
      { status: 'pending', credit: 0 },
    ]);
    expect(items[0]._id).not.toBe(items[1]._id);
  });

  it('returns empty array for empty input array', () => {
    expect(buildReferralHistoryItems([])).toEqual([]);
  });

  it('handles items with missing optional fields', () => {
    const items = buildReferralHistoryItems([
      { status: 'pending' }, // no refereeName, credit, createdDate, code
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].friendName).toBe('Awaiting friend');
    expect(items[0].creditText).toBe('$0');
    expect(items[0].dateText).toBe('No expiry');
    expect(items[0].code).toBe('');
  });
});
