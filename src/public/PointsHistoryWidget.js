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
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
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

  try {
    $w('#historyRepeater').onItemReady(($item, itemData) => {
      try { $item('#historyPoints').text = formatPoints(itemData.points); } catch (_) {}
      try { $item('#historyReason').text = itemData.reason; } catch (_) {}
      try { $item('#historyDate').text = formatDate(itemData.date); } catch (_) {}
      if (itemData.points >= 0) {
        try { $item.addClass('points-earned'); } catch (_) {}
      } else {
        try { $item.addClass('points-spent'); } catch (_) {}
      }
    });
  } catch (_) {}

  try { $w('#historyRepeater').data = transactions; } catch (_) {}
}
