/**
 * @module ActivityFeedWidget
 * @description Displays recent member activity stream on dashboard.
 *
 * Elements:
 *   #activityTitle    — Text: "Recent Activity"
 *   #activityRepeater — Repeater displaying last 10 activities
 *   #activityEmpty    — Shown when no activity or on error
 *
 * Repeater item elements:
 *   #activityIcon   — Icon/emoji by activity type
 *   #activityDesc   — Activity description text
 *   #activityPoints — Points earned ("+N pts" or empty)
 *   #activityTime   — Relative time ("2h ago", "yesterday")
 *
 * CF-gx44
 */

import { getActivityFeed as _defaultGetActivityFeed } from 'backend/gamificationEventReceiver.web';

const ICON_MAP = {
  cart:       '\uD83D\uDED2',
  star:       '\u2B50',
  gift:       '\uD83C\uDF81',
  fire:       '\uD83D\uDD25',
  trophy:     '\uD83C\uDFC6',
  wheel:      '\uD83C\uDFA1',
  shield:     '\uD83D\uDEE1\uFE0F',
  'arrow-up': '\u2B06\uFE0F',
};

/**
 * Format a timestamp as relative time.
 * @param {string|Date} ts
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRelativeTime(ts, now = new Date()) {
  const date = new Date(ts);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/**
 * Initialise the activity feed widget.
 *
 * @param {string}   memberId  Member whose activity to display
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getActivityFeed]
 * @param {Date}     [opts.now] — override current time for testing relative times
 */
export async function initActivityFeedWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getActivityFeed = opts.getActivityFeed ?? ((id, limit) => _defaultGetActivityFeed(id, limit));
  const now = opts.now ?? new Date();

  try { $w('#activityTitle').text = 'Recent Activity'; } catch {}

  let activities;
  try {
    activities = await getActivityFeed(memberId, 10);
  } catch {
    activities = null;
  }

  if (!activities || activities.length === 0) {
    try {
      $w('#activityEmpty').text = 'No activity yet — start earning points!';
      $w('#activityEmpty').show();
    } catch {}
    try { $w('#activityRepeater').hide(); } catch {}
    return;
  }

  try { $w('#activityEmpty').hide(); } catch {}
  try { $w('#activityRepeater').show(); } catch {}

  try {
    $w('#activityRepeater').data = activities;
  } catch {}

  try {
    $w('#activityRepeater').onItemReady(($item, itemData) => {
      try { $item('#activityIcon').text = ICON_MAP[itemData.iconType] ?? ICON_MAP.cart; } catch {}
      try { $item('#activityDesc').text = itemData.description; } catch {}
      try {
        $item('#activityPoints').text = itemData.pointsEarned > 0
          ? `+${itemData.pointsEarned} pts`
          : '';
      } catch {}
      try {
        $item('#activityTime').text = itemData.timestamp
          ? formatRelativeTime(itemData.timestamp, now)
          : '';
      } catch {}
    });
  } catch {}
}
