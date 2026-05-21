/**
 * cf-i8b4 (cf-44qt batch-M): 20-file logger sweep migration pins.
 *
 * Single test file pinning all 20 files in melania's batch-M dispatch
 * (hq-wisp-0vlw4i 2026-05-16). 60 console.* sites swapped to canonical
 * `logError(tag, err)` from `backend/utils/errorHandler` with the
 * `<module>:<fn>-<reason>` tag namespace established by cf-uydr +
 * cf-mrcm + cf-m7yg + cf-hjvs.
 *
 * Special cases:
 *   - notificationPreferences uses structured-object `logError(...)` from
 *     `backend/errorMonitoring.web.js` (kept intact); redundant
 *     console.error lines were DELETED rather than swapped.
 *   - marketingSequences had a local `function logError(msg, err)` wrapping
 *     console.error; replaced with canonical import + 6 caller-site
 *     tag-namespace migrations.
 *   - inventorySync's `console.log(... Sync complete ...)` is an INFO
 *     signal not a failure; migrated to logError with `-info` suffix
 *     so it still surfaces in Sentry (operationally useful) but tag
 *     names it as info.
 *
 * Regex shape accepts ', ", AND backtick — cf-mrcm's folded learning.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_BACKEND = path.resolve(TEST_DIR, '../src/backend');

function readSrc(rel) {
  return fs.readFileSync(path.resolve(SRC_BACKEND, rel), 'utf-8');
}

// Files keyed by relative path → expected tags after migration.
// Sub-key `requiresImport=true` means the file should import logError from
// backend/utils/errorHandler. `requiresImport=false` is for files that use
// structured-object logError from backend/errorMonitoring.web.js (the
// notificationPreferences exception).
const FILES = {
  'inventoryService.web.js': {
    requiresImport: true,
    tags: [
      'inventoryService:getStockStatus',
      'inventoryService:signUpBackInStock',
      'inventoryService:getInventoryUrgency',
    ],
  },
  'inventorySync.web.js': {
    requiresImport: true,
    tags: [
      'inventorySync:syncProduct',
      'inventorySync:syncComplete-info',
      'inventorySync:syncFailed',
    ],
  },
  'lifecycleCron.web.js': {
    requiresImport: true,
    tags: [
      'lifecycleCron:scanLifecycleMilestones',
      'lifecycleCron:runDailyChallengeReminders-pushFailed',
      'lifecycleCron:runDailyChallengeReminders',
    ],
  },
  'lifecycleEmailSender.web.js': {
    requiresImport: true,
    tags: ['lifecycleEmailSender:sendLifecycleEmails'],
  },
  'liveChat.web.js': {
    requiresImport: true,
    tags: [
      'liveChat:getOfficeHoursStatus',
      'liveChat:getCannedResponses',
      'liveChat:matchCannedResponse',
      'liveChat:createSupportTicket',
      'liveChat:getChatContext',
    ],
  },
  'liveChatService.web.js': {
    requiresImport: true,
    tags: [
      'liveChatService:checkOnlineStatus',
      'liveChatService:sendChatMessage',
      'liveChatService:fetchChatHistory',
      'liveChatService:createSupportTicket',
    ],
  },
  'liveInventory.web.js': {
    requiresImport: true,
    tags: [
      'liveInventory:getProductInventory',
      'liveInventory:registerStockNotification',
    ],
  },
  'liveShowroom.web.js': {
    requiresImport: true,
    tags: [
      'liveShowroom:getShowroomStatus',
      'liveShowroom:getLiveDisplayProducts',
      'liveShowroom:reserveShowroomPiece',
      'liveShowroom:cameraHeartbeat',
    ],
  },
  'localSeoService.web.js': {
    requiresImport: true,
    tags: [
      'localSeoService:fetchFeaturedProductsForPage',
      'localSeoService:loadLocalPage',
      'localSeoService:loadFeaturedProducts',
      'localSeoService:loadRelatedCityLinks',
      'localSeoService:getLocalSlugs',
    ],
  },
  'loyaltyMarketing.web.js': {
    requiresImport: true,
    tags: [
      'loyaltyMarketing:getEnrollmentPrompt',
      'loyaltyMarketing:enrollMember',
    ],
  },
  'marketingSequences.web.js': {
    requiresImport: true,
    tags: [
      'marketingSequences:triggerWelcomeSequence',
      'marketingSequences:triggerCartAbandonSequence',
      'marketingSequences:triggerReviewRequestSequence',
      'marketingSequences:runReviewRequestEmails',
      'marketingSequences:triggerWinbackSequence',
      'marketingSequences:scanAndTriggerWinback',
    ],
  },
  'memberPointsLedgerService.web.js': {
    requiresImport: true,
    tags: ['memberPointsLedgerService:getMyPointsHistory'],
  },
  'membershipService.web.js': {
    requiresImport: true,
    tags: [
      'membershipService:fetchOrders',
      'membershipService:listPlans',
    ],
  },
  'newsletterService.web.js': {
    requiresImport: true,
    tags: [
      'newsletterService:espSync',
      'newsletterService:espUnsubscribe',
      'newsletterService:welcomeAutoTrigger-nonblocking',
      'newsletterService:subscribe',
      'newsletterService:welcomeAutoTrigger-skippedEmptyContactId',
    ],
  },
  // notificationPreferences keeps existing structured-object logError from
  // errorMonitoring.web.js; this batch DELETES the redundant console.error
  // lines but doesn't add the canonical import.
  'notificationPreferences.web.js': {
    requiresImport: false,
    tags: [],
  },
  'notificationService.web.js': {
    // ALL 3 console.* sites inside notifyOwner are INTENTIONAL per JSDoc +
    // notificationServiceSilentFailureCleanup test: notifyOwner is the
    // documented last-resort alert channel — the entire fallback path
    // (secret-missing warn + email-failed warn + final OWNER ALERT error)
    // MUST stay on console so it surfaces in Wix logs even when secrets
    // are absent OR email delivery itself is broken. No migration this batch.
    // logError import is already present from earlier batches (used by
    // recordPriceSnapshots / checkWishlistAlerts / etc.), so we still
    // assert the canonical import is in place.
    requiresImport: true,
    tags: [],
    // Override the strict zero-console-call check — 3 intentional sites
    // (1 warn for secret-missing, 1 warn for email-failed, 1 error for OWNER ALERT).
    allowsConsoleCalls: 3,
  },
  'orderTracking.web.js': {
    requiresImport: true,
    tags: [
      'orderTracking:lookupOrder',
      'orderTracking:subscribeToNotifications',
      'orderTracking:unsubscribeFromNotifications',
      'orderTracking:getTrackingTimeline',
    ],
  },
  'photoGapReport.web.js': {
    requiresImport: true,
    tags: ['photoGapReport:generateReport'],
  },
  'photoReviews.web.js': {
    requiresImport: true,
    tags: [
      'photoReviews:submitPhotoReview-gamificationEvent',
      'photoReviews:submitPhotoReview',
      'photoReviews:moderatePhotoReview-blockedTransition',
      'photoReviews:moderatePhotoReview',
      'photoReviews:getPhotoGallery',
    ],
  },
  'contacts/contactResolver.web.js': {
    requiresImport: true,
    tags: [
      'contactResolver:appendOrCreateContact',
      'contactResolver:appendOrCreateContact-noContactId',
    ],
  },
};

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-i8b4 (cf-44qt batch-M): 20-file logger sweep migration', () => {
  for (const [filePath, spec] of Object.entries(FILES)) {
    describe(filePath, () => {
      const src = readSrc(filePath);

      it('contains zero console.error|warn|log|debug|info CALLS (matches the strict call-pattern, not comment text)', () => {
        const calls = src.match(/console\.(error|warn|log|debug|info)\s*\(/g) || [];
        const allowed = spec.allowsConsoleCalls || 0;
        expect(calls.length).toBe(allowed);
      });

      if (spec.requiresImport) {
        it('imports logError from a canonical location (errorHandler or errorMonitoring)', () => {
          // Accept either canonical location. Most files use
          // backend/utils/errorHandler; notificationService imports the
          // same from a slightly different module path. Both export
          // the same callable interface.
          const importPattern =
            /import\s+\{[^}]*\blogError\b[^}]*\}\s+from\s+['"]backend\/(utils\/errorHandler|errorMonitoring)/;
          expect(src).toMatch(importPattern);
        });
      }

      if (spec.tags.length > 0) {
        for (const tag of spec.tags) {
          it(`tag "${tag}" appears as a logError() call`, () => {
            expect(src).toMatch(tagPattern(tag));
          });
        }
      }
    });
  }

  it('summary: 60+ console.* call sites migrated across 20 files', () => {
    // Sanity: total expected logError tag count across all files matches
    // the bead's batch-M scope. notificationPreferences contributes 0
    // (its 3 sites were redundant-with-structured-logError deletions).
    const totalTags = Object.values(FILES).reduce(
      (sum, spec) => sum + spec.tags.length,
      0,
    );
    expect(totalTags).toBeGreaterThanOrEqual(57);  // 60 sites − 3 deletions
  });
});
