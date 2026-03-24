/**
 * @module PostPurchaseReveal
 * @description Post-purchase gamification reveal card on the Thank You Page.
 *
 * Shows signed-in members:
 *   - Points they're earning on this order (2 pts per $1)
 *   - Current tier + progress bar
 *   - ZIP leaderboard rank (if opted in)
 *   - Social share CTA
 *
 * Shows non-members a join CTA with estimated points.
 *
 * Zero new backend — reads getMyLoyaltyAccount() + getZipLeaderboard() only.
 *
 * Element IDs (Wix editor):
 *   #postPurchaseReveal — collapsible outer section
 *   #revealPointsText   — "You're earning X pts on this order!"
 *   #revealTierBar      — progress bar (0-100)
 *   #revealTierText     — tier name + points to next tier
 *   #revealRankText     — ZIP leaderboard rank (hidden if not ranked)
 *   #revealShareBtn     — share CTA button
 *   #revealJoinCta      — non-member join text
 *
 * CF-wndq
 */

// 2 points per $1 (matches POINT_VALUES.PURCHASE_PER_DOLLAR)
const PURCHASE_PER_DOLLAR = 2;

function previewPoints(orderTotal) {
  return Math.round(orderTotal * PURCHASE_PER_DOLLAR);
}

/**
 * Initialize the post-purchase reveal card.
 *
 * @param {Function} $w           Wix element selector
 * @param {Object}   opts
 * @param {number}   opts.orderTotal       Order subtotal in dollars
 * @param {Function} opts.getLoyaltyAccount Backend call returning loyalty data, throws for non-members
 * @param {Function} opts.getLeaderboard    Backend call returning { myRank, zipPrefix }, best-effort
 */
export async function initPostPurchaseReveal($w, { orderTotal, getLoyaltyAccount, getLeaderboard }) {
  try {
    let loyaltyData;
    try {
      loyaltyData = await getLoyaltyAccount();
    } catch (_) {
      // Not signed in — show guest join CTA
      showGuestState($w, orderTotal);
      return;
    }

    if (!loyaltyData) {
      try { $w('#postPurchaseReveal').collapse(); } catch (e) {}
      return;
    }

    // Fetch leaderboard rank — best-effort, never blocks the reveal
    let rankData = { myRank: null, zipPrefix: null };
    try {
      rankData = await getLeaderboard();
    } catch (_) {}

    showMemberState($w, loyaltyData, orderTotal, rankData);
  } catch (err) {
    try { $w('#postPurchaseReveal').collapse(); } catch (e) {}
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function showGuestState($w, orderTotal) {
  const pts = previewPoints(orderTotal);
  try { $w('#postPurchaseReveal').expand(); } catch (e) {}
  try { $w('#revealPointsText').hide(); } catch (e) {}
  try { $w('#revealTierBar').hide(); } catch (e) {}
  try { $w('#revealTierText').hide(); } catch (e) {}
  try { $w('#revealRankText').hide(); } catch (e) {}
  try { $w('#revealShareBtn').hide(); } catch (e) {}
  try {
    $w('#revealJoinCta').text = `Join rewards to earn ${pts} pts — sign up free`;
    $w('#revealJoinCta').show();
  } catch (e) {}
}

function showMemberState($w, loyaltyData, orderTotal, rankData) {
  const { tier, nextTier, progress, pointsToNext } = loyaltyData;
  const { myRank, zipPrefix } = rankData;
  const pts = previewPoints(orderTotal);

  try { $w('#postPurchaseReveal').expand(); } catch (e) {}
  try { $w('#revealJoinCta').hide(); } catch (e) {}

  // Points preview
  try {
    $w('#revealPointsText').text = `You're earning ${pts} pts on this order!`;
    $w('#revealPointsText').show();
  } catch (e) {}

  // Tier progress bar
  try { $w('#revealTierBar').value = progress; } catch (e) {}

  // Tier text
  try {
    const tierText = nextTier
      ? `${tier} · ${pointsToNext} pts to ${nextTier}`
      : `${tier} — top tier!`;
    $w('#revealTierText').text = tierText;
    $w('#revealTierText').show();
  } catch (e) {}

  // Leaderboard rank
  const hasRank = myRank !== null && zipPrefix;
  if (hasRank) {
    try {
      $w('#revealRankText').text = `You're #${myRank} in the ${zipPrefix}XX area`;
      $w('#revealRankText').show();
    } catch (e) {}
    try {
      $w('#revealShareBtn').text = `Share your #${myRank} ranking`;
      $w('#revealShareBtn').show();
    } catch (e) {}
  } else {
    try { $w('#revealRankText').hide(); } catch (e) {}
    try {
      $w('#revealShareBtn').text = 'Share your milestone';
      $w('#revealShareBtn').show();
    } catch (e) {}
  }

  // Share button onClick — navigator.share with clipboard fallback
  const shareText = hasRank
    ? `I'm #${myRank} in the ${zipPrefix}XX area on Carolina Futons! 🏔️ carolinafutons.com`
    : `Just earned ${pts} pts at Carolina Futons! 🏔️ carolinafutons.com`;
  try {
    $w('#revealShareBtn').onClick(() => {
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ text: shareText, url: 'https://carolinafutons.com' }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(shareText).catch(() => {});
      }
    });
  } catch (e) {}
}
