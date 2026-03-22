/**
 * @file gamificationEventReceiver.test.js
 * @description TDD tests for CF-eo88: gamification event receiver.
 *
 * Covers:
 *  - Each valid event name awards correct points
 *  - has_photo bonus applied correctly
 *  - Unknown event: no-op, returns current total without error
 *  - Missing memberId: returns { success: false }
 *  - CMS write failure: returns { success: false }
 *  - Points accumulation across multiple events
 *  - Tier advancement detected and returned
 *  - First event creates new MemberPoints record
 *  - Subsequent event updates existing record
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
  __setInsertError,
  __getInserted,
  __getUpdated,
  __onUpdate,
} from './__mocks__/wix-data.js';
import { receiveGamificationEvent } from '../src/backend/gamificationEventReceiver.web.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberRecord(memberId, totalPoints) {
  const { getTierForPoints } = require('../src/public/gamificationTokens.js');
  return {
    _id: `mp-${memberId}`,
    memberId,
    totalPoints,
    tier: getTierForPoints(totalPoints),
  };
}

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

  it('updates existing MemberPoints record on subsequent event', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 50, tier: 'Trail Blazer' }]);
    const updated = [];
    __onUpdate((collection, item) => updated.push({ collection, item }));
    await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(updated.length).toBe(1);
    expect(updated[0].item.totalPoints).toBe(55);
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
});

// ── CMS write failure ─────────────────────────────────────────────────────────

describe('CMS write failure', () => {
  it('returns { success: false } when insert throws', async () => {
    __setInsertError('MemberPoints', new Error('DB write failed'));
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

  it('tierChanged is false on first event when tier stays at Trail Blazer', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-new');
    expect(result.tierChanged).toBe(false);
    expect(result.newTier).toBe('Trail Blazer');
  });

  it('newTier is included in successful response', async () => {
    const result = await receiveGamificationEvent('gamification_add_to_cart', {}, 'mem-1');
    expect(result.newTier).toBeTruthy();
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
