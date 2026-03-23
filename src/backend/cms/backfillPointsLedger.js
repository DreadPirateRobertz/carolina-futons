/**
 * @file backfillPointsLedger.js
 * @description One-time migration: populate `memberMilestoneKey` on existing
 * PointsLedger rows that pre-date the cf-7mr unique-index work.
 *
 * Safe to run multiple times — rows that already have `memberMilestoneKey`
 * set are skipped.  Returns a summary object for logging/testing.
 *
 * Usage (Wix backend script or one-shot web method):
 *   import { backfillPointsLedger } from 'backend/cms/backfillPointsLedger';
 *   const result = await backfillPointsLedger();
 *   console.log(result); // { checked: N, updated: N, skipped: N }
 */
import wixData from 'wix-data';

const COLLECTION = 'PointsLedger';
const PAGE_SIZE = 100;

/**
 * Backfill `memberMilestoneKey` on PointsLedger rows where it is missing.
 *
 * @returns {Promise<{ checked: number, updated: number, skipped: number }>}
 */
export async function backfillPointsLedger() {
  let checked = 0;
  let updated = 0;
  let skipped = 0;
  let afterId = null; // cursor: last _id seen

  // Cursor-based pagination avoids Wix Data's .skip() cap (≤1000 items).
  // Each page advances by filtering _id > afterId with consistent ascending
  // ordering, so every row is visited exactly once regardless of collection size.
  while (true) {
    let q = wixData.query(COLLECTION).ascending('_id').limit(PAGE_SIZE);
    if (afterId !== null) q = q.gt('_id', afterId);
    const { items } = await q.find({ suppressAuth: true });

    if (items.length === 0) break;

    for (const item of items) {
      checked++;
      if (!item.memberMilestoneKey && item.memberId && item.milestone != null) {
        await wixData.update(
          COLLECTION,
          { ...item, memberMilestoneKey: `${item.memberId}:${item.milestone}` },
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
