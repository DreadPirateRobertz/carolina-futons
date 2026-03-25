/**
 * @module ChallengeOfTheWeekWidget
 * @description Community collective challenge with shared progress bar.
 * All members contribute toward a single weekly goal.
 *
 * Elements:
 *   #weeklyTitle       — Challenge title (e.g. "Community Challenge: 500 Orders!")
 *   #weeklyDesc        — Challenge description
 *   #weeklyProgress    — Progress text (e.g. "342 / 500")
 *   #weeklyProgressBar — Progress bar element (width set as percentage)
 *   #weeklyReward      — Reward label (e.g. "Everyone earns 200 pts!")
 *   #weeklyTimer       — Time remaining (e.g. "3d 14h left")
 *   #weeklyContributors — Contributor count (e.g. "127 members contributing")
 *   #weeklyComplete    — Shown when challenge is complete, hidden otherwise
 *   #weeklyContainer   — Outer container (collapsed when no active challenge)
 *   #weeklyError       — Shown on fetch error
 *
 * CF-8lj8
 */

import { getWeeklyChallenge as _defaultGetWeeklyChallenge } from 'backend/gamificationEventReceiver.web';

const TIMER_INTERVAL_MS = 60_000;

let _timerInterval;

/**
 * Format time remaining as "Nd Nh left" or "< 1h left".
 * @param {string|Date} expiresAt
 * @returns {string}
 */
function formatTimeRemaining(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return '< 1h left';
}

/**
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getWeeklyChallenge]
 */
export async function initChallengeOfTheWeekWidget(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getWeeklyChallenge = opts.getWeeklyChallenge ?? _defaultGetWeeklyChallenge;

  let challenge;
  try {
    challenge = await getWeeklyChallenge();
  } catch (err) {
    console.error('[ChallengeOfTheWeekWidget] failed to load', err);
    try { $w('#weeklyError').show(); } catch {}
    try { $w('#weeklyContainer').collapse(); } catch {}
    return;
  }

  if (!challenge) {
    try { $w('#weeklyContainer').collapse(); } catch {}
    return;
  }

  try { $w('#weeklyError').hide(); } catch {}
  try { $w('#weeklyContainer').expand(); } catch {}

  // Title & description
  try { $w('#weeklyTitle').text = challenge.title; } catch {}
  try { $w('#weeklyDesc').text = challenge.description ?? ''; } catch {}

  // Progress
  const current = challenge.currentTotal ?? 0;
  const target = challenge.targetCount ?? 1;
  const pct = Math.min(Math.round((current / target) * 100), 100);

  try { $w('#weeklyProgress').text = `${current.toLocaleString()} / ${target.toLocaleString()}`; } catch {}
  try { $w('#weeklyProgressBar').style.width = `${pct}%`; } catch {}

  // Reward
  if (challenge.rewardPoints > 0) {
    try { $w('#weeklyReward').text = `Everyone earns ${challenge.rewardPoints.toLocaleString()} pts!`; } catch {}
  }

  // Contributors
  try {
    $w('#weeklyContributors').text = challenge.contributorCount === 1
      ? '1 member contributing'
      : `${challenge.contributorCount.toLocaleString()} members contributing`;
  } catch {}

  // Complete state
  if (challenge.isComplete) {
    try { $w('#weeklyComplete').show(); } catch {}
    try { $w('#weeklyTimer').text = 'Complete!'; } catch {}
  } else {
    try { $w('#weeklyComplete').hide(); } catch {}

    // Countdown timer
    if (_timerInterval) clearInterval(_timerInterval);
    try { $w('#weeklyTimer').text = formatTimeRemaining(challenge.expiresAt); } catch {}
    _timerInterval = setInterval(() => {
      try { $w('#weeklyTimer').text = formatTimeRemaining(challenge.expiresAt); } catch {}
    }, TIMER_INTERVAL_MS);
  }
}
