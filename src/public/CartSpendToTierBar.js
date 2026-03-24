/**
 * @module CartSpendToTierBar
 * @description Cart page spend-to-next-tier progress bar with endowed progress.
 *
 * Applies the Kivetz (2006) endowed progress mechanic: floor displayed progress
 * at 20% to anchor goal pursuit — shown to increase tier completion by 82%.
 *
 * Shows signed-in members:
 *   - Progress toward the next loyalty tier including this order's preview points
 *   - "Add $X more for [Next Tier]!" upsell CTA, or tier-earn congratulation
 *   - Current tier name
 *
 * Collapses gracefully for non-members and tier data errors.
 *
 * Element IDs (Wix editor):
 *   #tierProgressBar   — progress bar (0-100), endowed floor at 20
 *   #tierProgressText  — spend-to-next or tier-earn message
 *   #tierName          — current tier label
 *
 * CF-1qo6
 */

// 1 point awarded per $1 of cart value (matches POINT_VALUES.PURCHASE_PER_DOLLAR)
const PURCHASE_PER_DOLLAR = 1;

// Endowed progress floor (Kivetz 2006) — never show less than this %
const ENDOWED_FLOOR = 20;

/**
 * Pure calculation: computes endowed progress and remaining spend for the bar.
 *
 * @param {{ tier, nextTier, progress, pointsToNext }} loyaltyData
 * @param {number} cartSubtotal  Cart subtotal in dollars
 * @returns {{ endowedProgress: number, remainingAfterCart: number }}
 */
export function calcTierProgressWithCart(loyaltyData, cartSubtotal) {
  const { progress, pointsToNext, nextTier } = loyaltyData;

  if (!nextTier) {
    return { endowedProgress: 100, remainingAfterCart: 0 };
  }

  const cartPoints = Math.round(cartSubtotal * PURCHASE_PER_DOLLAR);
  const rawProgress = Math.min(100, progress + (cartPoints * (100 - progress)) / pointsToNext);
  const endowedProgress = Math.max(ENDOWED_FLOOR, Math.round(rawProgress));
  const remainingAfterCart = Math.max(0, pointsToNext - cartPoints);

  return { endowedProgress, remainingAfterCart };
}

/**
 * Initialize the spend-to-tier bar on cart page load.
 * Fetches loyalty account once; hides all elements on guest/error.
 *
 * @param {Function} $w  Wix element selector
 * @param {Object}   opts
 * @param {number}   opts.cartSubtotal      Cart subtotal in dollars
 * @param {Function} opts.getLoyaltyAccount Backend call, throws for non-members
 */
export async function initSpendToTierBar($w, { cartSubtotal, getLoyaltyAccount }) {
  try {
    let loyaltyData;
    try {
      loyaltyData = await getLoyaltyAccount();
    } catch (_) {
      hideAll($w);
      return;
    }

    if (!loyaltyData) {
      hideAll($w);
      return;
    }

    renderBar($w, loyaltyData, cartSubtotal);
  } catch (err) {
    hideAll($w);
  }
}

/**
 * Update the bar when the cart subtotal changes (e.g., item added/removed).
 * Uses cached loyaltyData to avoid a backend round-trip on every cart change.
 *
 * @param {Function} $w
 * @param {Object}   opts
 * @param {number}   opts.cartSubtotal  Updated cart subtotal in dollars
 * @param {Object}   opts.loyaltyData   Previously fetched account (or null for guests)
 */
export function updateSpendToTierBar($w, { cartSubtotal, loyaltyData }) {
  if (!loyaltyData) return;
  try {
    renderBar($w, loyaltyData, cartSubtotal);
  } catch (err) {}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function hideAll($w) {
  try { $w('#tierProgressBar').hide(); } catch (e) {}
  try { $w('#tierProgressText').hide(); } catch (e) {}
  try { $w('#tierName').hide(); } catch (e) {}
}

function renderBar($w, loyaltyData, cartSubtotal) {
  const { tier, nextTier } = loyaltyData;
  const { endowedProgress, remainingAfterCart } = calcTierProgressWithCart(loyaltyData, cartSubtotal);

  try { $w('#tierProgressBar').value = endowedProgress; } catch (e) {}
  try { $w('#tierProgressBar').show(); } catch (e) {}

  try { $w('#tierName').text = tier; } catch (e) {}
  try { $w('#tierName').show(); } catch (e) {}

  const progressText = !nextTier
    ? `You're a ${tier} — top tier!`
    : remainingAfterCart <= 0
      ? `This order earns you ${nextTier} status!`
      : `Add $${remainingAfterCart} more for ${nextTier}!`;

  try { $w('#tierProgressText').text = progressText; } catch (e) {}
  try { $w('#tierProgressText').show(); } catch (e) {}
}
