/**
 * @module RewardsTierWidget
 * @description Displays member's rewards tier with progress to next tier.
 *
 * Elements:
 *   #tierBadge            — Colored badge element (class: tier-bronze/silver/gold/platinum)
 *   #tierName             — Text: tier name
 *   #tierProgress         — Progress bar (0-100 targetValue)
 *   #tierPointsNeeded     — Text: "N more points to [NextTier]" (hidden at Platinum)
 *   #tierBenefitsRepeater — Repeater listing current tier perks
 *   #tierNextBenefits     — Text or container showing next tier perks preview (hidden at Platinum)
 *   #tierError            — Shown on error
 *
 * Repeater item elements:
 *   #benefitText          — Text: benefit description
 *
 * CF-f5j9
 */

import { getMemberTier as _defaultGetMemberTier } from 'backend/gamificationEventReceiver.web';

/**
 * Initialise the rewards tier widget.
 *
 * @param {string}   memberId  Member whose tier to display
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getMemberTier]
 */
export async function initRewardsTierWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getMemberTier = opts.getMemberTier ?? ((id) => _defaultGetMemberTier(id));

  let data;
  try {
    data = await getMemberTier(memberId);
  } catch {
    data = null;
  }

  if (!data) {
    try { $w('#tierError').show(); } catch {}
    try { $w('#tierBadge').hide(); } catch {}
    try { $w('#tierName').hide(); } catch {}
    try { $w('#tierProgress').hide(); } catch {}
    try { $w('#tierPointsNeeded').hide(); } catch {}
    try { $w('#tierBenefitsRepeater').hide(); } catch {}
    try { $w('#tierNextBenefits').hide(); } catch {}
    return;
  }

  try { $w('#tierError').hide(); } catch {}

  // Badge with tier color class
  try {
    $w('#tierBadge').show();
    $w('#tierBadge').addClass(`tier-${data.currentTier}`);
  } catch {}

  // Tier name
  try { $w('#tierName').text = data.tierName; } catch {}

  // Progress bar
  if (data.nextTierName) {
    const totalRange = data.pointsInTier + data.pointsToNextTier;
    const pct = totalRange > 0 ? Math.round((data.pointsInTier / totalRange) * 100) : 0;
    try {
      $w('#tierProgress').targetValue = pct;
      $w('#tierProgress').show();
    } catch {}

    try {
      $w('#tierPointsNeeded').text = `${data.pointsToNextTier} more points to ${data.nextTierName}`;
      $w('#tierPointsNeeded').show();
    } catch {}
  } else {
    // Platinum — max tier
    try { $w('#tierProgress').hide(); } catch {}
    try { $w('#tierPointsNeeded').hide(); } catch {}
  }

  // Current tier benefits
  try {
    const benefitItems = data.benefits.map((b, i) => ({ _id: String(i), text: b }));
    $w('#tierBenefitsRepeater').data = benefitItems;
    $w('#tierBenefitsRepeater').onItemReady(($item, itemData) => {
      try { $item('#benefitText').text = itemData.text; } catch {}
    });
    $w('#tierBenefitsRepeater').show();
  } catch {}

  // Next tier benefits preview
  if (data.nextTierBenefits) {
    try {
      $w('#tierNextBenefits').text = `Next: ${data.nextTierBenefits.join(', ')}`;
      $w('#tierNextBenefits').show();
    } catch {}
  } else {
    try { $w('#tierNextBenefits').hide(); } catch {}
  }
}
