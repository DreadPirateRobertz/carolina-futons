/**
 * @file living-sky.test.js
 * @description TDD tests for cf-4el: living-sky.js core interpolation engine.
 *
 * Covers:
 *  - useLivingSky at key time-of-day waypoints (night, sunrise, midday, golden hour, dusk)
 *  - getSeason: month → spring/summer/fall/winter
 *  - Sun arc: cx rises from ~70 at dawn, peaks ~520 at noon, sets ~1000 at dusk
 *  - Moon phase: shadow offset varies with lunar cycle
 *  - precipitationType: winter cloudOp>0 → 'snow'; spring cloudOp>0.4 → 'mist'; else 'none'
 *  - Edge cases: totalMinutes=1440 wraps correctly, totalMinutes=0 returns night state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLivingSky, getSeason } from '../src/public/living-sky.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Parse a hex color string and return the sum of its RGB channels. */
function hexChannelSum(hex) {
  const h = hex.replace('#', '');
  return parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16);
}

/** Parse a hex color string and return the red channel. */
function hexRed(hex) {
  return parseInt(hex.replace('#', '').slice(0, 2), 16);
}

// ── getSeason ─────────────────────────────────────────────────────────────────

describe('getSeason', () => {
  it.each([
    ['2026-01-15', 'winter',  0],
    ['2026-02-15', 'winter',  1],
    ['2026-03-15', 'spring',  2],
    ['2026-04-15', 'spring',  3],
    ['2026-05-15', 'spring',  4],
    ['2026-06-15', 'summer',  5],
    ['2026-07-15', 'summer',  6],
    ['2026-08-15', 'summer',  7],
    ['2026-09-15', 'fall',    8],
    ['2026-10-15', 'fall',    9],
    ['2026-11-15', 'fall',   10],
    ['2026-12-15', 'winter', 11],
  ])('returns "%s" → %s (month %i)', (date, expected) => {
    expect(getSeason(new Date(date))).toBe(expected);
  });
});

// ── useLivingSky — shape ───────────────────────────────────────────────────────

describe('useLivingSky — return shape', () => {
  it('returns an object with all required LivingSkyState fields', () => {
    const state = useLivingSky(720); // noon
    expect(state).toMatchObject({
      skyColors: expect.arrayContaining([expect.any(String)]),
      glowColors: expect.arrayContaining([expect.any(String)]),
      ridgeColors: expect.objectContaining({
        r1: expect.any(String),
        r2: expect.any(String),
        r3: expect.any(String),
        r4: expect.any(String),
        tree: expect.any(String),
      }),
      sunPos: expect.objectContaining({
        cx: expect.any(Number),
        cy: expect.any(Number),
        r: expect.any(Number),
        opacity: expect.any(Number),
      }),
      moonPos: expect.objectContaining({
        cx: expect.any(Number),
        cy: expect.any(Number),
        opacity: expect.any(Number),
        phase: expect.any(Number),
        shadowOffset: expect.objectContaining({ dx: expect.any(Number), dy: expect.any(Number) }),
      }),
      starOpacity: expect.any(Number),
      cloudOpacity: expect.any(Number),
      birdOpacity: expect.any(Number),
      fireflyOpacity: expect.any(Number),
      owlOpacity: expect.any(Number),
      rimOpacity: expect.any(Number),
      rimColor: expect.any(String),
      navBg: expect.any(String),
      navText: expect.any(String),
      season: expect.stringMatching(/^(spring|summer|fall|winter)$/),
      precipitationOpacity: expect.any(Number),
      precipitationType: expect.stringMatching(/^(snow|mist|none)$/),
    });
    expect(state.skyColors).toHaveLength(4);
    expect(state.glowColors).toHaveLength(2);
  });
});

// ── useLivingSky — time-of-day waypoints ──────────────────────────────────────

