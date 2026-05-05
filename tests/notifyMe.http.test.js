/**
 * @file notifyMe.http.test.js
 * @description Canonical test for POST /_functions/notifyMe — Velo HTTP wrapper
 * that inserts back-in-stock notify-me requests into the NotifyMe CMS collection.
 *
 * Backfills cf-nisz (zero coverage prior). Pattern mirrors sampleRequests.http.test.js.
 * cf-89xn follow-up #2 (pr-test-analyzer flagged coverage gap).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __setInsertError,
  __getInserted,
} from './__mocks__/wix-data.js';

import { post_notifyMe, options_notifyMe } from '../src/backend/http-functions.js';

const VALID_BODY = {
  email: 'buyer@example.com',
  productId: 'prod-canby-frame-001',
  source: 'pdp',
};

function makeRequest(body = VALID_BODY, opts = {}) {
  const text = opts.rawBody ?? JSON.stringify(body);
  return {
    body: { text: async () => text },
    headers: {
      origin: opts.origin ?? 'https://carolina-futons-web.vercel.app',
      ...(opts.headers || {}),
    },
  };
}

beforeEach(() => {
  resetData();
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('post_notifyMe — success', () => {
  it('returns 200 with success:true on valid email + productId', async () => {
    const res = await post_notifyMe(makeRequest());
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });

  it('inserts a record into the NotifyMe collection', async () => {
    await post_notifyMe(makeRequest());
    const rows = __getInserted('NotifyMe');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'buyer@example.com',
      productId: 'prod-canby-frame-001',
      source: 'pdp',
    });
  });

  it('lowercases email before insert', async () => {
    await post_notifyMe(makeRequest({ ...VALID_BODY, email: 'Buyer@EXAMPLE.com' }));
    const rows = __getInserted('NotifyMe');
    expect(rows[0].email).toBe('buyer@example.com');
  });

  it('trims surrounding whitespace from email and productId', async () => {
    await post_notifyMe(
      makeRequest({ email: '  user@example.com  ', productId: '  prod-1  ' }),
    );
    const rows = __getInserted('NotifyMe');
    expect(rows[0].email).toBe('user@example.com');
    expect(rows[0].productId).toBe('prod-1');
  });

  it('defaults source to "pdp" when omitted', async () => {
    const { source: _, ...without } = VALID_BODY;
    await post_notifyMe(makeRequest(without));
    const rows = __getInserted('NotifyMe');
    expect(rows[0].source).toBe('pdp');
  });

  it('truncates source to 50 characters', async () => {
    const longSource = 'x'.repeat(120);
    await post_notifyMe(makeRequest({ ...VALID_BODY, source: longSource }));
    const rows = __getInserted('NotifyMe');
    expect(rows[0].source).toHaveLength(50);
  });

  it('sets CORS headers for an allowed origin', async () => {
    const res = await post_notifyMe(makeRequest());
    expect(res.headers['Access-Control-Allow-Origin']).toBe(
      'https://carolina-futons-web.vercel.app',
    );
    expect(res.headers['Content-Type']).toBe('application/json');
  });
});

// ── Validation rejection ──────────────────────────────────────────────────────

describe('post_notifyMe — validation', () => {
  it('returns 400 on invalid JSON body', async () => {
    const res = await post_notifyMe(makeRequest(null, { rawBody: 'not-json' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid JSON/i);
  });

  it('returns 400 when email is missing', async () => {
    const { email: _, ...without } = VALID_BODY;
    const res = await post_notifyMe(makeRequest(without));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/email/i);
  });

  it('returns 400 when email format is invalid', async () => {
    const res = await post_notifyMe(makeRequest({ ...VALID_BODY, email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/email/i);
  });

  it('returns 400 when productId is missing', async () => {
    const { productId: _, ...without } = VALID_BODY;
    const res = await post_notifyMe(makeRequest(without));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/product id/i);
  });

  it('returns 400 when email is non-string', async () => {
    const res = await post_notifyMe(makeRequest({ ...VALID_BODY, email: 12345 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when productId is non-string', async () => {
    const res = await post_notifyMe(makeRequest({ ...VALID_BODY, productId: ['p1'] }));
    expect(res.status).toBe(400);
  });

  it('does not write to NotifyMe collection on validation failure', async () => {
    await post_notifyMe(makeRequest({ ...VALID_BODY, email: 'bad' }));
    expect(__getInserted('NotifyMe')).toEqual([]);
  });
});

// ── Downstream failure ────────────────────────────────────────────────────────

describe('post_notifyMe — downstream failure', () => {
  it('returns 500 when wixData.insert throws', async () => {
    __setInsertError('NotifyMe', new Error('Wix Data store unavailable'));
    const res = await post_notifyMe(makeRequest());
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/internal server error/i);
  });

  it('still returns CORS headers on a 500 path so the browser can read the body', async () => {
    __setInsertError('NotifyMe', new Error('boom'));
    const res = await post_notifyMe(makeRequest());
    expect(res.headers['Access-Control-Allow-Origin']).toBe(
      'https://carolina-futons-web.vercel.app',
    );
    expect(res.headers['Content-Type']).toBe('application/json');
  });
});

// ── CORS preflight ────────────────────────────────────────────────────────────

describe('options_notifyMe', () => {
  it('returns a preflight response with status set', async () => {
    const res = await options_notifyMe(
      makeRequest(null, { headers: {}, rawBody: '' }),
    );
    expect(res).toBeDefined();
    expect(typeof res.status).toBe('number');
  });

  it('returns 204 for an allowed origin', async () => {
    const res = await options_notifyMe(
      makeRequest(null, { headers: {}, rawBody: '' }),
    );
    expect(res.status).toBe(204);
  });
});
