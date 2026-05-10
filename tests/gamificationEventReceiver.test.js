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
  __setUniqueField,
  __getInserted,
  __onUpdate,
  __onInsert,
} from './__mocks__/wix-data.js';
import { receiveGamificationEvent, updateStreakState, updateChallengeProgress, checkWishlistMonthlyCap, recordWishlistAdd, getActiveChallenges, _resetActiveChallengesRateLimit, recordChallengeProgress, _resetRecordChallengeProgressRateLimit, recoverStreak, getRecentAchievements, seedWelcomePoints } from '../src/backend/gamificationEventReceiver.web.js';
import { POINT_VALUES, STREAK_RECOVERY_COST } from '../src/public/gamificationTokens.js';
import { getTodayET, getYesterdayOf } from '../src/backend/utils/dateUtils.js';
import { ANALYTICS_EVENTS_COLLECTION } from '../src/backend/utils/analyticsEvents.js';

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

  it('unknown event returns pointsEarned: 0 and badgeUnlocked: null', async () => {
    const result = await receiveGamificationEvent('gamification_unknown_event', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBe(0);
    expect(result.badgeUnlocked).toBeNull();
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

// ── submit_review (+100, +50 bonus if has_photo) ─────────────────────────────

describe('gamification_submit_review', () => {
  it('awards 100 points when has_photo is false', async () => {
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { product_id: 'p1', rating: 5, has_photo: false },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(100);
  });

  it('awards 150 points when has_photo is true', async () => {
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { product_id: 'p1', rating: 4, has_photo: true },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(150);
  });

  it('awards 100 points when has_photo is absent', async () => {
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { product_id: 'p1', rating: 3 },
      'mem-1'
    );
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(100);
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
    // add_to_cart (+5) then submit_review (+100) = 105
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const result = await receiveGamificationEvent('gamification_submit_review', { has_photo: false }, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(105);
  });

  it('accumulates add_to_cart + photo_review = 155 points', async () => {
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const result = await receiveGamificationEvent(
      'gamification_submit_review',
      { has_photo: true },
      'mem-1'
    );
    expect(result.newTotal).toBe(155);
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

  it('minOrderTotal — grants bonus spin when orderTotal meets threshold', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_order_complete', active: true, spinsGranted: 1, minOrderTotal: 100 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_order_complete', { orderTotal: 150 }, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(1);
  });

  it('minOrderTotal — does NOT grant bonus spin when orderTotal is below threshold', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_order_complete', active: true, spinsGranted: 1, minOrderTotal: 100 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_order_complete', { orderTotal: 75 }, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(0);
  });

  it('minOrderTotal — grants bonus spin when orderTotal exactly equals threshold', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_order_complete', active: true, spinsGranted: 1, minOrderTotal: 100 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_order_complete', { orderTotal: 100 }, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(1);
  });

  it('minOrderTotal — omitted minOrderTotal treats all orders as qualifying', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-1', triggerEvent: 'gamification_order_complete', active: true, spinsGranted: 1 },
    ]);
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer', bonusSpinsAvailable: 0 },
    ]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_order_complete', { orderTotal: 5 }, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(1);
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

  it('applies 2x multiplier (3-day streak) to add_to_cart base 5 → 10', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', // yesterday → streak 3→4, stays 2x
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Math.round(5 * 2) = 10
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(10);
    expect(result.streakMultiplier).toBe(2);
  });

  it('applies 3x multiplier (day 7+) to submit_review base 100 → 300', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 7, streakStartDate: '2026-03-15',
      lastActivityDate: '2026-03-21', // yesterday → streak 7→8, multiplier stays 3x, no milestone
      streakMultiplier: 3,
    }]);
    const result = await receiveGamificationEvent('gamification_submit_review', { has_photo: false }, 'mem-1');
    // Math.round(100 * 3) = 300, milestoneBonus = 0 (only fires exactly at day 7)
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(300);
    expect(result.streakMultiplier).toBe(3);
  });

  it('fires milestoneBonus of 100 pts + milestoneUnlocked when streak crosses to day 7', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', // yesterday → streak 6→7
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // streak → 7, multiplier → 3x, Math.round(5 * 3) = 15, milestoneBonus = 100
    expect(result.newTotal).toBe(115);
    expect(result.milestoneUnlocked).toBe(true);
  });

  it('grants bonus spin from gamification_streak_milestone grant when milestone fires', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-m', triggerEvent: 'gamification_streak_milestone', active: true, spinsGranted: 1 },
    ]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', // yesterday → streak 6→7 (milestone fires)
      streakMultiplier: 2, bonusSpinsAvailable: 0,
    }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(1);
  });

  it('does NOT grant streak milestone bonus spin when milestone does not fire', async () => {
    __seed('BonusSpinGrants', [
      { _id: 'bsg-m', triggerEvent: 'gamification_streak_milestone', active: true, spinsGranted: 1 },
    ]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', // yesterday → streak 3→4, no milestone
      streakMultiplier: 2, bonusSpinsAvailable: 0,
    }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    const mpUpdates = updated.filter(u => u.collection === 'MemberPoints');
    const lastUpdate = mpUpdates[mpUpdates.length - 1];
    expect(lastUpdate.item.bonusSpinsAvailable).toBe(0);
  });

  it('returns currentStreakDays and streakMultiplier in result', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21', // yesterday → 2→3 days, 1x→2x
      streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.currentStreakDays).toBe(3);
    expect(result.streakMultiplier).toBe(2);
  });

  it('resets streak to 1 when last activity was 2+ days ago', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 10, streakStartDate: '2026-03-01',
      lastActivityDate: '2026-03-19', // 3 days ago — not eligible for grace
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
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 10, tier: 'Trail Blazer',
      currentStreakDays: 4, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-22', // today — already active
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // Same-day no-op: streak stays at 4, multiplier stays 2x
    // Math.round(5 * 2) = 10; total = 10 + 10 = 20
    expect(result.currentStreakDays).toBe(4);
    expect(result.newTotal).toBe(20);
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
    expect(mpUpdate.item.streakMultiplier).toBe(2);
    expect(mpUpdate.item.lastActivityDate).toBe('2026-03-22');
  });

  it('non-points spin (FREE_SHIP) increments streak but newTotal unchanged', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer',
      currentStreakDays: 2, streakStartDate: '2026-03-20',
      lastActivityDate: '2026-03-21', // yesterday → 2→3 days, 1x→2x
      streakMultiplier: 1,
    }]);
    const result = await receiveGamificationEvent('gamification_spin_completed', { prizeType: 'FREE_SHIP' }, 'mem-1');
    // basePoints=0, Math.round(0 * 2) = 0 → total unchanged
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(3);
    expect(result.streakMultiplier).toBe(2);
    expect(result.newTotal).toBe(50);
  });

  it('ET midnight boundary — correct streak at 00:01 ET (EST, Jan date)', async () => {
    // 2026-01-15T05:01:00Z = 00:01 EST (UTC-5 in Jan) → today=2026-01-15, yesterday=2026-01-14
    vi.setSystemTime(new Date('2026-01-15T05:01:00Z'));
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-01-12',
      lastActivityDate: '2026-01-14', // yesterday in ET
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    // streak 3→4, stays 2x
    expect(result.currentStreakDays).toBe(4);
    expect(result.streakMultiplier).toBe(2);
  });

  it('week_wanderer badge inserted when not yet in MemberBadges', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 2,
    }]);
    const badgeInserts = [];
    __onInsert((collection, item) => {
      if (collection === 'MemberBadges') badgeInserts.push(item);
    });
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(badgeInserts).toHaveLength(1);
    expect(badgeInserts[0].badgeId).toBe('week_wanderer');
    expect(badgeInserts[0].memberId).toBe('mem-1');
    expect(badgeInserts[0]._id).toBe('mem-1_week_wanderer'); // computed unique key
  });

  it('badge de-dup (TOCTOU guard) — duplicate _id insert treated as no-op, event still succeeds', async () => {
    // Seed badge using the computed _id so the mock _id-uniqueness check fires on second insert
    __seed('MemberBadges', [{ _id: 'mem-1_week_wanderer', memberId: 'mem-1', badgeId: 'week_wanderer' }]);
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 2,
    }]);
    const badgeInserts = [];
    __onInsert((collection, item) => {
      if (collection === 'MemberBadges') badgeInserts.push(item);
    });
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(true);          // event succeeds despite duplicate
    expect(result.milestoneUnlocked).toBe(true);
    expect(badgeInserts).toHaveLength(0);       // insert blocked by duplicate _id
  });

  it('concurrent badge award — only one row inserted when both requests hit the DB', async () => {
    // The mock runs sequentially (JS is single-threaded in tests), so this is not true simultaneous insertion.
    // What this test verifies is the idempotent path: the DB-level unique _id constraint rejects the second
    // insert, leaving exactly one badge row. The real race condition is closed at the DB level, not here.
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-2', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 2,
    }]);
    const [r1, r2] = await Promise.all([
      receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-2'),
      receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-2'),
    ]);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    const allBadges = __getInserted('MemberBadges').filter(b => b.memberId === 'mem-2' && b.badgeId === 'week_wanderer');
    expect(allBadges).toHaveLength(1);
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

    it('upgrades multiplier when crossing into 2x tier (days 2→3)', () => {
      const record = {
        currentStreakDays: 2,
        streakStartDate: '2026-03-20',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 1,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakMultiplier).toBe(2);
    });

    it('upgrades multiplier when crossing into 3x tier (days 6→7)', () => {
      const record = {
        currentStreakDays: 6,
        streakStartDate: '2026-03-16',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 2,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(7);
      expect(result.streakMultiplier).toBe(3);
    });

    it('fires milestoneBonus = STREAK_7_DAY when crossing to day 7', () => {
      const record = {
        currentStreakDays: 6,
        streakStartDate: '2026-03-16',
        lastActivityDate: YESTERDAY,
        streakMultiplier: 2,
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
        streakMultiplier: 2,
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

// ── gamification_wishlist_add (+25 pts, 1/month cap) ─────────────────────────

describe('gamification_wishlist_add', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('awards POINT_VALUES.WISHLIST_ADD (25) when no entry this month', async () => {
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(POINT_VALUES.WISHLIST_ADD);
  });

  it('awards 0 points when monthly cap (1/month) is reached', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-05' },
    ]);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(50); // 0 effective points
  });

  it('awards points when prior entry was last month (cap resets monthly)', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-02-28' },
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

  it('only counts log entries for the correct member this month', async () => {
    // Same month, different member — should not count against mem-1
    __seed('WishlistAddLog', [
      { memberId: 'mem-other', date: '2026-03-22' },
    ]);
    const result = await receiveGamificationEvent('gamification_wishlist_add', {}, 'mem-1');
    expect(result.newTotal).toBe(POINT_VALUES.WISHLIST_ADD);
  });
});

// ── checkWishlistMonthlyCap ───────────────────────────────────────────────────

describe('checkWishlistMonthlyCap', () => {
  it('returns { canEarn: true, count: 0 } when no entries this month', async () => {
    const result = await checkWishlistMonthlyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 0 });
  });

  it('returns { canEarn: false, count: 1 } when at cap (1 entry this month)', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-03-05' },
    ]);
    const result = await checkWishlistMonthlyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: false, count: 1 });
  });

  it("ignores last month's entries when checking this month's cap", async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-02-28' },
    ]);
    const result = await checkWishlistMonthlyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 0 });
  });

  it('ignores entries from next month (cross-month boundary)', async () => {
    __seed('WishlistAddLog', [
      { memberId: 'mem-1', date: '2026-04-01' },
    ]);
    const result = await checkWishlistMonthlyCap('mem-1', '2026-03-22');
    expect(result).toEqual({ canEarn: true, count: 0 });
  });

  it('fails open — returns { canEarn: true, count: 0 } when query throws', async () => {
    __setQueryError('WishlistAddLog', new Error('DB unavailable'));
    const result = await checkWishlistMonthlyCap('mem-1', '2026-03-22');
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
      graceTokenUsedDate: '2026-03-15', // same month — grace exhausted, ensures genuine reset
    }]);
    const eventTs = Math.floor(new Date('2026-03-22T16:00:00Z').getTime() / 1000); // noon ET March 22
    const result = await receiveGamificationEvent('gamification_add_to_cart', { ts: eventTs }, 'mem-clock2');
    expect(result.success).toBe(true);
    expect(result.currentStreakDays).toBe(1); // reset — genuine gap, grace exhausted
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

