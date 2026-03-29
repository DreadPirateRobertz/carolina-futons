/**
 * Tests for recordTrailChallengeCompletion in challengeService.web.js — CF-mcyh.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
} from './__mocks__/wix-data.js';

// ── Mock trailPerkService ─────────────────────────────────────────────────────

const { mockDeliverTrailPerk } = vi.hoisted(() => ({
  mockDeliverTrailPerk: vi.fn(),
}));

vi.mock('backend/trailPerkService.web', () => ({
  deliverTrailPerk: mockDeliverTrailPerk,
}));

import {
  recordTrailChallengeCompletion,
  TRAIL_REGISTRY,
  TRAIL_PROGRESS_COLLECTION,
} from '../src/backend/challengeService.web.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  mockDeliverTrailPerk.mockResolvedValue({ success: true, alreadyDelivered: false, couponCode: 'TRAIL-TESTCODE' });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('recordTrailChallengeCompletion — validation', () => {
  it('returns error for missing memberId', async () => {
    const r = await recordTrailChallengeCompletion(null, 'trail-spring', 'ch-first-purchase', 'a@b.com');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/memberId/i);
  });

  it('returns error for unknown trailId', async () => {
    const r = await recordTrailChallengeCompletion('mem-1', 'trail-unknown', 'ch-first-purchase', 'a@b.com');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unknown trailId/i);
  });

  it('returns error for challengeId not in trail', async () => {
    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', 'ch-7day-streak', 'a@b.com');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/does not belong/i);
  });
});

// ── First challenge on new progress record ────────────────────────────────────

describe('recordTrailChallengeCompletion — first challenge', () => {
  it('inserts a new progress record on first challenge', async () => {
    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', 'ch-first-purchase', 'a@b.com');
    expect(r.success).toBe(true);
    const inserted = __getInserted(TRAIL_PROGRESS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].trailId).toBe('trail-spring');
    expect(inserted[0].completedChallengeIds).toContain('ch-first-purchase');
  });

  it('uses computed _id for idempotency', async () => {
    await recordTrailChallengeCompletion('mem-1', 'trail-spring', 'ch-first-purchase', 'a@b.com');
    const inserted = __getInserted(TRAIL_PROGRESS_COLLECTION);
    expect(inserted[0]._id).toBe('mem-1_trail-spring');
  });

  it('returns trailComplete: false when only 1/5 challenges done', async () => {
    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', 'ch-first-purchase', 'a@b.com');
    expect(r.trailComplete).toBe(false);
    expect(mockDeliverTrailPerk).not.toHaveBeenCalled();
  });
});

// ── Idempotent completion ─────────────────────────────────────────────────────

describe('recordTrailChallengeCompletion — idempotency', () => {
  it('is a no-op when challenge already completed', async () => {
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-spring',
      memberId: 'mem-1',
      trailId: 'trail-spring',
      completedChallengeIds: ['ch-first-purchase'],
      completedAt: null,
    }]);
    const beforeCount = __getInserted(TRAIL_PROGRESS_COLLECTION).length;
    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', 'ch-first-purchase', 'a@b.com');
    expect(r.success).toBe(true);
    expect(r.perkDelivered).toBe(false);
    // No new inserts or updates
    expect(__getInserted(TRAIL_PROGRESS_COLLECTION)).toHaveLength(beforeCount);
    expect(__getUpdated(TRAIL_PROGRESS_COLLECTION)).toHaveLength(0);
  });
});

// ── Trail completion triggers perk delivery ───────────────────────────────────

describe('recordTrailChallengeCompletion — trail completion', () => {
  const springTrail = TRAIL_REGISTRY.find(t => t.id === 'trail-spring');

  it('delivers perk when final challenge completes the trail', async () => {
    // Seed 4 of 5 challenges done
    const fourChallenges = springTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-spring',
      memberId: 'mem-1',
      trailId: 'trail-spring',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', springTrail.challengeIds[4], 'a@b.com');
    expect(r.success).toBe(true);
    expect(r.trailComplete).toBe(true);
    expect(r.perkDelivered).toBe(true);
    expect(r.couponCode).toBe('TRAIL-TESTCODE');
  });

  it('calls deliverTrailPerk with correct args', async () => {
    const fourChallenges = springTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-spring',
      memberId: 'mem-1',
      trailId: 'trail-spring',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    await recordTrailChallengeCompletion('mem-1', 'trail-spring', springTrail.challengeIds[4], 'tester@example.com');
    expect(mockDeliverTrailPerk).toHaveBeenCalledWith('mem-1', 'perk-free-shipping', 'tester@example.com');
  });

  it('updates progress record with completedAt on trail completion', async () => {
    const fourChallenges = springTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-spring',
      memberId: 'mem-1',
      trailId: 'trail-spring',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    await recordTrailChallengeCompletion('mem-1', 'trail-spring', springTrail.challengeIds[4], 'a@b.com');
    const updated = __getUpdated(TRAIL_PROGRESS_COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].completedAt).toBeInstanceOf(Date);
  });

  it('perkDelivered: false when perk already delivered (alreadyDelivered:true)', async () => {
    mockDeliverTrailPerk.mockResolvedValue({ success: true, alreadyDelivered: true, couponCode: 'TRAIL-OLD' });
    const fourChallenges = springTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-spring',
      memberId: 'mem-1',
      trailId: 'trail-spring',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', springTrail.challengeIds[4], 'a@b.com');
    expect(r.trailComplete).toBe(true);
    expect(r.perkDelivered).toBe(false); // already delivered
  });

  it('returns trailComplete:true even when perk delivery throws', async () => {
    mockDeliverTrailPerk.mockRejectedValue(new Error('perk service down'));
    const fourChallenges = springTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-spring',
      memberId: 'mem-1',
      trailId: 'trail-spring',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    const r = await recordTrailChallengeCompletion('mem-1', 'trail-spring', springTrail.challengeIds[4], 'a@b.com');
    expect(r.success).toBe(true);
    expect(r.trailComplete).toBe(true);
    expect(r.perkDelivered).toBe(false);
  });
});

// ── Summer and Fall trail perks ───────────────────────────────────────────────

describe('recordTrailChallengeCompletion — other trails', () => {
  it('delivers perk-early-access on summer trail completion', async () => {
    const summerTrail = TRAIL_REGISTRY.find(t => t.id === 'trail-summer');
    const fourChallenges = summerTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-summer',
      memberId: 'mem-1',
      trailId: 'trail-summer',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    await recordTrailChallengeCompletion('mem-1', 'trail-summer', summerTrail.challengeIds[4], 'a@b.com');
    expect(mockDeliverTrailPerk).toHaveBeenCalledWith('mem-1', 'perk-early-access', 'a@b.com');
  });

  it('delivers perk-styling-call on fall trail completion', async () => {
    const fallTrail = TRAIL_REGISTRY.find(t => t.id === 'trail-fall');
    const fourChallenges = fallTrail.challengeIds.slice(0, 4);
    __seed(TRAIL_PROGRESS_COLLECTION, [{
      _id: 'mem-1_trail-fall',
      memberId: 'mem-1',
      trailId: 'trail-fall',
      completedChallengeIds: fourChallenges,
      completedAt: null,
    }]);

    await recordTrailChallengeCompletion('mem-1', 'trail-fall', fallTrail.challengeIds[4], 'a@b.com');
    expect(mockDeliverTrailPerk).toHaveBeenCalledWith('mem-1', 'perk-styling-call', 'a@b.com');
  });
});
