/**
 * zipLeaderboard.web.js — ZIP-code micro-leaderboard webMethod.
 *
 * Groups MemberPoints by the first 3 digits of zipCode and returns the
 * ranked leaderboard for the requesting member's ZIP prefix.
 *
 * cf-lx5 (CF-p5v2: Phase 5 v2)
 */

import { Permissions, webMethod } from 'wix-web-module';
import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';
const LEADERBOARD_CAP = 10;

/**
 * Returns the ZIP micro-leaderboard for the requesting member's 3-digit prefix.
 *
 * @param {string} memberId
 * @returns {Promise<{ leaderboard: Array, myRank: number|null }>}
 */
export const getZipLeaderboard = webMethod(
  Permissions.Member,
  async (memberId) => {
    if (!memberId) return { leaderboard: [], myRank: null };

    try {
      // Fetch requesting member's record to get their zipCode
      const meResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .eq('memberId', memberId)
        .find({ suppressAuth: true });

      const me = meResult.items[0];
      if (!me || !me.zipCode || me.zipCode.length < 3) {
        return { leaderboard: [], myRank: null };
      }

      const zipPrefix = me.zipCode.slice(0, 3);

      // Fetch all members sharing the same 3-digit prefix
      const prefixResult = await wixData
        .query(MEMBER_POINTS_COLLECTION)
        .startsWith('zipCode', zipPrefix)
        .find({ suppressAuth: true });

      // Sort by totalPoints desc, cap at LEADERBOARD_CAP
      const sorted = prefixResult.items
        .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
        .slice(0, LEADERBOARD_CAP);

      let myRank = null;
      const leaderboard = sorted.map((member, idx) => {
        const rank = idx + 1;
        const isMe = member.memberId === memberId;
        if (isMe) myRank = rank;
        return {
          rank,
          memberId: member.memberId,
          displayName: member.displayName || '',
          totalPoints: member.totalPoints || 0,
          zipPrefix,
          isMe,
        };
      });

      return { leaderboard, myRank };
    } catch (err) {
      logError(`getZipLeaderboard — failed for member ${memberId}`, err);
      return { leaderboard: [], myRank: null };
    }
  }
);
