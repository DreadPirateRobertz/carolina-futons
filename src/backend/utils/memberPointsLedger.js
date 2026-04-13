/**
 * MemberPointsLedger — immutable audit trail for all point mutations.
 * Inserted after every points earn, bonus, burn, recovery, or admin adjustment.
 * CF-ela
 */
import wixData from 'wix-data';

export const MEMBER_POINTS_LEDGER_COLLECTION = 'MemberPointsLedger';

/**
 * Insert an immutable audit record into MemberPointsLedger.
 *
 * @param {object} params
 * @param {string}      params.memberId         - Member ID
 * @param {string}      [params.traceId]        - Unique trace ID; auto-generated if omitted
 * @param {string}      params.operationType    - 'earn' | 'bonus' | 'burn' | 'recovery' | 'admin_adjust'
 * @param {number}      params.delta            - Points change (positive = earn, negative = burn)
 * @param {string}      params.reason           - Human-readable reason (e.g. event name, prize type)
 * @param {number}      params.previousBalance  - Points balance before this mutation
 * @param {number}      params.newBalance       - Points balance after this mutation
 * @param {object|null} [params.sourceData]     - Optional extra context; stored as JSON string
 * @returns {Promise<void>}
 */
export async function insertLedgerEntry({
  memberId,
  traceId,
  operationType,
  delta,
  reason,
  previousBalance,
  newBalance,
  sourceData,
}) {
  await wixData.insert(
    MEMBER_POINTS_LEDGER_COLLECTION,
    {
      memberId,
      traceId: traceId || `${memberId}_${Date.now()}`,
      operationType,
      delta,
      reason,
      previousBalance,
      newBalance,
      sourceData: sourceData != null ? JSON.stringify(sourceData) : null,
      timestamp: new Date(),
    },
    { suppressAuth: true }
  );
}

/**
 * Query paginated points history for a member.
 *
 * @param {string} memberId
 * @param {number} [limit=20]  - Max entries to return
 * @param {number} [offset=0]  - Number of entries to skip (pagination)
 * @returns {Promise<{ success: boolean, entries: Array, total: number, error?: string }>}
 */
export async function getPointsHistory(memberId, limit = 20, offset = 0) {
  try {
    const result = await wixData
      .query(MEMBER_POINTS_LEDGER_COLLECTION)
      .eq('memberId', memberId)
      .descending('_createdDate')
      .skip(offset)
      .limit(limit)
      .find({ suppressAuth: true });
    return { success: true, entries: result.items, total: result.totalCount };
  } catch (err) {
    console.error('[memberPointsLedger] getPointsHistory error:', err);
    return { success: false, entries: [], error: err.message };
  }
}
