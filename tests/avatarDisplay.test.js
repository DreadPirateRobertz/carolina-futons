/**
 * @file avatarDisplay.test.js
 * @description Tests for AvatarDisplay.js — Chibi Futon Avatar / bear Lottie animation logic.
 *
 * Covers:
 *   renderAvatar — show/hide Lottie container; accessory overlay text + visibility
 *   showUnlockCelebration — dancing-bear animation swap, idle restore, toast copy,
 *                           toast auto-dismiss, reduced-motion bypass, missing setAnimation guard
 *   buildAccessoryShopItems — perk descriptions, unlock/afford/equipped flags
 *
 * CF-tgsn.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderAvatar,
  showUnlockCelebration,
  buildAccessoryShopItems,
} from '../src/public/AvatarDisplay.js';

// ── Wix element stubs ─────────────────────────────────────────────────────────

function makeLottieContainer() {
  return {
    show:         vi.fn(),
    hide:         vi.fn(),
    setAnimation: vi.fn(),
  };
}

function makeOverlay() {
  const el = {
    _text: '',
    show: vi.fn(),
    hide: vi.fn(),
    text: vi.fn(function (v) { el._text = v; }),
  };
  return el;
}

function makeToast() {
  const el = {
    _text: '',
    show: vi.fn(),
    hide: vi.fn(),
    text: vi.fn(function (v) { el._text = v; }),
  };
  return el;
}

// ── Bear animation IDs (must match constants in AvatarDisplay.js) ─────────────
const DANCING_BEAR_ID = 'cute-bear-dancing-AfMGeP3e3h';
const IDLE_BEAR_ID    = 'waving-bear-3e2qFVfuGO';

// ── renderAvatar ──────────────────────────────────────────────────────────────

describe('renderAvatar — Lottie container', () => {
  it('shows container when useReducedMotion is false (default)', () => {
    const $lottie  = makeLottieContainer();
    const $overlay = makeOverlay();
    renderAvatar($lottie, $overlay, {});
    expect($lottie.show).toHaveBeenCalled();
    expect($lottie.hide).not.toHaveBeenCalled();
  });

  it('hides container when useReducedMotion is true', () => {
    const $lottie  = makeLottieContainer();
    const $overlay = makeOverlay();
    renderAvatar($lottie, $overlay, {}, { useReducedMotion: true });
    expect($lottie.hide).toHaveBeenCalled();
    expect($lottie.show).not.toHaveBeenCalled();
  });

  it('shows container when opts is omitted entirely', () => {
    const $lottie  = makeLottieContainer();
    const $overlay = makeOverlay();
    renderAvatar($lottie, $overlay, {});
    expect($lottie.show).toHaveBeenCalled();
  });
});

describe('renderAvatar — accessory overlay', () => {
  it('sets overlay text and shows it when accessory is equipped', () => {
    const $lottie  = makeLottieContainer();
    const $overlay = makeOverlay();
    renderAvatar($lottie, $overlay, { equippedAccessory: { label: 'Cozy Hat' } });
    expect($overlay.text).toHaveBeenCalledWith('Cozy Hat');
    expect($overlay.show).toHaveBeenCalled();
    expect($overlay.hide).not.toHaveBeenCalled();
  });

  it('hides overlay when equippedAccessory is null', () => {
    const $lottie  = makeLottieContainer();
    const $overlay = makeOverlay();
    renderAvatar($lottie, $overlay, { equippedAccessory: null });
    expect($overlay.hide).toHaveBeenCalled();
    expect($overlay.show).not.toHaveBeenCalled();
  });

  it('hides overlay when avatarState has no equippedAccessory key', () => {
    const $lottie  = makeLottieContainer();
    const $overlay = makeOverlay();
    renderAvatar($lottie, $overlay, {});
    expect($overlay.hide).toHaveBeenCalled();
  });
});

// ── showUnlockCelebration ─────────────────────────────────────────────────────

describe('showUnlockCelebration — toast', () => {
  it('shows toast immediately on call', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' });
    expect($toast.show).toHaveBeenCalled();
  });

  it('toast text contains the accessory label', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Summit Scarf', perkType: 'COSMETIC' });
    expect($toast._text).toContain('Summit Scarf');
  });

  it('hides toast after 4 seconds', () => {
    vi.useFakeTimers();
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' });
    expect($toast.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect($toast.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('still shows toast when useReducedMotion is true', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' }, { useReducedMotion: true });
    expect($toast.show).toHaveBeenCalled();
    expect($toast._text).toContain('Cozy Hat');
  });
});

describe('showUnlockCelebration — bear Lottie animation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(()  => { vi.useRealTimers(); });

  it('calls setAnimation with DANCING_BEAR_ID immediately', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' });
    expect($lottie.setAnimation).toHaveBeenCalledWith(DANCING_BEAR_ID);
  });

  it('restores IDLE_BEAR_ID after 3 seconds', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' });
    vi.advanceTimersByTime(3000);
    expect($lottie.setAnimation).toHaveBeenLastCalledWith(IDLE_BEAR_ID);
    expect($lottie.setAnimation).toHaveBeenCalledTimes(2);
  });

  it('DANCING_BEAR_ID and IDLE_BEAR_ID are distinct animation IDs', () => {
    // Guards against copy-paste errors where both IDs accidentally become the same.
    expect(DANCING_BEAR_ID).not.toBe(IDLE_BEAR_ID);
  });

  it('does not call setAnimation before the 3-second restore timer fires', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' });
    vi.advanceTimersByTime(2999);
    expect($lottie.setAnimation).toHaveBeenCalledTimes(1); // only the initial dancing call
  });

  it('skips both setAnimation calls when useReducedMotion is true', () => {
    const $lottie = makeLottieContainer();
    const $toast  = makeToast();
    showUnlockCelebration({ $lottieContainer: $lottie, $accessoryUnlockToast: $toast },
      { label: 'Cozy Hat', perkType: 'COSMETIC' }, { useReducedMotion: true });
    vi.advanceTimersByTime(5000);
    expect($lottie.setAnimation).not.toHaveBeenCalled();
  });

  it('does not throw when container has no setAnimation method', () => {
    // Wix environment may not expose setAnimation on all Lottie element types.
    const $lottieNoAnim = { show: vi.fn(), hide: vi.fn() };
    const $toast        = makeToast();
    expect(() =>
      showUnlockCelebration({ $lottieContainer: $lottieNoAnim, $accessoryUnlockToast: $toast },
        { label: 'Cozy Hat', perkType: 'COSMETIC' })
    ).not.toThrow();
  });
});

// ── buildAccessoryShopItems ───────────────────────────────────────────────────

const ACCESSORIES = [
  { _id: 'acc-1', label: 'Cozy Hat',     description: 'A warm hat',  pointCost: 200, perkType: 'COSMETIC',         perkValue: null, tierRequired: null },
  { _id: 'acc-2', label: '10% Off',      description: 'Always 10%',  pointCost: 500, perkType: 'DISCOUNT_PCT',     perkValue: 10,   tierRequired: 'Mountain Guide' },
  { _id: 'acc-3', label: 'Early Access', description: 'Shop early',  pointCost: 800, perkType: 'EARLY_ACCESS',     perkValue: null, tierRequired: 'Summit Master' },
  { _id: 'acc-4', label: 'Bonus Day',    description: '2× per week', pointCost: 600, perkType: 'BONUS_POINTS_DAY', perkValue: null, tierRequired: null },
];

describe('buildAccessoryShopItems — unlock / afford / equipped flags', () => {
  it('marks accessories in unlockedIds as isUnlocked: true', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, ['acc-1', 'acc-3'], 0, null);
    expect(result[0].isUnlocked).toBe(true);
    expect(result[1].isUnlocked).toBe(false);
    expect(result[2].isUnlocked).toBe(true);
  });

  it('marks accessory as canAfford when memberPoints >= pointCost', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 500, null);
    expect(result[0].canAfford).toBe(true);  // 200 ≤ 500
    expect(result[1].canAfford).toBe(true);  // 500 ≤ 500
    expect(result[2].canAfford).toBe(false); // 800 > 500
  });

  it('marks only the equipped accessory as isEquipped: true', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, 'acc-2');
    expect(result[0].isEquipped).toBe(false);
    expect(result[1].isEquipped).toBe(true);
    expect(result[2].isEquipped).toBe(false);
  });

  it('marks all as isEquipped: false when equippedAccessoryId is null', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, null);
    expect(result.every(a => !a.isEquipped)).toBe(true);
  });
});

describe('buildAccessoryShopItems — perk descriptions', () => {
  it('COSMETIC → "Cosmetic — visual only"', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, null);
    expect(result[0].perkDescription).toBe('Cosmetic — visual only');
  });

  it('DISCOUNT_PCT → interpolates perkValue into description', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, null);
    expect(result[1].perkDescription).toBe('Always 10% off every order');
  });

  it('EARLY_ACCESS → "Shop new products 24h early"', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, null);
    expect(result[2].perkDescription).toBe('Shop new products 24h early');
  });

  it('BONUS_POINTS_DAY → includes "2× points" description', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, null);
    expect(result[3].perkDescription).toContain('2×');
  });

  it('unknown perkType → empty string', () => {
    const weird = [{ _id: 'x', label: 'X', description: '', pointCost: 0, perkType: 'UNKNOWN', perkValue: null }];
    const result = buildAccessoryShopItems(weird, [], 0, null);
    expect(result[0].perkDescription).toBe('');
  });
});

describe('buildAccessoryShopItems — output shape', () => {
  it('returns one entry per input accessory', () => {
    expect(buildAccessoryShopItems(ACCESSORIES, [], 0, null)).toHaveLength(ACCESSORIES.length);
  });

  it('returns empty array for empty input', () => {
    expect(buildAccessoryShopItems([], [], 0, null)).toEqual([]);
  });

  it('preserves _id, label, description, pointCost, perkType, tierRequired on each item', () => {
    const result = buildAccessoryShopItems(ACCESSORIES, [], 0, null);
    const item = result[1]; // acc-2
    expect(item._id).toBe('acc-2');
    expect(item.label).toBe('10% Off');
    expect(item.pointCost).toBe(500);
    expect(item.perkType).toBe('DISCOUNT_PCT');
    expect(item.tierRequired).toBe('Mountain Guide');
  });
});
