/**
 * cf-mrcm (cf-44qt wave): pins the console.error → logError migration in
 * src/backend/whiteGloveScheduling.web.js. 13 catch + fire-and-forget
 * sites converted to use the `logError(tag, err)` shape from
 * `backend/utils/errorHandler` so Sentry sees all white-glove scheduling
 * failures (previously `console.error` only hit Velo console).
 *
 * Strategy: static-string assertions on the source file. Proves the
 * swap is complete + the tag list is consistent. Behavioral regression
 * coverage comes from the existing whiteGloveScheduling.test.js suite.
 *
 * Same shape as cf-uydr's emailAutomationLogErrorMigration.test.js
 * (PR #1373) — the canonical pattern for cf-44qt wave migrations.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/whiteGloveScheduling.web.js'),
  'utf-8',
);

// Each expected logError tag — one per swapped site. Order matches the
// file's top-to-bottom layout for forensic review.
const EXPECTED_TAGS = [
  'whiteGloveScheduling:getWhiteGloveSlots',
  'whiteGloveScheduling:bookWhiteGloveDelivery-smsConfirmation',
  'whiteGloveScheduling:bookWhiteGloveDelivery',
  'whiteGloveScheduling:getMyWhiteGloveAppointment',
  'whiteGloveScheduling:rescheduleWhiteGlove',
  'whiteGloveScheduling:blockDeliveryDate',
  'whiteGloveScheduling:unblockDeliveryDate',
  'whiteGloveScheduling:getBlockedDates',
  'whiteGloveScheduling:getAdminCalendar',
  'whiteGloveScheduling:runWhiteGlove48hReminders-smsPerAppt',
  'whiteGloveScheduling:runWhiteGlove48hReminders',
  'whiteGloveScheduling:runWhiteGloveDayOfReminders-smsPerAppt',
  'whiteGloveScheduling:runWhiteGloveDayOfReminders',
];

describe('cf-mrcm: whiteGloveScheduling.web.js logError migration', () => {
  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{\s*logError\s*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('contains zero remaining console.error|warn|log calls', () => {
    // Strict: no `console.*` calls anywhere in the source. cf-44qt
    // wave goal is to route every failure through logError so Sentry
    // gets the structured tag; console.* in src/backend/ only hits
    // Velo runtime logs which aren't queryable post-incident.
    const consoleCalls = SRC.match(/console\.(error|warn|log)\s*\(/g) || [];
    expect(consoleCalls).toEqual([]);
  });

  describe('each expected logError tag is present', () => {
    for (const tag of EXPECTED_TAGS) {
      it(`tag "${tag}" appears in the source`, () => {
        // Match the tag at the start of a logError(...) call's first
        // argument. Accepts ', ", or ` (backtick template literals for
        // sites with dynamic context like appt-id / reason suffix).
        // For backtick form the tag is followed by space/${ rather
        // than the closing quote, so the closing quote is optional.
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
        );
        expect(SRC).toMatch(pattern);
      });
    }
  });

  it(`total logError call count is at least ${EXPECTED_TAGS.length} (the migrated sites)`, () => {
    // Floor, not ceiling — defensive against future PRs that add new
    // logError sites without bumping this test. If a removal lands,
    // this catches it; net adds are allowed.
    const calls = SRC.match(/logError\s*\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(EXPECTED_TAGS.length);
  });
});
