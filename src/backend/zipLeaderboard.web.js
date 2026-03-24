/**
 * zipLeaderboard.web.js — ZIP-code micro-leaderboard webMethod.
 *
 * Groups MemberPoints by the first 3 digits of zipCode and returns the
 * ranked leaderboard for the caller's ZIP prefix.
 * Only members who have opted in (leaderboardOptIn: true) appear.
 *
 * cf-lx5 (CF-p5v2)
 */

import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';
const LEADERBOARD_CAP = 10;

/**
 * Returns the ZIP micro-leaderboard for the calling member's 3-digit prefix.
 * Caller identity is resolved server-side via currentMember.getMember() —
 * no memberId parameter accepted (prevents cross-member ZIP probing).
 *
 * @returns {Promise<{ leaderboard: Array, myRank: number|null, zipPrefix: string|null }>}
 */
export const getZipLeaderboard = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      const memberId = member?._id ?? null;
      if (!memberId) return { leaderboard: [], myRank: null, zipPrefix: null };

      // Fetch caller's MemberPoints to get their zipCode
      const meResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .eq('memberId', memberId)
        .find({ suppressAuth: true });

      const me = meResult.items[0];
      if (!me || !me.zipCode || me.zipCode.length < 3) {
        return { leaderboard: [], myRank: null, zipPrefix: null };
      }

      const zipPrefix = me.zipCode.slice(0, 3);

      // Fetch top-LEADERBOARD_CAP opted-in members in this ZIP prefix.
      // Server-side sort+limit avoids Wix's 50-item page cap truncating the
      // sort input for large ZIP clusters.
      const prefixResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .startsWith('zipCode', zipPrefix)
        .eq('leaderboardOptIn', true)
        .descending('totalPoints')
        .limit(LEADERBOARD_CAP)
        .find({ suppressAuth: true });

      // Determine whether the caller appears in the top-LEADERBOARD_CAP.
      // myRank stays null if they ranked outside the cap or haven't opted in
      // (non-opted-in caller's record is fetched in query 1 but absent from query 2).
      let myRank = null;
      const leaderboard = prefixResult.items.map((item, idx) => {
        const rank = idx + 1;
        const isMe = item.memberId === memberId;
        if (isMe) myRank = rank;
        return {
          rank,
          memberId: item.memberId,
          displayName: item.displayName || '',
          totalPoints: item.totalPoints ?? 0,
          isMe,
        };
      });

      // zipPrefix is common to all entries — returned once at the top level.
      return { leaderboard, myRank, zipPrefix };
    } catch (err) {
      logError('getZipLeaderboard — failed', err);
      return { leaderboard: [], myRank: null, zipPrefix: null };
    }
  }
);