describe('useLivingSky(0) — deep night (midnight)', () => {
  it('has dark sky colors (top stop very dark)', () => {
    const { skyColors } = useLivingSky(0);
    const top = skyColors[0];
    expect(top).toMatch(/^#|^rgb/);
    expect(hexChannelSum(top)).toBeLessThan(60);
  });

  it('has high star opacity (night)', () => {
    const { starOpacity } = useLivingSky(0);
    expect(starOpacity).toBeGreaterThan(0.7);
  });

  it('has zero sun opacity (night)', () => {
    const { sunPos } = useLivingSky(0);
    expect(sunPos.opacity).toBe(0);
  });

  it('has high moon opacity (full night)', () => {
    const { moonPos } = useLivingSky(0);
    expect(moonPos.opacity).toBeGreaterThan(0.8);
  });

  it('has high firefly opacity (night)', () => {
    const { fireflyOpacity } = useLivingSky(0);
    expect(fireflyOpacity).toBeGreaterThan(0.4);
  });
});

describe('useLivingSky(420) — sunrise (7am)', () => {
  it('sun is visible (sunPos.opacity > 0.5)', () => {
    const { sunPos } = useLivingSky(420);
    expect(sunPos.opacity).toBeGreaterThan(0.5);
  });

  it('sun cx is in left portion of sky (sunrise arc, cx < 400)', () => {
    const { sunPos } = useLivingSky(420);
    expect(sunPos.cx).toBeLessThan(400);
    expect(sunPos.cx).toBeGreaterThan(0);
  });

  it('has warm horizon colors (sky colors should not be pure dark)', () => {
    const { skyColors } = useLivingSky(420);
    // Bottom stop at sunrise should have a warm/bright red channel
    expect(hexRed(skyColors[3])).toBeGreaterThan(100);
  });

  it('has stars fading out (low star opacity at sunrise)', () => {
    const { starOpacity } = useLivingSky(420);
    expect(starOpacity).toBeLessThan(0.3);
  });
});

describe('useLivingSky(780) — midday (1pm)', () => {
  it('sun is at near-peak position (high opacity)', () => {
    const { sunPos } = useLivingSky(780);
    expect(sunPos.opacity).toBe(1);
  });

  it('sun cx is near center (midday arc peak, 450 < cx < 700)', () => {
    const { sunPos } = useLivingSky(780);
    expect(sunPos.cx).toBeGreaterThan(450);
    expect(sunPos.cx).toBeLessThan(700);
  });

  it('has no stars (full daylight)', () => {
    const { starOpacity } = useLivingSky(780);
    expect(starOpacity).toBe(0);
  });

  it('navBg is white (daytime nav)', () => {
    const { navBg } = useLivingSky(780);
    expect(navBg.toLowerCase()).toContain('ff'); // white or near-white
  });
});

describe('useLivingSky(1140) — golden hour (7pm)', () => {
  it('sun is setting — visible but low opacity (< 1)', () => {
    const { sunPos } = useLivingSky(1140);
    expect(sunPos.opacity).toBeGreaterThan(0);
  });

  it('sun cx is in right portion of sky (setting arc, cx > 700)', () => {
    const { sunPos } = useLivingSky(1140);
    expect(sunPos.cx).toBeGreaterThan(700);
  });

  it('has high rim opacity (rim light at golden hour)', () => {
    const { rimOpacity } = useLivingSky(1140);
    expect(rimOpacity).toBeGreaterThan(0.5);
  });
});

describe('useLivingSky(1320) — dusk (10pm)', () => {
  it('sun is gone (opacity 0)', () => {
    const { sunPos } = useLivingSky(1320);
    expect(sunPos.opacity).toBe(0);
  });

  it('stars are emerging (starOpacity > 0.4)', () => {
    const { starOpacity } = useLivingSky(1320);
    expect(starOpacity).toBeGreaterThan(0.4);
  });

  it('has dark navBg (night mode)', () => {
    const { navBg } = useLivingSky(1320);
    expect(hexChannelSum(navBg)).toBeLessThan(80);
  });
});

// ── Sun arc ───────────────────────────────────────────────────────────────────

describe('useLivingSky — sun arc', () => {
  it('sun cx rises from left at dawn', () => {
    const dawn = useLivingSky(300); // 5am
    const morning = useLivingSky(480); // 8am
    expect(dawn.sunPos.cx).toBeLessThan(morning.sunPos.cx);
  });

  it('sun cx peaks near center at noon', () => {
    const { sunPos } = useLivingSky(720);
    expect(sunPos.cx).toBeGreaterThan(480);
    expect(sunPos.cx).toBeLessThan(580);
  });

  it('sun cx moves rightward toward evening', () => {
    const noon = useLivingSky(720);
    const afternoon = useLivingSky(960);
    expect(afternoon.sunPos.cx).toBeGreaterThan(noon.sunPos.cx);
  });
});

// ── Moon phase ────────────────────────────────────────────────────────────────

describe('useLivingSky — moon phase', () => {
  it('moonPos.phase is between 0 and 29.53', () => {
    const { moonPos } = useLivingSky(0);
    expect(moonPos.phase).toBeGreaterThanOrEqual(0);
    expect(moonPos.phase).toBeLessThan(29.54);
  });

  it('moonPos.shadowOffset.dx varies over lunar cycle', () => {
    vi.useFakeTimers();
    try {
      const knownNewMoon = new Date('2025-01-29T12:36:00Z').getTime();

      vi.setSystemTime(new Date(knownNewMoon));
      const newMoonState = useLivingSky(0);

      vi.setSystemTime(new Date(knownNewMoon + 14.77 * 86400000));
      const fullMoonState = useLivingSky(0);

      expect(newMoonState.moonPos.shadowOffset.dx).not.toBeCloseTo(
        fullMoonState.moonPos.shadowOffset.dx, 0
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── precipitationType ─────────────────────────────────────────────────────────

describe('useLivingSky — precipitationType', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "snow" during winter night with cloudOp > 0', () => {
    // Winter: December
    vi.setSystemTime(new Date('2026-12-15T22:00:00'));
    const state = useLivingSky(300); // 5am — has cloudOp 0.55 in skyTable
    expect(state.season).toBe('winter');
    expect(state.cloudOpacity).toBeGreaterThan(0);
    expect(state.precipitationType).toBe('snow');
  });

  it('returns "mist" during spring when cloudOp > 0.4', () => {
    // Spring: April
    vi.setSystemTime(new Date('2026-04-15T07:00:00'));
    const state = useLivingSky(360); // 6am — cloudOp 0.85 in skyTable
    expect(state.season).toBe('spring');
    expect(state.cloudOpacity).toBeGreaterThan(0.4);
    expect(state.precipitationType).toBe('mist');
  });

  it('returns "none" during summer', () => {
    vi.setSystemTime(new Date('2026-07-15T12:00:00'));
    const state = useLivingSky(720); // noon — no clouds
    expect(state.season).toBe('summer');
    expect(state.precipitationType).toBe('none');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('useLivingSky — edge cases', () => {
  it('totalMinutes=1440 wraps to same state as 0', () => {
    const atZero = useLivingSky(0);
    const atDay  = useLivingSky(1440);
    // Both should be night — sun opacity 0
    expect(atDay.sunPos.opacity).toBe(atZero.sunPos.opacity);
  });

  it('totalMinutes=0 returns deep night (dark sky)', () => {
    const { starOpacity, sunPos } = useLivingSky(0);
    expect(starOpacity).toBeGreaterThan(0.7);
    expect(sunPos.opacity).toBe(0);
  });

  it('handles fractional minutes correctly (e.g., 425.5)', () => {
    // Should not throw
    expect(() => useLivingSky(425.5)).not.toThrow();
    const state = useLivingSky(425.5);
    expect(state.sunPos.opacity).toBeGreaterThan(0);
  });
});
