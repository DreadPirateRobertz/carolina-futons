/**
 * AnalyticsEvents — shared write utility for the cross-funnel analytics collection.
 *
 * Schema compatible with CF-yz54 quiz events. All gamification event handlers
 * write here so PM can query quiz_started → purchased → badge_earned in one place.
 *
 * Best-effort: callers should wrap in try/catch. Never throws.
 * CF-3wl
 */
import wixData from 'wix-data';

export const ANALYTICS_EVENTS_COLLECTION = 'AnalyticsEvents';

/**
 * Insert one analytics event row.
 *
 * @param {{ memberId: string|null, eventType: string, source: string, payload: object }} params
 * @returns {Promise<void>}
 */
export async function insertAnalyticsEvent({ memberId, eventType, source, payload }) {
  await wixData.insert(
    ANALYTICS_EVENTS_COLLECTION,
    {
      memberId: memberId ?? null,
      eventType,
      source,
      payload: JSON.stringify(payload ?? {}),
      timestamp: new Date(),
    },
    { suppressAuth: true }
  );
}
