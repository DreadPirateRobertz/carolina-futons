import { describe, it, expect } from 'vitest';
import {
  SEGMENT_COLORS,
  buildWheelSegments,
  computeCountdown,
  renderPendingPrizes,
  renderSpinResult,
} from '../src/public/SpinWheel.js';

// ── SEGMENT_COLORS ────────────────────────────────────────────────────

describe('SEGMENT_COLORS', () => {
  it('contains the mountain palette', () => {
    expect(SEGMENT_COLORS).toEqual(['#7c6af7', '#2d6a4f', '#b5451b']);
  });
});

// ── buildWheelSegments ────────────────────────────────────────────────

describe('buildWheelSegments', () => {
  it('returns empty array for empty input', () => {
    expect(buildWheelSegments([])).toEqual([]);
  });

  it('returns empty array for null/undefined input', () => {
    expect(buildWheelSegments(null)).toEqual([]);
    expect(buildWheelSegments(undefined)).toEqual([]);
  });

  it('builds segments with proportional arc angles', () => {
    const prizes = [
      { name: 'A', weight: 1, active: true },
      { name: 'B', weight: 3, active: true },
    ];
    const segments = buildWheelSegments(prizes);
    expect(segments).toHaveLength(2);
    expect(segments[0].angle).toBe(90);   // 1/4 of 360
    expect(segments[1].angle).toBe(270);  // 3/4 of 360
  });

  it('assigns colors cycling through SEGMENT_COLORS', () => {
    const prizes = [
      { name: 'A', weight: 1 },
      { name: 'B', weight: 1 },
      { name: 'C', weight: 1 },
      { name: 'D', weight: 1 },
    ];
    const segments = buildWheelSegments(prizes);
    expect(segments[0].color).toBe(SEGMENT_COLORS[0]);
    expect(segments[1].color).toBe(SEGMENT_COLORS[1]);
    expect(segments[2].color).toBe(SEGMENT_COLORS[2]);
    expect(segments[3].color).toBe(SEGMENT_COLORS[0]); // wraps
  });

  it('filters out inactive prizes', () => {
    const prizes = [
      { name: 'Active', weight: 2, active: true },
      { name: 'Inactive', weight: 3, active: false },
    ];
    const segments = buildWheelSegments(prizes);
    expect(segments).toHaveLength(1);
    expect(segments[0].name).toBe('Active');
    expect(segments[0].angle).toBe(360); // sole segment
  });

  it('treats missing active field as active', () => {
    const prizes = [{ name: 'No Flag', weight: 5 }];
    const segments = buildWheelSegments(prizes);
    expect(segments).toHaveLength(1);
    expect(segments[0].name).toBe('No Flag');
  });

  it('returns empty if all prizes are inactive', () => {
    const prizes = [
      { name: 'X', weight: 1, active: false },
      { name: 'Y', weight: 2, active: false },
    ];
    expect(buildWheelSegments(prizes)).toEqual([]);
  });

  it('preserves name and weight in output', () => {
    const prizes = [{ name: 'Free Shipping', weight: 10, active: true }];
    const segments = buildWheelSegments(prizes);
    expect(segments[0].name).toBe('Free Shipping');
    expect(segments[0].weight).toBe(10);
  });
});

// ── computeCountdown ──────────────────────────────────────────────────

