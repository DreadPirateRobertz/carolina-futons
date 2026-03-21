/**
 * CF-ty9g: Klarna HTTP functions — TDD test suite
 *
 * Covers:
 * - post_klarna_checkout: auth, validation, returnUrl whitelist, SSRF guard,
 *   rate limiting, Klarna API success/failure, wix-data order persistence
 * - post_klarna_confirm: auth, validation, IDOR guard, Klarna confirm success/failure
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';
import { __reset as resetSecrets, __setSecrets } from 'wix-secrets-backend';
import { __reset as resetFetch, __setHandler } from 'wix-fetch';
import { __reset as resetData, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  post_klarna_checkout,
  post_klarna_confirm,
} from '../src/backend/klarna-http.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_MEMBER = { _id: 'member-abc', loginEmail: 'buyer@example.com' };

const PROD_RETURN_URL = 'https://www.carolinafutons.com/checkout/success';
const PROD_CANCEL_URL = 'https://www.carolinafutons.com/checkout/cancel';
const STAGING_RETURN_URL = 'https://chrisdealglass.wixstudio.com/checkout/success';
const STAGING_CANCEL_URL = 'https://chrisdealglass.wixstudio.com/checkout/cancel';

const VALID_LINE_ITEMS = [
  { name: 'Eureka Futon Frame', quantity: 1, unitPrice: 49900, reference: 'sku-001' },
];

function makeRequest(bodyObj) {
  return {
    body: {
      async text() { return JSON.stringify(bodyObj); },
    },
  };
}

function makeValidCheckoutReq(overrides = {}) {
  return makeRequest({
    cartId: 'cart-123',
    lineItems: VALID_LINE_ITEMS,
    returnUrl: PROD_RETURN_URL,
    cancelUrl: PROD_CANCEL_URL,
    customerId: 'cust-xyz',
    ...overrides,
  });
}

/** Klarna API mock: returns a successful order creation response */
function klarnaCheckoutOkHandler(url, opts) {
  if (url.includes('/checkout/v3/orders') && opts?.method === 'POST') {
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          order_id: 'klarna-order-abc',
          html_snippet: '<div>Klarna</div>',
          expires_at: '2026-03-21T15:00:00Z',
        };
      },
    };
  }
  return { ok: false, status: 500, async json() { return {}; } };
}

/** Klarna API mock: returns a successful confirm response */
function klarnaConfirmOkHandler(url, opts) {
  if (url.includes('/checkout/v3/orders') && (opts?.method === 'POST' || opts?.method === 'PATCH')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return { order_id: 'klarna-order-abc', status: 'CONFIRMED' };
      },
    };
  }
  return { ok: false, status: 500, async json() { return {}; } };
}

function seedPendingOrder(klarnaOrderId = 'klarna-order-abc', memberId = 'member-abc') {
  __seed('Klarna_PendingOrders', [{
    _id: klarnaOrderId,
    klarnaOrderId,
    memberId,
    cartId: 'cart-123',
    createdAt: new Date().toISOString(),
  }]);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMembers();
  resetSecrets();
  resetFetch();
  resetData();
  __setSecrets({
    KLARNA_API_USERNAME: 'test-user',
    KLARNA_API_PASSWORD: 'test-pass',
  });
  __setMember(VALID_MEMBER);
  __setHandler(klarnaCheckoutOkHandler);
  // Seed an empty rate limit collection (no prior requests)
  __seed('Klarna_RateLimit', []);
});

// ── post_klarna_checkout — Auth ───────────────────────────────────────────────

describe('post_klarna_checkout — auth', () => {
  it('returns 401 when no member is logged in', async () => {
    __setMember(null);
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(401);
  });

  it('returns 401 when getMember throws', async () => {
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockRejectedValueOnce(new Error('Session expired'));
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(401);
  });
});

// ── post_klarna_checkout — Validation ─────────────────────────────────────────

