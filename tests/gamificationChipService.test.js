/**
 * @file gamificationChipService.test.js
 * @description Tests for getGamificationChipsForProducts.
 *
 * Covers:
 *  - returns error for empty productIds
 *  - returns error when productIds exceeds 50
 *  - returns zero-chip envelope for missing/falsy memberId (unauthenticated)
 *  - returns points, tier, streak from MemberPoints
 *  - returns badges from MemberBadges
 *  - hasActivity is true when any of points/streak/badges is non-zero
 *  - hasActivity is false when member has no activity
 *  - returns success:false on MemberPoints query error
 *  - returns chips with empty badges array when MemberBadges query fails (best-effort)
 *
 * cf-tcs / cf-wisp-kmwl
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from 'wix-data';
import { getGamificationChipsForProducts } from '../src/backend/gamificationChipService.web.js';

const PRODUCT_IDS = ['prod-1', 'prod-2', 'prod-3'];
const MEMBER_ID = 'mem-abc';

function makeMemberPoints(overrides = {}) {
  return {
    _id: `mp-${overrides.memberId ?? MEMBER_ID}`,
    memberId: overrides.memberId ?? MEMBER_ID,
    totalPoints: overrides.totalPoints ?? 0,
    tier: overrides.tier ?? null,
    currentStreakDays: overrides.currentStreakDays ?? 0,
    ...overrides,
  };
}

function makeBadge(memberId, badgeId) {
  return { _id: `${memberId}_${badgeId}`, memberId, badgeId };
}

beforeEach(() => {
  __reset();
});

describe('getGamificationChipsForProducts — input validation', () => {
  it('returns error for empty productIds array', async () => {
    __seed('MemberPoints', []);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts([], MEMBER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/productIds/i);
  });

  it('returns error for non-array productIds', async () => {
    const result = await getGamificationChipsForProducts(null, MEMBER_ID);
    expect(result.success).toBe(false);
  });

  it('returns error when productIds exceeds 50', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `prod-${i}`);
    __seed('MemberPoints', []);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(ids, MEMBER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/50/);
  });

  it('returns zero-chip envelope for null memberId (unauthenticated)', async () => {
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, null);
    expect(result.success).toBe(true);
    expect(result.chips).toMatchObject({ points: 0, tier: null, streak: 0, badges: [], hasActivity: false });
  });

  it('returns zero-chip envelope for empty string memberId', async () => {
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, '');
    expect(result.success).toBe(true);
    expect(result.chips.hasActivity).toBe(false);
  });
});

describe('getGamificationChipsForProducts — member data', () => {
  it('returns points from MemberPoints', async () => {
    __seed('MemberPoints', [makeMemberPoints({ totalPoints: 500 })]);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.chips.points).toBe(500);
  });

  it('returns tier from MemberPoints', async () => {
    __seed('MemberPoints', [makeMemberPoints({ tier: 'Summit Master' })]);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.tier).toBe('Summit Master');
  });

  it('returns streak from MemberPoints', async () => {
    __seed('MemberPoints', [makeMemberPoints({ currentStreakDays: 7 })]);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.streak).toBe(7);
  });

  it('returns badges from MemberBadges', async () => {
    __seed('MemberPoints', [makeMemberPoints()]);
    __seed('MemberBadges', [
      makeBadge(MEMBER_ID, 'week_wanderer'),
      makeBadge(MEMBER_ID, 'video_reviewer'),
    ]);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.badges).toContain('week_wanderer');
    expect(result.chips.badges).toContain('video_reviewer');
  });

  it('hasActivity is true when member has points', async () => {
    __seed('MemberPoints', [makeMemberPoints({ totalPoints: 100 })]);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.hasActivity).toBe(true);
  });

  it('hasActivity is true when member has streak', async () => {
    __seed('MemberPoints', [makeMemberPoints({ currentStreakDays: 3 })]);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.hasActivity).toBe(true);
  });

  it('hasActivity is true when member has badges', async () => {
    __seed('MemberPoints', [makeMemberPoints()]);
    __seed('MemberBadges', [makeBadge(MEMBER_ID, 'week_wanderer')]);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.hasActivity).toBe(true);
  });

  it('hasActivity is false when member has no activity', async () => {
    __seed('MemberPoints', [makeMemberPoints({ totalPoints: 0, currentStreakDays: 0 })]);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.chips.hasActivity).toBe(false);
  });

  it('defaults zeros when member has no MemberPoints record', async () => {
    __seed('MemberPoints', []);
    __seed('MemberBadges', []);
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.chips.points).toBe(0);
    expect(result.chips.streak).toBe(0);
    expect(result.chips.tier).toBeNull();
  });
});

describe('getGamificationChipsForProducts — error handling', () => {
  it('returns success:false on MemberPoints query error', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns chips with empty badges when MemberBadges query fails', async () => {
    __seed('MemberPoints', [makeMemberPoints({ totalPoints: 200 })]);
    __setQueryError('MemberBadges', new Error('DB down'));
    const result = await getGamificationChipsForProducts(PRODUCT_IDS, MEMBER_ID);
    expect(result.success).toBe(true);
    expect(result.chips.badges).toEqual([]);
    expect(result.chips.points).toBe(200);
  });
});
