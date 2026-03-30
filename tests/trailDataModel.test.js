/**
 * @file trailDataModel.test.js
 * @description TDD tests for CF-mcyh.1: Trail data model — Trail+Challenge join,
 * TrailProgress collection, getTrailProgress(memberId).
 *
 * Tests:
 *   - TRAIL_REGISTRY structure (id, name, theme, season, challengeIds, perkId)
 *   - getTrailProgress(memberId) — returns all 4 trails with per-trail progress
 *   - completedChallengeIds populated from MemberTrailProgress collection
 *   - completedAt populated when all challenges done
 *   - Member with no progress gets all trails with empty completedChallengeIds[]
 *   - isComplete flag set when completedChallengeIds.length === trail.challengeIds.length
 *   - error handling — returns safe fallback on DB failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __seed, __reset as resetData, __setQueryError } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

import {
  TRAIL_REGISTRY,
  TRAIL_PROGRESS_COLLECTION,
  getTrailProgress,
} from '../src/backend/challengeService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'member-abc';

function setMember(id = MEMBER_ID) {
  __setMember({ _id: id, contactDetails: { firstName: 'Hiker' } });
}

// ── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetMember();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── TRAIL_REGISTRY structure ──────────────────────────────────────────────────

describe('TRAIL_REGISTRY', () => {
  it('is an array with at least 1 trail', () => {
    expect(Array.isArray(TRAIL_REGISTRY)).toBe(true);
    expect(TRAIL_REGISTRY.length).toBeGreaterThanOrEqual(1);
  });

  it('each trail has required fields: id, name, theme, season, challengeIds, perkId', () => {
    for (const trail of TRAIL_REGISTRY) {
      expect(typeof trail.id).toBe('string');
      expect(typeof trail.name).toBe('string');
      expect(typeof trail.theme).toBe('string');
      expect(typeof trail.season).toBe('string');
      expect(Array.isArray(trail.challengeIds)).toBe(true);
      expect(trail.challengeIds.length).toBeGreaterThanOrEqual(1);
      expect(typeof trail.perkId).toBe('string');
    }
  });

  it('trail ids are unique', () => {
    const ids = TRAIL_REGISTRY.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('challengeIds within each trail are unique', () => {
    for (const trail of TRAIL_REGISTRY) {
      expect(new Set(trail.challengeIds).size).toBe(trail.challengeIds.length);
    }
  });

  it('Spring trail has 5 challenges matching the epic spec', () => {
    const spring = TRAIL_REGISTRY.find(t => t.season === 'spring');
    expect(spring).toBeDefined();
    expect(spring.challengeIds).toHaveLength(5);
  });

  it('Summer trail has 5 challenges', () => {
    const summer = TRAIL_REGISTRY.find(t => t.season === 'summer');
    expect(summer).toBeDefined();
    expect(summer.challengeIds).toHaveLength(5);
  });

  it('Fall trail has 5 challenges', () => {
    const fall = TRAIL_REGISTRY.find(t => t.season === 'fall');
    expect(fall).toBeDefined();
    expect(fall.challengeIds).toHaveLength(5);
  });
});

// ── TRAIL_PROGRESS_COLLECTION constant ───────────────────────────────────────

describe('TRAIL_PROGRESS_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof TRAIL_PROGRESS_COLLECTION).toBe('string');
    expect(TRAIL_PROGRESS_COLLECTION.length).toBeGreaterThan(0);
  });
});

// ── getTrailProgress — member with no progress ────────────────────────────────

describe('getTrailProgress — no prior progress', () => {
  it('returns success: true', async () => {
    setMember();
    __seed(TRAIL_PROGRESS_COLLECTION, []);

    const result = await getTrailProgress(MEMBER_ID);
    expect(result.success).toBe(true);
  });

  it('returns one entry per trail in TRAIL_REGISTRY', async () => {
    setMember();
    __seed(TRAIL_PROGRESS_COLLECTION, []);

    const result = await getTrailProgress(MEMBER_ID);
    expect(result.trails).toHaveLength(TRAIL_REGISTRY.length);
  });

  it('each entry has trailId, name, season, completedChallengeIds, isComplete', async () => {
    setMember();
    __seed(TRAIL_PROGRESS_COLLECTION, []);

    const result = await getTrailProgress(MEMBER_ID);
    for (const t of result.trails) {
      expect(typeof t.trailId).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.season).toBe('string');
      expect(Array.isArray(t.completedChallengeIds)).toBe(true);
      expect(typeof t.isComplete).toBe('boolean');
    }
  });

  it('completedChallengeIds is empty for member with no progress', async () => {
    setMember();
    __seed(TRAIL_PROGRESS_COLLECTION, []);

    const result = await getTrailProgress(MEMBER_ID);
    for (const t of result.trails) {
      expect(t.completedChallengeIds).toEqual([]);
      expect(t.isComplete).toBe(false);
    }
  });

  it('completedAt is null when not completed', async () => {
    setMember();
    __seed(TRAIL_PROGRESS_COLLECTION, []);

    const result = await getTrailProgress(MEMBER_ID);
    for (const t of result.trails) {
      expect(t.completedAt).toBeNull();
    }
  });
});

// ── getTrailProgress — member with partial progress ───────────────────────────

describe('getTrailProgress — partial progress', () => {
  it('merges saved completedChallengeIds into matching trail', async () => {
    setMember();
    const springTrail = TRAIL_REGISTRY.find(t => t.season === 'spring');
    const partialChallenges = springTrail.challengeIds.slice(0, 2);

    __seed(TRAIL_PROGRESS_COLLECTION, [
      {
        _id: 'tp-1',
        memberId: MEMBER_ID,
        trailId: springTrail.id,
        completedChallengeIds: partialChallenges,
        completedAt: null,
      },
    ]);

    const result = await getTrailProgress(MEMBER_ID);
    const spring = result.trails.find(t => t.trailId === springTrail.id);
    expect(spring.completedChallengeIds).toEqual(partialChallenges);
    expect(spring.isComplete).toBe(false);
  });

  it('does not merge another member\u2019s progress', async () => {
    setMember();
    const springTrail = TRAIL_REGISTRY.find(t => t.season === 'spring');

    __seed(TRAIL_PROGRESS_COLLECTION, [
      {
        _id: 'tp-other',
        memberId: 'other-member',
        trailId: springTrail.id,
        completedChallengeIds: springTrail.challengeIds,
        completedAt: new Date('2026-03-01'),
      },
    ]);

    const result = await getTrailProgress(MEMBER_ID);
    const spring = result.trails.find(t => t.trailId === springTrail.id);
    expect(spring.completedChallengeIds).toEqual([]);
    expect(spring.isComplete).toBe(false);
  });
});

// ── getTrailProgress — completed trail ────────────────────────────────────────

describe('getTrailProgress — completed trail', () => {
  it('sets isComplete true when all challenges done', async () => {
    setMember();
    const summerTrail = TRAIL_REGISTRY.find(t => t.season === 'summer');

    __seed(TRAIL_PROGRESS_COLLECTION, [
      {
        _id: 'tp-summer',
        memberId: MEMBER_ID,
        trailId: summerTrail.id,
        completedChallengeIds: [...summerTrail.challengeIds],
        completedAt: new Date('2026-03-15'),
      },
    ]);

    const result = await getTrailProgress(MEMBER_ID);
    const summer = result.trails.find(t => t.trailId === summerTrail.id);
    expect(summer.isComplete).toBe(true);
    expect(summer.completedAt).not.toBeNull();
  });

  it('populates completedAt from saved record', async () => {
    setMember();
    const springTrail = TRAIL_REGISTRY.find(t => t.season === 'spring');
    const completedDate = new Date('2026-02-14');

    __seed(TRAIL_PROGRESS_COLLECTION, [
      {
        _id: 'tp-spring',
        memberId: MEMBER_ID,
        trailId: springTrail.id,
        completedChallengeIds: [...springTrail.challengeIds],
        completedAt: completedDate,
      },
    ]);

    const result = await getTrailProgress(MEMBER_ID);
    const spring = result.trails.find(t => t.trailId === springTrail.id);
    expect(spring.isComplete).toBe(true);
    expect(spring.completedAt).toEqual(completedDate);
  });
});

// ── getTrailProgress — multiple trails with mixed progress ────────────────────

describe('getTrailProgress — multiple trails', () => {
  it('handles progress records for multiple trails simultaneously', async () => {
    setMember();
    const springTrail = TRAIL_REGISTRY.find(t => t.season === 'spring');
    const summerTrail = TRAIL_REGISTRY.find(t => t.season === 'summer');

    __seed(TRAIL_PROGRESS_COLLECTION, [
      {
        _id: 'tp-spring',
        memberId: MEMBER_ID,
        trailId: springTrail.id,
        completedChallengeIds: [...springTrail.challengeIds],
        completedAt: new Date('2026-03-01'),
      },
      {
        _id: 'tp-summer',
        memberId: MEMBER_ID,
        trailId: summerTrail.id,
        completedChallengeIds: summerTrail.challengeIds.slice(0, 3),
        completedAt: null,
      },
    ]);

    const result = await getTrailProgress(MEMBER_ID);

    const spring = result.trails.find(t => t.trailId === springTrail.id);
    expect(spring.isComplete).toBe(true);

    const summer = result.trails.find(t => t.trailId === summerTrail.id);
    expect(summer.isComplete).toBe(false);
    expect(summer.completedChallengeIds).toHaveLength(3);
  });
});

// ── getTrailProgress — error handling ────────────────────────────────────────

describe('getTrailProgress — error handling', () => {
  it('returns success false and safe fallback on DB error', async () => {
    setMember();
    __setQueryError(TRAIL_PROGRESS_COLLECTION, new Error('DB timeout'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getTrailProgress(MEMBER_ID);

    expect(result.success).toBe(false);
    expect(result.trails).toEqual([]);
    expect(result.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
