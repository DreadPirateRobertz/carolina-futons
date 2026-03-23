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
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { items } = await wixData
      .query(COLLECTION)
      .skip(offset)
      .limit(PAGE_SIZE)
      .find({ suppressAuth: true });

    for (const item of items) {
      checked++;
      if (item.memberMilestoneKey) {
        skipped++;
        continue;
      }
      if (!item.memberId || item.milestone == null) {
        skipped++;
        continue;
      }
      await wixData.update(
        COLLECTION,
        { ...item, memberMilestoneKey: `${item.memberId}:${item.milestone}` },
        { suppressAuth: true },
      );
      updated++;
    }

    hasMore = items.length === PAGE_SIZE;
    offset += items.length;
  }

  return { checked, updated, skipped };
}
