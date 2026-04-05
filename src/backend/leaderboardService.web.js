/**
 * @module leaderboardService
 * @description Weekly leaderboard snapshot service.
 *
 * webMethod getLeaderboard() — reads MemberPoints, returns top-10 sorted by
 *   totalPoints desc with rank assigned 1-based.
 * webMethod snapshotLeaderboard() — writes current top-10 to LeaderboardSnapshots
 *   with snapshotDate (YYYY-MM-DD) and entries JSON array.
 * webMethod getTopEarners(limit, offset) — paginated top-earners sorted by
 *   totalPoints desc, ties broken by lastActivityAt asc.
 *   limit: 1–100 (default 10), offset: 0–10000 (default 0).
 *
 * CMS collections:
 *   MemberPoints (read)          — memberId, displayName, totalPoints, tier, lastActivityAt
 *   LeaderboardSnapshots (write) — snapshotDate, entries, createdAt
 *
 * CF-9t0w / CF-znpj.2
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

/**
 * Returns a paginated list of top-earning members sorted by totalPoints
 * descending, with ties broken by lastActivityAt ascending.
 *
 * @param {number} [limit=10]  Max entries to return (1–100).
 * @param {number} [offset=0]  Number of entries to skip (0–10000).
 * @returns {Promise<{success: boolean, entries: Array, total: number, error?: string}>}
 */
export const getTopEarners = webMethod(
  Permissions.Anyone,
  async (limit = 10, offset = 0) => {
    if (limit <= 0) {
      return { success: false, error: 'limit must be greater than 0.' };
    }
    if (offset < 0) {
      return { success: false, error: 'offset must be 0 or greater.' };
    }

    const safeLimit  = Math.min(limit, 100);
    const safeOffset = Math.min(offset, 10000);

    try {
      const result = await wixData
        .query('MemberPoints')
        .eq('leaderboardOptIn', true)
        .descending('totalPoints')
        .ascending('lastActivityAt')
        .skip(safeOffset)
        .limit(safeLimit)
        .find({ suppressAuth: true });

      return {
        success: true,
        entries: result.items.map((item, i) => ({
          rank:           safeOffset + i + 1,
          memberId:       item.memberId       ?? null,
          displayName:    item.displayName     ?? null,
          totalPoints:    item.totalPoints     ?? 0,
          tier:           item.tier            ?? null,
          lastActivityAt: item.lastActivityAt  ?? null,
        })),
        total: result.totalCount,
      };
    } catch (e) {
      logError('leaderboardService.getTopEarners.query', e);
      return { success: false, error: 'Failed to fetch leaderboard.' };
    }
  }
);
