/**
 * @module GamificationStatsWidget
 * @description Aggregate stats overview for member dashboard header.
 *
 * Elements:
 *   #statsPoints  — Text: "2,450 pts"
 *   #statsTier    — Tier badge with color class (tier-bronze/silver/gold/platinum)
 *   #statsStreak  — Text: "7-day streak" (with fire icon if active)
 *   #statsBadges  — Text: "12 badges"
 *   #statsQuests  — Text: "45 quests completed"
 *   #statsRank    — Text: "Rank #23"
 *   #statsError   — Shown on error
 *   #statsRetry   — Retry button (onClick re-fetches)
 *
 * CF-ytrl
 */

import { getGamificationStats as _defaultGetGamificationStats } from 'backend/gamificationEventReceiver.web';

// Tier class derived from name: "Trail Blazer" → "tier-trail-blazer"
function tierClass(tierName) {
  return `tier-${tierName.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Initialise the gamification stats widget.
 *
 * @param {string}   memberId  Member whose stats to display
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getGamificationStats]
 */
export async function initGamificationStatsWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getGamificationStats = opts.getGamificationStats ?? ((id) => _defaultGetGamificationStats(id));

  async function render() {
    let stats;
    try {
      stats = await getGamificationStats(memberId);
    } catch {
      stats = null;
    }

    if (!stats) {
      try { $w('#statsError').show(); } catch {}
      try { $w('#statsPoints').hide(); } catch {}
      try { $w('#statsTier').hide(); } catch {}
      try { $w('#statsStreak').hide(); } catch {}
      try { $w('#statsBadges').hide(); } catch {}
      try { $w('#statsQuests').hide(); } catch {}
      try { $w('#statsRank').hide(); } catch {}
      return;
    }

    try { $w('#statsError').hide(); } catch {}

    // Points
    try { $w('#statsPoints').text = `${Number(stats.totalPoints).toLocaleString('en-US')} pts`; } catch {}

    // Tier badge
    try {
      $w('#statsTier').text = stats.currentTier;
      $w('#statsTier').addClass(tierClass(stats.currentTier));
    } catch {}

    // Streak
    const streak = stats.currentStreak ?? 0;
    try {
      if (streak >= 3) {
        $w('#statsStreak').text = `\uD83D\uDD25 ${streak}-day streak`;
      } else {
        $w('#statsStreak').text = `${streak}-day streak`;
      }
    } catch {}

    // Badges
    try { $w('#statsBadges').text = `${stats.badgesEarned} badges`; } catch {}

    // Quests
    try { $w('#statsQuests').text = `${stats.questsCompleted} quests completed`; } catch {}

    // Rank
    try { $w('#statsRank').text = `Rank #${stats.rank}`; } catch {}
  }

  await render();

  // Wire retry button
  try {
    $w('#statsRetry').onClick(async () => {
      await render();
    });
  } catch {}
}
