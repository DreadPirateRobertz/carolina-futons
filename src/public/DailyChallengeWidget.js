/**
 * @module DailyChallengeWidget
 * @description Member dashboard widget displaying active quest progress.
 *
 * Elements:
 *   #challengeRepeater   — Repeater displaying active quests
 *   #noChallengesMsg     — Message shown when no quests are active
 *
 * Repeater item elements:
 *   #challengeTitle        — Quest title (falls back to questId)
 *   #challengeProgress     — "N / M completed"
 *   #challengeCompleteIcon — Shown when current >= target
 *
 * CF-ti2e
 */

import { getActiveQuests as _defaultGetActiveQuests } from 'backend/questProgressService.web';

function renderQuests($w, quests) {
  if (!quests || quests.length === 0) {
    try { $w('#noChallengesMsg').show(); } catch (e) {}
    try { $w('#challengeRepeater').hide(); } catch (e) {}
    return;
  }

  try { $w('#noChallengesMsg').hide(); } catch (e) {}
  try { $w('#challengeRepeater').show(); } catch (e) {}
  try { $w('#challengeRepeater').data = quests; } catch (e) {}

  try {
    $w('#challengeRepeater').onItemReady(($item, $w2, item) => {
      try { $w2('#challengeTitle').text = item.title ?? item.questId; } catch (e) {}
      try { $w2('#challengeProgress').text = `${item.current} / ${item.target} completed`; } catch (e) {}
      if (item.current >= item.target) {
        try { $w2('#challengeCompleteIcon').show(); } catch (e) {}
      } else {
        try { $w2('#challengeCompleteIcon').hide(); } catch (e) {}
      }
    });
  } catch (e) {}
}

/**
 * Initialise the daily challenge widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getActiveQuests]
 */
export async function initDailyChallengeWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getActiveQuests = opts.getActiveQuests ?? ((id) => _defaultGetActiveQuests(id));

  let quests;
  try {
    quests = await getActiveQuests(memberId);
  } catch (e) {
    try { $w('#noChallengesMsg').show(); } catch (_) {}
    try { $w('#challengeRepeater').hide(); } catch (_) {}
    return;
  }

  renderQuests($w, quests);
}

/**
 * Re-fetch active quests and refresh the widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 */
export async function refreshChallenges(memberId, opts = {}) {
  return initDailyChallengeWidget(memberId, opts);
}