// ── updateStreakState — grace token (Phase 2 v2) ──────────────────────────────

describe('updateStreakState — grace token', () => {
  const TODAY = '2026-03-22';
  const YESTERDAY = '2026-03-21';
  const TWO_DAYS_AGO = '2026-03-20';
  const THREE_DAYS_AGO = '2026-03-19';

  describe('grace applies (exactly 1 missed day + token available)', () => {
    it('preserves streak days when lastActivity is exactly 2 days ago and no grace used', () => {
      const record = {
        currentStreakDays: 5,
        streakStartDate: '2026-03-17',
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 1.5,
        graceTokenUsedDate: null,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(5);
      expect(result.graceApplied).toBe(true);
    });

    it('preserves streak multiplier when grace applies', () => {
      const record = {
        currentStreakDays: 7,
        streakStartDate: '2026-03-15',
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 2,
        graceTokenUsedDate: null,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.streakMultiplier).toBe(2);
    });

    it('sets lastActivityDate to todayET when grace applies', () => {
      const record = {
        currentStreakDays: 3,
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 1.5,
        graceTokenUsedDate: null,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.lastActivityDate).toBe(TODAY);
    });

    it('sets graceTokenUsedDate to todayET when grace applies', () => {
      const record = {
        currentStreakDays: 4,
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 1.5,
        graceTokenUsedDate: null,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.graceTokenUsedDate).toBe(TODAY);
    });

    it('applies grace when graceTokenUsedDate is from a prior month', () => {
      const record = {
        currentStreakDays: 6,
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 1.5,
        graceTokenUsedDate: '2026-02-14', // February — different month
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.graceApplied).toBe(true);
      expect(result.currentStreakDays).toBe(6);
    });

    it('applies grace on DST spring-forward boundary (Mar 8→10, Mar 9 skipped)', () => {
      // Spring forward 2026: Mar 8 → clocks skip to Mar 9 2am → Mar 10 is safe
      const result = updateStreakState(
        { currentStreakDays: 3, lastActivityDate: '2026-03-08', streakMultiplier: 1.5, graceTokenUsedDate: null },
        '2026-03-10',
        '2026-03-09'
      );
      expect(result.graceApplied).toBe(true);
      expect(result.currentStreakDays).toBe(3);
    });
  });

  describe('grace does not apply', () => {
    it('resets streak when grace token already used this month', () => {
      const record = {
        currentStreakDays: 8,
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 2,
        graceTokenUsedDate: '2026-03-05', // same month (March)
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
      expect(result.graceApplied).toBeFalsy();
    });

    it('resets streak when missed 3 days (not eligible for grace)', () => {
      const record = {
        currentStreakDays: 5,
        lastActivityDate: THREE_DAYS_AGO,
        streakMultiplier: 1.5,
        graceTokenUsedDate: null,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.currentStreakDays).toBe(1);
      expect(result.graceApplied).toBeFalsy();
    });

    it('preserves graceTokenUsedDate on reset (does not consume unused token)', () => {
      const record = {
        currentStreakDays: 5,
        lastActivityDate: THREE_DAYS_AGO, // 3 days — no grace
        streakMultiplier: 1.5,
        graceTokenUsedDate: null,
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.graceTokenUsedDate).toBeNull();
    });

    it('grants grace when token was used last month (month-rollover edge case)', () => {
      // Grace used on '2026-02-28' (February); today is March → new month, token available.
      const record = {
        currentStreakDays: 8,
        streakStartDate: '2026-03-14',
        lastActivityDate: TWO_DAYS_AGO,
        streakMultiplier: 2,
        graceTokenUsedDate: '2026-02-28', // prior month — should NOT block grace
      };
      const result = updateStreakState(record, TODAY, YESTERDAY);
      expect(result.graceApplied).toBe(true);
      expect(result.currentStreakDays).toBe(8);
    });
  });

  describe('grace integration with receiveGamificationEvent', () => {
    it('persists graceTokenUsedDate to MemberPoints when grace fires', async () => {
      // Use real date functions so this test stays valid regardless of when it runs.
      const realToday = getTodayET();
      const realYesterday = getYesterdayOf(realToday);
      // twoDaysAgoReal = day before yesterday
      const [y, m, d] = realYesterday.split('-').map(Number);
      const prev = new Date(Date.UTC(y, m - 1, d - 1));
      const twoDaysAgoReal = [
        prev.getUTCFullYear(),
        String(prev.getUTCMonth() + 1).padStart(2, '0'),
        String(prev.getUTCDate()).padStart(2, '0'),
      ].join('-');

      const updated = [];
      __onUpdate((col, item) => { if (col === 'MemberPoints') updated.push(item); });
      __seed('MemberPoints', [{
        _id: 'mp-g', memberId: 'mem-g',
        totalPoints: 100, tier: 'Trail Blazer',
        currentStreakDays: 5, streakMultiplier: 1.5,
        lastActivityDate: twoDaysAgoReal,
        graceTokenUsedDate: null,
      }]);
      await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-g');
      expect(updated.length).toBe(1);
      expect(updated[0].graceTokenUsedDate).toBe(realToday);
    });
  });
});

// ── recoverStreak (Phase 2 v2) ────────────────────────────────────────────────

describe('recoverStreak', () => {
  it('returns { success: false } when memberId is missing', async () => {
    const result = await recoverStreak(null);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns { success: false } when member has no MemberPoints record', async () => {
    const result = await recoverStreak('mem-no-record');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no record|not found/i);
  });

  it('returns { success: false } when member has insufficient points', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: STREAK_RECOVERY_COST - 1,
      currentStreakDays: 0,
      lastStreakRecoveryDate: null,
    }]);
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient|not enough/i);
  });

  it('returns { success: false } when recovery used within 30 days', async () => {
    // Use a date 17 days before real today — always within the 30-day cooldown.
    const realToday = getTodayET();
    const [ty, tm, td] = realToday.split('-').map(Number);
    const recent = new Date(Date.UTC(ty, tm - 1, td - 17));
    const recentDate = [
      recent.getUTCFullYear(),
      String(recent.getUTCMonth() + 1).padStart(2, '0'),
      String(recent.getUTCDate()).padStart(2, '0'),
    ].join('-');
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      currentStreakDays: 0,
      lastStreakRecoveryDate: recentDate,
    }]);
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cooldown|30 day/i);
  });

  it('deducts STREAK_RECOVERY_COST points and sets currentStreakDays = 1 on success', async () => {
    const updated = [];
    __onUpdate((col, item) => { if (col === 'MemberPoints') updated.push(item); });
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      tier: 'Mountain Guide',
      currentStreakDays: 7,
      streakStartDate: '2026-03-01',
      lastStreakRecoveryDate: null,
    }]);
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(500 - STREAK_RECOVERY_COST);
    expect(result.currentStreakDays).toBe(1);
    expect(updated[0].currentStreakDays).toBe(1);
    expect(updated[0].totalPoints).toBe(500 - STREAK_RECOVERY_COST);
    // streakStartDate must be reset to avoid stale derived metrics
    expect(updated[0].streakStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sets lastStreakRecoveryDate to todayET on success', async () => {
    const updated = [];
    __onUpdate((col, item) => { if (col === 'MemberPoints') updated.push(item); });
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      currentStreakDays: 0,
      lastStreakRecoveryDate: null,
    }]);
    await recoverStreak('mem-1');
    expect(updated[0].lastStreakRecoveryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('allows recovery when lastStreakRecoveryDate is exactly 30 days ago (fence-post)', async () => {
    // daysDiff < 30 is blocked; daysDiff === 30 must be allowed.
    const realToday = getTodayET();
    const [ty, tm, td] = realToday.split('-').map(Number);
    const d30 = new Date(Date.UTC(ty, tm - 1, td - 30));
    const date30 = [
      d30.getUTCFullYear(),
      String(d30.getUTCMonth() + 1).padStart(2, '0'),
      String(d30.getUTCDate()).padStart(2, '0'),
    ].join('-');
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      currentStreakDays: 0,
      lastStreakRecoveryDate: date30,
    }]);
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(true);
  });

  it('allows recovery when lastStreakRecoveryDate is exactly 31 days ago', async () => {
    const realToday = getTodayET();
    const [ty, tm, td] = realToday.split('-').map(Number);
    const d31 = new Date(Date.UTC(ty, tm - 1, td - 31));
    const date31 = [
      d31.getUTCFullYear(),
      String(d31.getUTCMonth() + 1).padStart(2, '0'),
      String(d31.getUTCDate()).padStart(2, '0'),
    ].join('-');
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      currentStreakDays: 0,
      lastStreakRecoveryDate: date31,
    }]);
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(true);
  });

  it('allows recovery when lastStreakRecoveryDate is null (never used)', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      currentStreakDays: 0,
      lastStreakRecoveryDate: null,
    }]);
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(true);
  });

  it('returns DB error gracefully', async () => {
    __setQueryError(new Error('DB down'));
    const result = await recoverStreak('mem-1');
    expect(result.success).toBe(false);
  });
});

