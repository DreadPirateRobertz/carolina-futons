/**
 * @module CartLoyaltyBar
 * @description Cart page tier progress bar — session-1 loyalty discovery hook.
 *
 * Shows signed-in members their current loyalty tier, preview points for
 * this order, and an upsell CTA to reach the next tier.
 * Shows non-members a join CTA with estimated points for the order.
 *
 * Zero new backend — reads getMyLoyaltyAccount() only.
 *
 * Element IDs (Wix editor):
 *   #loyaltyBarSection  — collapsible container
 *   #loyaltyBarProgress — progress bar (0-100)
 *   #loyaltyBarText     — tier name + preview points
 *   #loyaltyBarCta      — upsell CTA for members with a next tier
 *   #loyaltyBarJoinCta  — join rewards CTA for non-members
 *
 * CF-jbu
 */

// 1 point awarded per $1 of order value (matches POINT_VALUES.PURCHASE_PER_DOLLAR)
const PURCHASE_PER_DOLLAR = 1;

/**
 * Initialize the cart loyalty bar on page load.
 *
 * @param {Function} $w  Wix element selector
 * @param {Object}   opts
 * @param {number}   opts.subtotal          Cart subtotal in dollars
 * @param {Function} opts.getLoyaltyAccount Backend call returning loyalty data, throws for non-members
 */
export async function initCartLoyaltyBar($w, { subtotal, getLoyaltyAccount }) {
  try {
    let loyaltyData;
    try {
      loyaltyData = await getLoyaltyAccount();
    } catch (_) {
      // Not signed in or permission denied — show guest join CTA
      showGuestState($w, subtotal);
      return;
    }

    if (!loyaltyData) {
      try { $w('#loyaltyBarSection').collapse(); } catch (e) {}
      return;
    }

    showMemberState($w, loyaltyData, subtotal);
  } catch (err) {
    try { $w('#loyaltyBarSection').collapse(); } catch (e) {}
  }
}

/**
 * Update the loyalty bar when the cart subtotal changes (e.g., item added).
 * Uses cached loyaltyData to avoid a backend round-trip on every cart change.
 *
 * @param {Function} $w
 * @param {Object}   opts
 * @param {number}   opts.subtotal     Updated cart subtotal
 * @param {Object}   opts.loyaltyData  Previously fetched loyalty account (or null for guests)
 */
export function updateCartLoyaltyBar($w, { subtotal, loyaltyData }) {
  if (!loyaltyData) return;
  try {
    showMemberState($w, loyaltyData, subtotal);
  } catch (err) {}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function previewPoints(subtotal) {
  return Math.round(subtotal * PURCHASE_PER_DOLLAR);
}

function showGuestState($w, subtotal) {
  const pts = previewPoints(subtotal);
  try { $w('#loyaltyBarSection').expand(); } catch (e) {}
  try { $w('#loyaltyBarProgress').value = 0; } catch (e) {}
  try { $w('#loyaltyBarText').hide(); } catch (e) {}
  try { $w('#loyaltyBarCta').hide(); } catch (e) {}
  try {
    $w('#loyaltyBarJoinCta').text = `Join rewards to earn ${pts} pts on this order`;
    $w('#loyaltyBarJoinCta').show();
  } catch (e) {}
}

function showMemberState($w, loyaltyData, subtotal) {
  const { tier, nextTier, progress, pointsToNext } = loyaltyData;
  const pts = previewPoints(subtotal);

  try { $w('#loyaltyBarSection').expand(); } catch (e) {}
  try { $w('#loyaltyBarJoinCta').hide(); } catch (e) {}
  try { $w('#loyaltyBarProgress').value = progress; } catch (e) {}
  try {
    $w('#loyaltyBarText').text = `${tier} · Earn ${pts} pts on this order`;
    $w('#loyaltyBarText').show();
  } catch (e) {}

  if (nextTier && pointsToNext > 0) {
    const dollarToNext = Math.max(0, pointsToNext - pts);
    const ctaText = dollarToNext > 0
      ? `Add $${dollarToNext} to reach ${nextTier}`
      : `This order gets you to ${nextTier}!`;
    try {
      $w('#loyaltyBarCta').text = ctaText;
      $w('#loyaltyBarCta').show();
    } catch (e) {}
  } else {
    try { $w('#loyaltyBarCta').hide(); } catch (e) {}
  }
}
