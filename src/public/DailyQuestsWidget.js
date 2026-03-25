/**
 * @module DailyQuestsWidget
 * @description Member dashboard widget showing daily quests with progress bars,
 * checkmarks, rewards, and a countdown timer to midnight reset.
 *
 * Elements:
 *   #questsTitle     — "Daily Quests" heading (or "No Quests Today" when empty)
 *   #questsRepeater  — Repeater for quest items
 *   #questsTimer     — Countdown to midnight UTC (e.g. "4h 30m")
 *   #questsError     — Shown on fetch error
 *
 * Repeater item elements:
 *   #questName       — Quest title (falls back to questId)
 *   #questDesc       — Quest description
 *   #questProgress   — "N / M" progress text
 *   #questReward     — "N pts" reward label
 *   #questCheckmark  — Shown when quest isComplete, hidden otherwise
 *
 * CF-8t8z
 */

import { getDailyQuests as _defaultGetDailyQuests } from 'backend/gamificationEventReceiver.web';

const TIMER_INTERVAL_MS = 60_000;

/**
 * Format time remaining until next midnight UTC as "Nh Mm".
 * @returns {string}
 */
function formatTimeToMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  const diffMs = midnight - now;
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

/**
 * Initialise the daily quests widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getDailyQuests]
 */
export async function initDailyQuestsWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getDailyQuests = opts.getDailyQuests ?? ((id) => _defaultGetDailyQuests(id));

  let quests;
  try {
    quests = await getDailyQuests(memberId);
  } catch {
    try { $w('#questsError').show(); } catch {}
    try { $w('#questsRepeater').hide(); } catch {}
    try { $w('#questsTimer').hide(); } catch {}
    return;
  }

  // Handle error-shape response (e.g. { error: 'auth_required' })
  if (quests && quests.error) {
    try { $w('#questsError').show(); } catch {}
    try { $w('#questsRepeater').hide(); } catch {}
    try { $w('#questsTimer').hide(); } catch {}
    return;
  }

  // Normalise: accept raw array or { quests: [...] }
  const questList = Array.isArray(quests) ? quests : [];

  try { $w('#questsError').hide(); } catch {}

  if (questList.length === 0) {
    try { $w('#questsTitle').text = 'No Quests Today'; } catch {}
    try { $w('#questsRepeater').hide(); } catch {}
    return;
  }

  try { $w('#questsTitle').text = 'Daily Quests'; } catch {}
  try { $w('#questsRepeater').show(); } catch {}
  try { $w('#questsRepeater').data = questList; } catch {}

  try {
    $w('#questsRepeater').onItemReady(($item, $w2, item) => {
      try { $w2('#questName').text = item.title ?? item.questId; } catch {}
      try { $w2('#questDesc').text = item.description ?? ''; } catch {}
      try { $w2('#questProgress').text = `${item.currentProgress} / ${item.targetProgress}`; } catch {}
      try { $w2('#questReward').text = `${item.pointsReward} pts`; } catch {}
      if (item.isComplete) {
        try { $w2('#questCheckmark').show(); } catch {}
      } else {
        try { $w2('#questCheckmark').hide(); } catch {}
      }
    });
  } catch {}

  // Countdown timer to midnight UTC
  try { $w('#questsTimer').text = formatTimeToMidnight(); } catch {}
  setInterval(() => {
    try { $w('#questsTimer').text = formatTimeToMidnight(); } catch {}
  }, TIMER_INTERVAL_MS);
}
