/**
 * Cross-rig event bus — outbound dispatcher (Web → Mobile).
 * Best-effort: errors are swallowed; never throws.
 * CF-44r
 */
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { BUS_SCHEMA_VERSION, OUTBOUND_EVENTS } from 'backend/utils/eventBus';

/**
 * Dispatch a web→mobile bus event to the mobile endpoint.
 * Silently no-ops if MOBILE_BUS_URL secret is absent.
 *
 * @param {{ event: string, userId: string, delta?: number, newTotal?: number, [key: string]: any }} params
 * @returns {Promise<void>}
 */
export async function dispatchBusEvent({ event, userId, delta, newTotal, ...extras }) {
  // Guard: only dispatch known outbound events
  if (!OUTBOUND_EVENTS.has(event)) return;

  let mobileUrl, busSecret;
  try {
    mobileUrl = await getSecret('MOBILE_BUS_URL');
    busSecret = await getSecret('BUS_SECRET');
  } catch (_) {
    // Secret not configured — silently skip dispatch
    return;
  }

  const eventId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const traceId = `trace_${eventId}`;

  const payload = {
    eventId,
    schemaVersion: BUS_SCHEMA_VERSION,
    traceId,
    event,
    userId,
    source: 'web',
    ts: Math.floor(Date.now() / 1000),
    ...(delta !== undefined ? { delta } : {}),
    ...(newTotal !== undefined ? { newTotal } : {}),
    ...extras,
  };

  try {
    await fetch(mobileUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bus-secret': busSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Best-effort: never throw
  }
}
