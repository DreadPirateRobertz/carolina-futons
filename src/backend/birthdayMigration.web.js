/**
 * @module birthdayMigration
 * @description One-time migration: backfill birthday_month and birthday_day
 * custom fields on Members/PrivateMembersData for all existing members.
 *
 * CF-zf97: The daily birthday cron queries these fields to find today's
 * birthday members. Members who set their birthday before the ongoing
 * wixMembers_onMemberUpdated hook was deployed will be missing these fields.
 * Run this once before enabling the birthday cron in production.
 *
 * @setup Run via Admin-only webMethod — trigger from Wix Dashboard or a
 * one-off backend call. Safe to re-run: skips members already up-to-date.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { _parseBirthdayMonthDay } from 'backend/events';
import { logError } from 'backend/utils/errorHandler';

const MEMBERS_COLLECTION = 'Members/PrivateMembersData';
const PAGE_SIZE = 100;

/**
 * Backfill birthday_month and birthday_day for all members.
 * Skips members with no birthday or whose derived fields already match.
 * Safe to re-run: idempotent for already-correct records.
 *
 * @returns {Promise<{processed: number, updated: number, skipped: number, errors: number}>}
 */
export const backfillBirthdayFields = webMethod(
  Permissions.Admin,
  async () => {
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    // Cursor-based pagination: wixData.query().skip() hits a hard Wix limit
    // of 1000 items. Instead, advance by filtering _id > lastSeenId ascending.
    let lastSeenId = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q = wixData.query(MEMBERS_COLLECTION)
        .ascending('_id')
        .limit(PAGE_SIZE);
      if (lastSeenId) {
        q = q.gt('_id', lastSeenId);
      }
      const page = await q.find();

      if (page.items.length === 0) break;

      for (const member of page.items) {
        processed++;
        const birthday = member.birthday ?? null;

        if (!birthday) {
          skipped++;
          continue;
        }

        const parsed = _parseBirthdayMonthDay(birthday);
        if (!parsed) {
          logError(`birthdayMigration:unparseableBirthday member=${member._id}`, null);
          skipped++;
          continue;
        }

        // Skip if already correct — avoids redundant writes on re-runs
        if (member.birthday_month === parsed.month && member.birthday_day === parsed.day) {
          skipped++;
          continue;
        }

        try {
          await wixData.update(MEMBERS_COLLECTION, {
            ...member,
            birthday_month: parsed.month,
            birthday_day: parsed.day,
          });
          updated++;
        } catch (err) {
          logError('[birthdayMigration] Failed to update member', err);
          errors++;
        }
      }

      if (page.items.length < PAGE_SIZE) break;
      lastSeenId = page.items[page.items.length - 1]._id;
    }

    logError(`birthdayMigration:complete processed=${processed} updated=${updated} skipped=${skipped} errors=${errors}`, null);
    return { processed, updated, skipped, errors };
  }
);
