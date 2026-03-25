/**
 * @module MilestoneNudgeToast
 * @description Slide-in toast notifications when members are close to milestones.
 * Checks milestone proximity on init, shows toast for each nudge.
 * Dismissed toasts are suppressed for 24h via localStorage.
 *
 * Elements:
 *   #milestoneToast      — Toast container (show/hide)
 *   #milestoneToastText  — Text: "Just 100 more points to Mountain Guide!"
 *   #milestoneToastClose — Dismiss button
 *
 * CF-cgpy
 */

import { checkMilestoneProximity as _defaultCheckMilestoneProximity } from 'backend/gamificationEventReceiver.web';

const SUPPRESS_KEY_PREFIX = 'milestone_nudge_dismissed_';
const SUPPRESS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a nudge was recently dismissed.
 * @param {string} milestoneKey
 * @param {Object} storage - localStorage-compatible object
 * @param {number} now - current timestamp ms
 * @returns {boolean}
 */
export function isSuppressed(milestoneKey, storage, now) {
  const key = `${SUPPRESS_KEY_PREFIX}${milestoneKey}`;
  const val = storage.getItem(key);
  if (!val) return false;
  const dismissedAt = parseInt(val, 10);
  return (now - dismissedAt) < SUPPRESS_DURATION_MS;
}

/**
 * Mark a nudge as dismissed.
 * @param {string} milestoneKey
 * @param {Object} storage
 * @param {number} now
 */
export function suppressNudge(milestoneKey, storage, now) {
  const key = `${SUPPRESS_KEY_PREFIX}${milestoneKey}`;
  storage.setItem(key, String(now));
}

/**
 * Format a nudge into display text.
 * @param {{ type: string, milestone: string, remaining: number }} nudge
 * @returns {string}
 */
export function formatNudgeText(nudge) {
  if (nudge.type === 'tier') {
    return `Just ${nudge.remaining} more points to ${nudge.milestone}!`;
  }
  if (nudge.type === 'streak') {
    return `Just ${nudge.remaining} more days to ${nudge.milestone}!`;
  }
  return `Almost there — ${nudge.remaining} to ${nudge.milestone}!`;
}

/**
 * Initialise the milestone nudge toast.
 *
 * @param {string}   memberId  Member to check proximity for
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.checkMilestoneProximity]
 * @param {Object}   [opts.storage] — localStorage-compatible object
 * @param {number}   [opts.now] — current timestamp ms
 */
export async function initMilestoneNudgeToast(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const checkProximity = opts.checkMilestoneProximity ?? ((id) => _defaultCheckMilestoneProximity(id));
  const storage = opts.storage ?? globalThis.localStorage;
  const now = opts.now ?? Date.now();

  // Hide toast initially
  try { $w('#milestoneToast').hide(); } catch {}

  let nudges;
  try {
    nudges = await checkProximity(memberId);
  } catch {
    return;
  }

  if (!nudges || nudges.length === 0) return;

  // Find first non-suppressed nudge
  const nudge = nudges.find(n => !isSuppressed(n.milestone, storage, now));
  if (!nudge) return;

  // Show toast
  try {
    $w('#milestoneToastText').text = formatNudgeText(nudge);
    $w('#milestoneToast').show();
  } catch {}

  // Wire dismiss button
  try {
    $w('#milestoneToastClose').onClick(() => {
      suppressNudge(nudge.milestone, storage, now);
      try { $w('#milestoneToast').hide(); } catch {}
    });
  } catch {}
}
