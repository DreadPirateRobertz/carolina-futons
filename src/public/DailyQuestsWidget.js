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

let _timerInterval;

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

function showErrorState($w) {
  try { $w('#questsError').show(); } catch {}
  try { $w('#questsRepeater').hide(); } catch {}
  try { $w('#questsTimer').hide(); } catch {}
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
  const getDailyQuests = opts.getDailyQuests ?? _defaultGetDailyQuests;

  let quests;
  try {
    quests = await getDailyQuests(memberId);
  } catch (err) {
    console.error('[DailyQuestsWidget] failed to load quests', err);
    showErrorState($w);
    return;
  }

  // Handle error-shape response from backend (e.g. { error: 'service_unavailable' })
  if (quests && quests.error) {
    showErrorState($w);
    return;
  }

  // getDailyQuests returns a flat array; non-arrays are treated as empty
  const questList = Array.isArray(quests) ? quests : [];

  try { $w('#questsError').hide(); } catch {}

  if (questList.length === 0) {
    try { $w('#questsTitle').text = 'No Quests Today'; } catch {}
    try { $w('#questsRepeater').hide(); } catch {}
    return;
  }

  try { $w('#questsTitle').text = 'Daily Quests'; } catch {}
  try { $w('#questsRepeater').show(); } catch {}

  // Register onItemReady BEFORE setting data (Wix best practice)
  try {
    $w('#questsRepeater').onItemReady(($item, itemData) => {
      try { $item('#questName').text = itemData.title ?? itemData.questId; } catch {}
      try { $item('#questDesc').text = itemData.description ?? ''; } catch {}
      try { $item('#questProgress').text = `${itemData.currentProgress} / ${itemData.targetProgress}`; } catch {}
      try { $item('#questReward').text = `${itemData.pointsReward} pts`; } catch {}
      if (itemData.isComplete) {
        try { $item('#questCheckmark').show(); } catch {}
      } else {
        try { $item('#questCheckmark').hide(); } catch {}
      }
    });
  } catch {}

  try { $w('#questsRepeater').data = questList; } catch {}

  // Countdown timer to midnight UTC — clear previous interval on re-init
  if (_timerInterval) clearInterval(_timerInterval);
  try { $w('#questsTimer').text = formatTimeToMidnight(); } catch {}
  _timerInterval = setInterval(() => {
    try { $w('#questsTimer').text = formatTimeToMidnight(); } catch {}
  }, TIMER_INTERVAL_MS);
}
