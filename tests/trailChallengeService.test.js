/**
 * @file trailChallengeService.test.js
 * @description TDD tests for trailChallengeService.web.js — CF-mcyh.2
 *
 * trailChallengeService is the webMethod layer over challengeService.web:
 *   - getMyTrailProgress() — SiteMember: resolves current member, delegates to getTrailProgress
 *   - completeTrailChallenge(trailId, challengeId) — SiteMember: marks challenge done,
 *       triggers perk unlock when trail is complete
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const {
  mockGetMember,
  mockGetTrailProgress,
  mockRecordTrailChallengeCompletion,
} = vi.hoisted(() => ({
  mockGetMember: vi.fn(),
  mockGetTrailProgress: vi.fn(),
  mockRecordTrailChallengeCompletion: vi.fn(),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: mockGetMember },
}));

vi.mock('backend/challengeService.web', () => ({
  getTrailProgress: mockGetTrailProgress,
  recordTrailChallengeCompletion: mockRecordTrailChallengeCompletion,
}));

// ── Import SUT ────────────────────────────────────────────────────────────────

import {
  getMyTrailProgress,
  completeTrailChallenge,
} from '../src/backend/trailChallengeService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER = { _id: 'mem-trail-1', loginEmail: 'hiker@test.com' };

const TRAIL_PROGRESS_RESULT = {
  success: true,
  trails: [
    {
      trailId: 'trail-spring',
      name: 'Spring Awakening',
      season: 'spring',
      challengeIds: ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'],
      completedChallengeIds: ['ch-first-purchase'],
      isComplete: false,
      completedAt: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMember.mockResolvedValue(MEMBER);
  mockGetTrailProgress.mockResolvedValue(TRAIL_PROGRESS_RESULT);
  mockRecordTrailChallengeCompletion.mockResolvedValue({
    success: true,
    trailComplete: false,
    perkDelivered: false,
  });
});

// ── getMyTrailProgress ────────────────────────────────────────────────────────

describe('getMyTrailProgress', () => {
  it('delegates to getTrailProgress with current member id', async () => {
    const result = await getMyTrailProgress();
    expect(mockGetTrailProgress).toHaveBeenCalledWith('mem-trail-1');
    expect(result).toEqual(TRAIL_PROGRESS_RESULT);
  });

  it('returns error when member is not authenticated', async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await getMyTrailProgress();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
    expect(mockGetTrailProgress).not.toHaveBeenCalled();
  });

  it('returns error when getMember throws', async () => {
    mockGetMember.mockRejectedValue(new Error('session expired'));
    const result = await getMyTrailProgress();
    expect(result.success).toBe(false);
    expect(mockGetTrailProgress).not.toHaveBeenCalled();
  });

  it('surfaces errors from getTrailProgress', async () => {
    mockGetTrailProgress.mockResolvedValue({ success: false, trails: [], error: 'DB down' });
    const result = await getMyTrailProgress();
    expect(result.success).toBe(false);
    expect(result.error).toBe('DB down');
  });
});

// ── completeTrailChallenge ────────────────────────────────────────────────────

describe('completeTrailChallenge', () => {
  it('calls recordTrailChallengeCompletion with member id, email, trailId, challengeId', async () => {
    await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    expect(mockRecordTrailChallengeCompletion).toHaveBeenCalledWith(
      'mem-trail-1',
      'trail-spring',
      'ch-first-purchase',
      'hiker@test.com',
    );
  });

  it('returns success with trailComplete: false when trail not yet done', async () => {
    const result = await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    expect(result.success).toBe(true);
    expect(result.trailComplete).toBe(false);
    expect(result.perkDelivered).toBe(false);
  });

  it('returns trailComplete: true and perkDelivered: true when trail finishes', async () => {
    mockRecordTrailChallengeCompletion.mockResolvedValue({
      success: true,
      trailComplete: true,
      perkDelivered: true,
      couponCode: 'TRAIL-ABCD1234',
    });
    const result = await completeTrailChallenge('trail-spring', 'ch-sleep-quiz');
    expect(result.trailComplete).toBe(true);
    expect(result.perkDelivered).toBe(true);
    expect(result.couponCode).toBe('TRAIL-ABCD1234');
  });

  it('returns error when member is not authenticated', async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
    expect(mockRecordTrailChallengeCompletion).not.toHaveBeenCalled();
  });

  it('returns error when getMember throws', async () => {
    mockGetMember.mockRejectedValue(new Error('auth failure'));
    const result = await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    expect(result.success).toBe(false);
    expect(mockRecordTrailChallengeCompletion).not.toHaveBeenCalled();
  });

  it('returns error for missing trailId', async () => {
    const result = await completeTrailChallenge(null, 'ch-first-purchase');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/trailId/i);
    expect(mockRecordTrailChallengeCompletion).not.toHaveBeenCalled();
  });

  it('returns error for missing challengeId', async () => {
    const result = await completeTrailChallenge('trail-spring', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/challengeId/i);
    expect(mockRecordTrailChallengeCompletion).not.toHaveBeenCalled();
  });

  it('surfaces errors from recordTrailChallengeCompletion', async () => {
    mockRecordTrailChallengeCompletion.mockResolvedValue({
      success: false,
      error: 'Unknown trailId: trail-bad.',
    });
    const result = await completeTrailChallenge('trail-bad', 'ch-first-purchase');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/trailId/i);
  });

  it('is idempotent — already-completed challenge returns success', async () => {
    mockRecordTrailChallengeCompletion.mockResolvedValue({
      success: true,
      trailComplete: false,
      perkDelivered: false,
    });
    const first = await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    const second = await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(mockRecordTrailChallengeCompletion).toHaveBeenCalledTimes(2);
  });

  it('uses empty string as email fallback when loginEmail is absent', async () => {
    mockGetMember.mockResolvedValue({ _id: 'mem-no-email' });
    await completeTrailChallenge('trail-spring', 'ch-first-purchase');
    expect(mockRecordTrailChallengeCompletion).toHaveBeenCalledWith(
      'mem-no-email',
      'trail-spring',
      'ch-first-purchase',
      '',
    );
  });
});
