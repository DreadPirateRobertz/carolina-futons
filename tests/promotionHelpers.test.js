import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatCountdown,
  getUrgencyLevel,
  formatDiscount,
  isPromoCodeValid,
  sanitizePromoInput,
  buildFlashSaleBanner,
  buildBOGOBadge,
  calculateSavingsDisplay,
} from '../src/public/promotionHelpers.js';

// ── formatCountdown ──────────────────────────────────────────────

describe('formatCountdown', () => {
  it('formats hours, minutes, seconds', () => {
    // 2h 30m 15s = 9015000ms
    const result = formatCountdown(9015000);
    expect(result).toBe('02:30:15');
  });

  it('formats with days when > 24h', () => {
    // 1d 3h 0m 0s
    const ms = (27 * 3600000);
    const result = formatCountdown(ms);
    expect(result).toBe('1d 03:00:00');
  });

  it('returns 00:00:00 for zero', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
  });

  it('returns 00:00:00 for negative', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });

  it('handles exact hour', () => {
    expect(formatCountdown(3600000)).toBe('01:00:00');
  });

  it('handles minutes only', () => {
    // 45 minutes
    expect(formatCountdown(2700000)).toBe('00:45:00');
  });

  it('handles seconds only', () => {
    expect(formatCountdown(30000)).toBe('00:00:30');
  });

  it('handles non-number input', () => {
    expect(formatCountdown('abc')).toBe('00:00:00');
    expect(formatCountdown(null)).toBe('00:00:00');
    expect(formatCountdown(undefined)).toBe('00:00:00');
  });
});

// ── getUrgencyLevel ──────────────────────────────────────────────

describe('getUrgencyLevel', () => {
  it('returns critical for < 1 hour', () => {
    expect(getUrgencyLevel(1800000)).toBe('critical');
  });

  it('returns urgent for < 6 hours', () => {
    expect(getUrgencyLevel(10800000)).toBe('urgent');
  });

  it('returns normal for < 24 hours', () => {
    expect(getUrgencyLevel(43200000)).toBe('normal');
  });

  it('returns low for > 24 hours', () => {
    expect(getUrgencyLevel(172800000)).toBe('low');
  });

  it('returns critical for zero', () => {
    expect(getUrgencyLevel(0)).toBe('critical');
  });

  it('returns critical for negative', () => {
    expect(getUrgencyLevel(-1000)).toBe('critical');
  });
});

// ── formatDiscount ──────────────────────────────────────────────

describe('formatDiscount', () => {
  it('formats percentage discount', () => {
    expect(formatDiscount('percentage', 10)).toBe('10% OFF');
  });

  it('formats fixed amount discount', () => {
    expect(formatDiscount('fixed', 25)).toBe('$25 OFF');
  });

  it('formats free shipping', () => {
    expect(formatDiscount('freeShipping')).toBe('FREE SHIPPING');
  });

  it('handles BOGO display', () => {
    expect(formatDiscount('bogo', 100)).toBe('FREE');
    expect(formatDiscount('bogo', 50)).toBe('50% OFF');
  });

  it('returns empty for unknown type', () => {
    expect(formatDiscount('unknown', 10)).toBe('');
  });

  it('rounds decimal percentages', () => {
    expect(formatDiscount('percentage', 10.5)).toBe('10.5% OFF');
  });

  it('formats fixed with cents', () => {
    expect(formatDiscount('fixed', 25.99)).toBe('$25.99 OFF');
  });
});

// ── isPromoCodeValid ────────────────────────────────────────────

describe('isPromoCodeValid', () => {
  it('accepts valid alphanumeric codes', () => {
    expect(isPromoCodeValid('SAVE10')).toBe(true);
    expect(isPromoCodeValid('SUMMER-2026')).toBe(true);
    expect(isPromoCodeValid('A')).toBe(true);
  });

  it('rejects empty input', () => {
    expect(isPromoCodeValid('')).toBe(false);
    expect(isPromoCodeValid(null)).toBe(false);
    expect(isPromoCodeValid(undefined)).toBe(false);
  });

  it('rejects codes that are too long', () => {
    expect(isPromoCodeValid('A'.repeat(51))).toBe(false);
  });

  it('rejects codes with special characters', () => {
    expect(isPromoCodeValid('<script>')).toBe(false);
    expect(isPromoCodeValid('code with spaces')).toBe(false);
    expect(isPromoCodeValid('code@#$')).toBe(false);
  });

  it('allows hyphens and underscores', () => {
    expect(isPromoCodeValid('SAVE-10')).toBe(true);
    expect(isPromoCodeValid('SAVE_10')).toBe(true);
  });
});

// ── sanitizePromoInput ──────────────────────────────────────────