// ── MemberPointsLedger — earn path ────────────────────────────────────────────

describe('MemberPointsLedger — receiveGamificationEvent inserts ledger entry', () => {
  it('inserts a ledger entry with correct fields after awarding points', async () => {
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ledger-1');

    const entries = __getInserted('MemberPointsLedger');
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.memberId).toBe('mem-ledger-1');
    expect(e.operationType).toBe('earn');
    expect(e.delta).toBe(5); // ADD_TO_CART_POINTS = 5
    expect(e.previousBalance).toBe(0);
    expect(e.newBalance).toBe(5);
    expect(e.reason).toBe('gamification_add_to_cart');
    expect(e.timestamp).toBeInstanceOf(Date);
    expect(typeof e.traceId).toBe('string');
  });

  it('records previousBalance correctly for an existing member', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-ledger-2',
      totalPoints: 100, tier: 'Bronze',
    }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ledger-2');

    const entries = __getInserted('MemberPointsLedger');
    expect(entries).toHaveLength(1);
    expect(entries[0].previousBalance).toBe(100);
    expect(entries[0].newBalance).toBe(105); // 100 + ADD_TO_CART_POINTS (5)
    expect(entries[0].delta).toBe(5);
  });

  it('includes sourceData with eventName', async () => {
    await receiveGamificationEvent('gamification_add_to_cart', { product_id: 'p99' }, 'mem-ledger-3');

    const entries = __getInserted('MemberPointsLedger');
    expect(entries[0].sourceData).toBeTruthy();
    const sd = JSON.parse(entries[0].sourceData);
    expect(sd.eventName).toBe('gamification_add_to_cart');
  });

  it('does not insert a ledger entry when delta is 0 (zero-point event)', async () => {
    // Unknown event = no points awarded; no ledger entry should be written
    await receiveGamificationEvent('gamification_unknown_event', {}, 'mem-ledger-4');

    const entries = __getInserted('MemberPointsLedger');
    expect(entries).toHaveLength(0);
  });
});

