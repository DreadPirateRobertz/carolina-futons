/**
 * @module AvatarDisplay
 * @description Pure frontend functions for the Chibi Futon Avatar display.
 * No side effects beyond DOM mutations passed in as $w() elements.
 * All functions are testable without a Wix environment.
 *
 * CF-phase6-avatar
 */

const DANCING_BEAR_ID = 'cute-bear-dancing-AfMGeP3e3h';
const IDLE_BEAR_ID    = 'waving-bear-3e2qFVfuGO';

const PERK_DESCRIPTIONS = {
  COSMETIC:         'Cosmetic — visual only',
  DISCOUNT_PCT:     (perkValue) => `Always ${perkValue}% off every order`,
  EARLY_ACCESS:     'Shop new products 24h early',
  BONUS_POINTS_DAY: '2× points once per week (before streak multiplier, max 4× total)',
};

/**
 * Initialise the avatar display. Call on page load or after state refresh.
 *
 * @param {Object} $lottieContainer - Wix $w element wrapping the Lottie box
 * @param {Object} $accessoryOverlay - Wix $w text element for accessory label
 * @param {Object} avatarState - Result of getAvatarState()
 * @param {{ useReducedMotion: boolean }} [opts]
 */
export function renderAvatar($lottieContainer, $accessoryOverlay, avatarState, opts = {}) {
  const { useReducedMotion = false } = opts;

  if (useReducedMotion) {
    $lottieContainer.hide();
  } else {
    $lottieContainer.show();
    // Lottie play is triggered by the page-level Lottie widget setup using
    // avatarState.lottieAnimationId — this function only controls show/hide.
  }

  if (avatarState.equippedAccessory) {
    $accessoryOverlay.text(avatarState.equippedAccessory.label);
    $accessoryOverlay.show();
  } else {
    $accessoryOverlay.hide();
  }
}

/**
 * Temporarily show unlock celebration animation + toast.
 * Called immediately after a successful purchaseAccessory response.
 *
 * @param {{ $lottieContainer: Object, $accessoryUnlockToast: Object }} $elements
 * @param {{ label: string, perkType: string }} accessory
 * @param {{ useReducedMotion: boolean }} [opts]
 */
export function showUnlockCelebration($elements, accessory, opts = {}) {
  const { $lottieContainer, $accessoryUnlockToast } = $elements;
  const { useReducedMotion = false } = opts;

  // Show toast immediately
  $accessoryUnlockToast.text(`🎉 ${accessory.label} unlocked!`);
  $accessoryUnlockToast.show();
  setTimeout(() => $accessoryUnlockToast.hide(), 4000);

  if (useReducedMotion) return;

  // Swap to dancing bear for 3s, then restore idle
  if ($lottieContainer.setAnimation) {
    $lottieContainer.setAnimation(DANCING_BEAR_ID);
    setTimeout(() => $lottieContainer.setAnimation(IDLE_BEAR_ID), 3000);
  }
}

/**
 * Build view-model array for the #accessoryShopList Repeater.
 * Pure function — no side effects, no wix-data calls.
 *
 * @param {Object[]} accessories - Active AvatarAccessories rows
 * @param {string[]} unlockedIds - Member's currently unlocked accessory IDs
 * @param {number} memberPoints - Member's current totalPoints
 * @param {string|null} equippedAccessoryId - Currently equipped accessory ID
 * @returns {Object[]}
 */
export function buildAccessoryShopItems(accessories, unlockedIds, memberPoints, equippedAccessoryId) {
  return accessories.map(acc => {
    const perkDescFn = PERK_DESCRIPTIONS[acc.perkType];
    const perkDescription = typeof perkDescFn === 'function'
      ? perkDescFn(acc.perkValue)
      : (perkDescFn || '');

    return {
      _id: acc._id,
      label: acc.label,
      description: acc.description,
      pointCost: acc.pointCost,
      perkType: acc.perkType,
      perkDescription,
      isUnlocked: unlockedIds.includes(acc._id),
      canAfford: memberPoints >= acc.pointCost,
      tierRequired: acc.tierRequired,
      isEquipped: acc._id === equippedAccessoryId,
    };
  });
}
