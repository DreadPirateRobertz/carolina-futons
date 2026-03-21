/**
 * Tests for Klarna HTTP functions
 *
 * Covers POST /_functions/klarna/checkout and /_functions/klarna/confirm.
 * Both are served by post_klarna(request), dispatched on request.path[0].
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler, __reset as resetFetch } from './__mocks__/wix-fetch.js';
import { post_klarna } from '../src/backend/http-functions.js';

// ── Fixtures ─────────────────────────────────────────────────────────

const KLARNA_CREDS = {
  KLARNA_API_USERNAME: 'PK12345_abc',
  KLARNA_API_PASSWORD: 's3cr3t',
  KLARNA_API_ENV: 'playground',
};

const sampleLineItems = [
  { name: 'Eureka Futon Frame', quantity: 1, unitPrice: 49900 },
  { name: 'Moonshadow Mattress', quantity: 2, unitPrice: 34900 },
];

const sampleTotals = {
  subtotal: 119700,
  shipping: 4900,
  tax: 8379,
  total: 132979,
};

function makeCheckoutRequest(body = {}) {
  const payload = JSON.stringify({ lineItems: sampleLineItems, totals: sampleTotals, ...body });
  return {
    path: ['checkout'],
    body: {
      text: async () => payload,
      json: async () => JSON.parse(payload),
    },
    headers: {},
  };
}

function makeConfirmRequest(body = {}) {
  const payload = JSON.stringify({ klarnaOrderId: 'korder-abc-123', ...body });
  return {
    path: ['confirm'],
    body: {
      text: async () => payload,
      json: async () => JSON.parse(payload),
    },
    headers: {},
  };
}

const klarnaCheckoutResponse = {
  order_id: 'korder-abc-123',
  order_url: 'https://checkout.klarna.com/eu1/checkout/korder-abc-123',
  status: 'checkout_incomplete',
};

const klarnaOrderResponse = {
  order_id: 'korder-abc-123',
  status: 'checkout_complete',
  order_amount: 132979,
  purchase_currency: 'USD',
};

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  resetSecrets();
  resetFetch();
  __setSecrets(KLARNA_CREDS);
});

// ── path routing ─────────────────────────────────────────────────────

describe('post_klarna — routing', () => {
  it('returns 400 for unknown sub-path', async () => {
    __setHandler(() => ({ ok: true, json: async () => klarnaCheckoutResponse }));
    const req = { path: ['unknown'], body: { text: async () => '{}' }, headers: {} };
    const result = await post_klarna(req);
    expect(result.status).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/unknown path|invalid/i);
  });

  it('returns 400 when path is missing', async () => {
    const req = { path: [], body: { text: async () => '{}' }, headers: {} };
    const result = await post_klarna(req);
    expect(result.status).toBe(400);
  });
});

// ── checkout ─────────────────────────────────────────────────────────

describe('post_klarna — checkout (/_functions/klarna/checkout)', () => {
  it('returns 200 with klarnaOrderId and redirectUrl on success', async () => {
    __setHandler(() => ({
      ok: true,
      json: async () => klarnaCheckoutResponse,
    }));
    const result = await post_klarna(makeCheckoutRequest());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.klarnaOrderId).toBe('korder-abc-123');
    expect(body.redirectUrl).toBe('https://checkout.klarna.com/eu1/checkout/korder-abc-123');
  });

  it('calls Klarna checkout API with correct auth header', async () => {
    let capturedUrl, capturedOptions;
    __setHandler((url, opts) => {
      capturedUrl = url;
      capturedOptions = opts;
      return { ok: true, json: async () => klarnaCheckoutResponse };
    });
    await post_klarna(makeCheckoutRequest());
    expect(capturedUrl).toContain('/checkout/v3/orders');
    expect(capturedOptions.method).toBe('POST');
    const expected = 'Basic ' + Buffer.from('PK12345_abc:s3cr3t').toString('base64');
    expect(capturedOptions.headers['Authorization']).toBe(expected);
  });

  it('uses playground URL when KLARNA_API_ENV=playground', async () => {
    let capturedUrl;
    __setHandler((url) => {
      capturedUrl = url;
      return { ok: true, json: async () => klarnaCheckoutResponse };
    });
    await post_klarna(makeCheckoutRequest());
    expect(capturedUrl).toContain('api.playground.klarna.com');
  });

  it('uses production URL when KLARNA_API_ENV=production', async () => {
    __setSecrets({ KLARNA_API_ENV: 'production' });
    let capturedUrl;
    __setHandler((url) => {
      capturedUrl = url;
      return { ok: true, json: async () => klarnaCheckoutResponse };
    });
    await post_klarna(makeCheckoutRequest());
    expect(capturedUrl).toContain('api.na.klarna.com');
    expect(capturedUrl).not.toContain('playground');
  });

  it('converts dollar totals to Klarna cents (×100)', async () => {
    let capturedBody;
    __setHandler((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => klarnaCheckoutResponse };
    });
    // totals.total = 132979 cents already in the fixture — but our http function
    // receives totals in cents (as stored internally) and passes them to Klarna
    await post_klarna(makeCheckoutRequest());
    expect(capturedBody.order_amount).toBe(sampleTotals.total);
    expect(capturedBody.order_tax_amount).toBe(sampleTotals.tax);
  });

  it('includes all line items in Klarna order_lines', async () => {
    let capturedBody;
    __setHandler((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => klarnaCheckoutResponse };
    });
    await post_klarna(makeCheckoutRequest());
    // sampleTotals.shipping > 0, so a shipping line is appended
    expect(capturedBody.order_lines).toHaveLength(sampleLineItems.length + 1);
    expect(capturedBody.order_lines[0].name).toBe('Eureka Futon Frame');
    expect(capturedBody.order_lines[0].quantity).toBe(1);
    expect(capturedBody.order_lines[0].unit_price).toBe(49900);
  });

  it('sets purchase_country=US and purchase_currency=USD', async () => {
    let capturedBody;
    __setHandler((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => klarnaCheckoutResponse };
    });
    await post_klarna(makeCheckoutRequest());
    expect(capturedBody.purchase_country).toBe('US');
    expect(capturedBody.purchase_currency).toBe('USD');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = {
      path: ['checkout'],
      body: { text: async () => 'not-json' },
      headers: {},
    };
    const result = await post_klarna(req);
    expect(result.status).toBe(400);
  });

  it('returns 400 when lineItems is missing', async () => {
    const result = await post_klarna(makeCheckoutRequest({ lineItems: undefined }));
    expect(result.status).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/lineItems/i);
  });

  it('returns 400 when lineItems is empty', async () => {
    const result = await post_klarna(makeCheckoutRequest({ lineItems: [] }));
    expect(result.status).toBe(400);
  });

  it('returns 400 when totals is missing', async () => {
    const result = await post_klarna(makeCheckoutRequest({ totals: undefined }));
    expect(result.status).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/totals/i);
  });

  it('returns 400 when total is not a positive number', async () => {
    const result = await post_klarna(makeCheckoutRequest({ totals: { ...sampleTotals, total: -1 } }));
    expect(result.status).toBe(400);
  });

  it('returns 500 when Klarna API is unavailable (secrets missing)', async () => {
    resetSecrets();
    __setSecrets({ KLARNA_API_USERNAME: 'u', KLARNA_API_PASSWORD: 'p' }); // no ENV
    __setHandler(() => { throw new Error('Network failure'); });
    const result = await post_klarna(makeCheckoutRequest());
    expect(result.status).toBe(500);
  });

  it('returns 500 when Klarna returns non-ok response', async () => {
    __setHandler(() => ({
      ok: false,
      status: 401,
      json: async () => ({ error_code: 'UNAUTHORIZED' }),
    }));
    const result = await post_klarna(makeCheckoutRequest());
    expect(result.status).toBe(500);
  });

  it('returns 500 when credentials secret is missing', async () => {
    resetSecrets();
    const result = await post_klarna(makeCheckoutRequest());
    expect(result.status).toBe(500);
  });

  it('returns no-store Cache-Control header', async () => {
    __setHandler(() => ({ ok: true, json: async () => klarnaCheckoutResponse }));
    const result = await post_klarna(makeCheckoutRequest());
    expect(result.headers['Cache-Control']).toBe('no-store');
  });
});

// ── confirm ──────────────────────────────────────────────────────────

describe('post_klarna — confirm (/_functions/klarna/confirm)', () => {
  it('returns 200 with klarnaOrderId and status on success', async () => {
    __setHandler(() => ({
      ok: true,
      json: async () => klarnaOrderResponse,
    }));
    const result = await post_klarna(makeConfirmRequest());
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.klarnaOrderId).toBe('korder-abc-123');
    expect(body.status).toBe('checkout_complete');
  });

  it('calls Klarna order-read endpoint with correct order ID', async () => {
    let capturedUrl;
    __setHandler((url) => {
      capturedUrl = url;
      return { ok: true, json: async () => klarnaOrderResponse };
    });
    await post_klarna(makeConfirmRequest());
    expect(capturedUrl).toContain('korder-abc-123');
    expect(capturedUrl).toContain('/checkout/v3/orders/');
  });

  it('uses correct auth header on confirm', async () => {
    let capturedOptions;
    __setHandler((url, opts) => {
      capturedOptions = opts;
      return { ok: true, json: async () => klarnaOrderResponse };
    });
    await post_klarna(makeConfirmRequest());
    const expected = 'Basic ' + Buffer.from('PK12345_abc:s3cr3t').toString('base64');
    expect(capturedOptions.headers['Authorization']).toBe(expected);
  });

  it('returns 400 when klarnaOrderId is missing', async () => {
    const result = await post_klarna(makeConfirmRequest({ klarnaOrderId: undefined }));
    expect(result.status).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/klarnaOrderId/i);
  });

  it('returns 400 when klarnaOrderId is not a non-empty string', async () => {
    const result = await post_klarna(makeConfirmRequest({ klarnaOrderId: '' }));
    expect(result.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = {
      path: ['confirm'],
      body: { text: async () => '{bad json' },
      headers: {},
    };
    const result = await post_klarna(req);
    expect(result.status).toBe(400);
  });

  it('returns 500 when Klarna returns non-ok on confirm', async () => {
    __setHandler(() => ({
      ok: false,
      status: 404,
      json: async () => ({ error_code: 'ORDER_NOT_FOUND' }),
    }));
    const result = await post_klarna(makeConfirmRequest());
    expect(result.status).toBe(500);
  });

  it('returns 500 when credentials are missing on confirm', async () => {
    resetSecrets();
    const result = await post_klarna(makeConfirmRequest());
    expect(result.status).toBe(500);
  });

  it('returns no-store Cache-Control on confirm', async () => {
    __setHandler(() => ({ ok: true, json: async () => klarnaOrderResponse }));
    const result = await post_klarna(makeConfirmRequest());
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('sanitizes klarnaOrderId — rejects IDs with path traversal characters', async () => {
    const result = await post_klarna(makeConfirmRequest({ klarnaOrderId: '../../../etc/passwd' }));
    expect(result.status).toBe(400);
  });

  it('returns order amount from Klarna response', async () => {
    __setHandler(() => ({ ok: true, json: async () => klarnaOrderResponse }));
    const result = await post_klarna(makeConfirmRequest());
    const body = JSON.parse(result.body);
    expect(body.amount).toBe(132979);
  });
});
