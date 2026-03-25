/**
 * @module GamificationSocialToast
 * @description Social proof toasts for member achievements (badges, tier ups).
 * Cycles through recent achievements every 30s. Dismissed achievements
 * suppressed for 1h via localStorage.
 *
 * Elements:
 *   #socialToast   — Toast container (show/hide)
 *   #socialText    — Text: "Alex just earned the First Purchase badge!"
 *   #socialDismiss — Dismiss button
 *
 * CF-cj4l
 */

import { getRecentAchievements as _defaultGetRecentAchievements } from 'backend/gamificationEventReceiver.web';

const SUPPRESS_KEY_PREFIX = 'social_proof_dismissed_';
const SUPPRESS_DURATION_MS = 60 * 60 * 1000; // 1 hour
const CYCLE_INTERVAL_MS = 30 * 1000; // 30 seconds

function achievementKey(a) {
  return `${a.achievementType}_${a.achievementName}`;
}

export function isSuppressed(achievement, storage, now) {
  const key = `${SUPPRESS_KEY_PREFIX}${achievementKey(achievement)}`;
  const val = storage.getItem(key);
  if (!val) return false;
  return (now - parseInt(val, 10)) < SUPPRESS_DURATION_MS;
}

export function suppressAchievement(achievement, storage, now) {
  const key = `${SUPPRESS_KEY_PREFIX}${achievementKey(achievement)}`;
  storage.setItem(key, String(now));
}

export function formatSocialText(achievement) {
  const name = achievement.memberNickname;
  if (achievement.achievementType === 'badge_earned') {
    return `${name} just earned the ${achievement.achievementName} badge!`;
  }
  if (achievement.achievementType === 'tier_upgraded') {
    return `${name} just reached ${achievement.achievementName}!`;
  }
  return `${name} achieved ${achievement.achievementName}!`;
}

/**
 * Initialise the gamification social proof toast.
 *
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getRecentAchievements]
 * @param {Object}   [opts.storage]
 * @param {number}   [opts.now]
 * @param {Function} [opts.setInterval]
 * @param {Function} [opts.onCycle] — test callback
 */
export async function initGamificationSocialToast(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getRecent = opts.getRecentAchievements ?? ((limit) => _defaultGetRecentAchievements(limit));
  const storage = opts.storage ?? globalThis.localStorage;
  const now = opts.now ?? Date.now();
  const _setInterval = opts.setInterval ?? globalThis.setInterval;

  try { $w('#socialToast').hide(); } catch {}

  let achievements;
  try {
    achievements = await getRecent(5);
  } catch {
    return;
  }

  if (!achievements || achievements.length === 0) return;

  const available = achievements.filter(a => !isSuppressed(a, storage, now));
  if (available.length === 0) return;

  let currentIdx = 0;

  function showCurrent() {
    if (currentIdx >= available.length) return;
    const a = available[currentIdx];
    try {
      $w('#socialText').text = formatSocialText(a);
      $w('#socialToast').show();
    } catch {}
    if (opts.onCycle) opts.onCycle(a, currentIdx);
  }

  showCurrent();

  try {
    $w('#socialDismiss').onClick(() => {
      const a = available[currentIdx];
      suppressAchievement(a, storage, now);
      try { $w('#socialToast').hide(); } catch {}
      currentIdx++;
      if (currentIdx < available.length) {
        showCurrent();
      }
    });
  } catch {}

  if (available.length > 1) {
    _setInterval(() => {
      currentIdx = (currentIdx + 1) % available.length;
      showCurrent();
    }, CYCLE_INTERVAL_MS);
  }
}
