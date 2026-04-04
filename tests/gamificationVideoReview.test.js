/**
 * Tests for CF-ou66.2: video_review_approved gamification event.
 * - 500 pts awarded (not streak-multiplied — FIXED_AWARD_EVENT)
 * - video_reviewer badge inserted into MemberBadges (idempotent)
 * - BADGE_REGISTRY and BADGE_DISPLAY_NAMES updated
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __setInsertError,
  __getInserted,
} from './__mocks__/wix-data.js';
import { receiveGamificationEvent } from '../src/backend/gamificationEventReceiver.web.js';
import {
  POINT_VALUES,
  BADGE_REGISTRY,
  BADGE_DISPLAY_NAMES,
} from '../src/public/gamificationTokens.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── Token constants ───────────────────────────────────────────────────────────

describe('POINT_VALUES.VIDEO_REVIEW', () => {
  it('is 500', () => {
    expect(POINT_VALUES.VIDEO_REVIEW).toBe(500);
  });
});

describe('BADGE_REGISTRY.video_reviewer', () => {
  it('exists in registry', () => {
    expect(BADGE_REGISTRY.video_reviewer).toBeDefined();
  });

  it('has tier MOUNTAIN_GUIDE', () => {
    expect(BADGE_REGISTRY.video_reviewer.tier).toBe('MOUNTAIN_GUIDE');
  });

  it('has label Video Reviewer', () => {
    expect(BADGE_REGISTRY.video_reviewer.label).toBe('Video Reviewer');
  });
});

describe('BADGE_DISPLAY_NAMES.video_reviewer', () => {
  it('is Video Reviewer', () => {
    expect(BADGE_DISPLAY_NAMES.video_reviewer).toBe('Video Reviewer');
  });
});

// ── video_review_approved event ───────────────────────────────────────────────

describe('receiveGamificationEvent — video_review_approved', () => {
  it('awards 500 points to a new member', async () => {
    const result = await receiveGamificationEvent('video_review_approved', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(500);
    expect(result.pointsEarned).toBe(500);
  });

  it('awards 500 points on top of existing balance', async () => {
    __seed('MemberPoints', [{ _id: 'mp-1', memberId: 'mem-1', totalPoints: 200, tier: 'Trail Blazer' }]);
    const result = await receiveGamificationEvent('video_review_approved', {}, 'mem-1');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(700);
  });

  it('is not streak-multiplied (FIXED_AWARD_EVENT)', async () => {
    // Seed a member with a 7-day streak (3× multiplier) — video_review_approved should still be 500
    __seed('MemberPoints', [{
      _id: 'mp-1',
      memberId: 'mem-streak',
      totalPoints: 0,
      tier: 'Trail Blazer',
      currentStreakDays: 7,
    }]);
    const result = await receiveGamificationEvent('video_review_approved', {}, 'mem-streak');
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(500);
    expect(result.pointsEarned).toBe(500);
  });

  it('inserts video_reviewer badge into MemberBadges', async () => {
    await receiveGamificationEvent('video_review_approved', {}, 'mem-1');
    const inserted = __getInserted('MemberBadges');
    const badge = inserted.find(b => b.badgeId === 'video_reviewer');
    expect(badge).toBeDefined();
    expect(badge.memberId).toBe('mem-1');
  });

  it('uses computed _id for idempotent badge insert', async () => {
    await receiveGamificationEvent('video_review_approved', {}, 'mem-1');
    const inserted = __getInserted('MemberBadges');
    const badge = inserted.find(b => b.badgeId === 'video_reviewer');
    expect(badge._id).toBe('mem-1_video_reviewer');
  });

  it('returns badgeUnlocked: video_reviewer on first award', async () => {
    const result = await receiveGamificationEvent('video_review_approved', {}, 'mem-1');
    expect(result.badgeUnlocked).toBe('video_reviewer');
  });

  it('succeeds silently when badge already exists (duplicate insert error)', async () => {
    __setInsertError('MemberBadges', new Error('duplicate key violates unique constraint'));
    const result = await receiveGamificationEvent('video_review_approved', {}, 'mem-1');
    // Points still awarded; badge insert failure is silent for duplicates
    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(500);
  });

  it('returns { success: false } when memberId is missing', async () => {
    const result = await receiveGamificationEvent('video_review_approved', {}, null);
    expect(result.success).toBe(false);
  });
});
