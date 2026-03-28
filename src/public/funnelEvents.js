// funnelEvents.js — Custom GA4 funnel event taxonomy
// All conversion-funnel custom events via wixWindow.trackEvent().
// Covers: quiz, swatch, bundle, loyalty, spin, referral, review,
// financing, compare, and room-planner touchpoints.
//
// CF-zqz2

let _wixWindow = null;

async function getWixWindow() {
  if (!_wixWindow) {
    try {
      _wixWindow = await import('wix-window-frontend');
    } catch (e) {
      _wixWindow = null;
    }
  }
  return _wixWindow;
}

async function fire(eventName, params = {}) {
  try {
    const ww = await getWixWindow();
    if (!ww?.trackEvent) return;
    ww.trackEvent('CustomEvent', { event: eventName, ...params });
  } catch (e) {
    // GA4 events are non-critical
  }
}

// ── Quiz ─────────────────────────────────────────────────────────────

export async function fireQuizStarted({ quizId } = {}) {
  await fire('quiz_started', { quiz_id: quizId });
}

export async function fireQuizCompleted({ quizId, result } = {}) {
  await fire('quiz_completed', { quiz_id: quizId, result });
}

export async function fireLeadCaptured({ quizId, email } = {}) {
  await fire('lead_captured', { quiz_id: quizId, email });
}

// ── Swatch ───────────────────────────────────────────────────────────

export async function fireSwatchRequested({ productId, swatchName } = {}) {
  await fire('swatch_requested', { product_id: productId, swatch_name: swatchName });
}

export async function fireSwatchToPurchase({ productId, swatchName } = {}) {
  await fire('swatch_to_purchase', { product_id: productId, swatch_name: swatchName });
}

// ── Bundle ───────────────────────────────────────────────────────────

export async function fireBundleViewed({ bundleId, bundleName } = {}) {
  await fire('bundle_viewed', { bundle_id: bundleId, bundle_name: bundleName });
}

export async function fireBundleAdded({ bundleId, bundleName, value } = {}) {
  await fire('bundle_added', { bundle_id: bundleId, bundle_name: bundleName, value });
}

export async function fireBundlePurchased({ bundleId, bundleName, value, orderId } = {}) {
  await fire('bundle_purchased', { bundle_id: bundleId, bundle_name: bundleName, value, order_id: orderId });
}

// ── Loyalty ──────────────────────────────────────────────────────────

export async function fireLoyaltyEnrolled({ memberId, source } = {}) {
  await fire('loyalty_enrolled', { member_id: memberId, source });
}

export async function fireLoyaltyRedeemed({ memberId, points, value } = {}) {
  await fire('loyalty_redeemed', { member_id: memberId, points, value });
}

// ── Spin ─────────────────────────────────────────────────────────────

export async function fireSpinPlayed({ memberId } = {}) {
  await fire('spin_played', { member_id: memberId });
}

export async function fireSpinWon({ memberId, prize } = {}) {
  await fire('spin_won', { member_id: memberId, prize });
}

export async function fireSpinConverted({ memberId, prize, orderId } = {}) {
  await fire('spin_converted', { member_id: memberId, prize, order_id: orderId });
}

// ── Referral ─────────────────────────────────────────────────────────

export async function fireReferralShared({ referrerId, channel } = {}) {
  await fire('referral_shared', { referrer_id: referrerId, channel });
}

export async function fireReferralConverted({ referrerId, refereeId, orderId } = {}) {
  await fire('referral_converted', { referrer_id: referrerId, referee_id: refereeId, order_id: orderId });
}

// ── Review ───────────────────────────────────────────────────────────

export async function fireReviewSubmitted({ productId, rating } = {}) {
  await fire('review_submitted', { product_id: productId, rating });
}

export async function fireReviewWithPhoto({ productId, rating } = {}) {
  await fire('review_with_photo', { product_id: productId, rating });
}

// ── Financing ────────────────────────────────────────────────────────

export async function fireFinancingCalculated({ productId, amount, term } = {}) {
  await fire('financing_calculated', { product_id: productId, amount, term });
}

export async function fireFinancingApplied({ productId, amount, provider } = {}) {
  await fire('financing_applied', { product_id: productId, amount, provider });
}

// ── Compare ──────────────────────────────────────────────────────────

export async function fireCompareStarted({ productIds } = {}) {
  await fire('compare_started', { product_ids: Array.isArray(productIds) ? productIds.join(',') : productIds });
}

export async function fireCompareToCart({ productId } = {}) {
  await fire('compare_to_cart', { product_id: productId });
}

// ── Room Planner ─────────────────────────────────────────────────────

export async function fireRoomPlannerUsed({ sessionId } = {}) {
  await fire('room_planner_used', { session_id: sessionId });
}

export async function fireRoomPlannerToCart({ sessionId, productId } = {}) {
  await fire('room_planner_to_cart', { session_id: sessionId, product_id: productId });
}