// ── MemberPointsLedger — recoverStreak burn ───────────────────────────────────

describe('MemberPointsLedger — recoverStreak inserts burn ledger entry', () => {
  it('inserts a burn ledger entry after successful streak recovery', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-r1', memberId: 'mem-recover-1',
      totalPoints: 500,
      currentStreakDays: 0,
      lastStreakRecoveryDate: null,
    }]);

    await recoverStreak('mem-recover-1');

    const entries = __getInserted('MemberPointsLedger');
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.memberId).toBe('mem-recover-1');
    expect(e.operationType).toBe('burn');
    expect(e.delta).toBe(-STREAK_RECOVERY_COST);
    expect(e.previousBalance).toBe(500);
    expect(e.newBalance).toBe(500 - STREAK_RECOVERY_COST);
    expect(e.reason).toBe('streak_recovery');
    expect(e.timestamp).toBeInstanceOf(Date);
  });

  it('does not insert a ledger entry when recovery fails (insufficient points)', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-r2', memberId: 'mem-recover-2',
      totalPoints: 1,
      currentStreakDays: 0,
    }]);

    await recoverStreak('mem-recover-2');

    const entries = __getInserted('MemberPointsLedger');
    expect(entries).toHaveLength(0);
  });
});

// ── MemberPointsLedger — catch-path resilience ────────────────────────────────

