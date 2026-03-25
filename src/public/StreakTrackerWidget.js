/**
 * @module StreakTrackerWidget
 * @description Displays current streak and streak calendar on member dashboard.
 *
 * Elements:
 *   #streakCount           — Text: "N day streak"
 *   #longestStreak         — Text: "Best: N days"
 *   #streakFlameIcon       — Show if currentStreak >= 3 (class "streak-active"), hide otherwise
 *   #streakMultiplierLabel — Text: "2x" if streak 3-6, "3x" if streak 7+, hidden if < 3
 *   #noStreakMsg           — Shown on error or null data
 *
 * CF-4xnp
 */

import { getStreakData as _defaultGetStreakData } from 'backend/gamificationEventReceiver.web';

/**
 * Initialise the streak tracker widget.
 *
 * @param {string}   memberId  Member whose streak to display
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getStreakData]
 */
export async function initStreakTrackerWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getStreakData = opts.getStreakData ?? ((id) => _defaultGetStreakData(id));

  let data;
  try {
    data = await getStreakData(memberId);
  } catch {
    data = null;
  }

  if (!data) {
    try { $w('#noStreakMsg').show(); } catch {}
    try { $w('#streakCount').hide(); } catch {}
    try { $w('#longestStreak').hide(); } catch {}
    try { $w('#streakFlameIcon').hide(); } catch {}
    try { $w('#streakMultiplierLabel').hide(); } catch {}
    return;
  }

  const streak = data.currentStreak ?? 0;

  try { $w('#streakCount').text = `${streak} day streak`; } catch {}
  try { $w('#longestStreak').text = `Best: ${data.longestStreak ?? 0} days`; } catch {}

  // Flame icon: show with "streak-active" class if streak >= 3
  if (streak >= 3) {
    try {
      $w('#streakFlameIcon').show();
      $w('#streakFlameIcon').addClass('streak-active');
    } catch {}
  } else {
    try { $w('#streakFlameIcon').hide(); } catch {}
  }

  // Multiplier label
  if (streak >= 7) {
    try {
      $w('#streakMultiplierLabel').text = '3x';
      $w('#streakMultiplierLabel').show();
    } catch {}
  } else if (streak >= 3) {
    try {
      $w('#streakMultiplierLabel').text = '2x';
      $w('#streakMultiplierLabel').show();
    } catch {}
  } else {
    try { $w('#streakMultiplierLabel').hide(); } catch {}
  }
}
