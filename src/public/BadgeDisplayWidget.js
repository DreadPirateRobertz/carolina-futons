/**
 * @module BadgeDisplayWidget
 * @description Shows earned achievement badges on the member dashboard.
 * New (unnotified) badges get a "badge-new" CSS class for highlight and
 * are marked as notified via markBadgeNotified after rendering.
 *
 * Elements:
 *   #badgeRepeater  — Repeater listing earned badges
 *   #noBadgesMsg    — Message shown when member has no badges
 *
 * Repeater item elements:
 *   #badgeIcon   — Image element (src = /images/badges/${badgeId}.png)
 *   #badgeName   — Text element (badge label)
 *   #badgeDate   — Text element ("Earned MM/DD/YYYY" from awardedAt)
 *
 * CF-hgmo
 */

import {
  getMemberBadges as _defaultGetMemberBadges,
  markBadgeNotified as _defaultMarkBadgeNotified,
} from 'backend/achievementBadgeService.web';

/**
 * Format a Date (or ISO string) as "Earned MM/DD/YYYY".
 * @param {Date|string} awardedAt
 * @returns {string}
 */
function formatBadgeDate(awardedAt) {
  const d = new Date(awardedAt);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `Earned ${mm}/${dd}/${yyyy}`;
}

/**
 * Initialise the badge display widget.
 *
 * @param {string}   memberId  Member whose badges to display
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getMemberBadges]
 * @param {Function} [opts.markBadgeNotified]
 */
export async function initBadgeDisplayWidget(memberId, opts = {}) {
  const $w                = opts.$w                ?? globalThis.$w;
  const getMemberBadges   = opts.getMemberBadges   ?? ((id) => _defaultGetMemberBadges(id));
  const markBadgeNotified = opts.markBadgeNotified ?? ((id, bid) => _defaultMarkBadgeNotified(id, bid));

  let badges;
  try {
    badges = await getMemberBadges(memberId);
  } catch (e) {
    // Non-fatal — leave UI in default state
    return;
  }

  if (!badges || badges.length === 0) {
    try { $w('#noBadgesMsg').show(); } catch (e) {}
    try { $w('#badgeRepeater').hide(); } catch (e) {}
    return;
  }

  try { $w('#noBadgesMsg').hide(); } catch (e) {}
  try { $w('#badgeRepeater').show(); } catch (e) {}

  try {
    $w('#badgeRepeater').data = badges;
  } catch (e) {}

  try {
    $w('#badgeRepeater').onItemReady(($item, itemData) => {
      try { $item('#badgeIcon').src = `/images/badges/${itemData.badgeId}.png`; } catch (e) {}
      try { $item('#badgeName').text = itemData.label; } catch (e) {}
      try { $item('#badgeDate').text = formatBadgeDate(itemData.awardedAt); } catch (e) {}

      if (!itemData.notified) {
        try { $item.addClass('badge-new'); } catch (e) {}
      }
    });
  } catch (e) {}

  // Mark new badges as notified (fire-and-forget, non-fatal)
  const newBadges = badges.filter(b => !b.notified);
  for (const badge of newBadges) {
    markBadgeNotified(memberId, badge.badgeId).catch(() => {});
  }
}
