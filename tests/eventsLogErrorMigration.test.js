/**
 * cf-events-logerror — pins console.error → logError migration in
 * src/backend/events.js. Largest single-file count in the pace-alert
 * burst (26 sites; Wix platform event handlers).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(TEST_DIR, '../src/backend/events.js'),
  'utf-8',
);

const EXPECTED_TAG_PREFIXES = [
  'events:revalidate-webhookFailed',
  'events:writeFailedEvent-dlqFailed',
  'events:wixEcom_onAbandonedCart-failed',
  'events:markCartRecovered-failed',
  'events:wixMembers_onMemberCreated-welcomeSequenceFailed',
  'events:wixMembers_onMemberCreated-seedPointsFailed',
  'events:sendOrderConfirmation',
  'events:wixEcom_onOrderApproved-webhookFailed',
  'events:wixEcom_onOrderApproved-postPurchaseFailed',
  'events:wixEcom_onOrderApproved-tierMilestoneFailed',
  'events:wixEcom_onOrderApproved-gamificationFailed',
  'events:wixEcom_onOrderApproved-referralFailed',
  'events:wixEcom_onOrderApproved-swatchAttributionFailed',
  'events:wixEcom_onOrderApproved-swatchKitCreditFailedSilent',
  'events:wixEcom_onOrderApproved-swatchKitCreditThrew',
  'events:wixEcom_onOrderApproved-earnFailed',
  'events:wixEcom_onOrderShipped-webhookFailed',
  'events:wixEcom_onOrderFulfilled-smsFailed',
  'events:wixEcom_onFulfillmentCreated-failed',
  'events:wixEcom_onFulfillmentUpdated-failed',
  'events:wixEcom_onOrderDelivered-failed',
  'events:wixEcom_onOrderCanceled-webhookFailed',
  'events:wixEcom_onOrderCanceled-careSequenceFailed',
  'events:wixStores_onProductCreated-orchestrationFailed',
  'events:wixStores_onProductUpdated-priceDropOrchestrationFailed',
  'events:dispatchRestockNotifications-orchestrationFailed',
];

describe('cf-events-logerror — events.js console.error → logError', () => {
  it('contains zero console.error calls (all sites converted)', () => {
    const matches = SRC.match(/console\.error\s*\(/g) || [];
    expect(matches.length).toBe(0);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it.each(EXPECTED_TAG_PREFIXES)('uses logError tag prefix %s', (prefix) => {
    expect(SRC).toContain(prefix);
  });

  it('drift guard — every logError call uses the events: prefix', () => {
    const tagPattern = /\blogError\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tags = Array.from(SRC.matchAll(tagPattern), (m) => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(26);
    const nonPrefixed = tags.filter((t) => !t.startsWith('events:'));
    expect(
      nonPrefixed,
      `found logError tags without events: prefix: ${nonPrefixed.join(', ')}`,
    ).toEqual([]);
  });
});
