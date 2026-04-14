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
 * webMethod getLeaderboardByPeriod(period, limit) — ranked top-N with period support.
 *   period: 'allTime' | 'weekly' (default 'allTime'), limit: 1–50 (default 20).
 *   Returns {rank, memberId, displayName, points, tier}[].
 * webMethod getMyRank() — personal rank lookup; memberId resolved from session (IDOR guard).
 *
 * CMS collections:
 *   MemberPoints (read)          — memberId, displayName, totalPoints, tier, lastActivityAt
 *   LeaderboardSnapshots (write) — snapshotDate, entries, createdAt
 *
 * CF-9t0w / CF-znpj.2 / cf-73p
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { webMethod, Permissions } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';
import { MEMBER_POINTS_LEDGER_COLLECTION } from 'backend/utils/memberPointsLedger';

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

// ── Helpers for period-based leaderboard ─────────────────────────────────────

/**
 * Returns ISO start-of-week (Sunday 00:00:00 UTC) for the current week.
 * @returns {Date}
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Aggregate weekly points per member from MemberPointsLedger for the current week.
 * Returns a Map of memberId → weeklyPoints (sum of positive deltas since week start).
 * @returns {Promise<Map<string, number>>}
 */
async function aggregateWeeklyPoints() {
  const weekStart = getWeekStart();
  const totals = new Map();
  let skip = 0;
  const batchSize = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await wixData
      .query(MEMBER_POINTS_LEDGER_COLLECTION)
      .ge('timestamp', weekStart)
      .gt('delta', 0)
      .skip(skip)
      .limit(batchSize)
      .find({ suppressAuth: true });

    for (const item of result.items) {
      const id = item.memberId;
      if (id) totals.set(id, (totals.get(id) ?? 0) + (item.delta ?? 0));
    }

    if (result.items.length < batchSize) break;
    skip += batchSize;
  }

  return totals;
}

/**
 * Returns the current top-N members for a given period.
 *
 * period 'allTime' — ranked by totalPoints on MemberPoints.
 * period 'weekly'  — ranked by points earned since the start of the current week
 *                    (aggregated from MemberPointsLedger), joined with MemberPoints
 *                    for displayName and tier.
 *
 * @param {string} [period='allTime']  'allTime' | 'weekly'
 * @param {number} [limit=20]          Max entries (1–50)
 * @returns {Promise<Array<{rank: number, memberId: string, displayName: string|null, points: number, tier: string|null}>>}
 */
export const getLeaderboardByPeriod = webMethod(
  Permissions.Anyone,
  async (period = 'allTime', limit = 20) => {
    const VALID_PERIODS = ['allTime', 'weekly'];
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
    if (!VALID_PERIODS.includes(period)) {
      return { success: false, error: 'Invalid period — must be allTime or weekly' };
    }

    try {
      if (period === 'weekly') {
        // Aggregate current-week points from MemberPointsLedger
        let weeklyTotals;
        try {
          weeklyTotals = await aggregateWeeklyPoints();
        } catch (e) {
          logError('leaderboardService.getLeaderboardByPeriod.aggregateWeekly', e);
          return { success: false, error: 'Failed to aggregate weekly points.' };
        }

        if (weeklyTotals.size === 0) return [];

        // Fetch MemberPoints for the active members to get displayName, tier, opt-in status
        const memberIds = [...weeklyTotals.keys()];
        const chunkSize = 50;
        const memberRecords = new Map();
        for (let i = 0; i < memberIds.length; i += chunkSize) {
          const chunk = memberIds.slice(i, i + chunkSize);
          const res = await wixData
            .query('MemberPoints')
            .hasSome('memberId', chunk)
            .eq('leaderboardOptIn', true)
            .limit(chunkSize)
            .find({ suppressAuth: true });
          for (const item of res.items) {
            memberRecords.set(item.memberId, item);
          }
        }

        // Build ranked list: only opted-in members, sorted by weekly points desc
        const ranked = [...weeklyTotals.entries()]
          .filter(([id]) => memberRecords.has(id))
          .map(([id, pts]) => {
            const rec = memberRecords.get(id);
            return { memberId: id, points: pts, displayName: rec.displayName ?? null, tier: rec.tier ?? null };
          })
          .sort((a, b) => b.points - a.points)
          .slice(0, safeLimit)
          .map((entry, i) => ({ rank: i + 1, ...entry }));

        return ranked;
      }

      // allTime: query MemberPoints by totalPoints desc
      const result = await wixData
        .query('MemberPoints')
        .eq('leaderboardOptIn', true)
        .descending('totalPoints')
        .limit(safeLimit)
        .find({ suppressAuth: true });

      return result.items.map((item, i) => ({
        rank:        i + 1,
        memberId:    item.memberId    ?? null,
        displayName: item.displayName ?? null,
        points:      item.totalPoints ?? 0,
        tier:        item.tier        ?? null,
      }));
    } catch (e) {
      logError('leaderboardService.getLeaderboardByPeriod.query', e);
      return [];
    }
  }
);

/**
 * Returns the rank, points, and tier for the currently authenticated member.
 * Rank is the count of opted-in members with strictly more points, plus 1.
 * Returns null if unauthenticated or if the member has no MemberPoints record.
 * memberId is resolved from the Wix session — never accepted from the caller (IDOR guard).
 *
 * @returns {Promise<{rank: number, points: number, tier: string|null} | null>}
 */
/**
 * Returns the top-3 members by totalPoints for the homepage sidebar widget.
 * Fields: rank, displayName, points, tier, avatarUrl.
 * Only includes members with leaderboardOptIn: true.
 *
 * @returns {Promise<Array<{rank: number, displayName: string|null, points: number, tier: string|null, avatarUrl: string|null}>>}
 */
export const getLeaderboardPreview = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData
        .query('MemberPoints')
        .eq('leaderboardOptIn', true)
        .descending('totalPoints')
        .limit(3)
        .find({ suppressAuth: true });

      return result.items.map((item, i) => ({
        rank:        i + 1,
        displayName: item.displayName ?? null,
        points:      item.totalPoints ?? 0,
        tier:        item.tier        ?? null,
        avatarUrl:   item.avatarUrl   ?? null,
      }));
    } catch (e) {
      logError('leaderboardService.getLeaderboardPreview', e);
      return [];
    }
  }
);

export const getMyRank = webMethod(
  Permissions.SiteMember,
  async () => {
    let memberId;
    try {
      const member = await currentMember.getMember();
      memberId = member?._id ?? null;
    } catch (err) {
      logError('leaderboardService.getMyRank — getMember failed', err);
    }
    if (!memberId) return null;

    try {
      const res = await wixData
        .query('MemberPoints')
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      const record = res.items[0] ?? null;
      if (!record) return null;

      const points = record.totalPoints ?? 0;
      const tier   = record.tier ?? null;

      // Count opted-in members with strictly more points
      const aboveCount = await wixData
        .query('MemberPoints')
        .eq('leaderboardOptIn', true)
        .gt('totalPoints', points)
        .count({ suppressAuth: true });

      return { rank: aboveCount + 1, points, tier };
    } catch (e) {
      logError('leaderboardService.getMyRank', e);
      return null;
    }
  }
);
