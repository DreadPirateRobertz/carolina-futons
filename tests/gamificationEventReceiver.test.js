/**
 * @file gamificationEventReceiver.test.js
 * @description TDD tests for CF-eo88: gamification event receiver.
 *
 * Covers:
 *  - Each valid event name awards correct points
 *  - has_photo bonus applied correctly
 *  - Unknown event: no-op, returns current total without error
 *  - Missing memberId: returns { success: false }
 *  - CMS write failure (insert, update, query): returns { success: false }
 *  - Unknown event query failure: returns { success: false }
 *  - Points accumulation across multiple events
 *  - Tier advancement detected and returned (including boundary at 500)
 *  - First event creates new MemberPoints record
 *  - Subsequent event updates existing record with correct tier persisted
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
  __setInsertError,
  __setUpdateError,
  __getInserted,
  __onUpdate,
  __onInsert,
} from './__mocks__/wix-data.js';
import { receiveGamificationEvent, updateStreakState, updateChallengeProgress, checkWishlistDailyCap, recordWishlistAdd, getActiveChallenges, _resetActiveChallengesRateLimit, recordChallengeProgress, _resetRecordChallengeProgressRateLimit } from '../src/backend/gamificationEventReceiver.web.js';
import { POINT_VALUES } from '../src/public/gamificationTokens.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  _resetActiveChallengesRateLimit();
  _resetRecordChallengeProgressRateLimit();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('receiveGamificationEvent — input validation', () => {
  it('returns { success: false } when memberId is missing', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, null);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns { success: false } when memberId is empty string', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, '');
    expect(result.success).toBe(false);
  });
});

// ── add_to_cart (+5 pts) ──────────────────────────────────────────────────────

describe('gamification_add_to_cart', () => {
  it('awards 5 points to a new member', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', { product_id: 'p1' }, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(5);
  });

  it('awards 5 points on top of existing balance', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', { product_id: 'p1' }, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(105);
  });

  it('inserts a new MemberPoints record on first event', async () => {
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-new');
    const inserted = __getInserted('MemberPoints');
    const record = inserted.find(r => r.memberId === 'mem-new');
    expect(record).toBeDefined();
    expect(record.totalPoints).toBe(5);
  });

  it('updates existing MemberPoints record on subsequent event with correct totalPoints and tier', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(updated.length).toBe(1);
    expect(updated[0].item.totalPoints).toBe(55);
    expect(updated[0].item.tier).toBe('Trail Blazer');
  });
});

// ── submit_review (+50, +25 bonus if has_photo) ───────────────────────────────

describe('gamification_submit_review', () => {
  it('awards 50 points when has_photo is false', async () => {
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { product_id: 'p1', rating: 5, has_photo: false },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(50);
  });

  it('awards 75 points when has_photo is true', async () => {
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { product_id: 'p1', rating: 4, has_photo: true },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(75);
  });

  it('awards 50 points when has_photo is absent', async () => {
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { product_id: 'p1', rating: 3 },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(50);
  });
});

// ── referral_shared (+100 pts) ────────────────────────────────────────────────

describe('gamification_referral_shared', () => {
  it('awards 100 points', async () => {
    const result = await receiveGamificationEvent(
      'gamification_referral_shared',
      { referral_code: 'REF123' },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(100);
  });
});

// ── Unknown event — no-op ─────────────────────────────────────────────────────

describe('unknown event name', () => {
  it('returns success:true with current total and no tier change', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 200, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_mystery_event', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(200);
    expect(result.tierChanged).toBe(false);
  });

  it('returns success:true with 0 total for a member with no record', async () => {
    const result = await receiveGamificationEvent('gamification_unknown', {}, 'mem-new');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(0);
  });

  it('does not write to MemberPoints on unknown event', async () => {
    await receiveGamificationEvent('gamification_unknown', {}, 'mem-1');
    expect(__getInserted('MemberPoints')).toHaveLength(0);
  });

  it('returns { success: false } when query throws on unknown event', async () => {
    __setQueryError('MemberPoints', new Error('DB read failed'));
    const result = await receiveGamificationEvent('gamification_unknown', {}, 'mem-1');
    expect(result.success).toBe(false);
  });
});

// ── CMS write failure ─────────────────────────────────────────────────────────

describe('CMS write failure', () => {
  it('returns { success: false } when insert throws', async () => {
    __setInsertError('MemberPoints', new Error('DB write failed'));
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when update throws', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    __setUpdateError('MemberPoints', new Error('DB update failed'));
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when query throws', async () => {
    __setQueryError('MemberPoints', new Error('DB read failed'));
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(false);
  });
});

// ── Points accumulation ───────────────────────────────────────────────────────

describe('points accumulation', () => {
  it('accumulates across multiple events in sequence', async () => {
    // add_to_cart (+5) then submit_review (+50) = 55
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const result = await receiveGamificationEvent('gamification_submit_review', { has_photo: false }, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(55);
  });

  it('accumulates add_to_cart + photo_review = 80 points', async () => {
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { has_photo: true },
      'mem-1'
    );
    expect(result.newTotal).toBe(80);
  });
});

// ── Tier transitions ──────────────────────────────────────────────────────────

describe('tier transitions', () => {
  it('tierChanged is false when points stay within the same tier', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.tierChanged).toBe(false);
    expect(result.newTier).toBe('Trail Blazer');
  });

  it('tierChanged is true and newTier correct when crossing 500-point threshold', async () => {
    // Start at 495, add referral_shared (+100) → 595 → Mountain Guide
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 495, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_referral_shared', {}, 'mem-1');
    expect(result.tierChanged).toBe(true);
    expect(result.newTier).toBe('Mountain Guide');
    expect(result.newTotal).toBe(595);
  });

  it('tierChanged is true exactly at the 500-point boundary', async () => {
    // 499 → +5 (add_to_cart) = 504 → Mountain Guide
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 499, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.tierChanged).toBe(true);
    expect(result.newTier).toBe('Mountain Guide');
  });

  it('tierChanged is false at 499 points (one point below boundary)', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 494, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.tierChanged).toBe(false);
    expect(result.newTier).toBe('Trail Blazer');
  });

  it('tierChanged is false on first event when tier stays at Trail Blazer', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-new');
    expect(result.tierChanged).toBe(false);
    expect(result.newTier).toBe('Trail Blazer');
  });

  it('newTier is Trail Blazer on first add_to_cart event', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.newTier).toBe('Trail Blazer');
  });
});

// ── Per-member isolation ──────────────────────────────────────────────────────

describe('per-member isolation', () => {
  it('events for different members do not interfere', async () => {
    await receiveGamificationEvent('gamification_referral_shared', {}, 'mem-A');
    const resultB = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-B');
    expect(resultB.newTotal).toBe(5); // mem-B unaffected by mem-A's 100 pts
  });
});

// ── gamification_order_complete (Math.floor(orderTotal) pts) ─────────────────

describe('gamification_order_complete', () => {
  beforeEach(() => {
    __reset();
  });

  it('awards Math.floor(orderTotal) points for a whole-dollar amount', async () => {
    const result = await receiveGamificationEvent(
      'gamification_order_complete',
      { orderTotal: 75 },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(75);
  });

  it('rounds down fractional orderTotal (49.99 → 49)', async () => {
    const result = await receiveGamificationEvent(
      'gamification_order_complete',
      { orderTotal: 49.99 },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(49);
  });

  it('awards 0 points when orderTotal is missing', async () => {
    const result = await receiveGamificationEvent(
      'gamification_order_complete',
      {},
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(0);
  });

  it('awards 0 points when orderTotal is 0', async () => {
    const result = await receiveGamificationEvent(
      'gamification_order_complete',
      { orderTotal: 0 },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(0);
  });

  it('stacks on existing member balance', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 200, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent(
      'gamification_order_complete',
      { orderTotal: 35.50 },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(235); // 200 + Math.floor(35.50)
  });
});

// ── Bonus spin grants ────────────────────────────────────────────────────────

describe('bonus spin grants', () => {
  beforeEach(() => {
    __reset();
  });

  it('increments bonusSpinsAvailable when active grant matches event', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_add_to_cart', active: true, spinsGranted: 1 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdate = updated.find(u => u.collection === 'MemberPoints');
    expect(mpUpdate).toBeDefined();
    expect(mpUpdate.item.bonusSpinsAvailable).toBe(1);
  });

  it('does not increment bonusSpinsAvailable when grant is inactive', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_add_to_cart', active: false, spinsGranted: 1 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdate = updated.find(u => u.collection === 'MemberPoints');
    expect(mpUpdate).toBeDefined();
    expect(mpUpdate.item.bonusSpinsAvailable).toBe(0);
  });

  it('respects spinsGranted > 1', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_submit_review', active: true, spinsGranted: 3 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_submit_review', { has_photo: false }, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(3);
  });

  it('stacks on existing bonusSpinsAvailable balance', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_referral_shared', active: true, spinsGranted: 1 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 5 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_referral_shared', {}, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(6);
  });

  it('order_complete event also triggers bonus spin check', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_order_complete', active: true, spinsGranted: 2 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_order_complete', { orderTotal: 25 }, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(2);
  });

  it('sets bonusSpinsAvailable on insert for new member with active grant', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_add_to_cart', active: true, spinsGranted: 1 },
    ]);
    const inserted = [];
    __onInsert((collection, item) => inserted.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-new');
    const mpInsert = inserted.find(i => i.collection === 'MemberPoints');
    expect(mpInsert).toBeDefined();
    expect(mpInsert.item.bonusSpinsAvailable).toBe(1);
  });

  it('no bonus spin when no grants exist for the event', async () => {
    // No BonusSpinGrants seeded at all
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer', bonusSpinsAvailable: 2 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdate = updated.find(u => u.collection === 'MemberPoints');
    expect(mpUpdate.item.bonusSpinsAvailable).toBe(2); // unchanged
  });
});

// ── Streak multiplier — integration with receiveGamificationEvent ─────────────

describe('streak multiplier — integration', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // today=2026-03-22, yesterday=2026-03-21
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies 1.5x multiplier (3-day streak) to add_to_cart base 5 → 8', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', // yesterday → streak 3→4, stays 1.5x
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Math.round(5 * 1.5) = 8
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(8);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('applies 2x multiplier (day 7+) to submit_review base 50 → 100', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 7, streakStartDate: '2026-03-15',
      lastActivityDate: '2026-03-21', // yesterday → streak 7→8, multiplier stays 2x, no milestone
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_submit_review', { has_photo: false }, 'mem-1');
    // Math.round(50 * 2) = 100, milestoneBonus = 0 (only fires exactly at day 7)
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(100);
    expect(result.streakMultiplier).toBe(2);
  });

  it('fires milestoneBonus of 100 pts + milestoneUnlocked when streak crosses to day 7', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', // yesterday → streak 6→7
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // streak → 7, multiplier → 2x, Math.round(5 * 2) = 10, milestoneBonus = 100
    expect(result.newTotal).toBe(110);
    expect(result.milestoneUnlocked).toBe(true);
  });

  it('returns currentStreakDays and streakMultiplier in result', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21', // yesterday → 2→3 days, 1x→1.5x
      streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.currentStreakDays).toBe(3);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('resets streak to 1 when last activity was 2+ days ago', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 10, streakStartDate: '2026-03-01',
      lastActivityDate: '2026-03-20', // 2 days ago — missed yesterday
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Reset: streak → 1, multiplier → 1x, Math.round(5 * 1) = 5
    expect(result.currentStreakDays).toBe(1);
    expect(result.streakMultiplier).toBe(1);
    expect(result.newTotal).toBe(5);
  });

  it('does not increment streak on same-day second event', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 8, tier: 'Trail Blazer',
      currentStreakDays: 4, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-22', // today — already active
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Same-day no-op: streak stays at 4, multiplier stays 1.5x
    // Math.round(5 * 1.5) = 8; total = 8 + 8 = 16
    expect(result.currentStreakDays).toBe(4);
    expect(result.newTotal).toBe(16);
  });

  it('persists streak fields in the MemberPoints update', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21', // yesterday
      streakMultiplier: 1,
    }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdate = updated.find(u => u.collection === 'MemberPoints');
    expect(mpUpdate.item.currentStreakDays).toBe(3);
    expect(mpUpdate.item.streakMultiplier).toBe(1.5);
    expect(mpUpdate.item.lastActivityDate).toBe('2026-03-22');
  });

  it('non-points spin (FREE_SHIP) increments streak but newTotal unchanged', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21', // yesterday → 2→3 days, 1.5x
      streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_spin_completed', { prizeType: 'FREE_SHIP' }, 'mem-1');
    // basePoints=0, Math.round(0 * 1.5) = 0 → total unchanged
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(3);
    expect(result.streakMultiplier).toBe(1.5);
    expect(result.newTotal).toBe(50);
  });

  it('ET midnight boundary — correct streak at 00:01 ET (EST, Jan date)', async () => {
    // 2026-01-15T05:01:00Z = 00:01 EST (UTC-5 in Jan) → today=2026-01-15, yesterday=2026-01-14
    vi.setSystemTime(new Date('2026-01-15T05:01:00Z'));
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-01-12',
      lastActivityDate: '2026-01-14', // yesterday in ET
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // streak 3→4, stays 1.5x
    expect(result.currentStreakDays).toBe(4);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('badge de-dup — week_wanderer not re-inserted when already in MemberBadges', async () => {
    __seed('MemberBadges', [{ _id: 'mb-1', memberId: 'mem-1', badgeId: 'week_wanderer' }]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', // yesterday → streak 6→7, milestone fires
      streakMultiplier: 1.5,
    }]);
    const badgeInserts = [];
    __onInsert((collection, item) => {
      if (collection === 'MemberBadges') badgeInserts.push(item);
    });
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.milestoneUnlocked).toBe(true);
    expect(badgeInserts).toHaveLength(0); // badge already exists — not re-inserted
  });

  it('week_wanderer badge inserted when not yet in MemberBadges', async () => {
    // No MemberBadges seeded — badge should be inserted on first 7-day milestone
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', // yesterday → streak 6→7
      streakMultiplier: 1.5,
    }]);
    const badgeInserts = [];
    __onInsert((collection, item) => {
      if (collection === 'MemberBadges') badgeInserts.push(item);
    });
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(badgeInserts).toHaveLength(1);
    expect(badgeInserts[0].badgeId).toBe('week_wanderer');
    expect(badgeInserts[0].memberId).toBe('mem-1');
  });
});

// ── updateStreakState ─────────────────────────────────────────────────────────

describe('updateStreakState', () => {
  const TODAY = '2026-03-22';
  const YESTERDAY = '2026-03-21';

  describe('same-day no-op (lastActivityDate === todayET)', () => {
    it('returns existing streak fields unchanged', () => {
      const record = {
        currentStreakDays: 4,
        streakStartDate: '2026-03-18',
        lastActivityDate: TODAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(4);
      expect(result.streakMultiplier).toBe(1.5);
      expect(result.lastActivityDate).toBe(TODAY);
    });

    it('returns milestoneBonus = 0 (not undefined) on same-day no-op', () => {
      const record = {
        currentStreakDays: 7,
        streakStartDate: '2026-03-15',
        lastActivityDate: TODAY,
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(0);
    });
  });

  describe('increment (lastActivityDate === yesterdayET)', () => {
    it('increments currentStreakDays by 1', () => {
      const record = {
        currentStreakDays: 2,
        streakStartDate: '2026-03-20',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(3);
    });

    it('upgrades multiplier when crossing into 1.5x tier (days 2→3)', () => {
      const record = {
        currentStreakDays: 2,
        streakStartDate: '2026-03-20',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakMultiplier).toBe(1.5);
    });

    it('upgrades multiplier when crossing into 2x tier (days 6→7)', () => {
      const record = {
        currentStreakDays: 6,
        streakStartDate: '2026-03-16',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(7);
      expect(result.streakMultiplier).toBe(2);
    });

    it('fires milestoneBonus = STREAK_7_DAY when crossing to day 7', () => {
      const record = {
        currentStreakDays: 6,
        streakStartDate: '2026-03-16',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(POINT_VALUES.STREAK_7_DAY); // 100
    });

    it('does NOT fire milestoneBonus when crossing to day 8 (already past milestone)', () => {
      const record = {
        currentStreakDays: 7,
        streakStartDate: '2026-03-15',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(0);
      expect(result.currentStreakDays).toBe(8);
    });

    it('sets lastActivityDate to todayET', () => {
      const record = {
        currentStreakDays: 3,
        streakStartDate: '2026-03-19',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.lastActivityDate).toBe(TODAY);
    });
  });

  describe('reset (missed ≥1 day or no prior activity)', () => {
    it('resets currentStreakDays to 1 when last activity was 2+ days ago', () => {
      const record = {
        currentStreakDays: 10,
        streakStartDate: '2026-03-01',
        lastActivityDate: '2026-03-19', // 3 days ago
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
    });

    it('resets multiplier to 1 on reset', () => {
      const record = {
        currentStreakDays: 10,
        streakStartDate: '2026-03-01',
        lastActivityDate: '2026-03-10',
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakMultiplier).toBe(1);
    });

    it('sets streakStartDate to todayET on reset', () => {
      const record = {
        currentStreakDays: 5,
        streakStartDate: '2026-03-01',
        lastActivityDate: '2026-03-10',
        streakMultiplier: 1.5,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakStartDate).toBe(TODAY);
    });

    it('milestoneBonus = 0 on reset', () => {
      const record = { currentStreakDays: 5, lastActivityDate: '2026-03-10', streakMultiplier: 1.5 };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.milestoneBonus).toBe(0);
    });

    it('resets correctly for new member with no streak fields (null/undefined)', () => {
      const record = { currentStreakDays: null, lastActivityDate: null, streakMultiplier: null };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
      expect(result.streakMultiplier).toBe(1);
      expect(result.streakStartDate).toBe(TODAY);
    });
  });
});

// ── updateChallengeProgress ───────────────────────────────────────────────────

const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';

const BASE_CHALLENGE = {
  _id: 'ch-1',
  challengeId: 'ch-1',
  title: 'First Steps',
  conditionType: 'ORDER_COMPLETE',
  targetCount: 3,
  rewardPoints: 100,
  rewardBadgeId: null,
  expiresAt: new Date('2027-01-01T00:00:00Z'),
  active: true,
};

describe('updateChallengeProgress', () => {
  beforeEach(() => __reset());

  it('creates a new progress record and increments to 1 on first event', async () => {
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.progressValue).toBe(1);
    expect(result.justCompleted).toBe(false);
    const inserted = __getInserted(CHALLENGE_PROGRESS_COLLECTION);
    expect(inserted[0]).toMatchObject({
      memberId: 'member-1',
      challengeId: 'ch-1',
      progressValue: 1,
    });
  });

  it('increments existing progress record', async () => {
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 1,
        eventIds: JSON.stringify(['evt-000']),
        completedAt: null,
        notifiedAt: null,
      },
    ]);
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.progressValue).toBe(2);
    expect(result.justCompleted).toBe(false);
  });

  it('does NOT increment when eventId is already in eventIds (idempotency)', async () => {
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 1,
        eventIds: JSON.stringify(['evt-001']),
        completedAt: null,
        notifiedAt: null,
      },
    ]);
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.alreadyProcessed).toBe(true);
    expect(result.progressValue).toBe(1);
  });

  it('sets justCompleted: true and completedAt when progressValue reaches targetCount', async () => {
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 2,
        eventIds: JSON.stringify(['evt-000', 'evt-001']),
        completedAt: null,
        notifiedAt: null,
      },
    ]);
    const now = new Date('2026-03-22T14:00:00Z');
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-002', now);
    expect(result.progressValue).toBe(3);
    expect(result.justCompleted).toBe(true);
    expect(result.completedAt).toEqual(now);
  });

  it('does NOT increment past targetCount (already completed challenge)', async () => {
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 3,
        eventIds: JSON.stringify(['evt-000', 'evt-001', 'evt-002']),
        completedAt: new Date('2026-03-22T10:00:00Z'),
        notifiedAt: null,
      },
    ]);
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-003', new Date());
    expect(result.alreadyCompleted).toBe(true);
    expect(result.progressValue).toBe(3);
  });

  it('trims eventIds to 501 entries when array reaches 1000 before appending', async () => {
    const bigIds = Array.from({ length: 1000 }, (_, i) => `evt-${i}`);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      {
        _id: 'prog-1',
        memberId: 'member-1',
        challengeId: 'ch-1',
        progressValue: 1,
        eventIds: JSON.stringify(bigIds),
        completedAt: null,
        notifiedAt: null,
      },
    ]);

    let writtenRecord = null;
    __onUpdate((collection, item) => {
      if (collection === CHALLENGE_PROGRESS_COLLECTION) writtenRecord = item;
    });

    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-new', new Date());
    expect(result.progressValue).toBe(2);
    expect(result.justCompleted).toBe(false);
    expect(writtenRecord).not.toBeNull();
    const writtenIds = JSON.parse(writtenRecord.eventIds);
    expect(writtenIds).toHaveLength(501);
    // Newest 500 kept: evt-500 through evt-999, plus 'evt-new'
    expect(writtenIds).toContain('evt-999');
    expect(writtenIds).toContain('evt-new');
    expect(writtenIds).not.toContain('evt-0'); // oldest trimmed
  });

  it('returns { progressError: true } without throwing when wix-data query fails', async () => {
    __setQueryError(CHALLENGE_PROGRESS_COLLECTION, new Error('DB unavailable'));
    const result = await updateChallengeProgress('member-1', BASE_CHALLENGE, 'evt-001', new Date());
    expect(result.progressError).toBe(true);
  });
});

// ── gamification_ar_used (+10 pts) ────────────────────────────────────────────

describe('gamification_ar_used', () => {
  it('awards POINT_VALUES.AR_USED (10) points to a new member', async () => {
    const result = await receiveGamificationEvent('gamification_ar_used', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(POINT_VALUES.AR_USED);
  });

  it('awards AR_USED on top of existing balance', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_ar_used', {}, 'mem-1');
    expect(result.newTotal).toBe(50 + POINT_VALUES.AR_USED);
  });
});

// ── gamification_wishlist_add (+2 pts, 5/day cap) ─────────────────────────────

describe('gamification_wishlist_add', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('awards POINT_VALUES.WISHLIST_ADD (2) when under daily cap', async () => {
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(POINT_VALUES.WISHLIST_ADD);
  });

  it('awards 0 points when daily cap (5/day) is reached', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(50); // 0 effective points
  });

  it('awards points on exactly the 5th add today (4 existing entries)', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
    ]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.newTotal).toBe(POINT_VALUES.WISHLIST_ADD);
  });

  it('writes a WishlistAddLog entry when cap not reached', async () => {
    await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    const logs = __getInserted('WishlistAddLog');
    expect(logs).toHaveLength(1);
    expect(logs[0].memberId).toBe('mem-1');
    expect(logs[0].date).toBe('2026-03-22');
  });

  it('does NOT write WishlistAddLog when cap is reached', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
    ]);
    const wishlistInserts = [];
    __onInsert((collection, item) => {
      if (collection === 'WishlistAddLog') wishlistInserts.push(item);
    });
    await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(wishlistInserts).toHaveLength(0);
  });

  it('still updates MemberPoints record when cap is reached (streak continuity)', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const updates = [];
    __onUpdate((col, item) => { if (col === 'MemberPoints') updates.push(item); });
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(updates).toHaveLength(1); // streak state written even when 0 points earned
  });

  it('still returns success when WishlistAddLog insert fails (best-effort)', async () => {
    __setInsertError('WishlistAddLog', new Error('log insert failed'));
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(POINT_VALUES.WISHLIST_ADD);
  });

  it('only counts log entries for the correct member and date', async () => {
    // Same date, different member — should not count against mem-1
    __seed('WishlistAddLog', [
      { memberId: 'mem-other', date: '2026-03-22' },
      { memberId: 'mem-other', date: '2026-03-22' },
      { memberId: 'mem-other', date: '2026-03-22' },
      { memberId: 'mem-other', date: '2026-03-22' },
      { memberId: 'mem-other', date: '2026-03-22' },
    ]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.newTotal).toBe(POINT_VALUES.WISHLIST_ADD);
  });
});

// ── checkWishlistDailyCap ─────────────────────────────────────────────────────

describe('checkWishlistDailyCap', () => {
  it('returns { canEarn: true, count: 0 } when no entries today', async () => {
    const result = await checkWishlistDailyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 0 });
  });

  it('returns { canEarn: true, count: 3 } when 3 entries today', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
    ]);
    const result = await checkWishlistDailyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 3 });
  });

  it('returns { canEarn: false, count: 5 } when at cap', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
      { memberId: 'mem-1', date: '2026-03-22' },
    ]);
    const result = await checkWishlistDailyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: false, count: 5 });
  });

  it("ignores yesterday's entries when checking today's cap", async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-21' },
      { memberId: 'mem-1', date: '2026-03-21' },
      { memberId: 'mem-1', date: '2026-03-21' },
      { memberId: 'mem-1', date: '2026-03-21' },
      { memberId: 'mem-1', date: '2026-03-21' },
    ]);
    const result = await checkWishlistDailyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 0 });
  });

  it('fails open — returns { canEarn: true, count: 0 } when query throws', async () => {
    __setQueryError('WishlistAddLog', new Error('DB unavailable'));
    const result = await checkWishlistDailyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 0 });
  });
});

// ── recordWishlistAdd ─────────────────────────────────────────────────────────

describe('recordWishlistAdd', () => {
  it('inserts a WishlistAddLog entry with memberId and date', async () => {
    await recordWishlistAdd('mem-1', '2026-03-22');
    const inserted = __getInserted('WishlistAddLog');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ memberId: 'mem-1', date: '2026-03-22' });
  });
});

// ── getActiveChallenges ───────────────────────────────────────────────────────

const CHALLENGES_COLLECTION = 'Challenges';

describe('getActiveChallenges', () => {
  beforeEach(() => { __reset(); _resetActiveChallengesRateLimit(); });
  afterEach(() => vi.useRealTimers());

  it('returns empty challenges array when no active challenges exist', async () => {
    const result = await getActiveChallenges('member-1');
    expect(result).toEqual({ challenges: [] });
  });

  it('returns up to 5 active challenges sorted by expiresAt ASC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'A', conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null, expiresAt: new Date('2026-04-05T00:00:00Z'), active: true },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'B', conditionType: 'REVIEW_SUBMITTED', targetCount: 3, rewardPoints: 20, rewardBadgeId: null, expiresAt: new Date('2026-03-28T00:00:00Z'), active: true },
      { _id: 'ch-3', challengeId: 'ch-3', title: 'C', conditionType: 'AR_USED', targetCount: 1, rewardPoints: 25, rewardBadgeId: 'ar_explorer', expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges).toHaveLength(3);
    // Sorted expiresAt ASC: B (Mar 28), C (Apr 1), A (Apr 5)
    expect(result.challenges[0].challengeId).toBe('ch-2');
    expect(result.challenges[1].challengeId).toBe('ch-3');
    expect(result.challenges[2].challengeId).toBe('ch-1');
  });

  it('excludes expired challenges (expiresAt < now) even when active = true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'Active', conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null, expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
      { _id: 'ch-2', challengeId: 'ch-2', title: 'Expired', conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null, expiresAt: new Date('2026-01-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0].challengeId).toBe('ch-1');
  });

  it('slices to maximum 5 challenges', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    const sixChallenges = Array.from({ length: 6 }, (_, i) => ({
      _id: `ch-${i}`, challengeId: `ch-${i}`, title: `Challenge ${i}`,
      conditionType: 'ORDER_COMPLETE', targetCount: 1, rewardPoints: 10, rewardBadgeId: null,
      expiresAt: new Date(`2026-04-0${i + 1}T00:00:00Z`), active: true,
    }));
    __seed(CHALLENGES_COLLECTION, sixChallenges);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges).toHaveLength(5);
  });

  it('merges member progress (progressValue, completedAt) into each challenge', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    __seed('MemberChallengeProgress', [
      { _id: 'prog-1', memberId: 'member-1', challengeId: 'ch-1', progressValue: 2, completedAt: null, notifiedAt: null, eventIds: '[]' },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges[0].progressValue).toBe(2);
    expect(result.challenges[0].completedAt).toBeNull();
  });

  it('defaults progressValue to 0 and completedAt to null when no progress record exists', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'First Steps', conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50, rewardBadgeId: null, expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    expect(result.challenges[0].progressValue).toBe(0);
    expect(result.challenges[0].completedAt).toBeNull();
  });

  it('returns response shape matching mobile API contract', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', title: 'AR Explorer', conditionType: 'AR_USED', targetCount: 1, rewardPoints: 25, rewardBadgeId: 'ar_explorer', expiresAt: new Date('2026-04-01T00:00:00Z'), active: true },
    ]);
    const result = await getActiveChallenges('member-1');
    const c = result.challenges[0];
    expect(c).toHaveProperty('challengeId');
    expect(c).toHaveProperty('title');
    expect(c).toHaveProperty('description');
    expect(c).toHaveProperty('targetCount');
    expect(c).toHaveProperty('rewardPoints');
    expect(c).toHaveProperty('rewardBadgeId');
    expect(c).toHaveProperty('expiresAt');
    expect(c).toHaveProperty('progressValue');
    expect(c).toHaveProperty('completedAt');
  });

  it('returns { status: 429 } after exceeding rate limit of 10 calls per hour', async () => {
    for (let i = 0; i < 10; i++) {
      await getActiveChallenges('member-rate-limit');
    }
    const result = await getActiveChallenges('member-rate-limit');
    expect(result).toEqual({ status: 429, error: 'Rate limit exceeded' });
  });
});

// ── recordChallengeProgress ───────────────────────────────────────────────────

const FUTURE_EXPIRY = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days out
const PAST_EXPIRY   = new Date(Date.now() - 24 * 60 * 60 * 1000);      // yesterday

const BASE_CHALLENGE_DEF = {
  _id: 'ch-1', challengeId: 'ch-1', title: 'Order 3 Times',
  conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50,
  rewardBadgeId: null, expiresAt: FUTURE_EXPIRY, active: true,
};

describe('recordChallengeProgress', () => {
  beforeEach(() => { __reset(); _resetRecordChallengeProgressRateLimit(); });

  it('returns { success: false, error } when memberId is missing', async () => {
    const result = await recordChallengeProgress({ memberId: '', challengeId: 'ch-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns { success: false, error } when challengeId is missing', async () => {
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns { success: false, error: not_found } when challenge does not exist', async () => {
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'no-such' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('challenge_not_found');
  });

  it('returns { success: false, error: challenge_expired } for expired challenge', async () => {
    __seed(CHALLENGES_COLLECTION, [
      { ...BASE_CHALLENGE_DEF, expiresAt: PAST_EXPIRY },
    ]);
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('challenge_expired');
  });

  it('increments progress from 0 to 1 for a new member', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]);
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(result.success).toBe(true);
    expect(result.newProgress).toBe(1);
    expect(result.completed).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it('increments existing progress correctly', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      { _id: 'prog-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 1, completedAt: null },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(result.success).toBe(true);
    expect(result.newProgress).toBe(2);
    expect(result.completed).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it('returns completed=true and awards rewardPoints when progress reaches targetCount', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]); // targetCount: 3, rewardPoints: 50
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      { _id: 'prog-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, completedAt: null },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(result.success).toBe(true);
    expect(result.newProgress).toBe(3);
    expect(result.completed).toBe(true);
    expect(result.pointsAwarded).toBe(50);
  });

  it('writes updated totalPoints to MemberPoints on completion', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      { _id: 'prog-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, completedAt: null },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));
    await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    const mpUpdate = updated.find(u => u.col === 'MemberPoints');
    expect(mpUpdate).toBeDefined();
    expect(mpUpdate.item.totalPoints).toBe(150); // 100 + 50
  });

  it('returns completed=true without re-awarding points for already-completed challenge (idempotent)', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      { _id: 'prog-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 3, completedAt: new Date('2026-03-22') },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 150, tier: 'Trail Blazer' }]);
    const updated = [];
    __onUpdate((col, item) => updated.push({ col, item }));
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.pointsAwarded).toBe(0);
    // No MemberPoints write on idempotent re-call
    expect(updated.find(u => u.col === 'MemberPoints')).toBeUndefined();
  });

  it('creates MemberPoints record for new member on completion', async () => {
    __seed(CHALLENGES_COLLECTION, [
      { ...BASE_CHALLENGE_DEF, targetCount: 1 },
    ]);
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    const result = await recordChallengeProgress({ memberId: 'mem-new', challengeId: 'ch-1' });
    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.pointsAwarded).toBe(50);
    const mpInsert = inserted.find(i => i.col === 'MemberPoints');
    expect(mpInsert).toBeDefined();
    expect(mpInsert.item.totalPoints).toBe(50);
  });

  it('returns { status: 429 } after exceeding rate limit of 20 calls per hour', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]);
    for (let i = 0; i < 20; i++) {
      await recordChallengeProgress({ memberId: 'mem-rl', challengeId: 'ch-1' });
    }
    const result = await recordChallengeProgress({ memberId: 'mem-rl', challengeId: 'ch-1' });
    expect(result).toEqual({ status: 429, error: 'Rate limit exceeded' });
  });
});

// ── recordChallengeProgress — PointsLedger hookup ────────────────────

describe('recordChallengeProgress — PointsLedger hookup', () => {
  beforeEach(() => { __reset(); _resetRecordChallengeProgressRateLimit(); });

  it('writes PointsLedger record when challenge reaches targetCount', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]); // targetCount: 3, rewardPoints: 50
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      { _id: 'prog-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, completedAt: null },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    const ledger = __getInserted('PointsLedger');
    const entry = ledger.find(r => r.type === 'challenge_complete');
    expect(entry).toBeDefined();
    expect(entry.memberId).toBe('mem-1');
    expect(entry.challengeId).toBe('ch-1');
    expect(entry.points).toBe(50);
    expect(entry.description).toBe('Order 3 Times completed');
  });

  it('does NOT write PointsLedger when challenge is not yet complete', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]); // targetCount: 3
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' }); // progress now 1 of 3
    const ledger = __getInserted('PointsLedger');
    const entry = ledger.find(r => r.type === 'challenge_complete');
    expect(entry).toBeUndefined();
  });

  it('PointsLedger insert error does not prevent success return', async () => {
    __seed(CHALLENGES_COLLECTION, [BASE_CHALLENGE_DEF]); // targetCount: 3, rewardPoints: 50
    __seed(CHALLENGE_PROGRESS_COLLECTION, [
      { _id: 'prog-1', memberId: 'mem-1', challengeId: 'ch-1', progressValue: 2, completedAt: null },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    __setInsertError('PointsLedger', new Error('DB unavailable'));
    const result = await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });
    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.pointsAwarded).toBe(50);
  });
});

// ── Streak clock fix (CF-hard-clockfix) ──────────────────────────────────────
// Webhook delivery lag must not break a fair streak.
// payload.ts (Unix seconds, event origin time) is used instead of Date.now().

describe('streak clock — payload.ts used when present', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves streak when webhook arrives after ET midnight but ts shows event was before midnight', async () => {
    // Member active through 2026-03-21 with a 6-day streak.
    // Event fired at 11:58 PM ET on 2026-03-22 (ts = 2026-03-23T03:58:00Z).
    // Webhook delivered 7 minutes late: processing time = 2026-03-23T04:05:00Z (12:05 AM ET March 23).
    //
    // Without fix: todayET='2026-03-23', yesterday='2026-03-22', lastActivity='2026-03-21' → RESET (streak=1)
    // With fix:    todayET=tsToETDate(ts)='2026-03-22', yesterday='2026-03-21', lastActivity='2026-03-21' → INCREMENT (streak=7)
    vi.setSystemTime(new Date('2026-03-23T04:05:00Z')); // processing time
    __seed('MemberPoints', [{
      _id: 'mp-clock-1', memberId: 'mem-clock', totalPoints: 500, tier: 'Mountain Maven',
      currentStreakDays: 6, streakStartDate: '2026-03-17',
      lastActivityDate: '2026-03-21', streakMultiplier: 1.5,
    }]);
    // ts = 11:58 PM ET on 2026-03-22 = 2026-03-23T03:58:00Z
    const eventTs = Math.floor(new Date('2026-03-23T03:58:00Z').getTime() / 1000);
    const result = await receiveGamificationEvent('gamification_add_to_cart', { ts: eventTs }, 'mem-clock');
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(7);  // incremented, not reset
    expect(result.milestoneUnlocked).toBe(true); // day-7 milestone
  });

  it('resets streak when ts shows a genuine 2-day gap', async () => {
    // Member last active 2026-03-20. Event ts is March 22 noon ET (real 2-day gap).
    vi.setSystemTime(new Date('2026-03-22T16:00:00Z')); // noon ET processing time
    __seed('MemberPoints', [{
      _id: 'mp-clock-2', memberId: 'mem-clock2', totalPoints: 300, tier: 'Trail Blazer',
      currentStreakDays: 5, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-20', streakMultiplier: 1.5,
    }]);
    const eventTs = Math.floor(new Date('2026-03-22T16:00:00Z').getTime() / 1000); // noon ET March 22
    const result = await receiveGamificationEvent('gamification_add_to_cart', { ts: eventTs }, 'mem-clock2');
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(1); // reset — genuine gap
  });

  it('falls back to processing time when payload.ts is absent', async () => {
    // Normal event with no ts — uses current clock date as before (no regression)
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // today ET = 2026-03-22
    __seed('MemberPoints', [{
      _id: 'mp-clock-3', memberId: 'mem-clock3', totalPoints: 200, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-clock3');
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(4); // yesterday active → increment
  });

  it('falls back to processing time when payload.ts is zero or negative', async () => {
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed('MemberPoints', [{
      _id: 'mp-clock-4', memberId: 'mem-clock4', totalPoints: 100, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21', streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', { ts: 0 }, 'mem-clock4');
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(3); // processing time used, yesterday active → increment
  });
});
