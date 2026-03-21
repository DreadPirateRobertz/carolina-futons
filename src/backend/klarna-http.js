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
 *   - Rate limiting: max 10 checkout requests per member per 60 s
 *   - IDOR guard on confirm: order must belong to current member
 */
import { ok, serverError, badRequest, unauthorized, forbidden, response } from 'wix-http-functions';
import { currentMember } from 'wix-members-backend';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

// ── Constants ────────────────────────────────────────────────────────────────

const KLARNA_API_BASE = 'https://api.playground.klarna.com';

/** Allowed prefixes for returnUrl / cancelUrl (open-redirect + SSRF guard) */
const ALLOWED_URL_PREFIXES = [
  'https://www.carolinafutons.com/',
  'https://chrisdealglass.wixstudio.com/',
];

/** Dutch 7-item SSRF blocklist — private/link-local/loopback IP ranges */
const SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/127\./,            // 1. IPv4 loopback
  /^https?:\/\/10\./,             // 2. Private class A
  /^https?:\/\/192\.168\./,       // 3. Private class C
  /^https?:\/\/169\.254\./,       // 4. Link-local / AWS metadata
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,  // 5. Private class B
  /^https?:\/\/0\./,              // 6. Current-network
  /^https?:\/\/::1/,              // 7. IPv6 loopback
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
 * @param {string} url
 * @returns {string|null} error message, or null if valid
 */
