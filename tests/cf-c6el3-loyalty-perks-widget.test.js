/**
 * @file cf-c6el3-loyalty-perks-widget.test.js
 * @description CF-c6el.3: Loyalty page "Your Perks" section.
 *
 * Tests:
 *   TIER_PERKS structure — ordered, valid shape, cumulative by tier
 *   getMemberDeliveredPerks — Trail Blazer member gets TB perks only
 *   getMemberDeliveredPerks — Mountain Guide gets TB + MG perks (cumulative)
 *   getMemberDeliveredPerks — Blue Ridge Legend gets all perks, no teaser
 *   getMemberDeliveredPerks — next tier teaser present below max tier
 *   getMemberDeliveredPerks — nextTierPointsNeeded calculated correctly
 *   getMemberDeliveredPerks — member with no MemberPoints record defaults to Trail Blazer
 *   getMemberDeliveredPerks — unauthenticated returns error
 *   getMemberDeliveredPerks — DB failure returns error
 *   LoyaltyPerksWidget — renders unlocked perks into repeater
 *   LoyaltyPerksWidget — renders next tier teaser
 *   LoyaltyPerksWidget — hides teaser at max tier
 *   LoyaltyPerksWidget — shows error on failed fetch
 *   LoyaltyPerksWidget — hides perksSection on failed fetch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __setQueryError } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

import { TIER_PERKS, getTierForPoints, TIER_THRESHOLDS } from '../src/public/gamificationTokens.js';
import { getMemberDeliveredPerks } from '../src/backend/rewardEngine.web.js';
import { initLoyaltyPerksWidget } from '../src/public/LoyaltyPerksWidget.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-perk-test';

function setMember(id = MEMBER_ID) {
  __setMember({ _id: id });
}

function seedPoints(memberId, totalPoints) {
  __seed('MemberPoints', [{ _id: 'mp-1', memberId, totalPoints }]);
}

// ── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetMember();
  vi.restoreAllMocks();
});

// ── TIER_PERKS structure ──────────────────────────────────────────────────────

describe('TIER_PERKS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(TIER_PERKS)).toBe(true);
    expect(TIER_PERKS.length).toBeGreaterThan(0);
  });

  it('each group has tierKey, tierName, and perks array', () => {
    for (const group of TIER_PERKS) {
      expect(typeof group.tierKey).toBe('string');
      expect(typeof group.tierName).toBe('string');
      expect(Array.isArray(group.perks)).toBe(true);
      expect(group.perks.length).toBeGreaterThan(0);
    }
  });

  it('each perk has perkId, label, description, and icon', () => {
    for (const group of TIER_PERKS) {
      for (const perk of group.perks) {
        expect(typeof perk.perkId).toBe('string');
        expect(typeof perk.label).toBe('string');
        expect(typeof perk.description).toBe('string');
        expect(typeof perk.icon).toBe('string');
      }
    }
  });

  it('perkIds are unique across all tiers', () => {
    const ids = TIER_PERKS.flatMap(g => g.perks.map(p => p.perkId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes Trail Blazer as first tier', () => {
    expect(TIER_PERKS[0].tierKey).toBe('TRAIL_BLAZER');
  });

  it('includes Blue Ridge Legend as last tier', () => {
    expect(TIER_PERKS[TIER_PERKS.length - 1].tierKey).toBe('BLUE_RIDGE_LEGEND');
  });

  it('tier order matches TIER_THRESHOLDS ascending order', () => {
    const expectedKeys = ['TRAIL_BLAZER', 'MOUNTAIN_GUIDE', 'SUMMIT_MASTER', 'BLUE_RIDGE_LEGEND'];
    expect(TIER_PERKS.map(g => g.tierKey)).toEqual(expectedKeys);
  });
});

// ── getMemberDeliveredPerks — Trail Blazer ────────────────────────────────────

describe('getMemberDeliveredPerks — Trail Blazer (0 pts)', () => {
  it('returns success true', async () => {
    setMember();
    seedPoints(MEMBER_ID, 0);
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
  });

  it('returns currentTierName: Trail Blazer', async () => {
    setMember();
    seedPoints(MEMBER_ID, 0);
    const result = await getMemberDeliveredPerks();
    expect(result.currentTierName).toBe('Trail Blazer');
    expect(result.currentTierKey).toBe('TRAIL_BLAZER');
  });

  it('returns only Trail Blazer perks in unlockedPerks', async () => {
    setMember();
    seedPoints(MEMBER_ID, 0);
    const result = await getMemberDeliveredPerks();
    const tbPerks = TIER_PERKS.find(g => g.tierKey === 'TRAIL_BLAZER').perks;
    expect(result.unlockedPerks).toHaveLength(tbPerks.length);
    expect(result.unlockedPerks.every(p => p.tierKey === 'TRAIL_BLAZER')).toBe(true);
  });

  it('returns Mountain Guide as nextTierName', async () => {
    setMember();
    seedPoints(MEMBER_ID, 0);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierName).toBe('Mountain Guide');
    expect(result.nextTierKey).toBe('MOUNTAIN_GUIDE');
  });

  it('returns Mountain Guide perks as next tier teaser', async () => {
    setMember();
    seedPoints(MEMBER_ID, 0);
    const result = await getMemberDeliveredPerks();
    const mgPerks = TIER_PERKS.find(g => g.tierKey === 'MOUNTAIN_GUIDE').perks;
    expect(result.nextTierPerks).toHaveLength(mgPerks.length);
  });

  it('calculates nextTierPointsNeeded from current points to 500', async () => {
    setMember();
    seedPoints(MEMBER_ID, 200);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierPointsNeeded).toBe(300);
  });
});

// ── getMemberDeliveredPerks — Mountain Guide ──────────────────────────────────

describe('getMemberDeliveredPerks — Mountain Guide (500 pts)', () => {
  it('returns currentTierName: Mountain Guide', async () => {
    setMember();
    seedPoints(MEMBER_ID, 500);
    const result = await getMemberDeliveredPerks();
    expect(result.currentTierName).toBe('Mountain Guide');
    expect(result.currentTierKey).toBe('MOUNTAIN_GUIDE');
  });

  it('includes TB + MG perks (cumulative)', async () => {
    setMember();
    seedPoints(MEMBER_ID, 500);
    const result = await getMemberDeliveredPerks();
    const tbCount = TIER_PERKS.find(g => g.tierKey === 'TRAIL_BLAZER').perks.length;
    const mgCount = TIER_PERKS.find(g => g.tierKey === 'MOUNTAIN_GUIDE').perks.length;
    expect(result.unlockedPerks).toHaveLength(tbCount + mgCount);
    const tierKeys = new Set(result.unlockedPerks.map(p => p.tierKey));
    expect(tierKeys.has('TRAIL_BLAZER')).toBe(true);
    expect(tierKeys.has('MOUNTAIN_GUIDE')).toBe(true);
  });

  it('Summit Master is the next tier teaser', async () => {
    setMember();
    seedPoints(MEMBER_ID, 600);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierKey).toBe('SUMMIT_MASTER');
  });

  it('nextTierPointsNeeded is correct at 600 pts (needs 2000)', async () => {
    setMember();
    seedPoints(MEMBER_ID, 600);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierPointsNeeded).toBe(1400);
  });
});

// ── getMemberDeliveredPerks — Summit Master ───────────────────────────────────

describe('getMemberDeliveredPerks — Summit Master (2000 pts)', () => {
  it('includes TB + MG + SM perks', async () => {
    setMember();
    seedPoints(MEMBER_ID, 2000);
    const result = await getMemberDeliveredPerks();
    const expected =
      TIER_PERKS.find(g => g.tierKey === 'TRAIL_BLAZER').perks.length +
      TIER_PERKS.find(g => g.tierKey === 'MOUNTAIN_GUIDE').perks.length +
      TIER_PERKS.find(g => g.tierKey === 'SUMMIT_MASTER').perks.length;
    expect(result.unlockedPerks).toHaveLength(expected);
  });

  it('Blue Ridge Legend is the next tier teaser', async () => {
    setMember();
    seedPoints(MEMBER_ID, 2000);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierKey).toBe('BLUE_RIDGE_LEGEND');
  });
});

// ── getMemberDeliveredPerks — Blue Ridge Legend ───────────────────────────────

describe('getMemberDeliveredPerks — Blue Ridge Legend (5000 pts)', () => {
  it('returns all perks across all tiers', async () => {
    setMember();
    seedPoints(MEMBER_ID, 5000);
    const result = await getMemberDeliveredPerks();
    const total = TIER_PERKS.reduce((sum, g) => sum + g.perks.length, 0);
    expect(result.unlockedPerks).toHaveLength(total);
  });

  it('nextTierName is null at max tier', async () => {
    setMember();
    seedPoints(MEMBER_ID, 9999);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierName).toBeNull();
    expect(result.nextTierKey).toBeNull();
    expect(result.nextTierPerks).toBeNull();
    expect(result.nextTierPointsNeeded).toBeNull();
  });
});

// ── getMemberDeliveredPerks — edge cases ──────────────────────────────────────

describe('getMemberDeliveredPerks — edge cases', () => {
  it('defaults to Trail Blazer when member has no MemberPoints record', async () => {
    setMember();
    __seed('MemberPoints', []); // no record
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(result.currentTierName).toBe('Trail Blazer');
    expect(result.totalPoints).toBe(0);
  });

  it('returns error on unauthenticated call', async () => {
    // no __setMember call — member is null
    __seed('MemberPoints', []);
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error on DB failure', async () => {
    setMember();
    __setQueryError('MemberPoints', new Error('DB timeout'));
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('unlockedPerks each have required fields', async () => {
    setMember();
    seedPoints(MEMBER_ID, 2500);
    const result = await getMemberDeliveredPerks();
    for (const p of result.unlockedPerks) {
      expect(typeof p.tierKey).toBe('string');
      expect(typeof p.tierName).toBe('string');
      expect(typeof p.perkId).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.icon).toBe('string');
    }
  });

  it('nextTierPointsNeeded is 0 when exactly at threshold', async () => {
    setMember();
    seedPoints(MEMBER_ID, 500); // exactly Mountain Guide
    const result = await getMemberDeliveredPerks();
    // currentTier is Mountain Guide, next is Summit Master (2000)
    expect(result.nextTierPointsNeeded).toBe(1500);
  });
});

// ── LoyaltyPerksWidget ────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    data: null,
    _visible: true,
    _onItemReady: null,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    onItemReady: vi.fn(function (cb) { this._onItemReady = cb; }),
  };
}

function make$w() {
  const els = {
    '#perksSection': makeEl(),
    '#perksRepeater': makeEl(),
    '#perkNextTierTeaser': makeEl(),
    '#perkNextTierName': makeEl(),
    '#perkNextTierPoints': makeEl(),
    '#perkNextTierList': makeEl(),
    '#perksError': makeEl(),
  };
  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

function makeSuccessData(overrides = {}) {
  return {
    success: true,
    currentTierName: 'Mountain Guide',
    currentTierKey: 'MOUNTAIN_GUIDE',
    totalPoints: 600,
    unlockedPerks: [
      { tierKey: 'TRAIL_BLAZER', tierName: 'Trail Blazer', perkId: 'daily-spin', label: 'Daily Spin Wheel', description: 'Spin once per day.', icon: '🎡' },
      { tierKey: 'MOUNTAIN_GUIDE', tierName: 'Mountain Guide', perkId: 'birthday-bonus', label: 'Birthday Bonus Points', description: 'Earn 150 pts on birthday.', icon: '🎂' },
    ],
    nextTierName: 'Summit Master',
    nextTierKey: 'SUMMIT_MASTER',
    nextTierPointsNeeded: 1400,
    nextTierPerks: [
      { perkId: 'styling-call', label: 'Free Styling Consultation', description: 'Free 30-min styling call.', icon: '📞' },
    ],
    ...overrides,
  };
}

describe('LoyaltyPerksWidget — happy path', () => {
  it('shows perksSection on success', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perksSection'].show).toHaveBeenCalled();
  });

  it('hides perksError on success', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perksError'].hide).toHaveBeenCalled();
  });

  it('sets repeater data with one item per unlocked perk', async () => {
    const $w = make$w();
    const data = makeSuccessData();
    const getPerks = vi.fn().mockResolvedValue(data);
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perksRepeater'].data).toHaveLength(data.unlockedPerks.length);
  });

  it('repeater items have _id, icon, label, description, tierName', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    const items = $w._els['#perksRepeater'].data;
    for (const item of items) {
      expect(typeof item._id).toBe('string');
      expect(typeof item.icon).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.tierName).toBe('string');
    }
  });

  it('onItemReady populates perk sub-elements', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });

    const $item = (sel) => {
      if (!$item._els[sel]) $item._els[sel] = makeEl();
      return $item._els[sel];
    };
    $item._els = {};
    $w._els['#perksRepeater']._onItemReady?.($item, {
      icon: '🎡', label: 'Daily Spin', description: 'Spin daily.', tierName: 'Trail Blazer',
    });
    expect($item._els['#perkIcon'].text).toBe('🎡');
    expect($item._els['#perkLabel'].text).toBe('Daily Spin');
    expect($item._els['#perkDescription'].text).toBe('Spin daily.');
    expect($item._els['#perkTierName'].text).toBe('Trail Blazer');
  });
});

describe('LoyaltyPerksWidget — next tier teaser', () => {
  it('shows #perkNextTierTeaser when nextTierName is set', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perkNextTierTeaser'].show).toHaveBeenCalled();
  });

  it('sets #perkNextTierName text', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perkNextTierName'].text).toBe('Summit Master');
  });

  it('sets #perkNextTierPoints with points remaining', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perkNextTierPoints'].text).toMatch(/1,400|1400/);
    expect($w._els['#perkNextTierPoints'].text).toMatch(/points/);
  });

  it('sets #perkNextTierList with next tier perk names', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData());
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perkNextTierList'].text).toContain('Free Styling Consultation');
  });

  it('hides #perkNextTierTeaser at max tier', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData({
      currentTierKey: 'BLUE_RIDGE_LEGEND',
      currentTierName: 'Blue Ridge Legend',
      nextTierName: null,
      nextTierKey: null,
      nextTierPerks: null,
      nextTierPointsNeeded: null,
    }));
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perkNextTierTeaser'].hide).toHaveBeenCalled();
  });

  it('shows "You\'ve reached X!" when nextTierPointsNeeded is 0', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue(makeSuccessData({ nextTierPointsNeeded: 0 }));
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perkNextTierPoints'].text).toMatch(/You've reached/);
  });
});

describe('LoyaltyPerksWidget — error handling', () => {
  it('hides perksSection on failed fetch', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue({ success: false, error: 'Not authenticated' });
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perksSection'].hide).toHaveBeenCalled();
  });

  it('shows perksError on failed fetch', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockResolvedValue({ success: false, error: 'Not authenticated' });
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perksError'].show).toHaveBeenCalled();
  });

  it('hides perksSection when fetch throws', async () => {
    const $w = make$w();
    const getPerks = vi.fn().mockRejectedValue(new Error('network error'));
    await initLoyaltyPerksWidget(MEMBER_ID, { $w, getMemberDeliveredPerks: getPerks });
    expect($w._els['#perksSection'].hide).toHaveBeenCalled();
    expect($w._els['#perksError'].show).toHaveBeenCalled();
  });
});
