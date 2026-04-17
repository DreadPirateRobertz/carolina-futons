/**
 * pushNotificationService — FCM HTTP v1 push dispatch + push preferences.
 *
 * Sends push notifications to all active device tokens for a member.
 * Handles per-token FCM failures; deactivates stale tokens (NOT_FOUND/UNREGISTERED).
 *
 * Push preferences (cf-5je): members can opt in/out of push categories
 * (challenges, streak, marketing, tier). Stored in PushPreferences collection.
 *
 * CF-axn / cf-5je
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { getActiveTokensForMember, deactivateToken } from 'backend/pushTokenRegistry.web';

export const PUSH_EVENTS = {
  BADGE_EARNED:       'badge_earned',
  TIER_CHANGED:       'tier_changed',
  CHALLENGE_COMPLETE: 'challenge_complete',
  CHALLENGE_REMINDER: 'challenge_reminder',
  STREAK_MILESTONE:   'streak_milestone',
  PRICE_DROP:         'price_drop',
};

const FCM_STALE_STATUSES = ['NOT_FOUND', 'UNREGISTERED'];

function _buildMessage(event, payload) {
  switch (event) {
    case PUSH_EVENTS.BADGE_EARNED:
      return { title: 'Badge Earned!', body: `You earned the ${payload.badgeId} badge.` };
    case PUSH_EVENTS.TIER_CHANGED:
      return { title: 'Tier Upgrade!', body: `You reached ${payload.tier} tier.` };
    case PUSH_EVENTS.CHALLENGE_COMPLETE:
      return { title: 'Challenge Complete!', body: payload.challengeName || 'You finished a challenge.' };
    case PUSH_EVENTS.CHALLENGE_REMINDER:
      return { title: 'Challenge Reminder', body: payload.challengeName ? `Don't forget: ${payload.challengeName}` : 'You have an active challenge to complete.' };
    case PUSH_EVENTS.STREAK_MILESTONE:
      return { title: 'Streak Milestone!', body: `${payload.days}-day streak achieved.` };
    case PUSH_EVENTS.PRICE_DROP:
      return { title: 'Price Drop Alert', body: payload.productName ? `${payload.productName} is on sale!` : 'A wishlisted item dropped in price.' };
    default:
      return { title: 'Carolina Futons', body: 'You have a new notification.' };
  }
}

async function _sendFcm(token, title, body, data) {
  const projectId = process.env.FCM_PROJECT_ID || 'carolina-futons';
  const serverKey  = process.env.FCM_SERVER_KEY || '';
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const payload = { message: { token, notification: { title, body }, data: data || {} } };
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serverKey}` },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    return { ok: false, status: res.status, fcmStatus: err?.error?.status };
  }
  return { ok: true };
}

/**
 * Send a push notification to all active device tokens for a member.
 *
 * @param {string} memberId
 * @param {string} event    - One of PUSH_EVENTS values
 * @param {object} [payload] - Event-specific data (badgeId, tier, etc.)
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function sendPushToMember(memberId, event, payload = {}) {
  const tokens = await getActiveTokensForMember(memberId);
  if (!tokens.length) return { sent: 0, failed: 0 };

  const { title, body } = _buildMessage(event, payload);
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    tokens.map(async (tokenRecord) => {
      try {
        const result = await _sendFcm(tokenRecord.token, title, body, payload);
        if (result.ok) {
          sent++;
        } else {
          failed++;
          if (FCM_STALE_STATUSES.includes(result.fcmStatus)) {
            await deactivateToken(memberId, tokenRecord.token);
          }
        }
      } catch (err) {
        console.error('[pushNotificationService] FCM error:', err);
        failed++;
      }
    })
  );

  return { sent, failed };
}

// ── Push Preferences (cf-5je) ───────────────────────────────────────────────

export const PUSH_PREFERENCES_COLLECTION = 'PushPreferences';

const VALID_CATEGORIES = ['challenges', 'streak', 'marketing', 'tier', 'badges'];

const DEFAULT_PREFS = Object.freeze({
  challenges: true,
  streak: true,
  marketing: true,
  tier: true,
  badges: true,
});

/** Map PUSH_EVENTS values to preference categories. */
const EVENT_TO_CATEGORY = {
  [PUSH_EVENTS.CHALLENGE_COMPLETE]: 'challenges',
  [PUSH_EVENTS.CHALLENGE_REMINDER]: 'challenges',
  [PUSH_EVENTS.STREAK_MILESTONE]:   'streak',
  [PUSH_EVENTS.PRICE_DROP]:         'marketing',
  [PUSH_EVENTS.TIER_CHANGED]:       'tier',
  [PUSH_EVENTS.BADGE_EARNED]:       'badges',
};

