/**
 * @module ensureIndexes
 * @description One-time CMS index setup for Carolina Futons.
 *
 * Run each ensure*() function once from an admin HTTP function or the
 * Wix Dashboard console after deploying the relevant feature. All functions
 * are idempotent — they skip creation if the index already exists.
 *
 * DEPLOYMENT ORDER:
 *   (1) Run backfillPointsLedger() FIRST to populate memberMilestoneKey on
 *       all existing rows.
 *   (2) THEN run ensurePointsLedgerIndex() to create the unique index.
 *   Running ensurePointsLedgerIndex() first risks duplicate-key errors during
 *   the backfill if any (memberId, milestone) pair already appears more than once.
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