describe('MemberPointsLedger — catch-path: ledger failure does not break earn', () => {
  it('returns {success:true, newTotal} even when MemberPointsLedger insert throws', async () => {
    __setInsertError('MemberPointsLedger', new Error('ledger unavailable'));

    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-catch-1');

    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(5);
  });

  it('returns {success:true, newTotal} even when milestone ledger insert throws', async () => {
    // Trigger a milestone: seed a member at exactly 499 pts so the add-to-cart
    // pushes past 500 and the streak milestone fires
    __seed('MemberPoints', [{
      _id: 'mp-mc2', memberId: 'mem-catch-2',
      totalPoints: 499, tier: 'Bronze',
      currentStreakDays: 7, streakStartDate: getTodayET(), lastActivityDate: getTodayET(),
    }]);
    __setInsertError('MemberPointsLedger', new Error('ledger unavailable'));

    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-catch-2');

    expect(result.success).toBe(true);
    expect(result.newTotal).toBeGreaterThan(499);
  });
});

describe('MemberPointsLedger — catch-path: ledger failure does not break recoverStreak', () => {
  it('returns {success:true, newTotal} even when burn ledger insert throws', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-rc1', memberId: 'mem-catch-3',
      totalPoints: 500, currentStreakDays: 0, lastStreakRecoveryDate: null,
    }]);
    __setInsertError('MemberPointsLedger', new Error('ledger unavailable'));

    const result = await recoverStreak('mem-catch-3');

    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(500 - STREAK_RECOVERY_COST);
  });
});

// ── receiveGamificationEvent — pointsEarned + badgeUnlocked ──────────────────

describe('receiveGamificationEvent — pointsEarned and badgeUnlocked', () => {
  beforeEach(() => {
    __reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns pointsEarned equal to base points for a new member (no streak)', async () => {
    // No MemberPoints seeded → fresh member, multiplier=1, milestoneBonus=0
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBe(5); // ADD_TO_CART_POINTS * 1 = 5
  });

  it('includes streakMultiplier in pointsEarned', async () => {
    // 3-day streak → 2× multiplier; lastActivity yesterday → streak continues
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', // yesterday → streak 3→4, still 2×
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBe(10); // Math.round(5 * 2) = 10, milestoneBonus=0
  });

  it('returns badgeUnlocked null when no milestone reached', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.badgeUnlocked).toBeNull();
  });

  it('returns badgeUnlocked week_wanderer when 7-day milestone badge is newly awarded', async () => {
    // 6-day streak; lastActivity yesterday → event crosses to day 7 → milestone fires
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', // yesterday → streak 6→7
      streakMultiplier: 1.5,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.badgeUnlocked).toBe('week_wanderer');
  });

  it('returns badgeUnlocked null when week_wanderer badge was already awarded', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 2,
    }]);
    // Pre-existing badge record — de-dup guard sets badgeUnlocked = null
    __setUniqueField('MemberBadges', '_id');
    __seed('MemberBadges', [{ _id: 'mem-1_week_wanderer', memberId: 'mem-1', badgeId: 'week_wanderer' }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.badgeUnlocked).toBeNull();
  });

  it('includes milestoneBonus in pointsEarned on 7-day milestone', async () => {
    // streak 6→7: multiplier becomes 3×, milestoneBonus = 100
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 2,
    }]);
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.success).toBe(true);
    // Math.round(5 * 3) = 15 (adjustedPoints), + 100 (STREAK_7_DAY milestoneBonus)
    expect(result.pointsEarned).toBe(15 + POINT_VALUES.STREAK_7_DAY);
  });
});

// ── AnalyticsEvents pipeline (CF-3wl) ─────────────────────────────────────────

