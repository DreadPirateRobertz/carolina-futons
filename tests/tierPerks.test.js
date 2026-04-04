/**
 * tierPerks.test.js
 * CF-c6el.1 — Tier perk definitions, lookup, and promotion helpers
 */

import { describe, it, expect } from 'vitest';
import {
  TIER_PERKS,
  PERK_TYPES,
  GAMIFICATION_TIER_ORDER,
  getPerksByTier,
  getNewPerksOnPromotion,
} from '../src/public/gamificationTokens.js';

// ── GAMIFICATION_TIER_ORDER (fixed stale names) ─────────────────────────────

describe('GAMIFICATION_TIER_ORDER', () => {
  it('uses canonical tier names', () => {
    expect(GAMIFICATION_TIER_ORDER).toEqual([
      'Trail Blazer',
      'Mountain Guide',
      'Summit Master',
      'Blue Ridge Legend',
    ]);
  });
});

// ── TIER_PERKS structure ─────────────────────────────────────────────────────

describe('TIER_PERKS — perk definitions', () => {
  it('defines perks for all four tiers', () => {
    expect(Object.keys(TIER_PERKS)).toEqual([
      'Trail Blazer',
      'Mountain Guide',
      'Summit Master',
      'Blue Ridge Legend',
    ]);
  });

  it('Trail Blazer has birthday discount only', () => {
    const perks = TIER_PERKS['Trail Blazer'];
    expect(perks).toHaveLength(1);
    expect(perks[0].type).toBe(PERK_TYPES.BIRTHDAY_DISCOUNT);
    expect(perks[0].value).toBe(10);
  });

  it('Mountain Guide adds accessory discount + priority support', () => {
    const perks = TIER_PERKS['Mountain Guide'];
    expect(perks).toHaveLength(3);
    const types = perks.map(p => p.type);
    expect(types).toContain(PERK_TYPES.ACCESSORY_DISCOUNT);
    expect(types).toContain(PERK_TYPES.PRIORITY_SUPPORT);
  });

  it('Summit Master adds white-glove, early access, styling call', () => {
    const perks = TIER_PERKS['Summit Master'];
    expect(perks).toHaveLength(6);
    const types = perks.map(p => p.type);
    expect(types).toContain(PERK_TYPES.FREE_WHITE_GLOVE);
    expect(types).toContain(PERK_TYPES.EARLY_ACCESS);
    expect(types).toContain(PERK_TYPES.STYLING_CALL);
  });

  it('Blue Ridge Legend inherits all Summit Master perks', () => {
    const summitTypes = TIER_PERKS['Summit Master'].map(p => p.type);
    const legendTypes = TIER_PERKS['Blue Ridge Legend'].map(p => p.type);
    for (const t of summitTypes) {
      expect(legendTypes).toContain(t);
    }
  });

  it('every perk has type, label, and delivery mechanism', () => {
    for (const [tier, perks] of Object.entries(TIER_PERKS)) {
      for (const perk of perks) {
        expect(perk.type, `${tier} perk missing type`).toBeTruthy();
        expect(perk.label, `${tier} perk ${perk.type} missing label`).toBeTruthy();
        expect(perk.delivery, `${tier} perk ${perk.type} missing delivery`).toBeTruthy();
      }
    }
  });
});

// ── getPerksByTier ────────────────────────────────────────────────────────────

describe('getPerksByTier', () => {
  it('returns perks for valid tier', () => {
    const perks = getPerksByTier('Mountain Guide');
    expect(perks).toHaveLength(3);
  });

  it('returns empty array for unknown tier', () => {
    expect(getPerksByTier('Nonexistent')).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(getPerksByTier(null)).toEqual([]);
  });
});

// ── getNewPerksOnPromotion ───────────────────────────────────────────────────

describe('getNewPerksOnPromotion', () => {
  it('Trail Blazer → Mountain Guide: gains accessory discount + priority support', () => {
    const newPerks = getNewPerksOnPromotion('Trail Blazer', 'Mountain Guide');
    const types = newPerks.map(p => p.type);
    expect(types).toEqual([PERK_TYPES.ACCESSORY_DISCOUNT, PERK_TYPES.PRIORITY_SUPPORT]);
  });

  it('Mountain Guide → Summit Master: gains white-glove, early access, styling call', () => {
    const newPerks = getNewPerksOnPromotion('Mountain Guide', 'Summit Master');
    const types = newPerks.map(p => p.type);
    expect(types).toEqual([
      PERK_TYPES.FREE_WHITE_GLOVE,
      PERK_TYPES.EARLY_ACCESS,
      PERK_TYPES.STYLING_CALL,
    ]);
  });

  it('Summit Master → Blue Ridge Legend: no new perks (same set)', () => {
    const newPerks = getNewPerksOnPromotion('Summit Master', 'Blue Ridge Legend');
    expect(newPerks).toEqual([]);
  });

  it('null → Trail Blazer: all Trail Blazer perks are new', () => {
    const newPerks = getNewPerksOnPromotion(null, 'Trail Blazer');
    expect(newPerks).toHaveLength(1);
    expect(newPerks[0].type).toBe(PERK_TYPES.BIRTHDAY_DISCOUNT);
  });

  it('same tier → same tier: no new perks', () => {
    expect(getNewPerksOnPromotion('Mountain Guide', 'Mountain Guide')).toEqual([]);
  });
});
