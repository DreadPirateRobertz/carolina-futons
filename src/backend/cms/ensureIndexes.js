/**
 * @module ensureIndexes
 * @description One-time CMS index setup for Carolina Futons.
 *
 * Run ensurePointsLedgerIndex() once from an admin HTTP function or the
 * Wix Dashboard console after deploying cf-7mr. The function is idempotent —
 * it skips creation if the index already exists.
 *
 * Wix unique indexes are single-field only. The compound (memberId, milestone)
 * uniqueness is encoded as a single computed key field: memberMilestoneKey
 * (format: "<memberId>:<milestone>"). recordStreakMilestoneEvent() writes this
 * field on every insert; the index below enforces uniqueness at the DB level.
 *
 * @requires wix-data-index-service-v2
 */
import { indexes } from 'wix-data-index-service-v2';

const POINTS_LEDGER_COLLECTION = 'PointsLedger';
const MEMBER_MILESTONE_INDEX_NAME = 'memberMilestoneKey_unique';

/**
 * Ensure the PointsLedger collection has a unique index on `memberMilestoneKey`.
 * Safe to call repeatedly — skips if the index already exists.
 *
 * @returns {Promise<void>}
 */
export async function ensurePointsLedgerIndex() {
  const existing = await indexes.listIndexes(POINTS_LEDGER_COLLECTION);
  const alreadyExists = (existing.indexes ?? []).some(
    (idx) => idx.name === MEMBER_MILESTONE_INDEX_NAME,
  );
  if (alreadyExists) return;

  await indexes.createIndex(POINTS_LEDGER_COLLECTION, {
    name: MEMBER_MILESTONE_INDEX_NAME,
    fields: [{ path: 'memberMilestoneKey', order: 'ASC' }],
    unique: true,
  });
}