describe('AnalyticsEvents — tier_upgrade written on tier change', () => {
  it('inserts a tier_upgrade event when member crosses a tier boundary', async () => {
    // 499 pts + add_to_cart (5 pts) = 504 → crosses Mountain Guide (500)
    __seed('MemberPoints', [{ _id: 'mp-ae1', memberId: 'mem-ae-1', totalPoints: 499, tier: 'Trail Blazer' }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ae-1');

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const tierRow = rows.find(r => r.eventType === 'tier_upgrade');
    expect(tierRow).toBeTruthy();
    expect(tierRow.memberId).toBe('mem-ae-1');
    expect(tierRow.source).toBe('gamification');
    const p = JSON.parse(tierRow.payload);
    expect(p.newTier).toBe('Mountain Guide');
    expect(tierRow.timestamp).toBeInstanceOf(Date);
  });

  it('does NOT insert a tier_upgrade event when tier is unchanged', async () => {
    // 100 pts + add_to_cart (5 pts) = 105 → stays Trail Blazer
    __seed('MemberPoints', [{ _id: 'mp-ae2', memberId: 'mem-ae-2', totalPoints: 100, tier: 'Trail Blazer' }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ae-2');

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(rows.find(r => r.eventType === 'tier_upgrade')).toBeUndefined();
  });
});

describe('AnalyticsEvents — badge_earned written on week_wanderer award', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // today=2026-03-22, yesterday=2026-03-21
  });
  afterEach(() => { vi.useRealTimers(); });

  it('inserts a badge_earned event when week_wanderer badge is awarded at day-7 milestone', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-ae3', memberId: 'mem-ae-3', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 6, streakStartDate: '2026-03-16',
      lastActivityDate: '2026-03-21', streakMultiplier: 1.5,
    }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ae-3');

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const badgeRow = rows.find(r => r.eventType === 'badge_earned');
    expect(badgeRow).toBeTruthy();
    expect(badgeRow.memberId).toBe('mem-ae-3');
    expect(badgeRow.source).toBe('gamification');
    const p = JSON.parse(badgeRow.payload);
    expect(p.badgeId).toBe('week_wanderer');
  });

  it('does NOT insert a badge_earned event when no milestone fires', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-ae4', memberId: 'mem-ae-4', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', streakMultiplier: 1.5,
    }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ae-4');

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(rows.find(r => r.eventType === 'badge_earned')).toBeUndefined();
  });
});

describe('AnalyticsEvents — streak_extended written on streak increment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // today=2026-03-22, yesterday=2026-03-21
  });
  afterEach(() => { vi.useRealTimers(); });

  it('inserts a streak_extended event when streak increments', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-ae5', memberId: 'mem-ae-5', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-21', streakMultiplier: 1.5,
    }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ae-5');

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const streakRow = rows.find(r => r.eventType === 'streak_extended');
    expect(streakRow).toBeTruthy();
    expect(streakRow.memberId).toBe('mem-ae-5');
    expect(streakRow.source).toBe('gamification');
    const p = JSON.parse(streakRow.payload);
    expect(p.currentStreakDays).toBe(4);
  });

  it('does NOT insert a streak_extended event when already active today', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-ae6', memberId: 'mem-ae-6', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 3, streakStartDate: '2026-03-19',
      lastActivityDate: '2026-03-22', // already today → no increment
      streakMultiplier: 1.5,
    }]);

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-ae-6');

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(rows.find(r => r.eventType === 'streak_extended')).toBeUndefined();
  });
});

describe('AnalyticsEvents — challenge_started written on first progress unit', () => {
  it('inserts a challenge_started event on first progress for a member', async () => {
    __seed('Challenges', [{
      _id: 'ch-ae1', challengeId: 'ch-ae1', title: 'First Steps',
      conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50,
      rewardBadgeId: null, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), active: true,
    }]);

    await recordChallengeProgress({ memberId: 'mem-ae-7', challengeId: 'ch-ae1' });

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const startRow = rows.find(r => r.eventType === 'challenge_started');
    expect(startRow).toBeTruthy();
    expect(startRow.memberId).toBe('mem-ae-7');
    expect(startRow.source).toBe('gamification');
    const p = JSON.parse(startRow.payload);
    expect(p.challengeId).toBe('ch-ae1');
  });

  it('does NOT insert challenge_started when member already has progress', async () => {
    __seed('Challenges', [{
      _id: 'ch-ae2', challengeId: 'ch-ae2', title: 'Keep Going',
      conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50,
      rewardBadgeId: null, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), active: true,
    }]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [{
      _id: 'cp-ae1', memberId: 'mem-ae-8', challengeId: 'ch-ae2', progressValue: 1, completedAt: null,
    }]);

    await recordChallengeProgress({ memberId: 'mem-ae-8', challengeId: 'ch-ae2' });

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(rows.find(r => r.eventType === 'challenge_started')).toBeUndefined();
  });
});

describe('AnalyticsEvents — challenge_completed written when challenge finishes', () => {
  it('inserts a challenge_completed event when progress reaches targetCount', async () => {
    __seed('Challenges', [{
      _id: 'ch-ae3', challengeId: 'ch-ae3', title: 'Order 3 Times',
      conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50,
      rewardBadgeId: null, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), active: true,
    }]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [{
      _id: 'cp-ae2', memberId: 'mem-ae-9', challengeId: 'ch-ae3', progressValue: 2, completedAt: null,
    }]);
    __seed('MemberPoints', [{ _id: 'mp-ae9', memberId: 'mem-ae-9', totalPoints: 100, tier: 'Trail Blazer' }]);

    await recordChallengeProgress({ memberId: 'mem-ae-9', challengeId: 'ch-ae3' });

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    const completeRow = rows.find(r => r.eventType === 'challenge_completed');
    expect(completeRow).toBeTruthy();
    expect(completeRow.memberId).toBe('mem-ae-9');
    expect(completeRow.source).toBe('gamification');
    const p = JSON.parse(completeRow.payload);
    expect(p.challengeId).toBe('ch-ae3');
    expect(p.pointsAwarded).toBe(50);
  });

  it('does NOT insert challenge_completed when challenge is not yet finished', async () => {
    __seed('Challenges', [{
      _id: 'ch-ae4', challengeId: 'ch-ae4', title: 'Keep Going',
      conditionType: 'ORDER_COMPLETE', targetCount: 3, rewardPoints: 50,
      rewardBadgeId: null, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), active: true,
    }]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, [{
      _id: 'cp-ae3', memberId: 'mem-ae-10', challengeId: 'ch-ae4', progressValue: 1, completedAt: null,
    }]);

    await recordChallengeProgress({ memberId: 'mem-ae-10', challengeId: 'ch-ae4' });

    const rows = __getInserted(ANALYTICS_EVENTS_COLLECTION);
    expect(rows.find(r => r.eventType === 'challenge_completed')).toBeUndefined();
  });
});

