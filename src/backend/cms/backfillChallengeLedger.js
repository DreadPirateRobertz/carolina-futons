/**
 * @file backfillChallengeLedger.js
 * @description One-time migration: populate `memberChallengeKey` on existing
 * PointsLedger rows of type 'challenge_completion' that pre-date the cf-ipg
 * unique-index work.
 *
 * Safe to run multiple times — rows that already have `memberChallengeKey`
 * set are skipped.  Returns a summary object for logging/testing.
 *
 * DEPLOYMENT ORDER:
 *   (1) Run backfillChallengeLedger() FIRST to populate memberChallengeKey on
 *       all existing rows.
 *   (2) THEN run ensureChallengeCompletionIndex() to create the unique index.
 *   Running ensureChallengeCompletionIndex() first risks duplicate-key errors
 *   during backfill if any (memberId, challengeId) pair appears more than once.
 *
 * Usage (Wix backend script or one-shot web method):
 *   import { backfillChallengeLedger } from 'backend/cms/backfillChallengeLedger';
 *   const result = await backfillChallengeLedger();
 *   console.log(result); // { checked: N, updated: N, skipped: N }
 */
import wixData from 'wix-data';

const COLLECTION = 'PointsLedger';
const PAGE_SIZE = 100;

/**
 * Backfill `memberChallengeKey` on PointsLedger rows of type 'challenge_completion'
 * where it is missing.
 *
 * @returns {Promise<{ checked: number, updated: number, skipped: number }>}
 *   checked — total rows visited; updated — rows that had memberChallengeKey written;
 *   skipped — rows that already had the key, had wrong type, or were missing memberId/challengeId.
 */
export async function backfillChallengeLedger() {
  let checked = 0;
  let updated = 0;
  let skipped = 0;
  let afterId = null;

  // Cursor-based pagination avoids Wix Data's .skip() cap (<=1000 items).
  // Each page advances by filtering _id > afterId with consistent ascending
  // ordering, so every row is visited exactly once regardless of collection size.
  while (true) {
    let q = wixData.query(COLLECTION).ascending('_id').limit(PAGE_SIZE);
    if (afterId !== null) q = q.gt('_id', afterId);
    const { items } = await q.find({ suppressAuth: true });

    if (items.length === 0) break;

    for (const item of items) {
      checked++;
      if (item.type === 'challenge_completion' && !item.memberChallengeKey && item.memberId && item.challengeId) {
        await wixData.update(
          COLLECTION,
          { ...item, memberChallengeKey: `${item.memberId}:${item.challengeId}` },
          { suppressAuth: true },
        );
        updated++;
      } else {
        skipped++;
      }
    }

    afterId = items[items.length - 1]._id;
    if (items.length < PAGE_SIZE) break;
  }

  return { checked, updated, skipped };
}