/**
 * Check whether a push should be skipped based on member preferences.
 *
 * @param {string} memberId
 * @param {string} event - One of PUSH_EVENTS values
 * @returns {Promise<boolean>} true if the member has opted out of this category
 */
export async function skipIfOptedOut(memberId, event) {
  const category = EVENT_TO_CATEGORY[event];
  if (!category) return false; // unmapped events always send

  const result = await wixData.query(PUSH_PREFERENCES_COLLECTION)
    .eq('memberId', memberId)
    .find({ suppressAuth: true });

  if (!result.items.length) return false; // no record -> default all-in

  const record = result.items[0];
  const prefs = record.categoryPrefs || {};
  return prefs[category] === false;
}

/**
 * Update push notification preferences for the current member.
 *
 * @param {{ challenges?: boolean, streak?: boolean, marketing?: boolean, tier?: boolean }} prefs
 * @returns {Promise<{ success: boolean, prefs?: object, error?: string }>}
 */
export const managePushPreferences = webMethod(
  Permissions.SiteMember,
  async (prefs) => {
    if (!prefs || typeof prefs !== 'object') {
      return { success: false, error: 'prefs object is required' };
    }

    for (const key of Object.keys(prefs)) {
      if (!VALID_CATEGORIES.includes(key)) {
        return { success: false, error: `unknown category: ${key}` };
      }
      if (typeof prefs[key] !== 'boolean') {
        return { success: false, error: `category ${key} must be boolean` };
      }
    }

    // ── Resolve memberId from session (idor-ok) ───────────────────────────
    let memberId;
    try {
      const member = await currentMember.getMember();
      memberId = member?._id;
    } catch (_) { /* handled below */ }
    if (!memberId) return { success: false, error: 'unauthenticated' };

    const existing = await wixData.query(PUSH_PREFERENCES_COLLECTION)
      .eq('memberId', memberId)
      .find({ suppressAuth: true });

    let merged;
    if (existing.items.length) {
      const record = existing.items[0];
      merged = { ...DEFAULT_PREFS, ...record.categoryPrefs, ...prefs };
      await wixData.update(PUSH_PREFERENCES_COLLECTION, {
        ...record,
        categoryPrefs: merged,
        updatedAt: new Date(),
      }, { suppressAuth: true });
    } else {
      merged = { ...DEFAULT_PREFS, ...prefs };
      await wixData.insert(PUSH_PREFERENCES_COLLECTION, {
        memberId,
        categoryPrefs: merged,
        updatedAt: new Date(),
      }, { suppressAuth: true });
    }

    return { success: true, prefs: merged };
  },
);

/**
 * Read-only companion — returns current push preferences for the caller.
 *
 * @returns {Promise<{ success: boolean, prefs?: object, error?: string }>}
 */
export const getMyPushPreferences = webMethod(
  Permissions.SiteMember,
  async () => {
    let memberId;
    try {
      const member = await currentMember.getMember();
      memberId = member?._id;
    } catch (_) { /* handled below */ }
    if (!memberId) return { success: false, error: 'unauthenticated' };

    const result = await wixData.query(PUSH_PREFERENCES_COLLECTION)
      .eq('memberId', memberId)
      .find({ suppressAuth: true });

    if (!result.items.length) {
      return { success: true, prefs: { ...DEFAULT_PREFS } };
    }

    return { success: true, prefs: { ...DEFAULT_PREFS, ...result.items[0].categoryPrefs } };
  },
);
