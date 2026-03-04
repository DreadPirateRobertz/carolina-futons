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
import { colors } from '../src/public/sharedTokens.js';

// ── formatReferralLink ────────────────────────────────────────────────

describe('formatReferralLink', () => {
  it('generates a full URL with referral code', () => {
    const link = formatReferralLink('ABCD1234');
    expect(link).toBe('https://www.carolinafutons.com?ref=ABCD1234');
  });

  it('uppercases the code', () => {
    const link = formatReferralLink('abcd1234');
    expect(link).toContain('ref=ABCD1234');
  });

  it('returns base URL for empty code', () => {
    const link = formatReferralLink('');
    expect(link).toBe('https://www.carolinafutons.com');
  });

  it('returns base URL for null/undefined code', () => {
    expect(formatReferralLink(null)).toBe('https://www.carolinafutons.com');
    expect(formatReferralLink(undefined)).toBe('https://www.carolinafutons.com');
  });

  it('strips non-alphanumeric characters from code', () => {
    const link = formatReferralLink('AB-CD 12.34');
    expect(link).toContain('ref=ABCD1234');
  });
});

// ── formatCreditAmount ────────────────────────────────────────────────

describe('formatCreditAmount', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCreditAmount(50)).toBe('$50');
  });

  it('formats zero', () => {
    expect(formatCreditAmount(0)).toBe('$0');
  });

  it('formats cents', () => {
    expect(formatCreditAmount(25.5)).toBe('$25.50');
  });

  it('handles negative amounts', () => {
    expect(formatCreditAmount(-10)).toBe('$0');
  });

  it('handles null/undefined', () => {
    expect(formatCreditAmount(null)).toBe('$0');
    expect(formatCreditAmount(undefined)).toBe('$0');
  });

  it('handles non-numeric input', () => {
    expect(formatCreditAmount('abc')).toBe('$0');
  });
});

// ── getReferralStatusLabel ────────────────────────────────────────────

describe('getReferralStatusLabel', () => {
  it('maps pending to friendly label', () => {
    expect(getReferralStatusLabel('pending')).toBe('Invite Sent');
  });

  it('maps signed_up to friendly label', () => {
    expect(getReferralStatusLabel('signed_up')).toBe('Friend Joined');
  });

  it('maps purchased to friendly label', () => {
    expect(getReferralStatusLabel('purchased')).toBe('Purchase Made');
  });

  it('maps credited to friendly label', () => {
    expect(getReferralStatusLabel('credited')).toBe('Credit Earned');
  });

  it('maps processing to friendly label', () => {
    expect(getReferralStatusLabel('processing')).toBe('Processing');
  });

  it('maps expired to friendly label', () => {
    expect(getReferralStatusLabel('expired')).toBe('Expired');
  });

  it('returns Unknown for unrecognized status', () => {
    expect(getReferralStatusLabel('foo')).toBe('Unknown');
  });

  it('handles empty/null/undefined', () => {
    expect(getReferralStatusLabel('')).toBe('Unknown');
    expect(getReferralStatusLabel(null)).toBe('Unknown');
    expect(getReferralStatusLabel(undefined)).toBe('Unknown');
  });
});

// ── getReferralStatusColor ────────────────────────────────────────────

describe('getReferralStatusColor', () => {
  it('returns mountainBlue for pending', () => {
    expect(getReferralStatusColor('pending')).toBe(colors.mountainBlue);
  });

  it('returns sunsetCoral for signed_up', () => {
    expect(getReferralStatusColor('signed_up')).toBe(colors.sunsetCoral);
  });

  it('returns success for credited', () => {
    expect(getReferralStatusColor('credited')).toBe(colors.success);
  });

  it('returns muted for expired', () => {
    expect(getReferralStatusColor('expired')).toBe(colors.muted);
  });

  it('returns muted for unknown status', () => {
    expect(getReferralStatusColor('unknown')).toBe(colors.muted);
  });

  it('handles null/undefined', () => {
    expect(getReferralStatusColor(null)).toBe(colors.muted);
    expect(getReferralStatusColor(undefined)).toBe(colors.muted);
  });
});

// ── getHowItWorksSteps ────────────────────────────────────────────────

describe('getHowItWorksSteps', () => {
  it('returns exactly 3 steps', () => {
    const steps = getHowItWorksSteps();
    expect(steps).toHaveLength(3);
  });

  it('each step has _id, title, description, and icon', () => {
    const steps = getHowItWorksSteps();
    for (const step of steps) {
      expect(step._id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.icon).toBeTruthy();
    }
  });

  it('steps have unique _ids', () => {
    const steps = getHowItWorksSteps();
    const ids = steps.map(s => s._id);
    expect(new Set(ids).size).toBe(3);
  });

  it('step descriptions mention credit amounts', () => {
    const steps = getHowItWorksSteps();
    const allText = steps.map(s => s.description).join(' ');
    expect(allText).toContain('$50');
    expect(allText).toContain('$25');
  });
});

// ── getSocialShareLinks ───────────────────────────────────────────────

