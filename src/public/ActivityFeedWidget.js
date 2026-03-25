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

// CF-r6r1: human-readable display names for raw event types
const EVENT_DISPLAY_NAMES = {
  gamification_add_to_cart:      'Added item to cart',
  gamification_submit_review:    'Submitted a product review',
  gamification_referral_shared:  'Shared a referral',
  gamification_referral_accepted: 'Referral accepted',
  gamification_order_complete:   'Completed a purchase',
  gamification_ar_used:          'Used AR try-on',
  gamification_wishlist_add:     'Added to wishlist',
  gamification_spin_completed:   'Completed a spin',
  streak_extended:               'Extended streak',
  streak_milestone:              'Hit a streak milestone',
  badge_earned:                  'Earned a badge',
  tier_upgraded:                 'Upgraded tier',
  quest_complete:                'Completed a quest',
  challenge_completed:           'Completed a challenge',
};

export function humanizeEventType(rawType) {
  return EVENT_DISPLAY_NAMES[rawType] ?? rawType.replace(/^gamification_/, '').replace(/_/g, ' ');
}

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
      try { $item('#activityDesc').text = humanizeEventType(itemData.description); } catch {}
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