// ── CF-cj4l: getRecentAchievements ──────────────────────────────────────────

describe('getRecentAchievements', () => {
  it('returns badge achievement with member display name', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra1', memberId: 'mem-ra1', eventType: 'badge_earned',
      payload: JSON.stringify({ badgeLabel: 'First Purchase' }),
      timestamp: new Date('2026-03-25T00:00:00Z').getTime(),
    }]);
    __seed('MemberPoints', [{
      _id: 'mp-ra1', memberId: 'mem-ra1', displayName: 'Alex', totalPoints: 100, tier: 'Trail Blazer',
    }]);

    const results = await getRecentAchievements(5);
    expect(results).toHaveLength(1);
    expect(results[0].memberNickname).toBe('Alex');
    expect(results[0].achievementType).toBe('badge_earned');
    expect(results[0].achievementName).toBe('First Purchase');
    expect(results[0].timestamp).toBe('2026-03-25T00:00:00.000Z');
  });

  it('returns tier_upgraded achievement with newTier as name', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra2', memberId: 'mem-ra2', eventType: 'tier_upgraded',
      payload: JSON.stringify({ newTier: 'Mountain Guide' }),
      timestamp: new Date('2026-03-25T01:00:00Z').getTime(),
    }]);
    __seed('MemberPoints', [{
      _id: 'mp-ra2', memberId: 'mem-ra2', displayName: 'Jordan', totalPoints: 500, tier: 'Mountain Guide',
    }]);

    const results = await getRecentAchievements(5);
    expect(results).toHaveLength(1);
    expect(results[0].memberNickname).toBe('Jordan');
    expect(results[0].achievementName).toBe('Mountain Guide');
  });

  it('falls back to "A member" when member has no displayName', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra3', memberId: 'mem-ra3', eventType: 'badge_earned',
      payload: JSON.stringify({ badgeLabel: 'Reviewer' }),
      timestamp: new Date('2026-03-25T00:00:00Z').getTime(),
    }]);
    __seed('MemberPoints', [{
      _id: 'mp-ra3', memberId: 'mem-ra3', totalPoints: 50, tier: 'Trail Blazer',
    }]);

    const results = await getRecentAchievements(5);
    expect(results[0].memberNickname).toBe('A member');
  });

  it('falls back to "A member" when memberId not in MemberPoints', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra4', memberId: 'mem-unknown', eventType: 'badge_earned',
      payload: JSON.stringify({ badgeLabel: 'Explorer' }),
      timestamp: new Date('2026-03-25T00:00:00Z').getTime(),
    }]);

    const results = await getRecentAchievements(5);
    expect(results[0].memberNickname).toBe('A member');
  });

  it('returns empty array when no achievements exist', async () => {
    const results = await getRecentAchievements(5);
    expect(results).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [
      { _id: 'ae-ra5a', memberId: 'mem-ra5', eventType: 'badge_earned', payload: '{"badgeLabel":"A"}', timestamp: 3 },
      { _id: 'ae-ra5b', memberId: 'mem-ra5', eventType: 'badge_earned', payload: '{"badgeLabel":"B"}', timestamp: 2 },
      { _id: 'ae-ra5c', memberId: 'mem-ra5', eventType: 'badge_earned', payload: '{"badgeLabel":"C"}', timestamp: 1 },
    ]);

    const results = await getRecentAchievements(2);
    expect(results).toHaveLength(2);
  });

  it('handles object payload (not stringified)', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra6', memberId: 'mem-ra6', eventType: 'badge_earned',
      payload: { badgeLabel: 'Photo Pro' },
      timestamp: new Date('2026-03-25T00:00:00Z').getTime(),
    }]);

    const results = await getRecentAchievements(5);
    expect(results[0].achievementName).toBe('Photo Pro');
  });

  it('falls back to eventType when payload has no badgeLabel or newTier', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra7', memberId: 'mem-ra7', eventType: 'badge_earned',
      payload: '{}',
      timestamp: new Date('2026-03-25T00:00:00Z').getTime(),
    }]);

    const results = await getRecentAchievements(5);
    expect(results[0].achievementName).toBe('badge_earned');
  });

  it('returns null timestamp when event has no timestamp', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [{
      _id: 'ae-ra8', memberId: 'mem-ra8', eventType: 'badge_earned',
      payload: '{"badgeLabel":"Test"}',
    }]);

    const results = await getRecentAchievements(5);
    expect(results[0].timestamp).toBeNull();
  });

  it('deduplicates member lookups for multiple achievements by same member', async () => {
    __seed(ANALYTICS_EVENTS_COLLECTION, [
      { _id: 'ae-ra9a', memberId: 'mem-ra9', eventType: 'badge_earned', payload: '{"badgeLabel":"A"}', timestamp: 2 },
      { _id: 'ae-ra9b', memberId: 'mem-ra9', eventType: 'tier_upgraded', payload: '{"newTier":"B"}', timestamp: 1 },
    ]);
    __seed('MemberPoints', [{
      _id: 'mp-ra9', memberId: 'mem-ra9', displayName: 'Tay', totalPoints: 200, tier: 'Trail Blazer',
    }]);

    const results = await getRecentAchievements(5);
    expect(results).toHaveLength(2);
    expect(results[0].memberNickname).toBe('Tay');
    expect(results[1].memberNickname).toBe('Tay');
  });
});

// ── cf-bvn: lastActivityAt stamped on every MemberPoints write path ──────────
// Dormancy detection (re-engagement win-back) reads MemberPoints.lastActivityAt.
// If any producer path forgets to stamp it, browse-only members silently fall
// out of the dormant cohort. These tests lock every write path.

