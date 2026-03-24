/**
 * @module PointsHistoryWidget
 * @description Member dashboard widget displaying recent points transactions.
 *
 * Elements:
 *   #historyRepeater — Repeater listing recent transactions
 *   #noHistoryMsg    — Message shown when there are no transactions
 *
 * Repeater item elements:
 *   #historyPoints — "+N pts" or "-N pts"
 *   #historyReason — Transaction reason text
 *   #historyDate   — Date formatted as MM/DD/YYYY
 *
 * CF-ptth
 */

import { getRecentPointsHistory as _defaultGetHistory } from 'backend/pointsHistoryService.web';

function formatDate(dateStr) {
  // dateStr is "YYYY-MM-DD" — reformat to "MM/DD/YYYY"
  const [year, month, day] = String(dateStr).split('-');
  return `${month}/${day}/${year}`;
}

function formatPoints(points) {
  return points >= 0 ? `+${points} pts` : `${points} pts`;
}

/**
 * Initialise the points history widget.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getRecentPointsHistory]
 */
export async function initPointsHistoryWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getRecentPointsHistory = opts.getRecentPointsHistory ?? ((id) => _defaultGetHistory(id));

  let transactions;
  try {
    const result = await getRecentPointsHistory(memberId);
    transactions = result.transactions ?? [];
  } catch (e) {
    try { $w('#noHistoryMsg').show(); } catch (_) {}
    try { $w('#historyRepeater').hide(); } catch (_) {}
    return;
  }

  if (!transactions.length) {
    try { $w('#noHistoryMsg').show(); } catch (_) {}
    try { $w('#historyRepeater').hide(); } catch (_) {}
    return;
  }

  try { $w('#noHistoryMsg').hide(); } catch (_) {}
  try { $w('#historyRepeater').show(); } catch (_) {}
  try { $w('#historyRepeater').data = transactions; } catch (_) {}

  try {
    $w('#historyRepeater').onItemReady(($item, $w2, item) => {
      try { $w2('#historyPoints').text = formatPoints(item.points); } catch (_) {}
      try { $w2('#historyReason').text = item.reason; } catch (_) {}
      try { $w2('#historyDate').text = formatDate(item.date); } catch (_) {}
      if (item.points >= 0) {
        try { $item.addClass('points-earned'); } catch (_) {}
      } else {
        try { $item.addClass('points-spent'); } catch (_) {}
      }
    });
  } catch (_) {}
}
