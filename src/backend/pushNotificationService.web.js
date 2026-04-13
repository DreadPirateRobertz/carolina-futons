/**
 * pushNotificationService — FCM HTTP v1 push dispatch.
 *
 * Sends push notifications to all active device tokens for a member.
 * Handles per-token FCM failures; deactivates stale tokens (NOT_FOUND/UNREGISTERED).
 *
 * CF-axn
 */
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
