/**
 * Cross-rig event bus utilities.
 * Schema: { eventId, schemaVersion: '1.0', traceId, event, userId, delta?, newTotal?, source, ts }
 * CF-44r
 *
 * ── CartSessions collection (mobile read) ──────────────────────────────────────
 * Web writes cart session state to CartSessions for mobile to query by memberId.
 * Schema: { _id, memberId, sessionId, items: Array<{productId, qty, price}>,
 *           updatedAt: Date, source: 'web'|'mobile' }
 * Mobile queries: wixData.query('CartSessions').eq('memberId', memberId).find()
 * CF-86gj: CartSessions writes now implemented in src/backend/cartSessionService.web.js.
 * Call createSession on page load, updateCartItems on every cart mutation,
 * and mergeGuestCart at login to preserve guest cart across auth boundary.
 */
import wixData from 'wix-data';

export const BUS_SCHEMA_VERSION = '1.0';
export const EVENT_TRACE_COLLECTION = 'EventTraceLog';

/** Mobile→Web events (inbound) */
export const INBOUND_EVENTS = new Set([
  'streak_extended',
  'challenge_started',
  'redemption_initiated',
  'badge_earned',
  'tier_changed',
  'sommelier_completed',
  'price_drop_watching',
  'wishlist_synced',
]);

/** Web→Mobile events (outbound) */
export const OUTBOUND_EVENTS = new Set([
  'points_earned',
  'tier_upgraded',
  'challenge_completed',
  'badge_earned',
  'streak_extended',
]);

/**
 * Validate an incoming bus event payload.
 * Returns null on success, or an error string describing what's wrong.
 * @param {object} body
 * @returns {string|null}
 */
export function validateIncomingEvent(body) {
  if (!body?.eventId) return 'Missing required field: eventId';
  if (!body?.schemaVersion) return 'Missing required field: schemaVersion';
  if (body.schemaVersion !== BUS_SCHEMA_VERSION) return `Unsupported schemaVersion — expected ${BUS_SCHEMA_VERSION}`;
  if (!body?.event) return 'Missing required field: event';
  if (!INBOUND_EVENTS.has(body.event)) return `Unknown event "${body.event}" — must be one of: ${[...INBOUND_EVENTS].join(', ')}`;
  // userId is advisory — server always uses session-resolved memberId, so omitting it is not an error.
  return null;
}

/**
 * Log an event to EventTraceLog. Idempotent — skips insert if eventId already recorded.
 * @param {{ eventId, traceId, event, userId, source, ts, status }} params
 * @returns {Promise<void>}
 */
export async function logEventTrace({ eventId, traceId, event, userId, source, ts, status }) {
  // Idempotency check: skip if this eventId was already recorded
  const existing = await wixData
    .query(EVENT_TRACE_COLLECTION)
    .eq('eventId', eventId)
    .limit(1)
    .find({ suppressAuth: true });
  if (existing.items.length > 0) return;

  await wixData.insert(
    EVENT_TRACE_COLLECTION,
    { _id: eventId, eventId, traceId, event, userId: userId || null, source: source || null, ts: ts || Math.floor(Date.now() / 1000), status },
    { suppressAuth: true }
  );
}
