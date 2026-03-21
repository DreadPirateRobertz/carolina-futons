/**
 * @module klarnaService
 * @description Server-side proxy for the Klarna Checkout API.
 *
 * Exposes two operations consumed by post_klarna in http-functions.js:
 *   - createKlarnaSession: creates a Klarna checkout order and returns the
 *     redirect URL for the mobile WebView flow.
 *   - readKlarnaOrder: reads a completed Klarna checkout order for confirmation.
 *
 * Credentials (KLARNA_API_USERNAME, KLARNA_API_PASSWORD, KLARNA_API_ENV) are
 * loaded from Wix Secrets Manager on each call — never hardcoded.
 *
 * Amounts: all monetary values are in cents (integer), matching Klarna's wire
 * format. Callers must not pass dollar floats.
 */

import { fetch } from 'wix-fetch';

// ── Constants ─────────────────────────────────────────────────────────

const KLARNA_BASE_URLS = {
  playground: 'https://api.playground.klarna.com',
  production: 'https://api.na.klarna.com',
};

const MERCHANT_URLS = {
  terms: 'https://www.carolinafutons.com/terms',
  checkout: 'https://www.carolinafutons.com/checkout',
  confirmation: 'https://www.carolinafutons.com/order-confirmation',
  push: 'https://www.carolinafutons.com/_functions/klarna/push',
};

// ── Credentials ───────────────────────────────────────────────────────

async function loadCredentials() {
  const { getSecret } = await import('wix-secrets-backend');
  const [username, password, env] = await Promise.all([
    getSecret('KLARNA_API_USERNAME'),
    getSecret('KLARNA_API_PASSWORD'),
    getSecret('KLARNA_API_ENV').catch(() => 'production'),
  ]);
  const baseUrl = KLARNA_BASE_URLS[env] ?? KLARNA_BASE_URLS.production;
  const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  return { baseUrl, auth };
}

// ── API helpers ───────────────────────────────────────────────────────

async function klarnaPost(path, body) {
  const { baseUrl, auth } = await loadCredentials();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new KlarnaApiError(
      errBody.error_code ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

async function klarnaGet(path) {
  const { baseUrl, auth } = await loadCredentials();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { 'Authorization': auth },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new KlarnaApiError(
      errBody.error_code ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create a Klarna checkout session.
 *
 * @param {Array<{name: string, quantity: number, unitPrice: number}>} lineItems
 * @param {{subtotal: number, shipping: number, tax: number, total: number}} totals
 *   All values in cents.
 * @returns {Promise<{klarnaOrderId: string, redirectUrl: string}>}
 */
export async function createKlarnaSession(lineItems, totals) {
  const order_lines = lineItems.map((item) => ({
    type: 'physical',
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_rate: 0,
    total_amount: item.unitPrice * item.quantity,
    total_discount_amount: 0,
    total_tax_amount: 0,
  }));

  // Add shipping as a separate order line if non-zero
  if (totals.shipping > 0) {
    order_lines.push({
      type: 'shipping_fee',
      name: 'Shipping',
      quantity: 1,
      unit_price: totals.shipping,
      tax_rate: 0,
      total_amount: totals.shipping,
      total_discount_amount: 0,
      total_tax_amount: 0,
    });
  }

  const data = await klarnaPost('/checkout/v3/orders', {
    purchase_country: 'US',
    purchase_currency: 'USD',
    locale: 'en-US',
    order_amount: totals.total,
    order_tax_amount: totals.tax,
    order_lines,
    merchant_urls: MERCHANT_URLS,
  });

  return {
    klarnaOrderId: data.order_id,
    redirectUrl: data.order_url,
  };
}

/**
 * Read a Klarna checkout order by ID (used to confirm completion).
 *
 * @param {string} klarnaOrderId
 * @returns {Promise<{klarnaOrderId: string, status: string, amount: number}>}
 */
export async function readKlarnaOrder(klarnaOrderId) {
  const data = await klarnaGet(`/checkout/v3/orders/${encodeURIComponent(klarnaOrderId)}`);
  return {
    klarnaOrderId: data.order_id,
    status: data.status,
    amount: data.order_amount,
  };
}

// ── Error type ────────────────────────────────────────────────────────

export class KlarnaApiError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.name = 'KlarnaApiError';
    this.httpStatus = httpStatus;
  }
}
