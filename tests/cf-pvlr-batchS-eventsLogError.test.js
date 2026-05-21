/**
 * cf-pvlr (cf-44qt batch-S): events.js console.* → logError migration.
 *
 * Single-file PR migrating all 33 console.* sites in src/backend/events.js
 * (Wix platform event handlers) to canonical `logError(tag, err)` from
 * `backend/utils/errorHandler` with the `events:<handler>(-<reason>)?`
 * tag namespace.
 *
 * Coverage: revalidate webhook + DLQ writer + every onXxx Wix event
 * handler (abandoned cart, order approved/shipped/fulfilled/delivered/
 * cancelled, product created/updated, restock, member created/updated).
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

const EXPECTED_TAGS = [
  // Revalidate webhook + DLQ
  'events:revalidate-webhookStatus',
  'events:revalidate-webhookFailed',
  'events:writeFailedEvent-dlqFailed',
  // Abandoned cart
  'events:wixEcom_onAbandonedCart-failed',
  'events:markCartRecovered-failed',
  // Member created
  'events:wixMembers_onMemberCreated-welcomeSequenceFailed',
  'events:wixMembers_onMemberCreated-seedPointsFailed',
  // Order approved (the biggest cluster)
  'events:wixEcom_onOrderApproved-webhookFailed',
  'events:wixEcom_onOrderApproved-postPurchaseFailed',
  'events:wixEcom_onOrderApproved-tierMilestoneFailed',
  'events:wixEcom_onOrderApproved-gamificationFailed',
  'events:wixEcom_onOrderApproved-referralFailed',
  'events:wixEcom_onOrderApproved-swatchAttributionFailed',
  'events:wixEcom_onOrderApproved-swatchKitCreditFailedSilent',
  'events:wixEcom_onOrderApproved-swatchKitCreditThrew',
  'events:wixEcom_onOrderApproved-earnFailed',
  // Order shipped / fulfilled
  'events:wixEcom_onOrderShipped-webhookFailed',
  'events:wixEcom_onOrderFulfilled-smsFailed',
  // Fulfillment
  'events:wixEcom_onFulfillmentCreated-failed',
  'events:wixEcom_onFulfillmentUpdated-failed',
  // Delivered
  'events:wixEcom_onOrderDelivered-failed',
  // Cancelled
  'events:wixEcom_onOrderCanceled-webhookFailed',
  'events:wixEcom_onOrderCanceled-careSequenceFailed',
  // Stores: product created
  'events:wixStores_onProductCreated-missingId',
  'events:wixStores_onProductCreated-orchestrationFailed',
  // Stores: product updated
  'events:wixStores_onProductUpdated-missingId',
  'events:wixStores_onProductUpdated-priceDropOrchestrationFailed',
  // Restock dispatch
  'events:dispatchRestockNotifications-failure',
  'events:dispatchRestockNotifications-orchestrationFailed',
  'events:dispatchRestockNotifications',
  // Member updated (birthday sync)
  'events:wixMembers_onMemberUpdated-unparseableBirthday',
  'events:wixMembers_onMemberUpdated-noPrivateMembersData',
  'events:wixMembers_onMemberUpdated-syncFailed',
];

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-pvlr (cf-44qt batch-S): events.js console.* → logError', () => {
  it('contains zero console.* calls of any kind', () => {
    const calls = SRC.match(/console\.(error|warn|log|debug|info)\s*\(/g) || [];
    expect(calls).toEqual([]);
  });

  it('imports logError from backend/utils/errorHandler', () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler/,
    );
  });

  it.each(EXPECTED_TAGS)('uses canonical logError tag %s', (tag) => {
    expect(SRC).toMatch(tagPattern(tag));
  });

  it('summary: 33 sites migrated', () => {
    expect(EXPECTED_TAGS).toHaveLength(33);
  });
});