describe('computeCountdown', () => {
  it('computes hours, minutes, seconds from future timestamp', () => {
    const now = 1000000;
    const future = now + (2 * 3600 + 15 * 60 + 30) * 1000; // 2h 15m 30s
    const result = computeCountdown(future, now);
    expect(result).toEqual({ hours: 2, minutes: 15, seconds: 30 });
  });

  it('returns zeros when nextSpinAt is in the past', () => {
    const now = 1000000;
    const past = now - 5000;
    expect(computeCountdown(past, now)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('returns zeros for equal timestamps (exactly now)', () => {
    const now = 1000000;
    expect(computeCountdown(now, now)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('returns zeros for invalid nextSpinAt', () => {
    expect(computeCountdown(null, 1000)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    expect(computeCountdown(undefined, 1000)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    expect(computeCountdown('garbage', 1000)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('accepts ISO string for nextSpinAt', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    const future = '2026-01-01T01:30:00Z';
    const result = computeCountdown(future, now);
    expect(result).toEqual({ hours: 1, minutes: 30, seconds: 0 });
  });

  it('accepts Date object for nextSpinAt', () => {
    const now = 0;
    const future = new Date(3661000); // 1h 1m 1s
    const result = computeCountdown(future, now);
    expect(result).toEqual({ hours: 1, minutes: 1, seconds: 1 });
  });

  it('floors partial seconds', () => {
    const now = 0;
    const future = 1500; // 1.5 seconds
    const result = computeCountdown(future, now);
    expect(result).toEqual({ hours: 0, minutes: 0, seconds: 1 });
  });
});

// ── renderPendingPrizes ───────────────────────────────────────────────

describe('renderPendingPrizes', () => {
  it('filters to PENDING status only', () => {
    const prizes = [
      { status: 'PENDING', prizeType: 'FREE_SHIP' },
      { status: 'REDEEMED', prizeType: 'DISCOUNT_PCT' },
      { status: 'PENDING', prizeType: 'SWATCH' },
    ];
    const result = renderPendingPrizes(prizes);
    expect(result).toHaveLength(2);
    expect(result[0].prizeType).toBe('FREE_SHIP');
    expect(result[1].prizeType).toBe('SWATCH');
  });

  it('excludes REDEEMED prizes', () => {
    const prizes = [{ status: 'REDEEMED', prizeType: 'POINTS' }];
    expect(renderPendingPrizes(prizes)).toEqual([]);
  });

  it('maps FREE_SHIP to "Free Shipping"', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'FREE_SHIP' }];
    expect(renderPendingPrizes(prizes)[0].label).toBe('Free Shipping');
  });

  it('maps DISCOUNT_PCT to "Discount"', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'DISCOUNT_PCT' }];
    expect(renderPendingPrizes(prizes)[0].label).toBe('Discount');
  });

  it('maps SWATCH to "Free Swatch"', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'SWATCH' }];
    expect(renderPendingPrizes(prizes)[0].label).toBe('Free Swatch');
  });

  it('maps POINTS to "Bonus Points"', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'POINTS' }];
    expect(renderPendingPrizes(prizes)[0].label).toBe('Bonus Points');
  });

  it('falls back to raw prizeType for unknown types', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'MYSTERY_BOX' }];
    expect(renderPendingPrizes(prizes)[0].label).toBe('MYSTERY_BOX');
  });

  it('returns empty for null/undefined input', () => {
    expect(renderPendingPrizes(null)).toEqual([]);
    expect(renderPendingPrizes(undefined)).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(renderPendingPrizes([])).toEqual([]);
  });

  it('includes name when present', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'DISCOUNT_PCT', name: '15% Off' }];
    const result = renderPendingPrizes(prizes);
    expect(result[0].name).toBe('15% Off');
  });

  it('omits name key when absent', () => {
    const prizes = [{ status: 'PENDING', prizeType: 'FREE_SHIP' }];
    const result = renderPendingPrizes(prizes);
    expect(result[0]).not.toHaveProperty('name');
  });
});

// ── renderSpinResult ──────────────────────────────────────────────────

describe('renderSpinResult', () => {
  it('sets isPoints true for POINTS prizes', () => {
    const result = renderSpinResult({ prize: 'Points', prizeType: 'POINTS', pointsAwarded: 100 });
    expect(result.isPoints).toBe(true);
  });

  it('headline contains points amount for POINTS prizes', () => {
    const result = renderSpinResult({ prize: 'Points', prizeType: 'POINTS', pointsAwarded: 250 });
    expect(result.headline).toContain('250');
    expect(result.headline).toContain('points');
  });

  it('sets isPoints false for non-POINTS prizes', () => {
    const result = renderSpinResult({ prize: 'Free Shipping', prizeType: 'FREE_SHIP' });
    expect(result.isPoints).toBe(false);
  });

  it('headline contains prize name for non-POINTS prizes', () => {
    const result = renderSpinResult({ prize: 'Free Shipping', prizeType: 'FREE_SHIP' });
    expect(result.headline).toContain('Free Shipping');
  });

  it('defaults pointsAwarded to 0 if missing', () => {
    const result = renderSpinResult({ prize: 'Points', prizeType: 'POINTS' });
    expect(result.headline).toContain('0');
  });

  it('includes prize and prizeType in output', () => {
    const result = renderSpinResult({ prize: 'A', prizeType: 'SWATCH', pointsAwarded: 0 });
    expect(result.prize).toBe('A');
    expect(result.prizeType).toBe('SWATCH');
  });

  it('handles missing fields gracefully', () => {
    const result = renderSpinResult({});
    expect(result.prize).toBe('');
    expect(result.prizeType).toBe('');
    expect(result.isPoints).toBe(false);
  });
});
