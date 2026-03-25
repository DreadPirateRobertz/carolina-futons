/**
 * @module PostPurchaseRewardPrompt
 * @description Post-purchase referral + points combo prompt.
 * Shows points earned from purchase and referral CTA on Thank You page.
 * Gracefully degrades for non-members (hides prompt entirely).
 *
 * Elements:
 *   #rewardPromptSection   — Container (expand/collapse)
 *   #rewardPointsText      — "You earned X points from this purchase!"
 *   #rewardReferralText    — "Share your link to earn 500 bonus points per friend."
 *   #rewardReferralLink    — Referral URL text
 *   #rewardCopyBtn         — Copy referral link button
 *
 * CF-fawn
 */

import { getPostPurchaseRewardSummary as _defaultGetSummary } from 'backend/referralService.web';

/**
 * Initialise the post-purchase reward prompt.
 *
 * @param {number}   orderTotal
 * @param {Object}   [opts]   Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getPostPurchaseRewardSummary]
 * @param {Function} [opts.copyToClipboard]
 */
export async function initPostPurchaseRewardPrompt(orderTotal, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getSummary = opts.getPostPurchaseRewardSummary ?? ((total) => _defaultGetSummary(total));
  const copyToClipboard = opts.copyToClipboard ?? (globalThis.navigator?.clipboard?.writeText?.bind(globalThis.navigator.clipboard));

  // Hide by default
  try { $w('#rewardPromptSection').collapse(); } catch {}

  let summary;
  try {
    summary = await getSummary(orderTotal);
  } catch {
    return;
  }

  // Non-member or error — don't show
  if (!summary) return;

  const { pointsEarned, referralUrl, referralBonusPoints } = summary;

  // Show points earned
  if (pointsEarned > 0) {
    try {
      $w('#rewardPointsText').text = `🎉 You earned ${pointsEarned} points from this purchase!`;
    } catch {}
  } else {
    try { $w('#rewardPointsText').text = ''; } catch {}
  }

  // Show referral CTA
  try {
    $w('#rewardReferralText').text =
      `Share your referral link to earn ${referralBonusPoints} bonus points per friend.`;
  } catch {}

  try { $w('#rewardReferralLink').text = referralUrl; } catch {}

  // Copy button
  try {
    $w('#rewardCopyBtn').onClick(async () => {
      try {
        if (copyToClipboard) await copyToClipboard(referralUrl);
        try { $w('#rewardCopyBtn').label = 'Copied!'; } catch {}
        setTimeout(() => {
          try { $w('#rewardCopyBtn').label = 'Copy Link'; } catch {}
        }, 2000);
      } catch {}
    });
  } catch {}

  // Show the section
  try { $w('#rewardPromptSection').expand(); } catch {}
}