describe('cf-bvn: lastActivityAt is stamped on every MemberPoints write path', () => {
  it('receiveGamificationEvent stamps lastActivityAt on wixData.update for existing record', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const updated = [];
    __onUpdate((col, item) => { if (col === 'MemberPoints') updated.push(item); });

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');

    expect(updated).toHaveLength(1);
    expect(updated[0].lastActivityAt).toBeInstanceOf(Date);
    expect(Math.abs(updated[0].lastActivityAt.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('receiveGamificationEvent stamps lastActivityAt on wixData.insert for new member', async () => {
    const inserted = [];
    __onInsert((col, item) => { if (col === 'MemberPoints') inserted.push(item); });

    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-new');

    const mp = inserted.find(i => i.memberId === 'mem-new');
    expect(mp).toBeDefined();
    expect(mp.lastActivityAt).toBeInstanceOf(Date);
    expect(Math.abs(mp.lastActivityAt.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('seedWelcomePoints stamps lastActivityAt on initial insert', async () => {
    const inserted = [];
    __onInsert((col, item) => { if (col === 'MemberPoints') inserted.push(item); });

    await seedWelcomePoints('mem-welcome', 50);

    const mp = inserted.find(i => i.memberId === 'mem-welcome');
    expect(mp).toBeDefined();
    expect(mp.lastActivityAt).toBeInstanceOf(Date);
    expect(Math.abs(mp.lastActivityAt.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('recordChallengeProgress stamps lastActivityAt on update (existing MemberPoints, challenge completes)', async () => {
    const CHALLENGES_COLLECTION = 'Challenges';
    const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';
    const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', name: 'X', type: 'daily', targetCount: 1, rewardPoints: 50, expiresAt: FUTURE, active: true },
    ]);
    __seed(CHALLENGE_PROGRESS_COLLECTION, []);
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 100, tier: 'Trail Blazer' }]);
    const updated = [];
    __onUpdate((col, item) => { if (col === 'MemberPoints') updated.push(item); });

    await recordChallengeProgress({ memberId: 'mem-1', challengeId: 'ch-1' });

    expect(updated).toHaveLength(1);
    expect(updated[0].lastActivityAt).toBeInstanceOf(Date);
    expect(Math.abs(updated[0].lastActivityAt.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('recordChallengeProgress stamps lastActivityAt on insert (new MemberPoints, challenge completes)', async () => {
    const CHALLENGES_COLLECTION = 'Challenges';
    const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
    __seed(CHALLENGES_COLLECTION, [
      { _id: 'ch-1', challengeId: 'ch-1', name: 'X', type: 'daily', targetCount: 1, rewardPoints: 50, expiresAt: FUTURE, active: true },
    ]);
    const inserted = [];
    __onInsert((col, item) => { if (col === 'MemberPoints') inserted.push(item); });

    await recordChallengeProgress({ memberId: 'mem-new', challengeId: 'ch-1' });

    const mp = inserted.find(i => i.memberId === 'mem-new');
    expect(mp).toBeDefined();
    expect(mp.lastActivityAt).toBeInstanceOf(Date);
    expect(Math.abs(mp.lastActivityAt.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('recoverStreak stamps lastActivityAt on updatedRecord', async () => {
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-1',
      totalPoints: 500,
      tier: 'Mountain Guide',
      currentStreakDays: 0,
      lastStreakRecoveryDate: null,
    }]);
    const updated = [];
    __onUpdate((col, item) => { if (col === 'MemberPoints') updated.push(item); });

    const result = await recoverStreak('mem-1');

    expect(result.success).toBe(true);
    expect(updated).toHaveLength(1);
    expect(updated[0].lastActivityAt).toBeInstanceOf(Date);
    expect(Math.abs(updated[0].lastActivityAt.getTime() - Date.now())).toBeLessThan(5000);
  });
});

// ── cf-m3tj: synthetic mobile challenge events ─────────────────────────────
//
// completeMobileChallenge dispatches one of three synthetic event names per
// the cf-m3tj fix. Verifies receiveGamificationEvent resolves them to the
// right point values AND treats them as FIXED_AWARD (no streak multiplier),
// matching the spec'd flat 75/50/100 awards.

describe('cf-m3tj — synthetic mobile challenge events', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
  });

  it('gamification_mobile_ar_discovery awards 75 pts to a new member', async () => {
    const result = await receiveGamificationEvent('gamification_mobile_ar_discovery', { productId: 'prod-1' }, 'mem-mobile-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(75);
    expect(result.pointsEarned).toBe(75);
  });

  it('gamification_mobile_quiz_completion awards 50 pts to a new member', async () => {
    const result = await receiveGamificationEvent('gamification_mobile_quiz_completion', { score: 9, total: 10 }, 'mem-mobile-2');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(50);
    expect(result.pointsEarned).toBe(50);
  });

  it('gamification_mobile_social_share awards 100 pts to a new member', async () => {
    const result = await receiveGamificationEvent('gamification_mobile_social_share', { platform: 'instagram' }, 'mem-mobile-3');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(100);
    expect(result.pointsEarned).toBe(100);
  });

  it('mobile awards are FIXED — not multiplied by an active 3x streak', async () => {
    // Member with 7-day streak (3x multiplier). For a non-fixed event like
    // add_to_cart this would be 5 * 3 = 15. For a mobile event it must stay
    // flat at the spec'd 75 — completeMobileChallenge enforces idempotency
    // upstream, so the streak multiplier would distort the spec.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));
    __seed('MemberPoints', [{
      _id: 'mp-1', memberId: 'mem-streak', totalPoints: 0, tier: 'Trail Blazer',
      currentStreakDays: 7, streakStartDate: '2026-03-15',
      lastActivityDate: '2026-03-21',
      streakMultiplier: 3,
    }]);
    const result = await receiveGamificationEvent(
      'gamification_mobile_ar_discovery',
      { productId: 'prod-1' },
      'mem-streak',
    );
    expect(result.pointsEarned).toBe(75); // not 225
    vi.useRealTimers();
  });
});
