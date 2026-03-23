/**
 * Streak display pure functions for Member Page.
 * No Wix SDK imports — accepts element references as parameters for testability.
 * DOM wiring happens in Member Page.js.
 * CF-phase2-streak
 */

/**
 * @param {number} streakDays
 * @returns {string}
 */
export function buildStreakChipText(streakDays) {
  // Compound-modifier form for singular (1) and week milestones (7, 14, 21…).
  // Days 2-6 use space-separated plural ("3 days streak").
  if (streakDays === 1 || streakDays >= 7) {
    return `🔥 ${streakDays}-day streak`;
  }
  return `🔥 ${streakDays} days streak`;
}

/**
 * Returns empty string for 1x (no visible badge when no bonus).
 * @param {number} multiplier
 * @returns {string}
 */
export function buildMultiplierBadgeText(multiplier) {
  if (multiplier <= 1) return '';
  return `${multiplier}× points`;
}

/**
 * @param {{ streakDays: number, multiplier: number, milestoneUnlocked: boolean }} data
 * @returns {string}
 */
export function buildToastText({ streakDays, multiplier, milestoneUnlocked }) {
  if (milestoneUnlocked) {
    return `🏔️ ${streakDays}-day streak! +100 bonus pts + Week Wanderer badge unlocked`;
  }
  return `Streak extended! ${streakDays} days → ${multiplier}× multiplier active`;
}

/**
 * @param {number|null|undefined} streakDays
 * @returns {boolean}
 */
export function shouldShowStreakChip(streakDays) {
  return typeof streakDays === 'number' && streakDays >= 1;
}

/**
 * Update streak display elements. Call after any point-earning event response.
 * Pass $element references from Wix ($w('#streakCountChip'), etc.)
 *
 * @param {Object} $elements - { $chip, $badge, $toast }
 * @param {{ currentStreakDays, streakMultiplier, milestoneUnlocked }} data
 * @param {boolean} reducedMotion - from wix-window useReducedMotion()
 */
export function updateStreakDisplay($elements, data, reducedMotion = false) {
  const { $chip, $badge, $toast } = $elements;
  const { currentStreakDays, streakMultiplier, milestoneUnlocked } = data;

  if (shouldShowStreakChip(currentStreakDays)) {
    $chip.text = buildStreakChipText(currentStreakDays);
    $chip.show();
  } else {
    $chip.hide();
  }

  const badgeText = buildMultiplierBadgeText(streakMultiplier);
  if (badgeText) {
    $badge.text = badgeText;
    $badge.show();
  } else {
    $badge.hide();
  }

  // Toast: show only when streak was incremented or milestone reached
  // Caller (Member Page.js) decides when to show toast based on whether streak changed
  if ($toast && !reducedMotion) {
    $toast.text = buildToastText({ streakDays: currentStreakDays, multiplier: streakMultiplier, milestoneUnlocked });
    $toast.show();
    setTimeout(() => $toast.hide(), milestoneUnlocked ? 5000 : 3000);
  }
}
