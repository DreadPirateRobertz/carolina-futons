import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from './__mocks__/wix-data.js';
import {
  GAMIFICATION_ACTION_LIMITS,
  GAMIFICATION_DAILY_CAP,
  checkGamificationRateLimit,
} from '../src/backend/utils/gamificationRateLimit.js';

beforeEach(() => { __reset(); });

// ── GAMIFICATION_ACTION_LIMITS ────────────────────────────────────────────────

describe('GAMIFICATION_ACTION_LIMITS', () => {
  it('defines all required action types', () => {
    const required = [
      'gamification_order_complete',
      'gamification_add_to_cart',
      'gamification_submit_review',
      'spinWheel',
      'challenge_progress',
    ];
    required.forEach(key => {
      expect(GAMIFICATION_ACTION_LIMITS[key], `missing limit for ${key}`).toBeDefined();
    });
  });

  it('each limit has max and windowMs as positive numbers', () => {
    for (const [key, limit] of Object.entries(GAMIFICATION_ACTION_LIMITS)) {
      expect(typeof limit.max, `${key}.max`).toBe('number');
      expect(limit.max, `${key}.max > 0`).toBeGreaterThan(0);
      expect(typeof limit.windowMs, `${key}.windowMs`).toBe('number');
      expect(limit.windowMs, `${key}.windowMs > 0`).toBeGreaterThan(0);
    }
  });

  it('gamification_order_complete is 50/day', () => {
    const l = GAMIFICATION_ACTION_LIMITS.gamification_order_complete;
    expect(l.max).toBe(50);
    expect(l.windowMs).toBe(24 * 3600_000);
  });

  it('gamification_add_to_cart is 10/hr', () => {
    const l = GAMIFICATION_ACTION_LIMITS.gamification_add_to_cart;
    expect(l.max).toBe(10);
    expect(l.windowMs).toBe(3600_000);
  });

  it('gamification_submit_review is 3/hr', () => {
    expect(GAMIFICATION_ACTION_LIMITS.gamification_submit_review.max).toBe(3);
  });
});

describe('GAMIFICATION_DAILY_CAP', () => {
  it('has max and 24h windowMs', () => {
    expect(GAMIFICATION_DAILY_CAP.max).toBeGreaterThan(0);
    expect(GAMIFICATION_DAILY_CAP.windowMs).toBe(24 * 3600_000);
  });
});

// ── checkGamificationRateLimit — happy path ───────────────────────────────────

describe('checkGamificationRateLimit — allowed', () => {
  it('allows first call for a known action type', async () => {
    const result = await checkGamificationRateLimit('mem-1', 'gamification_order_complete');
    expect(result.allowed).toBe(true);
  });

  it('allows first call for an unknown action type (daily cap only)', async () => {
    const result = await checkGamificationRateLimit('mem-1', 'discovery_constellation-orion');
    expect(result.allowed).toBe(true);
  });

  it('allows up to the action limit for a single action type', async () => {
    const NOW = Date.now();
    // gamification_submit_review: max 3/hr
    for (let i = 0; i < 3; i++) {
      const r = await checkGamificationRateLimit('mem-r', 'gamification_submit_review', { now: NOW });
      expect(r.allowed, `call ${i + 1}`).toBe(true);
    }
  });
});

// ── checkGamificationRateLimit — action-type limit ───────────────────────────

describe('checkGamificationRateLimit — action-type limit', () => {
  it('blocks after exceeding per-action limit (gamification_submit_review: 3/hr)', async () => {
    const NOW = Date.now();
    for (let i = 0; i < 3; i++) {
      await checkGamificationRateLimit('mem-2', 'gamification_submit_review', { now: NOW });
    }
    const result = await checkGamificationRateLimit('mem-2', 'gamification_submit_review', { now: NOW });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('action_rate_limited');
    expect(result.reason).toContain('gamification_submit_review');
  });

  it('different users have independent buckets', async () => {
    const NOW = Date.now();
    for (let i = 0; i < 3; i++) {
      await checkGamificationRateLimit('mem-a', 'gamification_submit_review', { now: NOW });
    }
    // mem-a is blocked but mem-b should still be allowed
    const resultA = await checkGamificationRateLimit('mem-a', 'gamification_submit_review', { now: NOW });
    const resultB = await checkGamificationRateLimit('mem-b', 'gamification_submit_review', { now: NOW });
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('batch of 10 same-action events (add_to_cart): 10 allowed, 11th blocked', async () => {
    const NOW = Date.now();
    for (let i = 0; i < 10; i++) {
      const r = await checkGamificationRateLimit('mem-3', 'gamification_add_to_cart', { now: NOW });
      expect(r.allowed, `event ${i + 1}`).toBe(true);
    }
    const blocked = await checkGamificationRateLimit('mem-3', 'gamification_add_to_cart', { now: NOW });
    expect(blocked.allowed).toBe(false);
  });

  it('window reset allows again after windowMs', async () => {
    const START = 1_000_000;
    for (let i = 0; i < 3; i++) {
      await checkGamificationRateLimit('mem-4', 'gamification_submit_review', { now: START });
    }
    // Advance past 1hr window
    const AFTER = START + 3600_001;
    const result = await checkGamificationRateLimit('mem-4', 'gamification_submit_review', { now: AFTER });
    expect(result.allowed).toBe(true);
  });
});

// ── checkGamificationRateLimit — daily cap ────────────────────────────────────

describe('checkGamificationRateLimit — daily cap (cross-action-type spam)', () => {
  it('daily cap blocks after GAMIFICATION_DAILY_CAP.max total events', async () => {
    const NOW = Date.now();
    const { max } = GAMIFICATION_DAILY_CAP;
    // Exhaust the daily cap using add_to_cart (high per-action limit: 10/hr)
    // We need to simulate max calls but reset the 10/hr window in between
    // Use an unknown action type (no per-action limit) to isolate the daily cap
    for (let i = 0; i < max; i++) {
      const r = await checkGamificationRateLimit('mem-5', 'discovery_event', { now: NOW });
      expect(r.allowed, `call ${i + 1}`).toBe(true);
    }
    const blocked = await checkGamificationRateLimit('mem-5', 'discovery_event', { now: NOW });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('daily_cap_exceeded');
  });

  it('spreading across multiple action types still hits daily cap', async () => {
    const NOW = Date.now();
    const { max } = GAMIFICATION_DAILY_CAP;
    // Use 3 different action types, spreading calls across them
    // Using unknown types to avoid per-action-type limits
    const actions = ['disc_a', 'disc_b', 'disc_c'];
    let total = 0;
    let blocked = false;
    outer:
    for (let round = 0; round < Math.ceil(max / actions.length) + 1; round++) {
      for (const action of actions) {
        const r = await checkGamificationRateLimit('mem-6', action, { now: NOW });
        total++;
        if (!r.allowed) {
          expect(r.reason).toBe('daily_cap_exceeded');
          expect(total).toBeGreaterThan(max); // blocked on the (max+1)th call
          blocked = true;
          break outer;
        }
      }
    }
    expect(blocked).toBe(true);
  });
});
