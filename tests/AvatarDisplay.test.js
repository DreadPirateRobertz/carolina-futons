import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderAvatar,
  buildAccessoryShopItems,
  showUnlockCelebration,
} from '../src/public/AvatarDisplay.js';

// ── renderAvatar ──────────────────────────────────────────────────────────────

describe('renderAvatar', () => {
  let $lottieContainer, $accessoryOverlay;

  beforeEach(() => {
    $lottieContainer = {
      show: vi.fn(),
      hide: vi.fn(),
      html: '',
    };
    $accessoryOverlay = {
      show: vi.fn(),
      hide: vi.fn(),
      text: vi.fn(),
    };
  });

  it('hides lottie container when useReducedMotion is true', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: null,
      unlockedAccessoryIds: [],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: true });
    expect($lottieContainer.hide).toHaveBeenCalled();
  });

  it('shows lottie container when useReducedMotion is false', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: null,
      unlockedAccessoryIds: [],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: false });
    expect($lottieContainer.show).toHaveBeenCalled();
  });

  it('shows accessory overlay with label when accessory is equipped', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: { label: '🎩 Top Hat', perkType: 'COSMETIC' },
      unlockedAccessoryIds: ['acc-hat'],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: false });
    expect($accessoryOverlay.text).toHaveBeenCalledWith('🎩 Top Hat');
    expect($accessoryOverlay.show).toHaveBeenCalled();
  });

  it('hides accessory overlay when no accessory is equipped', () => {
    const avatarState = {
      lottieAnimationId: 'waving-bear-3e2qFVfuGO',
      equippedAccessory: null,
      unlockedAccessoryIds: [],
    };
    renderAvatar($lottieContainer, $accessoryOverlay, avatarState, { useReducedMotion: false });
    expect($accessoryOverlay.hide).toHaveBeenCalled();
  });
});

// ── buildAccessoryShopItems ───────────────────────────────────────────────────

describe('buildAccessoryShopItems', () => {
  const accessories = [
    {
      _id: 'acc-cosmetic',
      label: 'Bow Tie',
      description: 'Dapper.',
      pointCost: 50,
      perkType: 'COSMETIC',
      perkValue: 0,
      tierRequired: 'TRAIL_BLAZER',
    },
    {
      _id: 'acc-discount',
      label: 'Discount Card',
      description: '5% off forever.',
      pointCost: 200,
      perkType: 'DISCOUNT_PCT',
      perkValue: 5,
      tierRequired: 'MOUNTAIN_GUIDE',
    },
    {
      _id: 'acc-early',
      label: 'Early Bird Pass',
      description: 'Shop early.',
      pointCost: 300,
      perkType: 'EARLY_ACCESS',
      perkValue: 0,
      tierRequired: 'MOUNTAIN_GUIDE',
    },
    {
      _id: 'acc-bonus',
      label: 'Lucky Charm',
      description: 'Double points.',
      pointCost: 500,
      perkType: 'BONUS_POINTS_DAY',
      perkValue: 0,
      tierRequired: 'SUMMIT_MASTER',
    },
  ];

  it('marks owned accessories as isUnlocked = true', () => {
    const items = buildAccessoryShopItems(accessories, ['acc-cosmetic'], 200, null);
    const cosmetic = items.find(i => i._id === 'acc-cosmetic');
    expect(cosmetic.isUnlocked).toBe(true);
    const discount = items.find(i => i._id === 'acc-discount');
    expect(discount.isUnlocked).toBe(false);
  });

  it('sets canAfford = false when memberPoints < pointCost', () => {
    const items = buildAccessoryShopItems(accessories, [], 100, null);
    const discount = items.find(i => i._id === 'acc-discount');
    expect(discount.canAfford).toBe(false);
    const cosmetic = items.find(i => i._id === 'acc-cosmetic');
    expect(cosmetic.canAfford).toBe(true);
  });

  it('sets isEquipped = true only for the currently equipped accessory', () => {
    const items = buildAccessoryShopItems(accessories, ['acc-cosmetic', 'acc-discount'], 500, 'acc-cosmetic');
    expect(items.find(i => i._id === 'acc-cosmetic').isEquipped).toBe(true);
    expect(items.find(i => i._id === 'acc-discount').isEquipped).toBe(false);
  });

  it('returns correct perkDescription for COSMETIC', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-cosmetic').perkDescription).toBe('Cosmetic — visual only');
  });

  it('returns correct perkDescription for DISCOUNT_PCT', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-discount').perkDescription).toBe('Always 5% off every order');
  });

  it('returns correct perkDescription for EARLY_ACCESS', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-early').perkDescription).toBe('Shop new products 24h early');
  });

  it('returns correct perkDescription for BONUS_POINTS_DAY', () => {
    const items = buildAccessoryShopItems(accessories, [], 0, null);
    expect(items.find(i => i._id === 'acc-bonus').perkDescription)
      .toBe('2× points once per week (before streak multiplier, max 4× total)');
  });
});

// ── showUnlockCelebration ─────────────────────────────────────────────────────

describe('showUnlockCelebration', () => {
  it('shows unlock toast with accessory label for 4 seconds', async () => {
    vi.useFakeTimers();
    const $lottieContainer = { setAnimation: vi.fn(), show: vi.fn() };
    const $accessoryUnlockToast = { show: vi.fn(), hide: vi.fn(), text: vi.fn() };
    const accessory = { label: '🎩 Top Hat', perkType: 'COSMETIC' };

    showUnlockCelebration(
      { $lottieContainer, $accessoryUnlockToast },
      accessory,
      { useReducedMotion: false }
    );

    expect($accessoryUnlockToast.text).toHaveBeenCalledWith('🎉 🎩 Top Hat unlocked!');
    expect($accessoryUnlockToast.show).toHaveBeenCalled();

    vi.advanceTimersByTime(4000);
    expect($accessoryUnlockToast.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('skips animation and goes straight to toast when useReducedMotion is true', () => {
    const $lottieContainer = { setAnimation: vi.fn(), show: vi.fn() };
    const $accessoryUnlockToast = { show: vi.fn(), hide: vi.fn(), text: vi.fn() };
    const accessory = { label: 'Bow Tie', perkType: 'COSMETIC' };

    showUnlockCelebration(
      { $lottieContainer, $accessoryUnlockToast },
      accessory,
      { useReducedMotion: true }
    );

    expect($lottieContainer.setAnimation).not.toHaveBeenCalled();
    expect($accessoryUnlockToast.show).toHaveBeenCalled();
  });
});
