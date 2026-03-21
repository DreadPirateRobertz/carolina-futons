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
    let skip = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await wixData.query(MEMBERS_COLLECTION)
        .limit(PAGE_SIZE)
        .skip(skip)
        .find();

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
          console.warn('[birthdayMigration] Unparseable birthday for member', member._id, ':', birthday);
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
          console.error('[birthdayMigration] Failed to update member', member._id, ':', err?.message ?? err);
          errors++;
        }
      }

      if (page.items.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }

    console.log(`[birthdayMigration] Complete — processed:${processed} updated:${updated} skipped:${skipped} errors:${errors}`);
    return { processed, updated, skipped, errors };
  }
);
