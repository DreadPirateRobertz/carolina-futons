// Leaderboard.js — Carolina Futons Points Leaderboard Page
// Shows ranked members by points for allTime and weekly periods.
// Backend: leaderboardService.web.js (getLeaderboardByPeriod, getMyRank)
// cf-73p

import { getLeaderboardByPeriod, getMyRank } from 'backend/leaderboardService.web';

let currentPeriod = 'allTime';
let currentMemberId = null;

$w.onReady(async function () {
  await Promise.all([
    initPeriodToggle(),
    loadLeaderboard('allTime'),
    loadMyRank(),
  ]);
});

// ── Period Toggle ────────────────────────────────────────────────────────────

function initPeriodToggle() {
  try {
    $w('#btnAllTime').onClick(() => switchPeriod('allTime'));
    $w('#btnWeekly').onClick(() => switchPeriod('weekly'));
  } catch (e) {}
}

async function switchPeriod(period) {
  if (period === currentPeriod) return;
  currentPeriod = period;

  try {
    $w('#btnAllTime').style.backgroundColor = period === 'allTime' ? '#333' : '#eee';
    $w('#btnWeekly').style.backgroundColor  = period === 'weekly'  ? '#333' : '#eee';
  } catch (e) {}

  await loadLeaderboard(period);
}

// ── Leaderboard List ─────────────────────────────────────────────────────────

async function loadLeaderboard(period) {
  try {
    $w('#leaderboardLoading').show();
    $w('#leaderboardRepeater').hide();
    $w('#leaderboardEmpty').hide();
  } catch (e) {}

  const entries = await getLeaderboardByPeriod(period, 20);

  try { $w('#leaderboardLoading').hide(); } catch (e) {}

  if (!Array.isArray(entries) || entries.length === 0) {
    try { $w('#leaderboardEmpty').show(); } catch (e) {}
    return;
  }

  try {
    $w('#leaderboardRepeater').data = entries;
    $w('#leaderboardRepeater').onItemReady(($item, itemData) => {
      try { $item('#rankText').text      = String(itemData.rank); } catch (e) {}
      try { $item('#memberName').text    = itemData.displayName ?? 'Anonymous'; } catch (e) {}
      try { $item('#memberPoints').text  = `${itemData.points.toLocaleString()} pts`; } catch (e) {}
      try { $item('#memberTier').text    = itemData.tier ?? ''; } catch (e) {}
    });
    $w('#leaderboardRepeater').show();
  } catch (e) {}
}

// ── My Rank ──────────────────────────────────────────────────────────────────

async function loadMyRank() {
  if (!currentMemberId) {
    try { $w('#myRankSection').hide(); } catch (e) {}
    return;
  }

  const rankData = await getMyRank(currentMemberId);

  if (!rankData) {
    try { $w('#myRankSection').hide(); } catch (e) {}
    return;
  }

  try {
    $w('#myRankNumber').text = `#${rankData.rank}`;
    $w('#myRankPoints').text = `${rankData.points.toLocaleString()} pts`;
    $w('#myRankTier').text   = rankData.tier ?? '';
    $w('#myRankSection').show();
  } catch (e) {}
}
