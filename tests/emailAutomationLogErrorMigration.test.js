/**
 * cf-uydr (cf-44qt.fu1) — pins the console.error → logError migration in
 * src/backend/emailAutomation.web.js. 19 catch sites converted to use the
 * `logError(tag, err)` shape from `backend/utils/errorHandler` so Sentry
 * sees all email-automation failures (previously `console.error` only hit
 * Velo console).
 *
 * Strategy: static-string assertions on the source file. This proves the
 * swap is complete + the tag list is consistent. Behavioral regression
 * coverage comes from the existing emailAutomation.test.js +
 * emailAutomationErrorHandling.test.js + emailAutomationDeepen.test.js
 * suites which exercise the catch paths.
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

// Each expected logError tag — one per swapped site. Order matches the
// file's top-to-bottom layout for ease of forensic review.
// cf-m6t0: wixMembers_onMemberCreated + wixEcom_onOrderCreated are kept as
// @deprecated stubs (test backward-compat) so their logError tags remain.
// wixEcom_onOrderCreated stub lost 'emailAutomation:orderConfirmation-send'
// (that call moved to events.js). Count drops 25 → 24.
const EXPECTED_TAGS = [
  'emailAutomation:welcomeSequence-trigger',
  'emailAutomation:postPurchase-queue-onOrderCreated',
  'emailAutomation:shippingNotification-send-freight',
  'emailAutomation:shippingNotification-send-parcel',
  'emailAutomation:careSequence-cancel',
  'emailAutomation:triggerWelcomeSequence-queue',
  'emailAutomation:triggerWelcomeSeries-queue',
  'emailAutomation:referralLink-nonblocking',
  'emailAutomation:triggerPostPurchaseSequence-queue',
  'emailAutomation:cartRecoveryCoupon-create',
  'emailAutomation:triggerAbandonedCartRecovery',
  'emailAutomation:triggerReengagement',
  'emailAutomation:processEmailQueue',
  'emailAutomation:unsubscribeContact',
  'emailAutomation:recordEmailEvent',
  'emailAutomation:triggerRestockNotifications',
  'emailAutomation:getAbTestResults',
  'emailAutomation:getCampaignAnalytics',
];

describe('cf-uydr — emailAutomation.web.js console.error → logError migration', () => {
  it('contains zero console.error calls (all 19 sites converted)', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAGS)('uses logError tag %s', (tag) => {
    // Accept either single-quoted ('tag') or template-literal (`tag ...`)
    // forms — `cartRecoveryCoupon-create` uses a template literal to
    // include the cart.checkoutId + redactEmail context in the tag.
    expect(SRC).toMatch(new RegExp(`logError\\([\\s\\n]*['\`]${tag.replace(/[.*+?^${}()|[\\\]\\\\]/g, '\\\\$&')}`));
  });

  it('logError call count is at least 24 (cf-m6t0: orderConfirmation-send moved to events.js)', () => {
    // Pre-cf-uydr: 6 logError calls. Post-cf-uydr: +19 = 25.
    // cf-m6t0: -1 (emailAutomation:orderConfirmation-send removed from stub; now in events.js) = 24.
    const matches = SRC.match(/\blogError\s*\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(24);
  });
});
