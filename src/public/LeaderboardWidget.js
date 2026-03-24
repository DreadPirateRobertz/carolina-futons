/**
 * @module LeaderboardWidget
 * @description Member dashboard leaderboard showing top-10 members by points,
 * with opt-in toggle and current-member row highlight.
 *
 * Elements:
 *   #leaderboardRepeater    — Repeater displaying top-10 entries
 *   #leaderboardOptInToggle — Checkbox/toggle controlling leaderboard visibility
 *   #leaderboardOptOutMsg   — Message shown when member opts out
 *
 * Repeater item elements:
 *   #rankText    — Rank label: Gold/Silver/Bronze for 1–3, #N for 4–10
 *   #nickText    — Member nickname
 *   #pointsText  — Points total
 *
 * CF-9svi
 */

import { getLeaderboard as _defaultGetLeaderboard, setLeaderboardOptIn as _defaultSetLeaderboardOptIn, getLeaderboardOptIn as _defaultGetLeaderboardOptIn } from 'backend/leaderboardService.web';

const RANK_LABELS = { 1: 'Gold', 2: 'Silver', 3: 'Bronze' };

function rankLabel(rank) {
  return RANK_LABELS[rank] ?? `#${rank}`;
}

function applyOptInState($w, optedIn) {
  if (optedIn) {
    try { $w('#leaderboardRepeater').show(); } catch (e) {}
    try { $w('#leaderboardOptOutMsg').hide(); } catch (e) {}
  } else {
    try { $w('#leaderboardRepeater').hide(); } catch (e) {}
    try { $w('#leaderboardOptOutMsg').show(); } catch (e) {}
  }
}

/**
 * Initialise the leaderboard widget.
 *
 * @param {string}   memberId  Current member ID (for row highlight and opt-in calls)
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getLeaderboard]
 * @param {Function} [opts.setLeaderboardOptIn]
 * @param {Function} [opts.getLeaderboardOptIn]
 */
export async function initLeaderboardWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getLeaderboard = opts.getLeaderboard ?? (() => _defaultGetLeaderboard());
  const setLeaderboardOptIn = opts.setLeaderboardOptIn ?? ((id, val) => _defaultSetLeaderboardOptIn(id, val));
  const getLeaderboardOptIn = opts.getLeaderboardOptIn ?? ((id) => _defaultGetLeaderboardOptIn(id));

  // Fetch leaderboard and opt-in state in parallel
  const [leaderboardResult, optInResult] = await Promise.allSettled([
    getLeaderboard(),
    getLeaderboardOptIn(memberId),
  ]);

  if (leaderboardResult.status === 'fulfilled') {
    const entries = leaderboardResult.value;

    try {
      $w('#leaderboardRepeater').data = entries;
    } catch (e) {}

    try {
      $w('#leaderboardRepeater').onItemReady(($item, $w2, item) => {
        try { $w2('#rankText').text = rankLabel(item.rank); } catch (e) {}
        try { $w2('#nickText').text = item.nickname; } catch (e) {}
        try { $w2('#pointsText').text = String(item.points); } catch (e) {}
        if (item.memberId === memberId) {
          try { $item.addClass('current-member'); } catch (e) {}
        }
      });
    } catch (e) {}
  } else {
    try { $w('#leaderboardRepeater').hide(); } catch (e) {}
  }

  const optedIn = optInResult.status === 'fulfilled' ? optInResult.value : true;
  applyOptInState($w, optedIn);

  // Wire opt-in toggle
  try {
    $w('#leaderboardOptInToggle').onChange(async (event) => {
      const newValue = event.target.checked;
      try { await setLeaderboardOptIn(memberId, newValue); } catch (e) {}
      applyOptInState($w, newValue);
    });
  } catch (e) {}
}
