/**
 * premiumMembershipHelpers.test.js — TDD tests for CF+ Premium membership frontend helpers.
 * CF-k6a0: Pure functions for plan comparison, benefit display, badge rendering.
 */
import { describe, it, expect } from 'vitest';

import {
  formatPlanPrice,
  getPlanSavings,
  formatMemberBadge,
  getMembershipStatusLabel,
  formatRenewalDate,
  calculateAnnualSavings,
  getBenefitsList,
  isPremiumMember,
} from '../src/public/premiumMembershipHelpers.js';

// ── formatPlanPrice ─────────────────────────────────────────────────

describe('formatPlanPrice', () => {
  it('formats monthly price', () => {
    expect(formatPlanPrice(14.99, 'monthly')).toBe('$14.99/mo');
  });

  it('formats annual price', () => {
    expect(formatPlanPrice(119.99, 'annual')).toBe('$119.99/yr');
  });

  it('handles zero price', () => {
    expect(formatPlanPrice(0, 'monthly')).toBe('$0.00/mo');
  });

  it('handles null price', () => {
    expect(formatPlanPrice(null, 'monthly')).toBe('$0.00/mo');
  });

  it('handles unknown plan type', () => {
    expect(formatPlanPrice(9.99, 'weekly')).toBe('$9.99');
  });
});

// ── getPlanSavings ──────────────────────────────────────────────────

describe('getPlanSavings', () => {
  it('calculates savings of annual vs monthly', () => {
    const savings = getPlanSavings(14.99, 119.99);
    // 14.99 * 12 = 179.88; 179.88 - 119.99 = 59.89
    expect(savings).toBeCloseTo(59.89, 2);
  });

  it('returns zero when annual is more expensive', () => {
    const savings = getPlanSavings(5, 100);
    // 5 * 12 = 60; 60 - 100 = -40; clamped to 0
    expect(savings).toBe(0);
  });

  it('handles null inputs', () => {
    expect(getPlanSavings(null, null)).toBe(0);
  });
});

// ── formatMemberBadge ───────────────────────────────────────────────

describe('formatMemberBadge', () => {
  it('returns CF+ badge text for active member', () => {
    const badge = formatMemberBadge(true);
    expect(badge.text).toBe('CF+ Member');
    expect(badge.visible).toBe(true);
  });

  it('returns hidden badge for non-member', () => {
    const badge = formatMemberBadge(false);
    expect(badge.visible).toBe(false);
  });
});

// ── getMembershipStatusLabel ────────────────────────────────────────

describe('getMembershipStatusLabel', () => {
  it('returns Active for active status', () => {
    expect(getMembershipStatusLabel('active')).toBe('Active');
  });

  it('returns Cancelled for cancelled status', () => {
    expect(getMembershipStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('returns Expired for expired status', () => {
    expect(getMembershipStatusLabel('expired')).toBe('Expired');
  });

  it('returns Unknown for null', () => {
    expect(getMembershipStatusLabel(null)).toBe('Unknown');
  });

  it('returns Unknown for unrecognized status', () => {
    expect(getMembershipStatusLabel('pending')).toBe('Unknown');
  });
});

// ── formatRenewalDate ───────────────────────────────────────────────

describe('formatRenewalDate', () => {
  it('formats a valid date', () => {
    const result = formatRenewalDate('2027-06-15T00:00:00.000Z');
    expect(result).toContain('June');
    expect(result).toContain('15');
    expect(result).toContain('2027');
  });

  it('returns empty for null', () => {
    expect(formatRenewalDate(null)).toBe('');
  });

  it('returns empty for invalid date', () => {
    expect(formatRenewalDate('not-a-date')).toBe('');
  });
});

// ── calculateAnnualSavings ──────────────────────────────────────────

describe('calculateAnnualSavings', () => {
  it('calculates savings from 10% discount on typical spend', () => {
    // $2000 annual spend * 10% = $200 savings
    const savings = calculateAnnualSavings(2000, 10);
    expect(savings).toBe(200);
  });

  it('handles zero spend', () => {
    expect(calculateAnnualSavings(0, 10)).toBe(0);
  });

  it('handles null inputs', () => {
    expect(calculateAnnualSavings(null, null)).toBe(0);
  });
});

// ── getBenefitsList ─────────────────────────────────────────────────

describe('getBenefitsList', () => {
  it('returns standard benefits list', () => {
    const benefits = getBenefitsList();
    expect(Array.isArray(benefits)).toBe(true);
    expect(benefits.length).toBeGreaterThan(0);
    expect(benefits.some(b => b.toLowerCase().includes('free shipping'))).toBe(true);
    expect(benefits.some(b => b.toLowerCase().includes('discount') || b.includes('%'))).toBe(true);
    expect(benefits.some(b => b.toLowerCase().includes('early access'))).toBe(true);
  });
});

// ── isPremiumMember ─────────────────────────────────────────────────

describe('isPremiumMember', () => {
  it('returns true for active membership result', () => {
    expect(isPremiumMember({ success: true, isActive: true })).toBe(true);
  });

  it('returns false for inactive membership result', () => {
    expect(isPremiumMember({ success: true, isActive: false })).toBe(false);
  });

  it('returns false for failed result', () => {
    expect(isPremiumMember({ success: false })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPremiumMember(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPremiumMember(undefined)).toBe(false);
  });
});
