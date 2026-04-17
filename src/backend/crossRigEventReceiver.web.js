/**
 * @module crossRigEventReceiver.web
 * @description Wix backend webMethod receiving Phase 8 cross-rig events from
 * the mobile app (streak_extended, challenge_started, redemption_initiated).
 *
 * Security: memberId is resolved from the authenticated Wix session — never
 * from the request body (IDOR protection, hq-u35ub).
 *
 * All events are logged to AnalyticsEvents for PM/data querying. No points
 * are awarded here — the mobile app is the source of truth for these events.
 *
 * Returns { success: false, status: 400 } for schema errors so the mobile
 * caller does NOT retry (cf-44r envelope contract: 400 = permanent failure).
 *
 * cf-87tn / Phase 8
 */

import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import { insertAnalyticsEvent } from 'backend/utils/analyticsEvents';
import { logError } from 'backend/utils/errorHandler';
import { syncBadgeEarnedToPush } from 'backend/utils/crossRigSyncUtils';
import { sendPushToMember, PUSH_EVENTS, skipIfOptedOut } from 'backend/pushNotificationService.web';
import { completeMobileChallenge, MOBILE_CHALLENGE_TYPES } from 'backend/mobileChallengeService.web';

const SUPPORTED_EVENTS = new Set([
  'streak_extended',
  'challenge_started',
  'redemption_initiated',
  'quiz_completed',
  'product_favorited',
  'cart_abandoned',
  'loyalty_tier_reached',
  'review_submitted',
  'badge_earned',
  'tier_changed',
  'sommelier_completed',
  'price_drop_watching',
  'wishlist_synced',
  'ar_discovery_completed',
  'social_share_completed',
]);

/**
 * Receive a cross-rig event from the mobile app.
 *
 * @param {{ eventId?: string, schemaVersion: string, event: string, [key: string]: unknown }} body
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
export const crossRigEvent = webMethod(
  Permissions.Member,
  async (body) => {
    // ── Schema validation ──────────────────────────────────────────────────
    if (!body?.schemaVersion) {
      return { success: false, status: 400, error: 'schemaVersion is required' };
    }
    if (!body?.event || !SUPPORTED_EVENTS.has(body.event)) {
      return {
        success: false,
        status: 400,
        error: `unsupported event: ${body?.event ?? '(missing)'}`,
      };
    }

    // ── Event-specific required-field validation ───────────────────────────
    if (body.event === 'quiz_completed' && (!body.quizId || !body.resultSlug)) {
      return { success: false, status: 400, error: 'quiz_completed requires quizId and resultSlug' };
    }
    if (body.event === 'product_favorited' && !body.productId) {
      return { success: false, status: 400, error: 'product_favorited requires productId' };
    }
    if (body.event === 'cart_abandoned' && (!body.cartId || body.cartTotal == null)) {
      return { success: false, status: 400, error: 'cart_abandoned requires cartId and cartTotal' };
    }
    if (body.event === 'loyalty_tier_reached' && !body.tier) {
      return { success: false, status: 400, error: 'loyalty_tier_reached requires tier' };
    }
    if (body.event === 'review_submitted' && (!body.productId || body.rating == null)) {
      return { success: false, status: 400, error: 'review_submitted requires productId and rating' };
    }

    // ── Resolve memberId from session (not from body) ──────────────────────
    let memberId = null;
    try {
      const member = await currentMember.getMember();
      memberId = member?._id ?? null;
    } catch (err) {
      logError(`crossRigEvent(${body.event}) — getMember failed`, err);
    }

    if (!memberId) {
      return { success: false, status: 401, error: 'unauthenticated' };
    }

    // ── Build event-specific payload ───────────────────────────────────────
    const analyticsPayload = { eventId: body.eventId };
    if (body.event === 'streak_extended') {
      analyticsPayload.streak = body.streak;
      analyticsPayload.delta = body.delta;
      analyticsPayload.newTotal = body.newTotal;
    }
    if (body.event === 'challenge_started') {
      analyticsPayload.challengeId = body.challengeId;
      analyticsPayload.delta = body.delta;
      analyticsPayload.newTotal = body.newTotal;
    }
    if (body.event === 'redemption_initiated') {
      analyticsPayload.delta = body.delta;
      analyticsPayload.newTotal = body.newTotal;
    }
    if (body.event === 'quiz_completed') {
      analyticsPayload.quizId = body.quizId;
      analyticsPayload.resultSlug = body.resultSlug;
    }
    if (body.event === 'product_favorited') {
      analyticsPayload.productId = body.productId;
    }
    if (body.event === 'cart_abandoned') {
      analyticsPayload.cartId = body.cartId;
      analyticsPayload.cartTotal = body.cartTotal;
    }
    if (body.event === 'loyalty_tier_reached') {
      analyticsPayload.tier = body.tier;
    }
    if (body.event === 'review_submitted') {
      analyticsPayload.productId = body.productId;
      analyticsPayload.rating = body.rating;
    }

    // ── Log to analytics ───────────────────────────────────────────────────
    try {
      await insertAnalyticsEvent({
        memberId,
        eventType: body.event,
        source: body.source ?? 'mobile',
        payload: analyticsPayload,
      });
    } catch (err) {
      logError('crossRigEvent — insertAnalyticsEvent failed', err);
      return { success: false, error: 'analytics write failed' };
    }

    // ── Post-analytics push side effects ──────────────────────────────────
    // badge_earned routes through syncBadgeEarnedToPush so the dispatch is
    // also recorded in CrossRigSyncLog (cross-rig audit trail).
    if (body.event === 'badge_earned' && body.badgeId) {
      try {
        await syncBadgeEarnedToPush(memberId, body.badgeId);
      } catch (err) {
        logError('crossRigEvent — syncBadgeEarnedToPush failed', err);
        // Non-fatal: analytics logged, push failure does not fail the event
      }
    }
    // tier_changed fires directly — web-side trigger, no cross-rig sync log needed.
    // skipIfOptedOut checks member preferences before dispatching (cf-5je).
    if (body.event === 'tier_changed' && body.newTier) {
      try {
        const skip = await skipIfOptedOut(memberId, PUSH_EVENTS.TIER_CHANGED);
        if (!skip) {
          await sendPushToMember(memberId, PUSH_EVENTS.TIER_CHANGED, { tier: body.newTier });
        }
      } catch (err) {
        logError('crossRigEvent — tier_changed push failed', err);
        // Non-fatal
      }
    }

    // ── Mobile challenge completions (cf-cn2) ─────────────────────────────
    // quiz_completed, ar_discovery_completed, social_share_completed all route
    // to completeMobileChallenge for idempotent point award + completion logging.
    const MOBILE_CHALLENGE_EVENT_MAP = {
      quiz_completed: MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION,
      ar_discovery_completed: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY,
      social_share_completed: MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE,
    };
    if (MOBILE_CHALLENGE_EVENT_MAP[body.event]) {
      try {
        await completeMobileChallenge(
          memberId,
          MOBILE_CHALLENGE_EVENT_MAP[body.event],
          {
            productId: body.productId,
            score: body.score,
            total: body.total,
            platform: body.platform,
          }
        );
      } catch (err) {
        logError(`crossRigEvent — completeMobileChallenge(${body.event}) failed`, err);
        // Non-fatal: analytics already logged
      }
    }

    return { success: true };
  },
);