function validateCallbackUrl(url, fieldName) {
  if (!url) return `${fieldName} is required`;
  if (isUrlSsrfBlocked(url)) return `${fieldName} targets a blocked IP range`;
  if (!isUrlAllowed(url)) return `${fieldName} must be a whitelisted domain`;
  return null;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function resolveCurrentMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Check rate limit for a member. Returns true if request is allowed,
 * false if the member has exceeded RATE_LIMIT_MAX in the current window.
 * Updates the counter in Klarna_RateLimit collection.
 */
async function checkAndIncrementRateLimit(memberId) {
  const now = Date.now();
  const recordId = `rl-${memberId}`;

  let existing = null;
  try {
    const result = await wixData.query(RATE_LIMIT_COLLECTION)
      .eq('memberId', memberId)
      .limit(1)
      .find();
    existing = result.items.length > 0 ? result.items[0] : null;
  } catch {
    existing = null;
  }

  if (existing) {
    const windowExpired = (now - existing.windowStart) > RATE_LIMIT_WINDOW_MS;
    if (windowExpired) {
      // Reset window
      await wixData.update(RATE_LIMIT_COLLECTION, {
        _id: existing._id,
        memberId,
        windowStart: now,
        count: 1,
      });
      return true;
    }
    if (existing.count >= RATE_LIMIT_MAX) {
      return false;
    }
    await wixData.update(RATE_LIMIT_COLLECTION, {
      _id: existing._id,
      memberId,
      windowStart: existing.windowStart,
      count: existing.count + 1,
    });
    return true;
  }

  // First request — create record
  await wixData.insert(RATE_LIMIT_COLLECTION, {
    _id: recordId,
    memberId,
    windowStart: now,
    count: 1,
  });
  return true;
}

// ── Klarna API client ─────────────────────────────────────────────────────────

async function getKlarnaAuth() {
  const [username, password] = await Promise.all([
    getSecret('KLARNA_API_USERNAME'),
    getSecret('KLARNA_API_PASSWORD'),
  ]);
  return `Basic ${btoa(`${username}:${password}`)}`;
}

// ── post_klarna_checkout ──────────────────────────────────────────────────────

/**
 * POST /_functions/klarna/checkout
 * Create a Klarna checkout session.
 *
 * Body: { cartId, lineItems, returnUrl, cancelUrl, customerId? }
 * Returns: { klarnaOrderId, klarnaCheckoutUrl, expiresAt }
 */
export async function post_klarna_checkout(request) {
  try {
    // 1. Auth
    const member = await resolveCurrentMember();
    if (!member) {
      return unauthorized({ body: JSON.stringify({ error: 'Authentication required' }), headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Parse body
    let body;
    try {
      body = JSON.parse(await request.body.text());
    } catch {
      return badRequest({ body: JSON.stringify({ error: 'Invalid JSON body' }), headers: { 'Content-Type': 'application/json' } });
    }

    const { cartId, lineItems, returnUrl, cancelUrl, customerId } = body;

    // 3. Validate required fields
    if (!cartId) {
      return badRequest({ body: JSON.stringify({ error: 'cartId is required' }), headers: { 'Content-Type': 'application/json' } });
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return badRequest({ body: JSON.stringify({ error: 'lineItems must be a non-empty array' }), headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Validate returnUrl / cancelUrl (whitelist + SSRF)
    const returnUrlError = validateCallbackUrl(returnUrl, 'returnUrl');
    if (returnUrlError) {
      return badRequest({ body: JSON.stringify({ error: returnUrlError }), headers: { 'Content-Type': 'application/json' } });
    }
    const cancelUrlError = validateCallbackUrl(cancelUrl, 'cancelUrl');
    if (cancelUrlError) {
      return badRequest({ body: JSON.stringify({ error: cancelUrlError }), headers: { 'Content-Type': 'application/json' } });
    }

    // 5. Rate limit
    const allowed = await checkAndIncrementRateLimit(member._id);
    if (!allowed) {
      return response({ status: 429, body: JSON.stringify({ error: 'Rate limit exceeded. Max 10 requests per minute.' }), headers: { 'Content-Type': 'application/json' } });
    }

    // 6. Call Klarna API
    const auth = await getKlarnaAuth();
    const klarnaPayload = {
      purchase_country: 'US',
      purchase_currency: 'USD',
      locale: 'en-US',
      merchant_urls: {
        terms: 'https://www.carolinafutons.com/terms',
        checkout: returnUrl,
        confirmation: returnUrl,
        push: `https://www.carolinafutons.com/_functions/klarna/confirm`,
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

    const klarnaResp = await fetch(`${KLARNA_API_BASE}/checkout/v3/orders`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(klarnaPayload),
    });

    if (!klarnaResp.ok) {
      console.error('[klarna-http] Klarna checkout API error:', klarnaResp.status);
      return serverError({ body: JSON.stringify({ error: 'Klarna API error creating session' }), headers: { 'Content-Type': 'application/json' } });
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

    return ok({
      body: JSON.stringify({ klarnaOrderId, klarnaCheckoutUrl, expiresAt }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[klarna-http] checkout error:', err.message, err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: { 'Content-Type': 'application/json' } });
  }
}

// ── post_klarna_confirm ───────────────────────────────────────────────────────

/**
 * POST /_functions/klarna/confirm
 * Confirm a Klarna order after the buyer completes the flow.
 *
 * Body: { klarnaOrderId, cartId }
 * Returns: { confirmed: true, orderId }
 */
export async function post_klarna_confirm(request) {
  try {
    // 1. Auth
    const member = await resolveCurrentMember();
    if (!member) {
      return unauthorized({ body: JSON.stringify({ error: 'Authentication required' }), headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Parse body
    let body;
    try {
      body = JSON.parse(await request.body.text());
    } catch {
      return badRequest({ body: JSON.stringify({ error: 'Invalid JSON body' }), headers: { 'Content-Type': 'application/json' } });
    }

    const { klarnaOrderId, cartId } = body;

    // 3. Validate
    if (!klarnaOrderId) {
      return badRequest({ body: JSON.stringify({ error: 'klarnaOrderId is required' }), headers: { 'Content-Type': 'application/json' } });
    }
    if (!cartId) {
      return badRequest({ body: JSON.stringify({ error: 'cartId is required' }), headers: { 'Content-Type': 'application/json' } });
    }

    // 4. IDOR guard — order must belong to current member
    let pendingOrder = null;
    try {
      const result = await wixData.query(PENDING_ORDERS_COLLECTION)
        .eq('klarnaOrderId', klarnaOrderId)
        .limit(1)
        .find();
      pendingOrder = result.items.length > 0 ? result.items[0] : null;
    } catch {
      pendingOrder = null;
    }

    if (!pendingOrder) {
      return forbidden({ body: JSON.stringify({ error: 'Order not found or unauthorized' }), headers: { 'Content-Type': 'application/json' } });
    }
    if (pendingOrder.memberId !== member._id) {
      return forbidden({ body: JSON.stringify({ error: 'Order not found or unauthorized' }), headers: { 'Content-Type': 'application/json' } });
    }

    // 5. Call Klarna confirm API
    const auth = await getKlarnaAuth();
    const klarnaResp = await fetch(`${KLARNA_API_BASE}/checkout/v3/orders/${klarnaOrderId}`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!klarnaResp.ok) {
      console.error('[klarna-http] Klarna confirm API error:', klarnaResp.status);
      return serverError({ body: JSON.stringify({ error: 'Klarna API error confirming order' }), headers: { 'Content-Type': 'application/json' } });
    }

    const klarnaData = await klarnaResp.json();

    return ok({
      body: JSON.stringify({ confirmed: true, orderId: klarnaData.order_id || klarnaOrderId }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[klarna-http] confirm error:', err.message, err);
    return serverError({ body: JSON.stringify({ error: 'Internal server error' }), headers: { 'Content-Type': 'application/json' } });
  }
}
