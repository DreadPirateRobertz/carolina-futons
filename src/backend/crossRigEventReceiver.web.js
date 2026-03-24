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

const SUPPORTED_EVENTS = new Set(['streak_extended', 'challenge_started', 'redemption_initiated']);

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

    // ── Resolve memberId from session (not from body) ──────────────────────
    let memberId = null;
    try {
      const member = await currentMember.getMember();
      memberId = member?._id ?? null;
    } catch (err) {
      logError('crossRigEvent — getMember failed', err);
    }

    if (!memberId) {
      return { success: false, status: 401, error: 'unauthenticated' };
    }

    // ── Build event-specific payload ───────────────────────────────────────
    const analyticsPayload = {
      eventId: body.eventId,
      delta: body.delta,
      newTotal: body.newTotal,
    };
    if (body.event === 'streak_extended') {
      analyticsPayload.streak = body.streak;
    }
    if (body.event === 'challenge_started') {
      analyticsPayload.challengeId = body.challengeId;
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

    return { success: true };
  },
);
