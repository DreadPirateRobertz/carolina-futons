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
 * CF-u81k
 */

/** Benefit copy shown in the modal for each tier. */
export const TIER_BENEFITS = {
  'Trail Blazer':   '',
  'Mountain Guide': 'Early access to sales + 2x review points',
  'Summit Seeker':  'Free shipping on orders over $150 + priority support',
  'Peak Pioneer':   'VIP events + dedicated support + 3x review points',
};

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
  const benefits = TIER_BENEFITS[newTier] ?? '';

  try { $w('#tierUpgradeHeading').text = `You reached ${newTier}!`; } catch (e) {}
  try { $w('#tierUpgradeBenefits').text = benefits; } catch (e) {}
  try {
    $w('#tierUpgradeCloseBtn').onClick(() => {
      try { $w('#tierUpgradeModal').hide(); } catch (e) {}
    });
  } catch (e) {}
  try { $w('#tierUpgradeModal').show(); } catch (e) {}
}
