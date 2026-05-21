/**
 * cf-homn (cf-44qt batch-M): src/backend 20-file console.* → logError migration.
 *
 * Static analysis: asserts 0 console.* calls remain in each file and that
 * every canonical logError tag is present in the source.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/backend');
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const ALL_FILES = [
  'inventoryService.web.js',
  'inventorySync.web.js',
  'lifecycleCron.web.js',
  'lifecycleEmailSender.web.js',
  'liveChat.web.js',
  'liveChatService.web.js',
  'liveInventory.web.js',
  'liveShowroom.web.js',
  'localSeoService.web.js',
  'loyaltyMarketing.web.js',
  'marketingSequences.web.js',
  'memberPointsLedgerService.web.js',
  'membershipService.web.js',
  'newsletterService.web.js',
  'notificationPreferences.web.js',
  'notificationService.web.js',
  'orderTracking.web.js',
  'photoGapReport.web.js',
  'photoReviews.web.js',
  'contacts/contactResolver.web.js',
];

// Files that already import logError — no import assertion needed for others
const ALREADY_HAS_IMPORT = new Set([
  'loyaltyMarketing.web.js',
  'notificationService.web.js',
]);

// Files with 0 console.* before migration — no tags expected
const ALREADY_CLEAN = new Set(['liveShowroom.web.js', 'orderTracking.web.js']);

const FILE_TAGS = {
  'inventoryService.web.js': [
    'inventoryService:getStockStatus-failed',
    'inventoryService:signUpBackInStock-failed',
    'inventoryService:getInventoryUrgency-failed',
  ],
  'inventorySync.web.js': [
    'inventorySync:syncInventoryFromStore-productFailed',
    'inventorySync:syncInventoryFromStore-failed',
  ],
  'lifecycleCron.web.js': [
    'lifecycleCron:scanLifecycleMilestones-failed',
    'lifecycleCron:runDailyChallengeReminders-reminderFailed',
    'lifecycleCron:runDailyChallengeReminders-failed',
  ],
  'lifecycleEmailSender.web.js': [
    'lifecycleEmailSender:sendLifecycleEmails-failed',
  ],
  'liveChat.web.js': [
    'liveChat:getOfficeHoursStatus-failed',
    'liveChat:getCannedResponses-failed',
    'liveChat:matchCannedResponse-failed',
    'liveChat:createSupportTicket-failed',
    'liveChat:getChatContext-failed',
  ],
  'liveChatService.web.js': [
    'liveChatService:isOnline-failed',
    'liveChatService:sendMessage-failed',
    'liveChatService:getChatHistory-failed',
    'liveChatService:createSupportTicket-failed',
  ],
  'liveInventory.web.js': [
    'liveInventory:getProductInventory-failed',
    'liveInventory:registerStockNotification-failed',
  ],
  'localSeoService.web.js': [
    'localSeoService:getLocalPage-featuredProductsFailed',
    'localSeoService:getLocalPage-failed',
    'localSeoService:getFeaturedProductsForCity-failed',
    'localSeoService:getRelatedCityLinks-failed',
    'localSeoService:getAllLocalSlugs-failed',
  ],
  'loyaltyMarketing.web.js': [
    'loyaltyMarketing:getEnrollmentPrompt-failed',
    'loyaltyMarketing:enrollMember-failed',
  ],
  'marketingSequences.web.js': [
    'marketingSequences:triggerWelcomeSequence-failed',
    'marketingSequences:triggerCartAbandonSequence-failed',
    'marketingSequences:triggerReviewRequestSequence-failed',
    'marketingSequences:runReviewRequestEmails-failed',
    'marketingSequences:triggerWinbackSequence-failed',
    'marketingSequences:scanAndTriggerWinback-failed',
  ],
  'memberPointsLedgerService.web.js': [
    'memberPointsLedgerService:getMyPointsHistory-failed',
  ],
  'membershipService.web.js': [
    'membershipService:getActiveOrder-failed',
    'membershipService:getMembershipPlans-failed',
  ],
  'newsletterService.web.js': [
    'newsletterService:syncToESP-failed',
    'newsletterService:unsubscribeFromESP-failed',
    'newsletterService:subscribeToNewsletter-welcomeTriggerFailed',
    'newsletterService:subscribeToNewsletter-failed',
    'newsletterService:_triggerWelcomeFlowInternal-noContactId',
  ],
  'notificationPreferences.web.js': [
    'notificationPreferences:getNotificationPreferences-failed',
    'notificationPreferences:saveNotificationPreferences-failed',
    'notificationPreferences:unsubscribeAll-failed',
  ],
  'notificationService.web.js': [
    'notificationService:notifyOwner-secretMissing',
    'notificationService:notifyOwner-emailFailed',
    'notificationService:notifyOwner-ownerAlert',
  ],
  'photoGapReport.web.js': [
    'photoGapReport:generateReport-failed',
  ],
  'photoReviews.web.js': [
    'photoReviews:submitPhotoReview-gamificationFailed',
    'photoReviews:submitPhotoReview-failed',
    'photoReviews:moderatePhotoReview-blockedTransition',
    'photoReviews:moderatePhotoReview-failed',
    'photoReviews:getPhotoGallery-failed',
  ],
  'contacts/contactResolver.web.js': [
    'contactResolver:_resolveContactIdInternal-appendOrCreateFailed',
    'contactResolver:_resolveContactIdInternal-noContactId',
  ],
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-homn (cf-44qt batch-M): 20-file console.* → logError', () => {
  describe('all 20 files: zero console.* calls', () => {
    it.each(ALL_FILES)('%s has no console.* calls', (file) => {
      const source = src(file);
      const calls = source.match(/console\.(error|warn|log|debug|info)\s*\(/g) || [];
      expect(calls).toEqual([]);
    });
  });

  describe('all non-already-imported files: logError imported from errorHandler', () => {
    it.each(ALL_FILES.filter(f => !ALREADY_HAS_IMPORT.has(f) && !ALREADY_CLEAN.has(f)))(
      '%s imports logError from errorHandler',
      (file) => {
        const source = src(file);
        expect(source).toMatch(
          /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/utils\/errorHandler/,
        );
      }
    );
  });

  describe('per-file canonical logError tags', () => {
    for (const [file, tags] of Object.entries(FILE_TAGS)) {
      describe(file, () => {
        it.each(tags)('uses tag %s', (tag) => {
          const source = src(file);
          expect(source).toMatch(tagPattern(tag));
        });
      });
    }
  });

  it('summary: 55 logError tags across 18 migrated files', () => {
    const total = Object.values(FILE_TAGS).reduce((sum, tags) => sum + tags.length, 0);
    expect(total).toBe(55);
  });
});