describe('post_klarna_checkout — input validation', () => {
  it('returns 400 when cartId is missing', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ cartId: undefined }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/cartId/i);
  });

  it('returns 400 when lineItems is missing', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ lineItems: undefined }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/lineItems/i);
  });

  it('returns 400 when lineItems is empty array', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ lineItems: [] }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/lineItems/i);
  });

  it('returns 400 when returnUrl is missing', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ returnUrl: undefined }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/returnUrl/i);
  });

  it('returns 400 when cancelUrl is missing', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ cancelUrl: undefined }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/cancelUrl/i);
  });
});

// ── post_klarna_checkout — returnUrl whitelist ────────────────────────────────

describe('post_klarna_checkout — returnUrl whitelist', () => {
  it('accepts production returnUrl', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ returnUrl: PROD_RETURN_URL }));
    expect(result.status).toBe(200);
  });

  it('accepts staging returnUrl', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ returnUrl: STAGING_RETURN_URL, cancelUrl: STAGING_CANCEL_URL }));
    expect(result.status).toBe(200);
  });

  it('rejects http:// returnUrl', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ returnUrl: 'http://www.carolinafutons.com/checkout' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/returnUrl/i);
  });

  it('rejects returnUrl on unlisted domain', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ returnUrl: 'https://evil.com/checkout' }));
    expect(result.status).toBe(400);
  });

  it('rejects returnUrl that uses carolinafutons.com as subdomain of attacker domain', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({
      returnUrl: 'https://www.carolinafutons.com.evil.com/checkout',
    }));
    expect(result.status).toBe(400);
  });

  it('rejects cancelUrl on unlisted domain', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({ cancelUrl: 'https://attacker.net/cancel' }));
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/cancelUrl/i);
  });
});

// ── post_klarna_checkout — SSRF guard ─────────────────────────────────────────

describe('post_klarna_checkout — SSRF guard', () => {
  it('rejects returnUrl with 127.x.x.x loopback', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({
      returnUrl: 'https://127.0.0.1/checkout',
    }));
    expect(result.status).toBe(400);
  });

  it('rejects cancelUrl with 169.254.x.x link-local (metadata endpoint)', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({
      cancelUrl: 'https://169.254.169.254/latest/meta-data/',
    }));
    expect(result.status).toBe(400);
  });

  it('rejects returnUrl with 10.x.x.x private range', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({
      returnUrl: 'https://10.0.0.1/checkout',
    }));
    expect(result.status).toBe(400);
  });

  it('rejects returnUrl with 192.168.x.x private range', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq({
      returnUrl: 'https://192.168.1.100/checkout',
    }));
    expect(result.status).toBe(400);
  });
});

// ── post_klarna_checkout — Rate limiting ──────────────────────────────────────

describe('post_klarna_checkout — rate limiting', () => {
  it('allows request when under rate limit', async () => {
    __seed('Klarna_RateLimit', [{
      _id: `rl-member-abc`,
      memberId: 'member-abc',
      windowStart: Date.now() - 30000,
      count: 9,
    }]);
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(200);
  });

  it('returns 429 when rate limit exceeded (10 requests in window)', async () => {
    __seed('Klarna_RateLimit', [{
      _id: 'rl-member-abc',
      memberId: 'member-abc',
      windowStart: Date.now() - 30000,
      count: 10,
    }]);
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(429);
    expect(JSON.parse(result.body).error).toMatch(/rate limit/i);
  });

  it('resets count when window has expired (> 60 seconds)', async () => {
    __seed('Klarna_RateLimit', [{
      _id: 'rl-member-abc',
      memberId: 'member-abc',
      windowStart: Date.now() - 70000,  // window expired
      count: 10,
    }]);
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(200);
  });
});

// ── post_klarna_checkout — Success ────────────────────────────────────────────

