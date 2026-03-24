/**
 * @module StreakTrackerWidget
 * @description Member dashboard widget displaying current streak, longest streak,
 * flame icon (active at ≥3 days), and streak multiplier label.
 *
 * Elements:
 *   #streakCount           — "N day streak"
 *   #longestStreak         — "Best: N days"
 *   #streakFlameIcon       — Shown/hidden based on streak ≥ 3; class "streak-active"
 *   #streakMultiplierLabel — "2x" (days 3–6) or "3x" (days 7+); hidden when < 3
 *   #noStreakMsg           — Shown on fetch error or null result
 *
 * CF-4xnp
 */

import { getStreakData as _defaultGetStreakData } from 'backend/gamificationEventReceiver.web';

function multiplierLabel(streak) {
  if (streak >= 7) return '3x';
  if (streak >= 3) return '2x';
  return null;
}

function showError($w) {
  try { $w('#noStreakMsg').show(); } catch (_) {}
  try { $w('#streakCount').hide(); } catch (_) {}
  try { $w('#longestStreak').hide(); } catch (_) {}
  try { $w('#streakFlameIcon').hide(); } catch (_) {}
  try { $w('#streakMultiplierLabel').hide(); } catch (_) {}
}

/**
 * Initialise the streak tracker widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getStreakData]
 */
export async function initStreakTrackerWidget(memberId, opts = {}) {
  const $w           = opts.$w ?? globalThis.$w;
  const getStreakData = opts.getStreakData ?? ((id) => _defaultGetStreakData(id));

  let data;
  try {
    data = await getStreakData(memberId);
  } catch (e) {
    showError($w);
    return;
  }

  if (!data) {
    showError($w);
    return;
  }

  const { currentStreak, longestStreak } = data;

  try { $w('#streakCount').text = `${currentStreak} day streak`; } catch (_) {}
  try { $w('#longestStreak').text = `Best: ${longestStreak} days`; } catch (_) {}

  if (currentStreak >= 3) {
    try { $w('#streakFlameIcon').show(); } catch (_) {}
    try { $w('#streakFlameIcon').addClass('streak-active'); } catch (_) {}
  } else {
    try { $w('#streakFlameIcon').hide(); } catch (_) {}
  }

  const label = multiplierLabel(currentStreak);
  if (label) {
    try { $w('#streakMultiplierLabel').text = label; } catch (_) {}
    try { $w('#streakMultiplierLabel').show(); } catch (_) {}
  } else {
    try { $w('#streakMultiplierLabel').hide(); } catch (_) {}
  }
}
