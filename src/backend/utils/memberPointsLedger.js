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
