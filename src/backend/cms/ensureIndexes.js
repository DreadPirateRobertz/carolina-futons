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
 *   (3) Run backfillChallengeLedger() FIRST to populate memberChallengeKey on
 *       all existing challenge_completion rows.
 *   (4) THEN run ensureChallengeCompletionIndex() to create the unique index.
 *   Running ensureChallengeCompletionIndex() first risks duplicate-key errors
 *   during backfill if any (memberId, challengeId) pair appears more than once.
 *
 * Wix unique indexes are single-field only. Compound (memberId, X) uniqueness
 * is encoded as a single computed key field in "<memberId>:<x>" format.
 * The corresponding record*Event() functions write this field on every insert;
 * the indexes below enforce uniqueness at the DB level.
 *
 * Indexes managed here:
 *   ensurePointsLedgerIndex()         — memberMilestoneKey_unique (cf-7mr)
 *   ensureChallengeCompletionIndex()  — memberChallengeKey_unique  (cf-ipg)
 *
 * @requires wix-data-index-service-v2
 */
import { indexes } from 'wix-data-index-service-v2';

const POINTS_LEDGER_COLLECTION = 'PointsLedger';
const MEMBER_MILESTONE_INDEX_NAME = 'memberMilestoneKey_unique';
const MEMBER_CHALLENGE_INDEX_NAME = 'memberChallengeKey_unique';

/**
 * Create a unique single-field index on `collection` if it does not already exist.
 *
 * @param {string} collection - Wix Data collection name.
 * @param {string} indexName  - Desired index name.
 * @param {string} fieldPath  - Field path to index.
 * @returns {Promise<void>}
 */
async function ensureUniqueIndex(collection, indexName, fieldPath) {
  const existing = await indexes.listIndexes(collection);
  const alreadyExists = (existing.indexes ?? []).some((idx) => idx.name === indexName);
  if (alreadyExists) return;

  await indexes.createIndex(collection, {
    name: indexName,
    fields: [{ path: fieldPath, order: 'ASC' }],
    unique: true,
  });
}

/**
 * Ensure the PointsLedger collection has a unique index on `memberMilestoneKey`.
 * Safe to call repeatedly — skips if the index already exists.
 *
 * @returns {Promise<void>}
 */
export async function ensurePointsLedgerIndex() {
  await ensureUniqueIndex(POINTS_LEDGER_COLLECTION, MEMBER_MILESTONE_INDEX_NAME, 'memberMilestoneKey');
}

/**
 * Ensure the PointsLedger collection has a unique index on `memberChallengeKey`.
 * Prevents TOCTOU duplicate inserts when concurrent requests both complete the
 * same challenge for the same member.
 * Safe to call repeatedly — skips if the index already exists.
 *
 * @returns {Promise<void>}
 */
export async function ensureChallengeCompletionIndex() {
  await ensureUniqueIndex(POINTS_LEDGER_COLLECTION, MEMBER_CHALLENGE_INDEX_NAME, 'memberChallengeKey');
}
