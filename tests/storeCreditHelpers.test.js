import { describe, it, expect } from 'vitest';
import {
  formatCreditBalance,
  getReasonLabel,
  getStatusBadge,
  daysUntilExpiration,
  isExpiringSoon,
  formatExpirationMessage,
  formatTransaction,
} from '../src/public/storeCreditHelpers.js';

const DAY = 86400000;

// ── formatCreditBalance ──────────────────────────────────────────────

describe('formatCreditBalance', () => {
  it('formats whole number', () => {
    expect(formatCreditBalance(100)).toBe('$100.00');
  });

  it('formats decimal amount', () => {
    expect(formatCreditBalance(25.5)).toBe('$25.50');
  });

  it('formats zero', () => {
    expect(formatCreditBalance(0)).toBe('$0.00');
  });

  it('handles null/undefined', () => {
    expect(formatCreditBalance(null)).toBe('$0.00');
    expect(formatCreditBalance(undefined)).toBe('$0.00');
  });

  it('handles string input', () => {
    expect(formatCreditBalance('50')).toBe('$50.00');
  });

  it('handles NaN', () => {
    expect(formatCreditBalance('abc')).toBe('$0.00');
  });
});

// ── getReasonLabel ───────────────────────────────────────────────────

describe('getReasonLabel', () => {
  it('returns label for return', () => {
    expect(getReasonLabel('return')).toBe('Return Credit');
  });

  it('returns label for refund', () => {
    expect(getReasonLabel('refund')).toBe('Refund');
  });

  it('returns label for promotion', () => {
    expect(getReasonLabel('promotion')).toBe('Promotional Credit');
  });

  it('returns label for admin_gift', () => {
    expect(getReasonLabel('admin_gift')).toBe('Admin Gift');
  });

  it('returns label for goodwill', () => {
    expect(getReasonLabel('goodwill')).toBe('Goodwill Credit');
  });

  it('returns label for gift_received', () => {
    expect(getReasonLabel('gift_received')).toBe('Gift from Member');
  });

  it('returns fallback for unknown reason', () => {
    expect(getReasonLabel('unknown')).toBe('Store Credit');
  });

  it('returns fallback for null', () => {
    expect(getReasonLabel(null)).toBe('Store Credit');
  });
});

// ── getStatusBadge ───────────────────────────────────────────────────

describe('getStatusBadge', () => {
  it('returns green for active', () => {
    const badge = getStatusBadge('active');
    expect(badge.label).toBe('Active');
    expect(badge.color).toBe('#4CAF50');
  });

  it('returns grey for used', () => {
    const badge = getStatusBadge('used');
    expect(badge.label).toBe('Used');
  });

  it('returns red for expired', () => {
    const badge = getStatusBadge('expired');
    expect(badge.label).toBe('Expired');
    expect(badge.color).toBe('#F44336');
  });

  it('returns fallback for unknown', () => {
    const badge = getStatusBadge('mystery');
    expect(badge.label).toBe('mystery');
  });
});

// ── daysUntilExpiration ──────────────────────────────────────────────

describe('daysUntilExpiration', () => {
  it('returns positive for future date', () => {
    const future = new Date(Date.now() + DAY * 10);
    expect(daysUntilExpiration(future.toISOString())).toBeGreaterThanOrEqual(9);
    expect(daysUntilExpiration(future.toISOString())).toBeLessThanOrEqual(11);
  });

  it('returns negative for past date', () => {
    const past = new Date(Date.now() - DAY * 5);
    expect(daysUntilExpiration(past.toISOString())).toBeLessThan(0);
  });

  it('returns Infinity for null', () => {
    expect(daysUntilExpiration(null)).toBe(Infinity);
  });

  it('handles Date objects', () => {
    const future = new Date(Date.now() + DAY * 30);
    expect(daysUntilExpiration(future)).toBeGreaterThanOrEqual(29);
  });
});

// ── isExpiringSoon ───────────────────────────────────────────────────

describe('isExpiringSoon', () => {
  it('returns true for date within threshold', () => {
    const soon = new Date(Date.now() + DAY * 10).toISOString();
    expect(isExpiringSoon(soon, 30)).toBe(true);
  });

  it('returns false for date beyond threshold', () => {
    const later = new Date(Date.now() + DAY * 60).toISOString();
    expect(isExpiringSoon(later, 30)).toBe(false);
  });

  it('returns false for already expired', () => {
    const past = new Date(Date.now() - DAY * 5).toISOString();
    expect(isExpiringSoon(past, 30)).toBe(false);
  });

  it('uses default 30-day threshold', () => {
    const soon = new Date(Date.now() + DAY * 15).toISOString();
    expect(isExpiringSoon(soon)).toBe(true);
  });
});

// ── formatExpirationMessage ──────────────────────────────────────────

describe('formatExpirationMessage', () => {
  it('returns Expired for past date', () => {
    const past = new Date(Date.now() - DAY * 5).toISOString();
    expect(formatExpirationMessage(past)).toBe('Expired');
  });

  it('returns Expires tomorrow for 1 day out', () => {
    const tomorrow = new Date(Date.now() + DAY * 0.8).toISOString();
    expect(formatExpirationMessage(tomorrow)).toBe('Expires tomorrow');
  });

  it('returns days message for near future', () => {
    const fiveDays = new Date(Date.now() + DAY * 5).toISOString();
    const msg = formatExpirationMessage(fiveDays);
    expect(msg).toMatch(/Expires in \d+ days/);
  });

  it('returns formatted date for distant future', () => {
    const farFuture = new Date(Date.now() + DAY * 200).toISOString();
    const msg = formatExpirationMessage(farFuture);
    expect(msg).toMatch(/Expires \w+ \d+, \d{4}/);
  });
});

// ── formatTransaction ────────────────────────────────────────────────

describe('formatTransaction', () => {
  it('formats issue transaction with plus sign', () => {
    const result = formatTransaction({
      type: 'issue',
      amount: 50,
      date: '2026-01-15T00:00:00Z',
    });
    expect(result.label).toBe('Credit Issued');
    expect(result.amountDisplay).toBe('+$50.00');
    expect(result.dateDisplay).toBeTruthy();
  });

  it('formats redeem transaction with minus sign', () => {
    const result = formatTransaction({
      type: 'redeem',
      amount: 25,
      date: '2026-02-01T00:00:00Z',
    });
    expect(result.label).toBe('Applied to Order');
    expect(result.amountDisplay).toBe('-$25.00');
  });

  it('formats gift_sent with minus sign', () => {
    const result = formatTransaction({ type: 'gift_sent', amount: 10, date: '2026-01-01T00:00:00Z' });
    expect(result.amountDisplay).toBe('-$10.00');
    expect(result.label).toBe('Gifted');
  });

  it('formats gift_received with plus sign', () => {
    const result = formatTransaction({ type: 'gift_received', amount: 10, date: '2026-01-01T00:00:00Z' });
    expect(result.amountDisplay).toBe('+$10.00');
    expect(result.label).toBe('Gift Received');
  });

  it('handles null input', () => {
    const result = formatTransaction(null);
    expect(result.label).toBe('Unknown');
    expect(result.amountDisplay).toBe('$0.00');
  });

  it('handles missing date', () => {
    const result = formatTransaction({ type: 'issue', amount: 50 });
    expect(result.dateDisplay).toBe('');
  });
});
