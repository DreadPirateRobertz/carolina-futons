/**
 * socialProofBadge.web.js — PDP social proof badge backend (cf-ic1).
 *
 * Pre-auth webMethod (Permissions.Anyone) — no login required.
 * Returns the count of opted-in members in the given ZIP prefix,
 * or the national total as fallback when no valid ZIP prefix is provided.
 *
 * Consumed by PDPSocialProofBadge.js to render:
 *   "X Charlotte members competing — earn N points on this purchase"
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';

// Normalize zipPrefix: must be exactly 3 digit chars
function normalizeZipPrefix(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, 3);
  if (trimmed.length < 3 || !/^\d{3}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Returns the count of opted-in members in the given ZIP prefix.
 * Falls back to national count when zipPrefix is null/invalid.
 *
 * @param {string|null} rawZipPrefix - 3-digit ZIP prefix from client (URL param)
 * @returns {Promise<{ count: number, zipPrefix: string|null, isNational: boolean }>}
 */
export const getNeighborCount = webMethod(
  Permissions.Anyone,
  async (rawZipPrefix) => {
    try {
      const zipPrefix = normalizeZipPrefix(rawZipPrefix);

      let query = wixData
        .query(MEMBER_POINTS_COLLECTION)
        .eq('leaderboardOptIn', true);

      if (zipPrefix) {
        query = query.startsWith('zipCode', zipPrefix);
      }

      const count = await query.find({ suppressAuth: true }).then(r => r.totalCount);

      return {
        count,
        zipPrefix: zipPrefix ?? null,
        isNational: !zipPrefix,
      };
    } catch (err) {
      console.error('[socialProofBadge] getNeighborCount failed:', err);
      return { count: 0, zipPrefix: null, isNational: true };
    }
  }
);
