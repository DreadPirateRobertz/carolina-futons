#!/usr/bin/env node
/**
 * @script migrate-birthday-fields.mjs
 * @description One-time migration: reads `birthday` (Date) from
 *   Members/PrivateMembersData for all members and writes `birthday_month`
 *   (int 1-12) and `birthday_day` (int 1-31) as separate custom fields.
 *
 * Run ONCE before enabling the birthday cron in production.
 *
 * Usage:
 *   WIX_API_KEY=<key> WIX_ACCOUNT_ID=<id> WIX_SITE_ID=<id> \
 *     node scripts/migrate-birthday-fields.mjs [--dry-run]
 *
 * Flags:
 *   --dry-run   Log what would be updated without writing to Wix.
 *
 * Requirements:
 *   - WIX_API_KEY: Wix API key with Members read+write permission
 *   - WIX_ACCOUNT_ID: Wix account ID
 *   - WIX_SITE_ID: Wix site ID
 *
 * Exit codes:
 *   0 — success (or dry-run)
 *   1 — environment variable missing
 *   2 — unrecoverable API error
 */

// ── Config ────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 100; // max Wix Data API page size

const API_KEY = process.env.WIX_API_KEY;
const ACCOUNT_ID = process.env.WIX_ACCOUNT_ID;
const SITE_ID = process.env.WIX_SITE_ID;

if (!API_KEY || !ACCOUNT_ID || !SITE_ID) {
  console.error('[migrate-birthday-fields] Missing required env vars: WIX_API_KEY, WIX_ACCOUNT_ID, WIX_SITE_ID');
  process.exit(1);
}

const HEADERS = {
  Authorization: API_KEY,
  'wix-account-id': ACCOUNT_ID,
  'wix-site-id': SITE_ID,
  'Content-Type': 'application/json',
};

const DATA_URL = 'https://www.wixapis.com/wix-data/v2/items/query';
const UPDATE_URL = (itemId) => `https://www.wixapis.com/wix-data/v2/items/${itemId}`;

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Extract month (1-12) and day (1-31) from a Wix date value.
 * Wix stores Date fields as ISO strings or Date objects.
 * Returns null if the value cannot be parsed.
 */
function parseBirthdayMonthDay(birthdayValue) {
  if (!birthdayValue) return null;
  const d = new Date(birthdayValue);
  if (isNaN(d.getTime())) return null;
  // Use UTC to avoid timezone shift on bare date strings (e.g. "1990-05-15")
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Query one page of Members/PrivateMembersData with pagination.
 */
async function queryPage(offset) {
  const body = {
    dataCollectionId: 'Members/PrivateMembersData',
    query: {
      fields: ['_id', 'birthday', 'birthday_month', 'birthday_day'],
      paging: { limit: PAGE_SIZE, offset },
    },
  };
  const resp = await fetch(DATA_URL, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!resp.ok) {
    throw new Error(`Wix Data query failed: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  return json.dataItems ?? [];
}

/**
 * Update a single member record's birthday_month and birthday_day fields.
 */
async function updateMemberFields(itemId, month, day) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would update ${itemId}: birthday_month=${month} birthday_day=${day}`);
    return;
  }
  const body = {
    dataCollectionId: 'Members/PrivateMembersData',
    dataItem: {
      id: itemId,
      data: { birthday_month: month, birthday_day: day },
    },
  };
  const resp = await fetch(UPDATE_URL(itemId), { method: 'PATCH', headers: HEADERS, body: JSON.stringify(body) });
  if (!resp.ok) {
    throw new Error(`Wix Data update failed for ${itemId}: ${resp.status} ${await resp.text()}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`[migrate-birthday-fields] Starting${DRY_RUN ? ' (DRY-RUN)' : ''}…`);

  let offset = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    const items = await queryPage(offset);
    if (items.length === 0) break;

    for (const item of items) {
      const id = item.id ?? item._id;
      const data = item.data ?? item;
      totalProcessed++;

      // Skip members already migrated (both fields already set)
      if (data.birthday_month != null && data.birthday_day != null) {
        totalSkipped++;
        continue;
      }

      // Skip members with no birthday set
      if (!data.birthday) {
        totalSkipped++;
        continue;
      }

      const parsed = parseBirthdayMonthDay(data.birthday);
      if (!parsed) {
        console.warn(`  [WARN] Cannot parse birthday for member ${id}: ${JSON.stringify(data.birthday)}`);
        totalErrors++;
        continue;
      }

      try {
        await updateMemberFields(id, parsed.month, parsed.day);
        totalUpdated++;
      } catch (err) {
        console.error(`  [ERROR] Update failed for member ${id}:`, err.message);
        totalErrors++;
      }
    }

    offset += items.length;
    if (items.length < PAGE_SIZE) break;
  }

  console.log(`[migrate-birthday-fields] Done.`);
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Updated:   ${totalUpdated}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Errors:    ${totalErrors}`);

  if (totalErrors > 0) process.exit(2);
}

main().catch((err) => {
  console.error('[migrate-birthday-fields] Fatal error:', err.message);
  process.exit(2);
});