describe('post_klarna_checkout — success', () => {
  it('returns 200 with klarnaOrderId, klarnaCheckoutUrl, expiresAt', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.klarnaOrderId).toBe('klarna-order-abc');
    expect(body.klarnaCheckoutUrl).toBeDefined();
    expect(body.expiresAt).toBe('2026-03-21T15:00:00Z');
  });

  it('persists order to Klarna_PendingOrders with memberId', async () => {
    await post_klarna_checkout(makeValidCheckoutReq());
    const orders = __getInserted('Klarna_PendingOrders');
    expect(orders.length).toBeGreaterThanOrEqual(1);
    const order = orders.find(o => o.klarnaOrderId === 'klarna-order-abc');
    expect(order).toBeDefined();
    expect(order.memberId).toBe('member-abc');
    expect(order.cartId).toBe('cart-123');
  });

  it('Content-Type header is application/json', async () => {
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

// ── post_klarna_checkout — Klarna API error ───────────────────────────────────

describe('post_klarna_checkout — Klarna API error', () => {
  it('returns 500 when Klarna API returns non-ok', async () => {
    __setHandler(() => ({ ok: false, status: 400, async json() { return { error_code: 'BAD_VALUE' }; } }));
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(500);
    expect(JSON.parse(result.body).error).toMatch(/klarna/i);
  });

  it('returns 500 when Klarna API call throws', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const result = await post_klarna_checkout(makeValidCheckoutReq());
    expect(result.status).toBe(500);
  });
});

// ── post_klarna_confirm ───────────────────────────────────────────────────────
// Shared setup: most confirm tests need a seeded order + confirm handler.

describe('post_klarna_confirm', () => {
  const confirmReq = (overrides = {}) =>
    makeRequest({ klarnaOrderId: 'klarna-order-abc', cartId: 'cart-123', ...overrides });

  describe('auth', () => {
    it('returns 401 when no member is logged in', async () => {
      __setMember(null);
      seedPendingOrder();
      __setHandler(klarnaConfirmOkHandler);
      expect((await post_klarna_confirm(confirmReq())).status).toBe(401);
    });
  });

  describe('input validation', () => {
    it('returns 400 when klarnaOrderId is missing', async () => {
      const result = await post_klarna_confirm(makeRequest({ cartId: 'cart-123' }));
      expect(result.status).toBe(400);
      expect(JSON.parse(result.body).error).toMatch(/klarnaOrderId/i);
    });

    it('returns 400 when cartId is missing', async () => {
      const result = await post_klarna_confirm(makeRequest({ klarnaOrderId: 'klarna-order-abc' }));
      expect(result.status).toBe(400);
      expect(JSON.parse(result.body).error).toMatch(/cartId/i);
    });
  });

  describe('IDOR guard', () => {
    it('returns 403 when klarnaOrderId not found in pending orders', async () => {
      __seed('Klarna_PendingOrders', []);
      __setHandler(klarnaConfirmOkHandler);
      const result = await post_klarna_confirm(makeRequest({ klarnaOrderId: 'unknown-order', cartId: 'cart-123' }));
      expect(result.status).toBe(403);
      expect(JSON.parse(result.body).error).toMatch(/not found|unauthorized/i);
    });

    it('returns 403 when order belongs to a different member', async () => {
      seedPendingOrder('klarna-order-abc', 'other-member-xyz');
      __setHandler(klarnaConfirmOkHandler);
      expect((await post_klarna_confirm(confirmReq())).status).toBe(403);
    });
  });

  describe('success', () => {
    beforeEach(() => {
      seedPendingOrder();
      __setHandler(klarnaConfirmOkHandler);
    });

    it('returns 200 with confirmed: true and orderId', async () => {
      const result = await post_klarna_confirm(confirmReq());
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.confirmed).toBe(true);
      expect(body.orderId).toBeDefined();
    });

    it('Content-Type header is application/json', async () => {
      const result = await post_klarna_confirm(confirmReq());
      expect(result.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Klarna API error', () => {
    beforeEach(() => { seedPendingOrder(); });

    it('returns 500 when Klarna confirm API returns non-ok', async () => {
      __setHandler(() => ({ ok: false, status: 500, async json() { return {}; } }));
      const result = await post_klarna_confirm(confirmReq());
      expect(result.status).toBe(500);
      expect(JSON.parse(result.body).error).toMatch(/klarna/i);
    });

    it('returns 500 when Klarna confirm API throws', async () => {
      __setHandler(() => { throw new Error('Network timeout'); });
      expect((await post_klarna_confirm(confirmReq())).status).toBe(500);
    });
  });
});
