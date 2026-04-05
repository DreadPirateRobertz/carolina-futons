/**
 * loyaltyPortability.test.js
 * CF-znpj — Two concerns:
 *   1. Verify loyaltyTiers.ts (pure TS port) values are byte-exact with gamificationTokens.js
 *   2. Hardening guards in loyaltyService.web.js (checkStreakAchievements,
 *      insertStreakAchievement, recordChallengeCompleteEvent)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __setInsertError, __getInserted } from './__mocks__/wix-data.js';

// ── Mocks (top-level, hoisted by Vitest) ─────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const c = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(c) ? c : '';
  },
}));

vi.mock('wix-loyalty.v2', () => ({
  accounts: { getMyAccount: vi.fn(async () => null) },
  rewards: { listRewards: vi.fn(async () => ({ rewards: [] })) },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member1' })) },
}));

vi.mock('backend/memberGamePreferences.web', () => ({
  getGamePrefsForMember: vi.fn(async () => ({})),
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));

// ── Import modules under test ─────────────────────────────────────────────────

import {
  TIER_THRESHOLDS,
  POINT_VALUES,
  STREAK_RECOVERY_COST,
  STREAK_MULTIPLIER_TIERS,
  getStreakMultiplier,
  BADGE_COLORS,
  BADGE_REGISTRY,
  TIER_NAMES,
  getTierForPoints,
  GAMIFICATION_TIER_ORDER,
  PERK_TYPES,
  TIER_PERKS,
  getPerksByTier,
  getNewPerksOnPromotion,
  isBonusPointsDayAvailable,
  getBadgesForAccount,
  BADGE_DISPLAY_NAMES,
  TIER_PERK_CATALOG,
} from '../src/public/loyaltyTiers.ts';

import {
  checkStreakAchievements,
  insertStreakAchievement,
  recordChallengeCompleteEvent,
} from '../src/backend/loyaltyService.web.js';

beforeEach(() => {
  resetData();
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 1: loyaltyTiers.ts — pure TS port value verification
// ═════════════════════════════════════════════════════════════════════════════

describe('loyaltyTiers.ts — TIER_THRESHOLDS', () => {
  it('TRAIL_BLAZER is 0', () => expect(TIER_THRESHOLDS.TRAIL_BLAZER).toBe(0));
  it('MOUNTAIN_GUIDE is 500', () => expect(TIER_THRESHOLDS.MOUNTAIN_GUIDE).toBe(500));
  it('SUMMIT_MASTER is 2000', () => expect(TIER_THRESHOLDS.SUMMIT_MASTER).toBe(2000));
  it('BLUE_RIDGE_LEGEND is 5000', () => expect(TIER_THRESHOLDS.BLUE_RIDGE_LEGEND).toBe(5000));
});

describe('loyaltyTiers.ts — POINT_VALUES', () => {
  it('PURCHASE_PER_DOLLAR is 2', () => expect(POINT_VALUES.PURCHASE_PER_DOLLAR).toBe(2));
  it('REVIEW is 100', () => expect(POINT_VALUES.REVIEW).toBe(100));
  it('REFERRAL_ACCEPTED is 500', () => expect(POINT_VALUES.REFERRAL_ACCEPTED).toBe(500));
  it('AR_TRY_ON is 25', () => expect(POINT_VALUES.AR_TRY_ON).toBe(25));
  it('VIDEO_REVIEW is 500', () => expect(POINT_VALUES.VIDEO_REVIEW).toBe(500));
  it('VISUAL_SEARCH_USE is 15 (mobile-only)', () => expect(POINT_VALUES.VISUAL_SEARCH_USE).toBe(15));
  it('SHARE_PRODUCT is 10 (mobile-only)', () => expect(POINT_VALUES.SHARE_PRODUCT).toBe(10));
  it('PUSH_NOTIFICATION_ENABLED is 50 (mobile-only)', () => expect(POINT_VALUES.PUSH_NOTIFICATION_ENABLED).toBe(50));
});

describe('loyaltyTiers.ts — STREAK_RECOVERY_COST', () => {
  it('is 50', () => expect(STREAK_RECOVERY_COST).toBe(50));
});

describe('loyaltyTiers.ts — getStreakMultiplier', () => {
  it('0 days → 1×', () => expect(getStreakMultiplier(0)).toBe(1));
  it('2 days → 1×', () => expect(getStreakMultiplier(2)).toBe(1));
  it('3 days → 2×', () => expect(getStreakMultiplier(3)).toBe(2));
  it('6 days → 2×', () => expect(getStreakMultiplier(6)).toBe(2));
  it('7 days → 3×', () => expect(getStreakMultiplier(7)).toBe(3));
  it('100 days → 3×', () => expect(getStreakMultiplier(100)).toBe(3));
});

describe('loyaltyTiers.ts — BADGE_COLORS (inlined hex from sharedTokens.js)', () => {
  it('PREMIUM is badgeEspresso #3D1C02', () => expect(BADGE_COLORS.PREMIUM).toBe('#3D1C02'));
  it('ACHIEVEMENT is badgeForestBlue #2B5FA5', () => expect(BADGE_COLORS.ACHIEVEMENT).toBe('#2B5FA5'));
  it('URGENCY is badgeCoral #E8634B', () => expect(BADGE_COLORS.URGENCY).toBe('#E8634B'));
});

describe('loyaltyTiers.ts — BADGE_REGISTRY', () => {
  it('first_step uses coral (#E8634B) Eastern Bluebird SVG', () => {
    expect(BADGE_REGISTRY.first_step.svgColor).toBe('#E8634B');
    expect(BADGE_REGISTRY.first_step.svgLabel).toBe('Eastern Bluebird');
    expect(BADGE_REGISTRY.first_step.tier).toBe('TRAIL_BLAZER');
  });
  it('trail_regular uses espresso (#3D1C02) Black Bear SVG', () => {
    expect(BADGE_REGISTRY.trail_regular.svgColor).toBe('#3D1C02');
    expect(BADGE_REGISTRY.trail_regular.svgLabel).toBe('Black Bear');
  });
  it('visualizer uses mountainBlue (#5B8FA8) Great Horned Owl SVG', () => {
    expect(BADGE_REGISTRY.visualizer.svgColor).toBe('#5B8FA8');
    expect(BADGE_REGISTRY.visualizer.svgLabel).toBe('Great Horned Owl');
  });
  it('curator uses forestBlue (#2B5FA5) Luna Moth SVG, tier MOUNTAIN_GUIDE', () => {
    expect(BADGE_REGISTRY.curator.svgColor).toBe('#2B5FA5');
    expect(BADGE_REGISTRY.curator.tier).toBe('MOUNTAIN_GUIDE');
  });
  it('week_wanderer uses gold (#C8960C) Red-Tailed Hawk SVG', () => {
    expect(BADGE_REGISTRY.week_wanderer.svgColor).toBe('#C8960C');
    expect(BADGE_REGISTRY.week_wanderer.svgLabel).toBe('Red-Tailed Hawk');
  });
  it('voice_of_mountain has no SVG path (emoji-only badge)', () => {
    expect(BADGE_REGISTRY.voice_of_mountain.svgPath).toBeUndefined();
    expect(BADGE_REGISTRY.voice_of_mountain.icon).toBe('🏔️');
  });
  it('video_reviewer uses gold (#C8960C) Monarch Butterfly SVG', () => {
    expect(BADGE_REGISTRY.video_reviewer.svgColor).toBe('#C8960C');
    expect(BADGE_REGISTRY.video_reviewer.svgLabel).toBe('Monarch Butterfly');
  });
  it('all SVG paths begin with "M" (valid path data)', () => {
    for (const [id, badge] of Object.entries(BADGE_REGISTRY)) {
      if (badge.svgPath) expect(badge.svgPath.trim()).toMatch(/^M/i);
    }
  });
});

describe('loyaltyTiers.ts — getTierForPoints', () => {
  it('0 → Trail Blazer', () => expect(getTierForPoints(0)).toBe('Trail Blazer'));
  it('499 → Trail Blazer', () => expect(getTierForPoints(499)).toBe('Trail Blazer'));
  it('500 → Mountain Guide', () => expect(getTierForPoints(500)).toBe('Mountain Guide'));
  it('1999 → Mountain Guide', () => expect(getTierForPoints(1999)).toBe('Mountain Guide'));
  it('2000 → Summit Master', () => expect(getTierForPoints(2000)).toBe('Summit Master'));
  it('5000 → Blue Ridge Legend', () => expect(getTierForPoints(5000)).toBe('Blue Ridge Legend'));
  it('NaN → Trail Blazer', () => expect(getTierForPoints(NaN)).toBe('Trail Blazer'));
  it('Infinity → Trail Blazer', () => expect(getTierForPoints(Infinity)).toBe('Trail Blazer'));
  it('negative → Trail Blazer', () => expect(getTierForPoints(-1)).toBe('Trail Blazer'));
  it('null coerces to 0 → Trail Blazer', () => expect(getTierForPoints(null)).toBe('Trail Blazer'));
});

describe('loyaltyTiers.ts — GAMIFICATION_TIER_ORDER', () => {
  it('ascending 4-tier order', () => {
    expect(GAMIFICATION_TIER_ORDER).toEqual([
      'Trail Blazer', 'Mountain Guide', 'Summit Master', 'Blue Ridge Legend',
    ]);
  });
});

describe('loyaltyTiers.ts — TIER_PERKS cumulative stacking', () => {
  it('Trail Blazer has 1 perk', () => expect(TIER_PERKS['Trail Blazer']).toHaveLength(1));
  it('Mountain Guide has 3 perks (cumulative)', () => expect(TIER_PERKS['Mountain Guide']).toHaveLength(3));
  it('Summit Master has 6 perks (cumulative)', () => expect(TIER_PERKS['Summit Master']).toHaveLength(6));
  it('Blue Ridge Legend shares Summit Master perks', () => {
    expect(TIER_PERKS['Blue Ridge Legend']).toStrictEqual(TIER_PERKS['Summit Master']);
  });
  it('birthday discount is 10%, delivery coupon_email', () => {
    const p = TIER_PERKS['Trail Blazer'].find(p => p.type === 'BIRTHDAY_DISCOUNT');
    expect(p?.value).toBe(10);
    expect(p?.delivery).toBe('coupon_email');
  });
  it('EARLY_ACCESS perk value is 48h', () => {
    const p = TIER_PERKS['Summit Master'].find(p => p.type === 'EARLY_ACCESS');
    expect(p?.value).toBe(48);
  });
});

describe('loyaltyTiers.ts — getNewPerksOnPromotion', () => {
  it('Trail Blazer → Mountain Guide → 2 new perks', () => {
    const perks = getNewPerksOnPromotion('Trail Blazer', 'Mountain Guide');
    expect(perks).toHaveLength(2);
    expect(perks.map(p => p.type)).toContain('ACCESSORY_DISCOUNT');
  });
  it('Mountain Guide → Summit Master → 3 new perks', () => {
    expect(getNewPerksOnPromotion('Mountain Guide', 'Summit Master')).toHaveLength(3);
  });
  it('null → Trail Blazer → all Trail Blazer perks (new member)', () => {
    const perks = getNewPerksOnPromotion(null, 'Trail Blazer');
    expect(perks).toHaveLength(1);
    expect(perks[0].type).toBe('BIRTHDAY_DISCOUNT');
  });
  it('same tier → 0 new perks', () => {
    expect(getNewPerksOnPromotion('Mountain Guide', 'Mountain Guide')).toHaveLength(0);
  });
});

describe('loyaltyTiers.ts — isBonusPointsDayAvailable', () => {
  it('null → available', () => expect(isBonusPointsDayAvailable(null, '2026-04-04')).toBe(true));
  it('undefined → available', () => expect(isBonusPointsDayAvailable(undefined, '2026-04-04')).toBe(true));
  it('used today → not available', () => expect(isBonusPointsDayAvailable('2026-04-04', '2026-04-04')).toBe(false));
  it('used 6 days ago → not available', () => expect(isBonusPointsDayAvailable('2026-03-29', '2026-04-04')).toBe(false));
  it('used 7 days ago → available', () => expect(isBonusPointsDayAvailable('2026-03-28', '2026-04-04')).toBe(true));
});

describe('loyaltyTiers.ts — getBadgesForAccount', () => {
  it('empty → []', () => expect(getBadgesForAccount({})).toEqual([]));
  it('no arg → []', () => expect(getBadgesForAccount()).toEqual([]));
  it('1 purchase → first_step', () => expect(getBadgesForAccount({ purchaseCount: 1 })).toContain('first_step'));
  it('3 purchases → first_step + trail_regular', () => {
    const b = getBadgesForAccount({ purchaseCount: 3 });
    expect(b).toContain('first_step');
    expect(b).toContain('trail_regular');
  });
  it('arTryOnUsed → visualizer', () => expect(getBadgesForAccount({ arTryOnUsed: true })).toContain('visualizer'));
  it('3 distinct product lines → curator', () => {
    expect(getBadgesForAccount({ productLines: ['futons', 'sofas', 'chairs'] })).toContain('curator');
  });
  it('3× same product line → no curator (dedup by Set)', () => {
    expect(getBadgesForAccount({ productLines: ['futons', 'futons', 'futons'] })).not.toContain('curator');
  });
  it('currentStreakDays 7 → week_wanderer', () => {
    expect(getBadgesForAccount({ currentStreakDays: 7 })).toContain('week_wanderer');
  });
  it('currentStreakDays 6 → no week_wanderer', () => {
    expect(getBadgesForAccount({ currentStreakDays: 6 })).not.toContain('week_wanderer');
  });
  it('reviewCount 3 → voice_of_mountain', () => {
    expect(getBadgesForAccount({ reviewCount: 3 })).toContain('voice_of_mountain');
  });
});

describe('loyaltyTiers.ts — BADGE_DISPLAY_NAMES', () => {
  it('week_wanderer → Week Wanderer', () => expect(BADGE_DISPLAY_NAMES.week_wanderer).toBe('Week Wanderer'));
  it('trail_regular → Trail Regular', () => expect(BADGE_DISPLAY_NAMES.trail_regular).toBe('Trail Regular'));
  it('video_reviewer → Video Reviewer', () => expect(BADGE_DISPLAY_NAMES.video_reviewer).toBe('Video Reviewer'));
});

describe('loyaltyTiers.ts — TIER_PERK_CATALOG', () => {
  it('has 4 entries', () => expect(TIER_PERK_CATALOG).toHaveLength(4));
  it('keys are in ascending tier order', () => {
    expect(TIER_PERK_CATALOG.map(e => e.tierKey)).toEqual([
      'TRAIL_BLAZER', 'MOUNTAIN_GUIDE', 'SUMMIT_MASTER', 'BLUE_RIDGE_LEGEND',
    ]);
  });
  it('each entry has non-empty perks array', () => {
    for (const entry of TIER_PERK_CATALOG) expect(entry.perks.length).toBeGreaterThan(0);
  });
  it('Blue Ridge Legend has free-shipping-all perk', () => {
    const legend = TIER_PERK_CATALOG.find(e => e.tierKey === 'BLUE_RIDGE_LEGEND');
    expect(legend?.perks.some(p => p.perkId === 'free-shipping-all')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Part 2: loyaltyService.web.js hardening guards
// ═════════════════════════════════════════════════════════════════════════════

// ── checkStreakAchievements — memberId validation ─────────────────────────────

describe('checkStreakAchievements — memberId validation (CF-znpj hardening)', () => {
  it('returns [] for null memberId without querying DB', async () => {
    const result = await checkStreakAchievements(null, 30);
    expect(result).toEqual([]);
  });

  it('returns [] for empty-string memberId', async () => {
    expect(await checkStreakAchievements('', 30)).toEqual([]);
  });

  it('returns [] for path-traversal memberId (../../etc/passwd)', async () => {
    expect(await checkStreakAchievements('../../etc/passwd', 30)).toEqual([]);
  });

  it('returns [] when streak days do not cross any milestone (0 days)', async () => {
    expect(await checkStreakAchievements('member-1', 0)).toEqual([]);
  });

  it('returns newly crossed milestone for valid memberId', async () => {
    const result = await checkStreakAchievements('member-1', 7);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain(7);
  });

  it('skips milestones already in StreakAchievements', async () => {
    __seed('StreakAchievements', [{ memberId: 'member-1', milestone: 7 }]);
    const result = await checkStreakAchievements('member-1', 7);
    expect(result).not.toContain(7);
  });
});

// ── insertStreakAchievement — memberId validation + concurrent dedup ───────────

describe('insertStreakAchievement — memberId validation + idempotency (CF-znpj hardening)', () => {
  it('throws TypeError for null memberId', async () => {
    await expect(insertStreakAchievement(null, 7, 7)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for path-traversal memberId', async () => {
    await expect(insertStreakAchievement('../bad', 7, 7)).rejects.toThrow(TypeError);
  });

  it('inserts record for valid memberId + milestone', async () => {
    await insertStreakAchievement('member-1', 7, 7);
    const inserted = __getInserted('StreakAchievements');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ memberId: 'member-1', milestone: 7, streakDays: 7 });
  });

  it('skips insert when record already exists (read-before-write dedup)', async () => {
    __seed('StreakAchievements', [{ _id: 'x', memberId: 'member-1', milestone: 7 }]);
    await insertStreakAchievement('member-1', 7, 7);
    // No new inserts — should still be only the seeded record
    expect(__getInserted('StreakAchievements')).toHaveLength(1);
  });

  it('silently handles duplicate-key error from concurrent insert (idempotent)', async () => {
    __setInsertError('StreakAchievements', new Error('duplicate key value violates unique constraint'));
    await expect(insertStreakAchievement('member-1', 7, 7)).resolves.toBeUndefined();
  });

  it('re-throws non-duplicate errors', async () => {
    __setInsertError('StreakAchievements', new Error('network timeout'));
    await expect(insertStreakAchievement('member-1', 7, 7)).rejects.toThrow('network timeout');
  });
});

// ── recordChallengeCompleteEvent — concurrent duplicate key idempotency ───────

describe('recordChallengeCompleteEvent — concurrent duplicate key idempotency (CF-znpj hardening)', () => {
  it('silently returns on duplicate insert error (DB-level constraint)', async () => {
    // App-level read-before-write finds nothing; DB rejects the insert as duplicate
    __setInsertError('PointsLedger', new Error('WDE0025: duplicate key'));
    await expect(
      recordChallengeCompleteEvent('member-1', 'challenge-1', 50)
    ).resolves.toBeUndefined();
  });

  it('re-throws non-duplicate insert errors', async () => {
    __setInsertError('PointsLedger', new Error('permission denied'));
    await expect(
      recordChallengeCompleteEvent('member-1', 'challenge-1', 50)
    ).rejects.toThrow('permission denied');
  });

  it('throws TypeError for invalid memberId', async () => {
    await expect(
      recordChallengeCompleteEvent(null, 'challenge-1', 50)
    ).rejects.toThrow(TypeError);
  });

  it('throws TypeError for invalid points (zero)', async () => {
    await expect(
      recordChallengeCompleteEvent('member-1', 'challenge-1', 0)
    ).rejects.toThrow(TypeError);
  });
});
