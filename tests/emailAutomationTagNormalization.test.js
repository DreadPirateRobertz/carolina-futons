/**
 * cf-g79m (cf-uydr.fu1) — pins the logError tag normalization in
 * src/backend/emailAutomation.web.js. cf-uydr migrated 19 console.error
 * sites with `emailAutomation:<fn>-<reason>` tags; this PR brings the
 * 6 pre-existing (non-prefixed) logError calls under the same naming
 * convention so Sentry can group all email-automation surfaces by a
 * single `emailAutomation:*` prefix.
 *
 * Strategy: static-string assertion on the source file. Same shape as
 * the cf-uydr migration test. Behavioral coverage for the underlying
 * functions lives in their respective test files (cf-fzsd review email,
 * cf-tcj5 consultation, cf-jm5t swatch, cf-nkau post-purchase,
 * cf-8onx tier-milestone, etc.) — those already exercise the catch
 * paths; this test only pins the tag-string shape.
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

const EXPECTED_PREFIXED_TAGS = [
  'emailAutomation:handleOrderDelivered:confirmation',
  'emailAutomation:handleOrderDelivered:postPurchaseCare',
  'emailAutomation:handleOrderDelivered:survey',
  'emailAutomation:triggerConsultationFollowup',
  'emailAutomation:triggerSwatchFollowupSequence',
  'emailAutomation:checkAndTriggerTierMilestone',
];

const FORBIDDEN_LEGACY_TAGS = [
  "logError('handleOrderDelivered:confirmation'",
  "logError('handleOrderDelivered:postPurchaseCare'",
  "logError('handleOrderDelivered:survey'",
  "logError('triggerConsultationFollowup'",
  "logError('triggerSwatchFollowupSequence'",
  // checkAndTriggerTierMilestone uses a template literal with milestoneKey
  // suffix — match the bare prefix without the colon-suffix.
  'logError(`checkAndTriggerTierMilestone:',
];

describe('cf-g79m — emailAutomation.web.js logError tag normalization', () => {
  it.each(EXPECTED_PREFIXED_TAGS)('uses logError tag prefix %s', (tag) => {
    expect(SRC).toContain(tag);
  });

  it.each(FORBIDDEN_LEGACY_TAGS)('does NOT use legacy non-prefixed form %s', (legacy) => {
    expect(SRC).not.toContain(legacy);
  });

  it('every logError call uses the emailAutomation: prefix', () => {
    // Match all `logError(<tag>, ...)` call sites and verify each tag
    // starts with 'emailAutomation:'. Catches future drift where a new
    // catch site forgets the prefix.
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    // Sanity floor: at least 24 logError calls present (19 cf-uydr +
    // 6 cf-g79m − 1 cf-m6t0: emailAutomation:orderConfirmation-send removed
    // from dead wixEcom_onOrderCreated stub; call moved to events.js).
    expect(tags.length).toBeGreaterThanOrEqual(24);
    const nonPrefixed = tags.filter((t) => !t.startsWith('emailAutomation:'));
    expect(
      nonPrefixed,
      `found logError tags without emailAutomation: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
