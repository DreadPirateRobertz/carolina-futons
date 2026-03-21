/**
 * @module klarna-http
 * @description Wix HTTP functions for Klarna checkout integration.
 * Exposes two endpoints consumed by cfutons_mobile (cm-3e3):
 *
 *   POST /_functions/klarna/checkout  — create a Klarna session
 *   POST /_functions/klarna/confirm   — confirm a Klarna order
 *
 * Security:
 *   - SiteMember auth required (no guest checkout)
 *   - returnUrl/cancelUrl whitelist (SSRF + open-redirect guard)
 *   - Dutch 7-item SSRF blocklist for private/link-local IPs
 *     (loopback, class A/B/C private, link-local, current-net, IPv6 loopback)
 *   - Rate limiting: max 10 checkout requests per member per 60 s
 *     DB failure fails closed (throws → outer catch → 500)
 *   - IDOR guard on confirm: order must belong to current member, cartId matched
 *   - Confirmed orders deleted from Klarna_PendingOrders (replay prevention)
 *
 * Klarna API base URL: defaults to https://api.klarna.com (production).
 * Override by setting the KLARNA_API_BASE_URL secret to the playground URL
 * (https://api.playground.klarna.com) for testing.
 */
import { ok, serverError, badRequest, unauthorized, forbidden, response } from 'wix-http-functions';
import { currentMember } from 'wix-members-backend';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

// ── Constants ────────────────────────────────────────────────────────────────

/** Allowed prefixes for returnUrl / cancelUrl (open-redirect + SSRF guard) */
const ALLOWED_URL_PREFIXES = [
  'https://www.carolinafutons.com/',
  'https://chrisdealglass.wixstudio.com/',
];

/**
 * Dutch 7-item SSRF blocklist — private/link-local/loopback IP ranges.
 * Applied to returnUrl and cancelUrl to prevent server-side request forgery.
 */
const SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/127\./,                         // 1. IPv4 loopback
  /^https?:\/\/10\./,                          // 2. Private class A
  /^https?:\/\/192\.168\./,                    // 3. Private class C
  /^https?:\/\/169\.254\./,                    // 4. Link-local / AWS metadata
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,   // 5. Private class B (172.16–31)
  /^https?:\/\/0\./,                           // 6. Current-network (0.x.x.x)
  /^https?:\/\/::1/,                           // 7. IPv6 loopback
];

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const PENDING_ORDERS_COLLECTION = 'Klarna_PendingOrders';
const RATE_LIMIT_COLLECTION = 'Klarna_RateLimit';

// ── Security helpers ──────────────────────────────────────────────────────────