describe('sanitizePromoInput', () => {
  it('trims and uppercases input', () => {
    expect(sanitizePromoInput('  save10  ')).toBe('SAVE10');
  });

  it('strips non-alphanumeric except hyphens and underscores', () => {
    expect(sanitizePromoInput('SAVE@10!!')).toBe('SAVE10');
  });

  it('handles empty input', () => {
    expect(sanitizePromoInput('')).toBe('');
    expect(sanitizePromoInput(null)).toBe('');
  });

  it('truncates to 50 chars', () => {
    const long = 'A'.repeat(60);
    expect(sanitizePromoInput(long).length).toBe(50);
  });
});

// ── buildFlashSaleBanner ────────────────────────────────────────

describe('buildFlashSaleBanner', () => {
  it('builds banner data for active sale', () => {
    const sale = {
      title: 'Spring Flash Sale',
      discountPercent: 25,
      remainingMs: 7200000, // 2h
      productIds: 'p1,p2',
    };

    const banner = buildFlashSaleBanner(sale);
    expect(banner.headline).toBe('Spring Flash Sale');
    expect(banner.discountLabel).toBe('25% OFF');
    expect(banner.countdown).toBe('02:00:00');
    expect(banner.urgency).toBe('urgent');
    expect(banner.ctaText).toBe('Shop Now');
  });

  it('shows critical urgency under 1 hour', () => {
    const banner = buildFlashSaleBanner({
      title: 'Quick', discountPercent: 10, remainingMs: 1800000,
    });
    expect(banner.urgency).toBe('critical');
  });

  it('returns null for null sale', () => {
    expect(buildFlashSaleBanner(null)).toBeNull();
  });

  it('returns null for sale with no remaining time', () => {
    expect(buildFlashSaleBanner({
      title: 'Done', discountPercent: 10, remainingMs: 0,
    })).toBeNull();
  });
});

// ── buildBOGOBadge ──────────────────────────────────────────────

describe('buildBOGOBadge', () => {
  it('builds badge for 100% BOGO (free item)', () => {
    const deal = {
      title: 'Buy Frame Get Cover Free',
      buyCategory: 'frames',
      getCategory: 'covers',
      buyQuantity: 1,
      getQuantity: 1,
      getDiscountPercent: 100,
    };

    const badge = buildBOGOBadge(deal);
    expect(badge.label).toBe('BUY 1 GET 1 FREE');
    expect(badge.description).toBe('Buy a frames item, get a covers item FREE');
  });

  it('builds badge for partial BOGO (50% off)', () => {
    const badge = buildBOGOBadge({
      title: 'Half Off',
      buyCategory: 'frames', getCategory: 'mattresses',
      buyQuantity: 1, getQuantity: 1, getDiscountPercent: 50,
    });

    expect(badge.label).toBe('BUY 1 GET 1 50% OFF');
    expect(badge.description).toContain('50% OFF');
  });

  it('builds badge for buy 2 get 1', () => {
    const badge = buildBOGOBadge({
      title: 'B2G1',
      buyCategory: 'pillows', getCategory: 'pillows',
      buyQuantity: 2, getQuantity: 1, getDiscountPercent: 100,
    });

    expect(badge.label).toBe('BUY 2 GET 1 FREE');
  });

  it('returns null for null deal', () => {
    expect(buildBOGOBadge(null)).toBeNull();
  });
});

// ── calculateSavingsDisplay ─────────────────────────────────────

describe('calculateSavingsDisplay', () => {
  it('shows total savings from promo + BOGO', () => {
    const result = calculateSavingsDisplay({
      promoDiscount: 50,
      bogoSavings: 89,
      subtotal: 1097,
    });

    expect(result.totalSavings).toBe(139);
    expect(result.savingsPercent).toBe(12.67);
    expect(result.displayText).toContain('$139');
  });

  it('shows promo-only savings', () => {
    const result = calculateSavingsDisplay({
      promoDiscount: 100,
      bogoSavings: 0,
      subtotal: 500,
    });

    expect(result.totalSavings).toBe(100);
    expect(result.savingsPercent).toBe(20);
  });

  it('shows BOGO-only savings', () => {
    const result = calculateSavingsDisplay({
      promoDiscount: 0,
      bogoSavings: 89,
      subtotal: 500,
    });

    expect(result.totalSavings).toBe(89);
  });

  it('handles zero savings', () => {
    const result = calculateSavingsDisplay({
      promoDiscount: 0,
      bogoSavings: 0,
      subtotal: 500,
    });

    expect(result.totalSavings).toBe(0);
    expect(result.displayText).toBe('');
  });

  it('handles zero subtotal', () => {
    const result = calculateSavingsDisplay({
      promoDiscount: 0,
      bogoSavings: 0,
      subtotal: 0,
    });

    expect(result.totalSavings).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });

  it('caps savings at subtotal', () => {
    const result = calculateSavingsDisplay({
      promoDiscount: 500,
      bogoSavings: 200,
      subtotal: 300,
    });

    expect(result.totalSavings).toBe(300);
    expect(result.savingsPercent).toBe(100);
  });
});
