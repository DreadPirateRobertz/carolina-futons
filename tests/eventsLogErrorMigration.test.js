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
  'events:wixEcom_onCartAbandoned-dropped',
  'events:markCartRecovered',
  'events:welcomeSequence',
  'events:seedWelcomePoints',
  'events:orderStatusWebhook-confirmed',
  'events:postPurchaseSequence',
  'events:tierMilestoneCheck',
  'events:gamificationOnOrder',
  'events:referralOnOrder',
  'events:swatchAttributionCheck',
  'events:swatchKitCredit-silentFailure',
  'events:swatchKitCreditIssuance',
  'events:wixEcom_onOrderApproved-gamificationEarn',
  'events:orderStatusWebhook-shipped',
  'events:onOrderFulfilled-sms',
  'events:onFulfillmentCreated',
  'events:onFulfillmentUpdated',
  'events:onOrderDelivered',
  'events:orderStatusWebhook-cancelled',
  'events:cancelCareSequence',
  'events:contentOrchestration-newProduct',
  'events:contentOrchestration-priceDrop',
  'events:restockNotifications-resultFailure',
  'events:contentOrchestration-restock',
  'events:restockNotifications',
  'events:syncBirthdayFields',
];

describe('cf-events-logerror — events.js console.error → logError', () => {
  it('contains zero console.error calls (all 26 sites converted)', () => {
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
