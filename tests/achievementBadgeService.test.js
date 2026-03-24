/**
 * @file achievementBadgeService.test.js
 * @description Tests for CF-7tdf: AchievementBadgeService — award and query achievement badges.
 *
 * Covers:
 *  - BADGES: exports all 6 expected badge keys with id/label/points
 *  - awardBadge: awards a new badge, returns { awarded: true, badge }
 *  - awardBadge: returns { alreadyAwarded: true } for duplicate
 *  - awardBadge: rejects unknown badgeId with status 400
 *  - awardBadge: IDOR guard — wrong caller returns forbidden
 *  - awardBadge: auth_required when no session
 *  - awardBadge: all 6 badge IDs are awardable
 *  - awardBadge: inserts record with notified: false
 *  - awardBadge: DB error returns success: false
 *  - getMemberBadges: returns empty array for member with no badges
 *  - getMemberBadges: returns all badges for member
 *  - getMemberBadges: joins label from BADGES registry
 *  - getMemberBadges: does not return another member's badges
 *  - getMemberBadges: DB error returns success: false
 *  - markBadgeNotified: updates notified flag to true
 *  - markBadgeNotified: returns { notFound: true } for missing badge
 *  - markBadgeNotified: IDOR guard — wrong caller returns forbidden
 *  - markBadgeNotified: auth_required when no session
 *  - markBadgeNotified: DB error returns success: false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setQueryError,
} from './__mocks__/wix-data.js';

const memberMocks = vi.hoisted(() => ({ getMember: vi.fn() }));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: memberMocks.getMember },
}));

import {
  BADGES,
  awardBadge,
  getMemberBadges,
  markBadgeNotified,
} from '../src/backend/achievementBadgeService.web.js';

const MEMBER = {
  _id: 'mem-1',
  contactDetails: { firstName: 'Alex', emails: ['alex@test.com'], addresses: [] },
};

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  memberMocks.getMember.mockResolvedValue(MEMBER);
});

// ── BADGES registry ───────────────────────────────────────────────────────────

describe('BADGES', () => {
  it('exports exactly 6 badges', () => {
    expect(Object.keys(BADGES)).toHaveLength(6);
  });

  it.each([
    ['FIRST_PURCHASE', 'first_purchase', 'First Purchase',  50 ],
    ['STREAK_7',       'streak_7',       '7-Day Streak',    100],
    ['STREAK_30',      'streak_30',      '30-Day Streak',   300],
    ['REVIEW_5',       'review_5',       '5 Reviews',       150],
    ['REFERRAL_3',     'referral_3',     '3 Referrals',     250],
    ['WISHLIST_10',    'wishlist_10',    '10 Wishlist Adds', 75 ],
  ])('%s has correct id, label, and points', (key, id, label, points) => {
    expect(BADGES[key]).toEqual({ id, label, points });
  });
});

// ── awardBadge ────────────────────────────────────────────────────────────────

describe('awardBadge — new badge', () => {
  it('returns { awarded: true, badge } for a new badge', async () => {
    const result = await awardBadge('mem-1', 'first_purchase');
    expect(result.awarded).toBe(true);
    expect(result.badge).toEqual(BADGES.FIRST_PURCHASE);
  });

  it('inserts a record into MemberBadges', async () => {
    await awardBadge('mem-1', 'streak_7');
    const inserted = __getInserted('MemberBadges');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].badgeId).toBe('streak_7');
  });

  it('inserts record with notified: false', async () => {
    await awardBadge('mem-1', 'review_5');
    const inserted = __getInserted('MemberBadges');
    expect(inserted[0].notified).toBe(false);
  });

  it('inserts record with awardedAt as a Date', async () => {
    await awardBadge('mem-1', 'referral_3');
    const inserted = __getInserted('MemberBadges');
    expect(inserted[0].awardedAt).toBeInstanceOf(Date);
  });
});

describe('awardBadge — all 6 badge IDs are awardable', () => {
  it.each(Object.values(BADGES).map(b => [b.id]))(
    'can award badge id "%s"',
    async (badgeId) => {
      const result = await awardBadge('mem-1', badgeId);
      expect(result.awarded).toBe(true);
    }
  );
});

describe('awardBadge — duplicate', () => {
  it('returns { alreadyAwarded: true } when badge already exists', async () => {
    __seed('MemberBadges', [{
      _id: 'mb-1', memberId: 'mem-1', badgeId: 'first_purchase',
      awardedAt: new Date(), notified: false,
    }]);
    const result = await awardBadge('mem-1', 'first_purchase');
    expect(result.alreadyAwarded).toBe(true);
  });

  it('does not insert a second record on duplicate', async () => {
    __seed('MemberBadges', [{
      _id: 'mb-1', memberId: 'mem-1', badgeId: 'streak_7',
      awardedAt: new Date(), notified: false,
    }]);
    await awardBadge('mem-1', 'streak_7');
    expect(__getUpdated('MemberBadges')).toHaveLength(0);
  });
});

describe('awardBadge — validation', () => {
  it('returns error with status 400 for unknown badgeId', async () => {
    const result = await awardBadge('mem-1', 'nonexistent_badge');
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('Unknown badgeId');
  });

  it('returns auth_required when no member session', async () => {
    memberMocks.getMember.mockResolvedValue(null);
    const result = await awardBadge('mem-1', 'first_purchase');
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('returns forbidden when caller is a different member (IDOR guard)', async () => {
    memberMocks.getMember.mockResolvedValue({ _id: 'mem-2' });
    const result = await awardBadge('mem-1', 'first_purchase');
    expect(result.success).toBe(false);
    expect(result.error).toBe('forbidden');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('MemberBadges', new Error('DB down'));
    const result = await awardBadge('mem-1', 'streak_7');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns auth_required when getMember() throws (network error)', async () => {
    memberMocks.getMember.mockRejectedValue(new Error('network unavailable'));
    const result = await awardBadge('mem-1', 'first_purchase');
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });
});

// ── getMemberBadges ───────────────────────────────────────────────────────────

describe('getMemberBadges', () => {
  it('returns empty badges array for member with no badges', async () => {
    const result = await getMemberBadges('mem-1');
    expect(result.badges).toEqual([]);
  });

  it('returns all badges for a member', async () => {
    __seed('MemberBadges', [
      { _id: 'mb-1', memberId: 'mem-1', badgeId: 'first_purchase', awardedAt: new Date('2026-03-20'), notified: true },
      { _id: 'mb-2', memberId: 'mem-1', badgeId: 'streak_7',       awardedAt: new Date('2026-03-21'), notified: false },
    ]);
    const result = await getMemberBadges('mem-1');
    expect(result.badges).toHaveLength(2);
  });

  it('joins label from BADGES registry', async () => {
    __seed('MemberBadges', [{
      _id: 'mb-1', memberId: 'mem-1', badgeId: 'review_5',
      awardedAt: new Date('2026-03-22'), notified: false,
    }]);
    const result = await getMemberBadges('mem-1');
    expect(result.badges[0].label).toBe('5 Reviews');
  });

  it('includes badgeId and awardedAt in each item', async () => {
    const ts = new Date('2026-03-22T10:00:00Z');
    __seed('MemberBadges', [{
      _id: 'mb-1', memberId: 'mem-1', badgeId: 'referral_3',
      awardedAt: ts, notified: false,
    }]);
    const result = await getMemberBadges('mem-1');
    expect(result.badges[0].badgeId).toBe('referral_3');
    expect(result.badges[0].awardedAt).toEqual(ts);
  });

  it('does not return another member\'s badges', async () => {
    __seed('MemberBadges', [
      { _id: 'mb-1', memberId: 'mem-1', badgeId: 'first_purchase', awardedAt: new Date(), notified: false },
      { _id: 'mb-2', memberId: 'mem-2', badgeId: 'streak_7',       awardedAt: new Date(), notified: false },
    ]);
    const result = await getMemberBadges('mem-1');
    expect(result.badges).toHaveLength(1);
    expect(result.badges[0].badgeId).toBe('first_purchase');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('MemberBadges', new Error('Timeout'));
    const result = await getMemberBadges('mem-1');
    expect(result.success).toBe(false);
  });
});

// ── markBadgeNotified ─────────────────────────────────────────────────────────

describe('markBadgeNotified', () => {
  it('updates notified to true', async () => {
    __seed('MemberBadges', [{
      _id: 'mb-1', memberId: 'mem-1', badgeId: 'streak_30',
      awardedAt: new Date(), notified: false,
    }]);
    const result = await markBadgeNotified('mem-1', 'streak_30');
    expect(result.updated).toBe(true);
    const updated = __getUpdated('MemberBadges');
    expect(updated[0].notified).toBe(true);
  });

  it('returns { notFound: true } when badge record does not exist', async () => {
    const result = await markBadgeNotified('mem-1', 'wishlist_10');
    expect(result.notFound).toBe(true);
  });

  it('returns auth_required when no member session', async () => {
    memberMocks.getMember.mockResolvedValue(null);
    const result = await markBadgeNotified('mem-1', 'streak_7');
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('returns forbidden when caller is a different member (IDOR guard)', async () => {
    memberMocks.getMember.mockResolvedValue({ _id: 'mem-99' });
    const result = await markBadgeNotified('mem-1', 'first_purchase');
    expect(result.success).toBe(false);
    expect(result.error).toBe('forbidden');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('MemberBadges', new Error('Network error'));
    const result = await markBadgeNotified('mem-1', 'review_5');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns auth_required when getMember() throws (network error)', async () => {
    memberMocks.getMember.mockRejectedValue(new Error('auth service down'));
    const result = await markBadgeNotified('mem-1', 'streak_7');
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('preserves other record fields when updating', async () => {
    const ts = new Date('2026-03-20T09:00:00Z');
    __seed('MemberBadges', [{
      _id: 'mb-1', memberId: 'mem-1', badgeId: 'first_purchase',
      awardedAt: ts, notified: false,
    }]);
    await markBadgeNotified('mem-1', 'first_purchase');
    const updated = __getUpdated('MemberBadges');
    expect(updated[0].memberId).toBe('mem-1');
    expect(updated[0].badgeId).toBe('first_purchase');
    expect(updated[0].awardedAt).toEqual(ts);
  });
});
