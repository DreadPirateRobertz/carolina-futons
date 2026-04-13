/**
 * @module memberPointsLedgerService.web
 * @description Member-facing webMethod over the MemberPointsLedger audit
 * trail. Returns the caller's own points history — memberId is derived
 * from the authenticated session, never accepted from the caller, so the
 * endpoint cannot be used to enumerate another member's ledger.
 *
 * CF-qyi
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const COLLECTION = 'MemberPointsLedger';
const DEFAULT_LIMIT = 20;

/** Hard cap on page size to protect the collection + response payload. */
export const MAX_HISTORY_LIMIT = 100;

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_HISTORY_LIMIT);
}

function clampOffset(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function resolveCallerMemberId() {
  try {
    const member = await currentMember.getMember();
    if (!member || !member._id) return null;
    return member._id;
  } catch (_) {
    return null;
  }
}

/**
 * Return the authenticated member's points ledger history, paginated.
 *
 * Any positional arguments beyond (limit, offset) are ignored on purpose
 * so legacy callers can't smuggle in a memberId — it is always resolved
 * from the session.
 *
 * @param {number} [limit=20]  - Page size; capped at MAX_HISTORY_LIMIT
 * @param {number} [offset=0]  - Number of entries to skip
 * @returns {Promise<{ success: boolean, entries?: Array, total?: number, hasMore?: boolean, error?: string }>}
 */
export const getMyPointsHistory = webMethod(
  Permissions.SiteMember,
  async (limit = DEFAULT_LIMIT, offset = 0) => {
    const memberId = await resolveCallerMemberId();
    if (!memberId) {
      return { success: false, entries: [], error: 'auth_required' };
    }

    const pageSize = clampLimit(limit);
    const skip     = clampOffset(offset);

    try {
      const result = await wixData
        .query(COLLECTION)
        .eq('memberId', memberId)
        .descending('_createdDate')
        .skip(skip)
        .limit(pageSize)
        .find({ suppressAuth: true });

      const total   = result.totalCount ?? Infinity;
      const hasMore = skip + result.items.length < total;

      return {
        success: true,
        entries: result.items,
        total,
        hasMore,
      };
    } catch (err) {
      console.error('[memberPointsLedgerService] getMyPointsHistory error:', err);
      return { success: false, entries: [], error: 'Unable to fetch points history' };
    }
  }
);
