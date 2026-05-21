/**
 * cf-n3ii (cf-44qt batch-Q): emailAutomation.web.js console.warn → logError.
 *
 * Builds on cf-uydr (which migrated 19 console.error sites) by migrating
 * the remaining 11 console.warn sites to canonical
 * `logError(tag, err|null)` with the `<module>:<fn>-<reason>` tag
 * namespace.
 *
 * NB: this test SUPPLEMENTS tests/emailAutomationLogErrorMigration.test.js;
 * the cf-uydr test pins the 19 console.error sites and the >=25 logError
 * call count. This test adds the 11 console.warn migrations and asserts
 * that the file now contains ZERO console.* calls of any kind.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/emailAutomation.web.js'),
  'utf-8',
);

const EXPECTED_TAGS = [
  'emailAutomation:triggerWelcomeSequence-discountUnavailable',
  'emailAutomation:triggerWelcomeSeries-discountUnavailable',
  'emailAutomation:triggerWelcomeSeries-skippedEmptyContactId',
  'emailAutomation:triggerPostPurchaseSequence-noSlug',
  'emailAutomation:triggerAbandonedCartRecovery-malformedLineItems',
  'emailAutomation:triggerAbandonedCartRecovery-skippedEmptyContactId',
  'emailAutomation:triggerReengagement-discountUnavailable',
  'emailAutomation:triggerReengagement-memberLookupFailed',
  'emailAutomation:cancelSequenceForOrder-missingOrderNumber',
  'emailAutomation:triggerRestockNotifications-notifyFailed',
  'emailAutomation:checkAndTriggerTierMilestone-skippedEmptyContactId',
];

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-n3ii — emailAutomation.web.js console.warn → logError migration', () => {
  it('contains zero console.* calls of any kind (warn migrations complete)', () => {
    const calls = SRC.match(/console\.(error|warn|log|debug|info)\s*\(/g) || [];
    expect(calls).toEqual([]);
  });

  it.each(EXPECTED_TAGS)('uses canonical logError tag %s', (tag) => {
    expect(SRC).toMatch(tagPattern(tag));
  });

  it('summary: 11 console.warn sites migrated', () => {
    expect(EXPECTED_TAGS).toHaveLength(11);
  });
});
