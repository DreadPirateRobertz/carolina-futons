/**
 * @module LeaderboardWidget
 * @description Displays top-10 members by points on member dashboard.
 *
 * Elements:
 *   #leaderboardTitle    — Text: "Community Leaderboard"
 *   #leaderboardRepeater — Repeater displaying top-10 entries
 *   #leaderboardYourRank — Text: "Your rank: #N" or "You are #N — X pts to reach top 10"
 *   #leaderboardEmpty    — Shown on error or empty data
 *
 * Repeater item elements:
 *   #leaderRank   — Rank label: "Gold"/"Silver"/"Bronze" for 1-3, "#N" for 4+
 *   #leaderName   — Member nickname
 *   #leaderPoints — Points formatted with commas + " pts"
 *   #leaderAvatar — Image element (src = avatarUrl)
 *
 * CF-ttcd, CF-bs92
 */

import { getLeaderboard as _defaultGetLeaderboard } from 'backend/gamificationEventReceiver.web';

const RANK_LABELS = { 1: 'Gold', 2: 'Silver', 3: 'Bronze' };
const RANK_CLASSES = { 1: 'rank-gold', 2: 'rank-silver', 3: 'rank-bronze' };

function rankLabel(rank) {
  return RANK_LABELS[rank] ?? `#${rank}`;
}

function formatPoints(n) {
  return `${Number(n).toLocaleString('en-US')} pts`;
}

/**
 * Initialise the leaderboard widget.
 *
 * @param {string}   memberId  Current member ID (for "Your rank" display)
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getLeaderboard]
 * @param {string}   [opts.currentMemberId] — alias for memberId in tests
 */
export async function initLeaderboardWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getLeaderboard = opts.getLeaderboard ?? ((limit, mid) => _defaultGetLeaderboard(limit, mid));
  const currentMemberId = opts.currentMemberId ?? memberId;

  try { $w('#leaderboardTitle').text = 'Community Leaderboard'; } catch {}

  let result;
  try {
    result = await getLeaderboard(10, currentMemberId);
  } catch {
    result = null;
  }

  const entries = result?.entries ?? null;

  if (!entries || entries.length === 0) {
    try { $w('#leaderboardEmpty').show(); } catch {}
    try { $w('#leaderboardRepeater').hide(); } catch {}
    try { $w('#leaderboardYourRank').hide(); } catch {}
    return;
  }

  try { $w('#leaderboardEmpty').hide(); } catch {}
  try { $w('#leaderboardRepeater').show(); } catch {}

  try {
    $w('#leaderboardRepeater').data = entries;
  } catch {}

  try {
    $w('#leaderboardRepeater').onItemReady(($item, itemData) => {
      try { $item('#leaderRank').text = rankLabel(itemData.rank); } catch {}
      try { $item('#leaderName').text = itemData.nickname; } catch {}
      try { $item('#leaderPoints').text = formatPoints(itemData.totalPoints); } catch {}
      try { if (itemData.avatarUrl) { $item('#leaderAvatar').src = itemData.avatarUrl; } } catch {}

      // Top 3 styling
      const rankClass = RANK_CLASSES[itemData.rank];
      if (rankClass) {
        try { $item('#leaderRank').addClass(rankClass); } catch {}
      }

      // Highlight current member
      if (itemData.memberId === currentMemberId) {
        try { $item.addClass('current-member'); } catch {}
      }
    });
  } catch {}

  // CF-bs92: Always show rank — in top 10 or outside
  const currentUserRank = result?.currentUserRank;
  const pointsToTopTen = result?.pointsToTopTen ?? 0;
  const inTop = entries.some(e => e.memberId === currentMemberId);

  if (inTop) {
    try {
      $w('#leaderboardYourRank').text = `Your rank: #${currentUserRank}`;
      $w('#leaderboardYourRank').show();
    } catch {}
  } else if (currentUserRank) {
    try {
      $w('#leaderboardYourRank').text = `You are #${currentUserRank} \u2014 ${pointsToTopTen} pts to reach top 10`;
      $w('#leaderboardYourRank').show();
    } catch {}
  } else {
    try { $w('#leaderboardYourRank').hide(); } catch {}
  }
}
