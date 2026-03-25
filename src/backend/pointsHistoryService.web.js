/**
 * @module pointsHistoryService
 * @description Returns recent points transaction history for the authenticated member.
 *
 * @setup
 * CMS collection "PointsTransactions" with fields:
 * - memberId (Text)     — Wix member ID
 * - points   (Number)   — Points delta (positive = earned, negative = spent)
 * - reason   (Text)     — Human-readable reason for the transaction
 * - date     (DateTime) — Transaction date
 * - type     (Text)     — "earn" | "spend"
 *
 * CF-ptth
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const COLLECTION = 'PointsTransactions';

async function requireOwnMember(memberId) {
  let member;
  try {
    member = await currentMember.getMember();
  } catch (_) {
    return { error: 'auth_required' };
  }
  if (!member || !member._id) return { error: 'auth_required' };
  if (member._id !== memberId) return { error: 'forbidden' };
  return { memberId: member._id };
}

/**
 * Return recent points transactions for the authenticated member.
 *
 * @param {string} memberId
 * @param {number} [limit=10]
 * @returns {Promise<{ transactions?: Array, error?: string }>}
 */
export const getRecentPointsHistory = webMethod(
  Permissions.SiteMember,
  async (memberId, limit = 10) => {
    const auth = await requireOwnMember(memberId);
    if (auth.error) return { error: auth.error };

    try {
      const result = await wixData
        .query(COLLECTION)
        .eq('memberId', memberId)
        .descending('date')
        .limit(limit)
        .find({ suppressAuth: true });

      return {
        transactions: result.items.map(({ points, reason, date, type }) => ({
          points,
          reason,
          date,
          type,
        })),
      };
    } catch (err) {
      console.error('[pointsHistoryService] getRecentPointsHistory failed:', err);
      return { error: 'Unable to fetch points history' };
    }
  }
);
