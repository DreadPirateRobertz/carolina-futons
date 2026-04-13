/**
 * @module TierUpgradeModal
 * @description Celebration modal shown when a member's loyalty tier increases.
 *
 * Elements:
 *   #tierUpgradeModal    — Lightbox container (shown on tier-up)
 *   #tierUpgradeHeading  — "You reached [newTier]!"
 *   #tierUpgradeBenefits — Tier-specific benefit text
 *   #tierUpgradeCloseBtn — Hides the modal on click
 *
 * CF-u81k, CF-c6el.1
 */
import { getNewPerksOnPromotion } from './gamificationTokens.js';

/**
 * Build benefit summary text from the tier perk definitions.
 * Shows only the NEW perks unlocked by this promotion.
 * @param {string} prevTier
 * @param {string} newTier
 * @returns {string}
 */
export function buildBenefitText(prevTier, newTier) {
  const newPerks = getNewPerksOnPromotion(prevTier, newTier);
  if (!newPerks.length) return '';
  return newPerks.map(p => p.label).join(' + ');
}

/**
 * Show the tier upgrade celebration modal when newTier !== prevTier.
 * No-ops silently when the tier has not changed.
 *
 * @param {string|null} prevTier  Tier before the event
 * @param {string|null} newTier   Tier after the event
 * @param {Object}      [opts]    Injectable overrides (for testing)
 * @param {Function}    [opts.$w] Wix element selector (defaults to globalThis.$w)
 */
export async function initTierUpgradeModal(prevTier, newTier, opts = {}) {
  if (prevTier === newTier) return;

  const $w = opts.$w ?? globalThis.$w;
  const benefits = buildBenefitText(prevTier, newTier);

  try { $w('#tierUpgradeHeading').text = `You reached ${newTier}!`; } catch (e) {}
  try { $w('#tierUpgradeBenefits').text = benefits; } catch (e) {}
  try {
    $w('#tierUpgradeCloseBtn').onClick(() => {
      try { $w('#tierUpgradeModal').hide(); } catch (e) {}
    });
  } catch (e) {}
  try { $w('#tierUpgradeModal').show(); } catch (e) {}
}
