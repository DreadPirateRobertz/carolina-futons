/**
 * ZipLeaderboardDisplay.js — ZIP micro-leaderboard UI helpers (cf-shr).
 *
 * Renders the top-10 leaderboard for the caller's 3-digit ZIP prefix onto
 * the Member Page. Consumes getZipLeaderboard from zipLeaderboard.web.js.
 *
 * Element contract (all required by Member Page editor):
 *   #zipLeaderboardSection  — container box (show/hide)
 *   #zipLeaderboardRepeater — repeater (one row per entry)
 *   #zipMyRankText          — text: "You're ranked #N in your area"
 *   #zipPrefixText          — text: "Top neighbors in 282xx"
 *   #zipLeaderboardEmpty    — box shown when no opted-in neighbors found
 *
 * Repeater item elements:
 *   #zipRankText        — "1", "2", …
 *   #zipDisplayNameText — member display name
 *   #zipPointsText      — "1,000 pts"
 *   #zipEntryBox        — row box; background set to colors.sand for caller's row
 */

import { colors } from 'public/designTokens.js';

/**
 * Render the ZIP leaderboard into the provided elements.
 *
 * @param {{ $section, $repeater, $myRankText, $zipPrefixText, $emptyMessage }} els
 * @param {{ leaderboard: Array, myRank: number|null, zipPrefix: string|null }
 *        | { status: 429 }} result
 */
export function renderZipLeaderboard(els, result) {
  const { $section, $repeater, $myRankText, $zipPrefixText, $emptyMessage } = els;

  // Rate limit or no ZIP data — hide section entirely
  if (!result || result.status === 429 || !result.zipPrefix) {
    $section.hide();
    return;
  }

  const { leaderboard, myRank, zipPrefix } = result;

  $zipPrefixText.text = `Top neighbors in ${zipPrefix}xx`;

  // No opted-in neighbors in this ZIP prefix — show empty state
  if (!leaderboard || leaderboard.length === 0) {
    try { $emptyMessage.show(); } catch (e) {}
    $section.show();
    return;
  }

  try { $emptyMessage.hide(); } catch (e) {}

  $repeater.onItemReady(($item, itemData) => {
    try { $item('#zipRankText').text = String(itemData.rank); } catch (e) {}
    try { $item('#zipDisplayNameText').text = itemData.displayName || 'Member'; } catch (e) {}
    try { $item('#zipPointsText').text = `${(itemData.totalPoints || 0).toLocaleString()} pts`; } catch (e) {}
    try {
      const row = $item('#zipEntryBox');
      if (itemData.isMe) row.style.backgroundColor = colors.sand;
      else row.style.backgroundColor = '';
    } catch (e) {}
  });

  $repeater.data = leaderboard;

  if (myRank !== null) {
    $myRankText.text = `You're ranked #${myRank} in your area`;
    $myRankText.show();
  } else {
    $myRankText.hide();
  }

  $section.show();
}

/**
 * Fetch and render the ZIP leaderboard section on Member Page.
 * Hides section silently on any error or rate limit.
 *
 * @param {{ $section, $repeater, $myRankText, $zipPrefixText, $emptyMessage }} els
 * @param {Function} getZipLeaderboardFn  — injected for testability
 */
export async function initZipLeaderboardSection(els, getZipLeaderboardFn) {
  try {
    const result = await getZipLeaderboardFn();
    renderZipLeaderboard(els, result);
  } catch (err) {
    els.$section.hide();
  }
}
