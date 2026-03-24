/**
 * @module leaderboardService
 * @description Weekly leaderboard snapshot service.
 *
 * webMethod getLeaderboard() — reads MemberPoints, returns top-10 sorted by
 *   totalPoints desc with rank assigned 1-based.
 * webMethod snapshotLeaderboard() — writes current top-10 to LeaderboardSnapshots
 *   with snapshotDate (YYYY-MM-DD) and entries JSON array.
 *
 * CMS collections:
 *   MemberPoints (read)          — memberId, displayName, totalPoints, tier
 *   LeaderboardSnapshots (write) — snapshotDate, entries, createdAt
 *
 * CF-9t0w
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

/**
 * Query top-10 from MemberPoints, ranked 1-based.
 * @returns {Promise<Array<{rank,memberId,displayName,totalPoints,tier}>>}
 */
async function fetchTop10() {
  const result = await wixData
    .query('MemberPoints')
    .eq('leaderboardOptIn', true)
    .descending('totalPoints')
    .limit(10)
    .find({ suppressAuth: true });

  return result.items.map((item, i) => ({
    rank:        i + 1,
    memberId:    item.memberId    ?? null,
    displayName: item.displayName ?? null,
    totalPoints: item.totalPoints ?? 0,
    tier:        item.tier        ?? null,
  }));
}

/**
 * Returns the current top-10 members sorted by totalPoints descending.
 * @returns {Promise<Array<{rank,memberId,displayName,totalPoints,tier}>>}
 */
export const getLeaderboard = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      return await fetchTop10();
    } catch (e) {
      logError('leaderboardService.getLeaderboard.query', e);
      return [];
    }
  }
);

/**
 * Writes the current top-10 snapshot to LeaderboardSnapshots.
 * @returns {Promise<{success: boolean, snapshotDate: string}>}
 */
export const snapshotLeaderboard = webMethod(
  Permissions.Admin,
  async () => {
    const snapshotDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    let entries;
    try {
      entries = await fetchTop10();
    } catch (e) {
      logError('leaderboardService.snapshotLeaderboard.fetch', e);
      return { success: false, snapshotDate };
    }

    try {
      await wixData.insert('LeaderboardSnapshots', {
        snapshotDate,
        entries: JSON.stringify(entries),
        createdAt: new Date().toISOString(),
      }, { suppressAuth: true });
    } catch (e) {
      logError('leaderboardService.snapshotLeaderboard.insert', e);
      return { success: false, snapshotDate };
    }

    return { success: true, snapshotDate };
  }
);
