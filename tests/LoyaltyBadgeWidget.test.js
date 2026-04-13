/**
 * Tests for LoyaltyBadgeWidget (CF-gamif2).
 * Verifies initLoyaltyBadge: shows for logged-in members, hides for guests,
 * renders tier badge and streak text correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLoyaltyBadge } from '../src/public/LoyaltyBadgeWidget';

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeTier(overrides = {}) {
  return {
    currentTier: 'trail-blazer',
    tierName: 'Trail Blazer',
    pointsInTier: 120,
    pointsToNextTier: 380,
    nextTierName: 'Mountain Guide',
    benefits: ['1x points'],
    nextTierBenefits: ['1.5x points', 'Free shipping over $500'],
    ...overrides,
  };
}

function makeStreak(overrides = {}) {
  return { currentStreak: 3, longestStreak: 7, lastActivityDate: '2026-04-10', ...overrides };
}

function makeEl(type = 'box') {
  const el = {
    html: '',
    text: '',
    _visible: true,
    show: vi.fn().mockImplementation(function () { this._visible = true; }),
    hide: vi.fn().mockImplementation(function () { this._visible = false; }),
  };
  return el;
}

function make$w() {
  const els = {};
  const $w = vi.fn((selector) => {
    if (!els[selector]) els[selector] = makeEl();
    return els[selector];
  });
  $w._els = els;
  return $w;
}

// ── initLoyaltyBadge ──────────────────────────────────────────────────────────

describe('initLoyaltyBadge', () => {
  let $w;

  beforeEach(() => {
    $w = make$w();
  });

  // ── Guest / unauthenticated ─────────────────────────────────────────────────

  it('hides container when getCurrentMember returns null', async () => {
    await initLoyaltyBadge({ $w, getCurrentMember: async () => null });
    expect($w('#loyaltyBadgeContainer').hide).toHaveBeenCalled();
    expect($w('#loyaltyBadgeContainer').show).not.toHaveBeenCalled();
  });

  it('hides container when getCurrentMember returns member without _id', async () => {
    await initLoyaltyBadge({ $w, getCurrentMember: async () => ({ name: 'Guest' }) });
    expect($w('#loyaltyBadgeContainer').show).not.toHaveBeenCalled();
  });

  it('hides container when getCurrentMember throws', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => { throw new Error('Not logged in'); },
    });
    expect($w('#loyaltyBadgeContainer').show).not.toHaveBeenCalled();
  });

  // ── Authenticated member ────────────────────────────────────────────────────

  it('shows container for logged-in member with valid tier', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => makeTier(),
      getStreakData: async () => makeStreak({ currentStreak: 0 }),
    });
    expect($w('#loyaltyBadgeContainer').show).toHaveBeenCalled();
  });

  it('keeps container hidden when getMemberTier returns null', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => null,
      getStreakData: async () => makeStreak(),
    });
    expect($w('#loyaltyBadgeContainer').show).not.toHaveBeenCalled();
  });

  it('keeps container hidden when getMemberTier throws', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => { throw new Error('backend error'); },
      getStreakData: async () => makeStreak(),
    });
    expect($w('#loyaltyBadgeContainer').show).not.toHaveBeenCalled();
  });

  // ── Tier badge rendering ────────────────────────────────────────────────────

  it('sets badge element html when getTierBadgeIcon returns SVG', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => makeTier({ tierName: 'Trail Blazer' }),
      getStreakData: async () => makeStreak({ currentStreak: 0 }),
    });
    // getTierBadgeIcon('Trail Blazer') returns SVG (tested in badgeIcons tests)
    // We just verify the element received some content
    const el = $w('#loyaltyTierBadge');
    expect(el.html || el.text).toBeTruthy();
  });

  it('passes memberId to getMemberTier', async () => {
    const getMemberTier = vi.fn().mockResolvedValue(makeTier());
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-abc' }),
      getMemberTier,
      getStreakData: async () => makeStreak({ currentStreak: 0 }),
    });
    expect(getMemberTier).toHaveBeenCalledWith('mem-abc');
  });

  // ── Streak rendering ────────────────────────────────────────────────────────

  it('shows streak text when currentStreak >= 1', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => makeTier(),
      getStreakData: async () => makeStreak({ currentStreak: 5 }),
    });
    const streakEl = $w('#loyaltyStreakText');
    expect(streakEl.show).toHaveBeenCalled();
    expect(streakEl.text).toContain('5');
  });

  it('hides streak text when currentStreak is 0', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => makeTier(),
      getStreakData: async () => makeStreak({ currentStreak: 0 }),
    });
    expect($w('#loyaltyStreakText').hide).toHaveBeenCalled();
    expect($w('#loyaltyStreakText').show).not.toHaveBeenCalled();
  });

  it('hides streak text when getStreakData throws', async () => {
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-1' }),
      getMemberTier: async () => makeTier(),
      getStreakData: async () => { throw new Error('streak error'); },
    });
    // Container still shows (tier succeeded), streak hides
    expect($w('#loyaltyBadgeContainer').show).toHaveBeenCalled();
    expect($w('#loyaltyStreakText').hide).toHaveBeenCalled();
  });

  it('passes memberId to getStreakData', async () => {
    const getStreakData = vi.fn().mockResolvedValue(makeStreak({ currentStreak: 0 }));
    await initLoyaltyBadge({
      $w,
      getCurrentMember: async () => ({ _id: 'mem-xyz' }),
      getMemberTier: async () => makeTier(),
      getStreakData,
    });
    expect(getStreakData).toHaveBeenCalledWith('mem-xyz');
  });
});
