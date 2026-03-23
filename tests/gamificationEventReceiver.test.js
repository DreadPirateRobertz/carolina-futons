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
import { receiveGamificationEvent, updateStreakState } from '../src/backend/gamificationEventReceiver.web.js';
import { POINT_VALUES } from '../src/public/gamificationTokens.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
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
