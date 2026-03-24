/**
 * @module illustrationDiscovery
 * @description Phase 8 — postMessage reply channel for illustration discovery events.
 *
 * Illustrations (inside Wix HTML iframes) fire discovery moments back to the page
 * via `window.parent.postMessage({ type: 'discovery', discoveryId: '...' }, '*')`.
 * masterPage receives these via `$w('#someIllustrationFrame').onMessage(cb)` and
 * delegates to `handleIllustrationReply` for validation + gamification routing.
 *
 * Security: only discoveryIds in KNOWN_DISCOVERY_IDS are accepted.
 * Unknown or malformed messages are silently ignored — no error, no award.
 *
 * CF-p8-reply / cf-1dn
 */

// ── Whitelist ─────────────────────────────────────────────────────────────────

/**
 * Canonical set of valid discovery IDs.
 * Any discoveryId not in this set is silently ignored.
 */
export const KNOWN_DISCOVERY_IDS = new Set([
  'constellation-orion',
  'constellation-cassiopeia',
  'mountain-firefly',
  'rainbow-arch',
]);

// ── validateDiscoveryEvent ────────────────────────────────────────────────────

/**
 * Validate a postMessage event from an illustration iframe.
 * Returns the validated discoveryId string, or null if invalid/unknown.
 *
 * @param {MessageEvent|{data: object}|object} event - Raw message event from $w.onMessage
 * @returns {string|null}
 */
export function validateDiscoveryEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const data = event.data ?? event;
  if (!data || data.type !== 'discovery') return null;
  const { discoveryId } = data;
  if (typeof discoveryId !== 'string') return null;
  if (!KNOWN_DISCOVERY_IDS.has(discoveryId)) return null;
  return discoveryId;
}

// ── handleIllustrationReply ───────────────────────────────────────────────────

/**
 * Handle a postMessage event from an illustration iframe.
 * Validates the event, then routes a valid discovery to the gamification engine.
 *
 * @param {object} event - Raw message event (from $w('#frame').onMessage callback)
 * @param {string} memberId - Authenticated member ID
 * @param {object} deps - Injectable dependencies for testing
 * @param {Function} deps.receiveEvent - `receiveGamificationEvent(eventName, payload, memberId)`
 * @returns {Promise<{handled: boolean, result?: object}>}
 */
export async function handleIllustrationReply(event, memberId, { receiveEvent }) {
  const discoveryId = validateDiscoveryEvent(event);
  if (!discoveryId) return { handled: false };
  try {
    const result = await receiveEvent(`discovery_${discoveryId}`, {}, memberId);
    return { handled: true, result };
  } catch (err) {
    console.error('[illustrationDiscovery] receiveEvent failed:', err);
    return { handled: true, result: { success: false } };
  }
}
