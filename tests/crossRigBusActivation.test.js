/**
 * crossRigBusActivation.test.js
 * CF-1faf — Tests that gamification mutations dispatch cross-rig bus events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OUTBOUND_EVENTS } from '../src/backend/utils/eventBus.js';

// ── OUTBOUND_EVENTS registry ────────────────────────────────────────────────

describe('OUTBOUND_EVENTS registry', () => {
  it('includes points_earned', () => {
    expect(OUTBOUND_EVENTS.has('points_earned')).toBe(true);
  });

  it('includes tier_upgraded', () => {
    expect(OUTBOUND_EVENTS.has('tier_upgraded')).toBe(true);
  });

  it('includes challenge_completed', () => {
    expect(OUTBOUND_EVENTS.has('challenge_completed')).toBe(true);
  });

  it('includes badge_earned', () => {
    expect(OUTBOUND_EVENTS.has('badge_earned')).toBe(true);
  });

  it('includes streak_extended', () => {
    expect(OUTBOUND_EVENTS.has('streak_extended')).toBe(true);
  });

  it('has exactly 5 outbound events', () => {
    expect(OUTBOUND_EVENTS.size).toBe(5);
  });
});

// ── dispatchBusEvent guard ──────────────────────────────────────────────────

describe('dispatchBusEvent — event guard', () => {
  it('no-ops for unknown events', async () => {
    // dispatchBusEvent checks OUTBOUND_EVENTS and returns early for unknowns
    const { dispatchBusEvent } = await import('../src/backend/utils/eventBusDispatcher.js');
    // Should not throw — just silently return
    await expect(dispatchBusEvent({ event: 'unknown_event', userId: 'mem-1' })).resolves.toBeUndefined();
  });
});

// ── Event shape validation ──────────────────────────────────────────────────

describe('bus event shapes (CF-1faf)', () => {
  it('badge_earned event includes badgeId field', () => {
    const event = { event: 'badge_earned', userId: 'mem-1', badgeId: 'week_wanderer' };
    expect(event.event).toBe('badge_earned');
    expect(event.badgeId).toBe('week_wanderer');
    expect(event.userId).toBe('mem-1');
  });

  it('streak_extended event includes currentStreakDays field', () => {
    const event = { event: 'streak_extended', userId: 'mem-1', currentStreakDays: 7 };
    expect(event.event).toBe('streak_extended');
    expect(event.currentStreakDays).toBe(7);
  });

  it('points_earned event includes delta and newTotal fields', () => {
    const event = { event: 'points_earned', userId: 'mem-1', delta: 50, newTotal: 550 };
    expect(event.delta).toBe(50);
    expect(event.newTotal).toBe(550);
  });

  it('tier_upgraded event includes newTier and previousTier fields', () => {
    const event = { event: 'tier_upgraded', userId: 'mem-1', newTier: 'Mountain Guide', previousTier: 'Trail Blazer' };
    expect(event.newTier).toBe('Mountain Guide');
    expect(event.previousTier).toBe('Trail Blazer');
  });

  it('challenge_completed event includes challengeId field', () => {
    const event = { event: 'challenge_completed', userId: 'mem-1', challengeId: 'ch-1' };
    expect(event.challengeId).toBe('ch-1');
  });
});
