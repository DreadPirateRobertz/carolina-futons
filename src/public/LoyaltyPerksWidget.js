/**
 * @module LoyaltyPerksWidget
 * @description "Your Perks" section on the Loyalty page.
 * Shows the member's unlocked tier perks and a teaser of the next tier's perks.
 *
 * Elements:
 *   #perksSection         — Outer container (hidden on error or no data)
 *   #perksRepeater        — Repeater: one card per unlocked perk
 *   #perkNextTierTeaser   — Box shown when a next tier exists (hidden at max tier)
 *   #perkNextTierName     — Text: next tier name e.g. "Mountain Guide"
 *   #perkNextTierPoints   — Text: "N more points to unlock"
 *   #perkNextTierList     — Text: comma-joined list of next tier perks
 *   #perksError           — Shown on load failure
 *
 * Repeater item elements:
 *   #perkIcon             — Text: emoji icon
 *   #perkLabel            — Text: perk name
 *   #perkDescription      — Text: perk description
 *   #perkTierName         — Text: which tier granted this perk
 *
 * CF-c6el.3
 */

import { getMemberDeliveredPerks as _defaultGetPerks } from 'backend/rewardEngine.web';

/**
 * Initialise the loyalty perks widget.
 *
 * @param {string}   memberId   Member whose perks to display (used for auth context)
 * @param {Object}  [opts]      Injectable overrides for testing
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getMemberDeliveredPerks]
 */
export async function initLoyaltyPerksWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getMemberDeliveredPerks = opts.getMemberDeliveredPerks ?? (() => _defaultGetPerks());

  let data;
  try {
    const result = await getMemberDeliveredPerks();
    data = result?.success ? result : null;
  } catch {
    data = null;
  }

  if (!data) {
    try { $w('#perksSection').hide(); } catch {}
    try { $w('#perksError').show(); } catch {}
    return;
  }

  try { $w('#perksError').hide(); } catch {}
  try { $w('#perksSection').show(); } catch {}

  // ── Unlocked perks repeater ────────────────────────────────────────────────

  const repeaterItems = data.unlockedPerks.map((p, i) => ({
    _id: String(i),
    icon: p.icon,
    label: p.label,
    description: p.description,
    tierName: p.tierName,
  }));

  try {
    $w('#perksRepeater').data = repeaterItems;
    $w('#perksRepeater').onItemReady(($item, itemData) => {
      try { $item('#perkIcon').text = itemData.icon; } catch {}
      try { $item('#perkLabel').text = itemData.label; } catch {}
      try { $item('#perkDescription').text = itemData.description; } catch {}
      try { $item('#perkTierName').text = itemData.tierName; } catch {}
    });
  } catch {}

  // ── Next-tier teaser ───────────────────────────────────────────────────────

  if (data.nextTierName && data.nextTierPerks) {
    try { $w('#perkNextTierTeaser').show(); } catch {}
    try { $w('#perkNextTierName').text = data.nextTierName; } catch {}

    const pts = data.nextTierPointsNeeded;
    if (pts !== null) {
      try {
        $w('#perkNextTierPoints').text =
          pts === 0
            ? `You've reached ${data.nextTierName}!`
            : `${pts.toLocaleString()} more points to unlock`;
      } catch {}
    }

    const perkNames = data.nextTierPerks.map(p => p.label).join(', ');
    try { $w('#perkNextTierList').text = perkNames; } catch {}
  } else {
    try { $w('#perkNextTierTeaser').hide(); } catch {}
  }
}
