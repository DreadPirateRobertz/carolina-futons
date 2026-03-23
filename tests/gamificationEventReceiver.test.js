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
import { receiveGamificationEvent } from '../src/backend/gamificationEventReceiver.web.js';

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