function isUrlAllowed(url) {
  if (!url || typeof url !== 'string') return false;
  return ALLOWED_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

function isUrlSsrfBlocked(url) {
  return SSRF_BLOCKED_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Validate a callback URL: must be on whitelist AND not match SSRF blocklist.
 * @param {string} url - The URL to validate.
 * @param {string} fieldName - Field name for error messages (e.g. 'returnUrl').
 * @returns {string|null} Error message, or null if valid.
 */
function validateCallbackUrl(url, fieldName) {
  if (!url) return `${fieldName} is required`;
  if (isUrlSsrfBlocked(url)) return `${fieldName} targets a blocked IP range`;
  if (!isUrlAllowed(url)) return `${fieldName} must be a whitelisted domain`;
  return null;
}

// ── Response helper ───────────────────────────────────────────────────────────

/** Convenience: build a JSON response body + Content-Type header pair */
function jsonBody(obj) {
  return { body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } };
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function resolveCurrentMember() {
  try {
    return await currentMember.getMember();
  } catch (err) {
    console.error('[klarna-http] getMember error:', err.message);
    return null;
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Check and increment rate limit for a member.
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Throws on wix-data failure (fail closed — outer catch returns 500).
 */
async function checkAndIncrementRateLimit(memberId) {
  const now = Date.now();
  const recordId = `rl-${memberId}`;

  // DB failure throws intentionally — fail closed, not fail open
  const result = await wixData.query(RATE_LIMIT_COLLECTION)
    .eq('memberId', memberId)
    .limit(1)
    .find();
  const existing = result.items.length > 0 ? result.items[0] : null;

  if (existing) {
    const windowExpired = (now - existing.windowStart) > RATE_LIMIT_WINDOW_MS;
    if (windowExpired) {
      await wixData.update(RATE_LIMIT_COLLECTION, {
        _id: existing._id, memberId, windowStart: now, count: 1,
      });
      return true;
    }
    if (existing.count >= RATE_LIMIT_MAX) {
      return false;
    }
    await wixData.update(RATE_LIMIT_COLLECTION, {
      _id: existing._id, memberId, windowStart: existing.windowStart, count: existing.count + 1,
    });
    return true;
  }

  // First request in this window — create record
  await wixData.insert(RATE_LIMIT_COLLECTION, {
    _id: recordId, memberId, windowStart: now, count: 1,
  });
  return true;
}

// ── Klarna API client ─────────────────────────────────────────────────────────

/**
 * Load Klarna credentials and API base URL from secrets.
 * KLARNA_API_BASE_URL secret overrides the production default — use this
 * to point at https://api.playground.klarna.com during development/testing.
 */
async function getKlarnaConfig() {
  const [username, password] = await Promise.all([
    getSecret('KLARNA_API_USERNAME'),
    getSecret('KLARNA_API_PASSWORD'),
  ]);
  let apiBase = 'https://api.klarna.com';
  try {
    const override = await getSecret('KLARNA_API_BASE_URL');
    if (override) apiBase = override;
  } catch {
    // Secret not set — production default stands
  }
  return { auth: `Basic ${btoa(`${username}:${password}`)}`, apiBase };
}

// ── post_klarna_checkout ──────────────────────────────────────────────────────

/**
 * POST /_functions/klarna/checkout
 * Create a Klarna checkout session.
 *
 * @param {Object} request - Wix HTTP request.
 * Body: { cartId: string, lineItems: Array, returnUrl: string, cancelUrl: string, customerId?: string }
 * Returns: { klarnaOrderId: string, klarnaCheckoutUrl: string, expiresAt: string }
 * Note: klarnaCheckoutUrl is Klarna's html_snippet (an embeddable widget string, not a bare URL).
 */
export async function post_klarna_checkout(request) {
  try {
    // 1. Auth
    const member = await resolveCurrentMember();
    if (!member) {
      return unauthorized(jsonBody({ error: 'Authentication required' }));
    }

    // 2. Parse body
    let body;
    try {
      body = JSON.parse(await request.body.text());
    } catch {
      return badRequest(jsonBody({ error: 'Invalid JSON body' }));
    }

    const { cartId, lineItems, returnUrl, cancelUrl } = body;

    // 3. Validate required fields
    if (!cartId) {
      return badRequest(jsonBody({ error: 'cartId is required' }));
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return badRequest(jsonBody({ error: 'lineItems must be a non-empty array' }));
    }

    // 4. Validate returnUrl / cancelUrl (whitelist + SSRF)
    const returnUrlError = validateCallbackUrl(returnUrl, 'returnUrl');
    if (returnUrlError) {
      return badRequest(jsonBody({ error: returnUrlError }));
    }
    const cancelUrlError = validateCallbackUrl(cancelUrl, 'cancelUrl');
    if (cancelUrlError) {
      return badRequest(jsonBody({ error: cancelUrlError }));
    }

    // 5. Rate limit (throws on DB failure → fail closed → 500)
    const allowed = await checkAndIncrementRateLimit(member._id);
    if (!allowed) {
      return response({ status: 429, ...jsonBody({ error: 'Rate limit exceeded. Max 10 requests per minute.' }) });
    }

    // 6. Call Klarna API
    const { auth, apiBase } = await getKlarnaConfig();
    const klarnaPayload = {
      purchase_country: 'US',
      purchase_currency: 'USD',
      locale: 'en-US',
      merchant_urls: {
        terms: 'https://www.carolinafutons.com/terms',
        checkout: returnUrl,
        confirmation: returnUrl,
        push: 'https://www.carolinafutons.com/_functions/klarna/confirm',
      },
      order_lines: lineItems.map(item => ({
        type: 'physical',
        reference: item.reference || '',
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_amount: item.quantity * item.unitPrice,
      })),
    };

    const klarnaResp = await fetch(`${apiBase}/checkout/v3/orders`, {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(klarnaPayload),
    });

    if (!klarnaResp.ok) {
      let klarnaError = {};
      try { klarnaError = await klarnaResp.json(); } catch {}
      console.error('[klarna-http] Klarna checkout API error:', klarnaResp.status, JSON.stringify(klarnaError));
      return serverError(jsonBody({ error: 'Klarna API error creating session' }));
    }

    const klarnaData = await klarnaResp.json();
    const { order_id: klarnaOrderId, html_snippet: klarnaCheckoutUrl, expires_at: expiresAt } = klarnaData;

    // 7. Persist pending order for IDOR guard on confirm
    await wixData.insert(PENDING_ORDERS_COLLECTION, {
      _id: klarnaOrderId,
      klarnaOrderId,
      memberId: member._id,
      cartId,
      createdAt: new Date().toISOString(),
    });

    return ok(jsonBody({ klarnaOrderId, klarnaCheckoutUrl, expiresAt }));
  } catch (err) {
    console.error('[klarna-http] checkout error:', err.message, err);
    return serverError(jsonBody({ error: 'Internal server error' }));
  }
}

// ── post_klarna_confirm ───────────────────────────────────────────────────────

/**
 * POST /_functions/klarna/confirm
 * Confirm a Klarna order after the buyer completes the checkout flow.
 * Deletes the pending order record to prevent replay.
 *
 * @param {Object} request - Wix HTTP request.
 * Body: { klarnaOrderId: string, cartId: string }
 * Returns: { confirmed: true, orderId: string }
 */
export async function post_klarna_confirm(request) {
  try {
    // 1. Auth
    const member = await resolveCurrentMember();
    if (!member) {
      return unauthorized(jsonBody({ error: 'Authentication required' }));
    }

    // 2. Parse body
    let body;
    try {
      body = JSON.parse(await request.body.text());
    } catch {
      return badRequest(jsonBody({ error: 'Invalid JSON body' }));
    }

    const { klarnaOrderId, cartId } = body;

    // 3. Validate
    if (!klarnaOrderId) {
      return badRequest(jsonBody({ error: 'klarnaOrderId is required' }));
    }
    if (!cartId) {
      return badRequest(jsonBody({ error: 'cartId is required' }));
    }

    // 4. IDOR guard — order must exist, belong to current member, and match cartId.
    // DB failure throws → outer catch returns 500 (not 403 — distinct failure mode).
    const klarnaResult = await wixData.query(PENDING_ORDERS_COLLECTION)
      .eq('klarnaOrderId', klarnaOrderId)
      .limit(1)
      .find();
    const pendingOrder = klarnaResult.items.length > 0 ? klarnaResult.items[0] : null;

    if (!pendingOrder || pendingOrder.memberId !== member._id || pendingOrder.cartId !== cartId) {
      return forbidden(jsonBody({ error: 'Order not found or unauthorized' }));
    }

    // 5. Call Klarna confirm API.
    // Klarna v3: POST /checkout/v3/orders/{id}/confirm acknowledges the order.
    const { auth, apiBase } = await getKlarnaConfig();
    const klarnaResp = await fetch(`${apiBase}/checkout/v3/orders/${klarnaOrderId}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!klarnaResp.ok) {
      let klarnaError = {};
      try { klarnaError = await klarnaResp.json(); } catch {}
      console.error('[klarna-http] Klarna confirm API error:', klarnaResp.status, JSON.stringify(klarnaError));
      return serverError(jsonBody({ error: 'Klarna API error confirming order' }));
    }

    const klarnaData = await klarnaResp.json();

    // 6. Delete pending order to prevent replay of this confirm endpoint
    await wixData.remove(PENDING_ORDERS_COLLECTION, klarnaOrderId);

    return ok(jsonBody({ confirmed: true, orderId: klarnaData.order_id || klarnaOrderId }));
  } catch (err) {
    console.error('[klarna-http] confirm error:', err.message, err);
    return serverError(jsonBody({ error: 'Internal server error' }));
  }
}