describe('getSocialShareLinks', () => {
  it('generates email share link', () => {
    const links = getSocialShareLinks('ABCD1234');
    expect(links.email).toContain('mailto:');
    expect(links.email).toContain('Carolina%20Futons');
    expect(links.email).toContain('ABCD1234');
  });

  it('generates SMS share link', () => {
    const links = getSocialShareLinks('ABCD1234');
    expect(links.sms).toContain('sms:');
    expect(links.sms).toContain('ABCD1234');
  });

  it('generates Facebook share link', () => {
    const links = getSocialShareLinks('ABCD1234');
    expect(links.facebook).toContain('facebook.com');
    expect(links.facebook).toContain('ABCD1234');
  });

  it('returns empty object for empty code', () => {
    const links = getSocialShareLinks('');
    expect(links).toEqual({});
  });

  it('returns empty object for null/undefined code', () => {
    expect(getSocialShareLinks(null)).toEqual({});
    expect(getSocialShareLinks(undefined)).toEqual({});
  });
});

// ── calculateReferralProgress ─────────────────────────────────────────

describe('calculateReferralProgress', () => {
  it('computes summary from stats object', () => {
    const progress = calculateReferralProgress({
      totalReferrals: 5,
      pendingReferrals: 2,
      signedUpReferrals: 1,
      completedReferrals: 2,
      totalEarned: 150,
      totalAvailable: 50,
      totalApplied: 100,
    });

    expect(progress.totalFriends).toBe(5);
    expect(progress.successRate).toBe(40); // 2/5 = 40%
    expect(progress.totalEarned).toBe(150);
    expect(progress.availableCredit).toBe(50);
  });

  it('handles zero referrals without division by zero', () => {
    const progress = calculateReferralProgress({
      totalReferrals: 0,
      pendingReferrals: 0,
      signedUpReferrals: 0,
      completedReferrals: 0,
      totalEarned: 0,
      totalAvailable: 0,
      totalApplied: 0,
    });

    expect(progress.totalFriends).toBe(0);
    expect(progress.successRate).toBe(0);
    expect(progress.totalEarned).toBe(0);
    expect(progress.availableCredit).toBe(0);
  });

  it('handles null/undefined stats', () => {
    const progress = calculateReferralProgress(null);
    expect(progress.totalFriends).toBe(0);
    expect(progress.successRate).toBe(0);
  });

  it('rounds success rate to integer', () => {
    const progress = calculateReferralProgress({
      totalReferrals: 3,
      completedReferrals: 1,
      totalEarned: 50,
      totalAvailable: 50,
      totalApplied: 0,
    });
    expect(progress.successRate).toBe(33); // 1/3 ≈ 33.3 → 33
  });
});

// ── formatExpiryDate ──────────────────────────────────────────────────

describe('formatExpiryDate', () => {
  it('formats a Date object to readable string', () => {
    const date = new Date(2026, 5, 15); // June 15, 2026 (local)
    const result = formatExpiryDate(date);
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('formats ISO date string', () => {
    const result = formatExpiryDate('2026-06-15T12:00:00Z');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });

  it('returns "No expiry" for null/undefined', () => {
    expect(formatExpiryDate(null)).toBe('No expiry');
    expect(formatExpiryDate(undefined)).toBe('No expiry');
  });

  it('returns "No expiry" for invalid date', () => {
    expect(formatExpiryDate('not-a-date')).toBe('No expiry');
  });
});

// ── buildReferralHistoryItems ─────────────────────────────────────────

describe('buildReferralHistoryItems', () => {
  it('transforms referral data into repeater-ready items', () => {
    const referrals = [
      {
        code: 'CODE001',
        refereeName: 'Bob',
        refereeEmail: 'bob@example.com',
        status: 'credited',
        credit: 50,
        orderNumber: 'ORD-001',
        createdDate: new Date('2026-01-15'),
      },
    ];

    const items = buildReferralHistoryItems(referrals);
    expect(items).toHaveLength(1);
    expect(items[0]._id).toBeTruthy();
    expect(items[0].friendName).toBe('Bob');
    expect(items[0].statusLabel).toBe('Credit Earned');
    expect(items[0].statusColor).toBe(colors.success);
    expect(items[0].creditText).toBe('$50');
  });

  it('uses "Awaiting friend" for pending referrals with no name', () => {
    const items = buildReferralHistoryItems([
      {
        code: 'CODE002',
        refereeName: '',
        refereeEmail: '',
        status: 'pending',
        credit: 50,
        createdDate: new Date(),
      },
    ]);

    expect(items[0].friendName).toBe('Awaiting friend');
  });

  it('returns empty array for null/undefined input', () => {
    expect(buildReferralHistoryItems(null)).toEqual([]);
    expect(buildReferralHistoryItems(undefined)).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(buildReferralHistoryItems([])).toEqual([]);
  });

  it('assigns unique _ids to each item', () => {
    const items = buildReferralHistoryItems([
      { code: 'A', refereeName: 'X', status: 'pending', credit: 50, createdDate: new Date() },
      { code: 'B', refereeName: 'Y', status: 'credited', credit: 50, createdDate: new Date() },
    ]);

    expect(items[0]._id).not.toBe(items[1]._id);
  });
});
