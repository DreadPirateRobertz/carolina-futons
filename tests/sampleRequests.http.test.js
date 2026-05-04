/**
 * @file sampleRequests.http.test.js
 * @description TDD tests for POST /_functions/sampleRequests — Velo HTTP wrapper
 * around swatchRequest.submitSwatchRequest with per-email rate limiting (5/hour).
 *
 * cf-9t70
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/swatchRequest.web', () => ({
  submitSwatchRequest: vi.fn(),
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

import { submitSwatchRequest } from 'backend/swatchRequest.web';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { post_sampleRequests, options_sampleRequests } from '../src/backend/http-functions.js';

const VALID_BODY = {
  swatchIds: ['swatch-1', 'swatch-2'],
  contactInfo: {
    email: 'buyer@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    address: '123 Main St',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28739',
  },
  productSlug: 'kingston-futon-frame',
};

function makeRequest(body = VALID_BODY) {
  return {
    body: { text: async () => JSON.stringify(body) },
    headers: { origin: 'https://carolina-futons-web.vercel.app' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true });
  submitSwatchRequest.mockResolvedValue({ success: true, requestId: 'req-abc-123' });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('post_sampleRequests — success', () => {
  it('returns 200 with requestId on valid payload', async () => {
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.requestId).toBe('req-abc-123');
  });

  it('calls submitSwatchRequest with swatchIds, contactInfo, and productSlug', async () => {
    await post_sampleRequests(makeRequest());
    expect(submitSwatchRequest).toHaveBeenCalledWith({
      swatchIds: VALID_BODY.swatchIds,
      contactInfo: VALID_BODY.contactInfo,
      productSlug: VALID_BODY.productSlug,
    });
  });

  it('works when productSlug is omitted', async () => {
    const { productSlug: _, ...bodyWithout } = VALID_BODY;
    const res = await post_sampleRequests(makeRequest(bodyWithout));
    expect(res.status).toBe(200);
    expect(submitSwatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({ productSlug: undefined }),
    );
  });

  it('checks rate limit for the contact email', async () => {
    await post_sampleRequests(makeRequest());
    expect(checkRateLimit).toHaveBeenCalledWith(
      'SwatchRequestRateLimit',
      'buyer@example.com',
      expect.objectContaining({ max: 5, windowMs: 3_600_000 }),
    );
  });

  it('normalises email to lowercase before rate-limit check', async () => {
    const body = { ...VALID_BODY, contactInfo: { ...VALID_BODY.contactInfo, email: 'Buyer@EXAMPLE.COM' } };
    await post_sampleRequests(makeRequest(body));
    expect(checkRateLimit).toHaveBeenCalledWith('SwatchRequestRateLimit', 'buyer@example.com', expect.anything());
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe('post_sampleRequests — validation', () => {
  it('returns 400 on invalid JSON body', async () => {
    const req = {
      body: { text: async () => 'not-json' },
      headers: {},
    };
    const res = await post_sampleRequests(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid JSON/i);
  });

  it('returns 400 when submitSwatchRequest returns success:false', async () => {
    submitSwatchRequest.mockResolvedValue({ success: false, error: 'swatchIds must not be empty' });
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/swatchIds must not be empty/i);
  });

  it('returns 400 with fallback message when submitSwatchRequest returns success:false with no error', async () => {
    submitSwatchRequest.mockResolvedValue({ success: false });
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBeTruthy();
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('post_sampleRequests — rate limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/too many requests/i);
  });

  it('skips rate-limit check when contactInfo.email is absent', async () => {
    const body = { swatchIds: ['s1'], contactInfo: { firstName: 'No', lastName: 'Email' } };
    await post_sampleRequests(makeRequest(body));
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('does not call submitSwatchRequest when rate limit is exceeded', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    await post_sampleRequests(makeRequest());
    expect(submitSwatchRequest).not.toHaveBeenCalled();
  });
});

// ── Server errors ─────────────────────────────────────────────────────────────

describe('post_sampleRequests — server errors', () => {
  it('returns 500 when submitSwatchRequest resolves to null', async () => {
    submitSwatchRequest.mockResolvedValue(null);
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('returns 500 on unexpected thrown exception from submitSwatchRequest', async () => {
    submitSwatchRequest.mockRejectedValue(new Error('Wix DB timeout'));
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('returns 500 on unexpected thrown exception from checkRateLimit', async () => {
    checkRateLimit.mockRejectedValue(new Error('rate limit store unavailable'));
    const res = await post_sampleRequests(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ── CORS preflight ────────────────────────────────────────────────────────────

describe('options_sampleRequests', () => {
  it('returns a response object for CORS preflight', async () => {
    const res = await options_sampleRequests({ headers: { origin: 'https://carolina-futons-web.vercel.app' } });
    expect(res).toBeDefined();
    expect(typeof res.status).toBe('number');
  });
});
