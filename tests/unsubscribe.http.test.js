/**
 * @file unsubscribe.http.test.js
 * @description Tests for POST /_functions/unsubscribe JSON API endpoint and
 * the account-preferences webMethods in unsubscribeService.web.js.
 *
 * GET /_functions/unsubscribe is covered by tests/unsubscribeEndpoint.test.js.
 * cf-r9tf
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted } from './__mocks__/wix-data.js';

// ── POST /_functions/unsubscribe ──────────────────────────────────────────────

vi.mock('wix-http-functions', () => ({
  ok: vi.fn((opts) => ({ status: 200, ...opts })),
  badRequest: vi.fn((opts) => ({ status: 400, ...opts })),
  serverError: vi.fn((opts) => ({ status: 500, ...opts })),
  response: vi.fn((opts) => ({ ...opts })),
  notFound: vi.fn((opts) => ({ status: 404, ...opts })),
  forbidden: vi.fn((opts) => ({ status: 403, ...opts })),
  unauthorized: vi.fn((opts) => ({ status: 401, ...opts })),
}));

const { mockUnsubscribeContact, mockGetSecret } = vi.hoisted(() => ({
  mockUnsubscribeContact: vi.fn(),
  mockGetSecret: vi.fn(),
}));

vi.mock('backend/emailAutomation.web', () => ({
  unsubscribeContact: mockUnsubscribeContact,
  triggerAbandonedCartRecovery: vi.fn(),
  processEmailQueue: vi.fn(),
  triggerReengagement: vi.fn(),
  triggerPostPurchaseSequence: vi.fn(),
  getCampaignAnalytics: vi.fn(),
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: mockGetSecret,
}));

import { signUnsubToken } from '../src/backend/utils/unsubToken.js';
import { post_unsubscribe, options_unsubscribe } from '../src/backend/http-functions.js';

const TEST_SECRET = 'test-unsub-secret';

function makePostRequest(body = {}) {
  return {
    query: {},
    headers: { origin: 'https://carolina-futons-web.vercel.app' },
    body: { text: async () => JSON.stringify(body) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSecret.mockResolvedValue(TEST_SECRET);
  mockUnsubscribeContact.mockResolvedValue({ success: true });
});

describe('post_unsubscribe — success', () => {
  it('returns 200 with success:true for valid HMAC token', async () => {
    const token = await signUnsubToken('user@example.com', 'welcome', TEST_SECRET);
    const res = await post_unsubscribe(makePostRequest({ token }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: true, email: 'user@example.com' });
  });

  it('calls unsubscribeContact with decoded email and seq', async () => {
    const token = await signUnsubToken('sub@example.com', 'cart_recovery', TEST_SECRET);
    await post_unsubscribe(makePostRequest({ token }));
    expect(mockUnsubscribeContact).toHaveBeenCalledWith('sub@example.com', 'cart_recovery');
  });

  it('handles seq=all', async () => {
    const token = await signUnsubToken('bulk@example.com', 'all', TEST_SECRET);
    await post_unsubscribe(makePostRequest({ token }));
    expect(mockUnsubscribeContact).toHaveBeenCalledWith('bulk@example.com', 'all');
  });
});

describe('post_unsubscribe — token errors', () => {
  it('returns 400 for missing token field', async () => {
    const res = await post_unsubscribe(makePostRequest({}));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ success: false });
    expect(mockUnsubscribeContact).not.toHaveBeenCalled();
  });

  it('returns 400 for empty string token', async () => {
    const res = await post_unsubscribe(makePostRequest({ token: '' }));
    expect(res.status).toBe(400);
    expect(mockUnsubscribeContact).not.toHaveBeenCalled();
  });

  it('returns 400 for tampered token', async () => {
    const token = await signUnsubToken('user@example.com', 'all', TEST_SECRET);
    const [payload] = token.split('.');
    const res = await post_unsubscribe(makePostRequest({ token: `${payload}.badsig` }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'invalid-token' });
  });

  it('returns 400 for expired token', async () => {
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from(JSON.stringify({ email: 'u@e.com', seq: 'all', exp: 1 })).toString('base64url');
    const sig = createHmac('sha256', TEST_SECRET).update(payload).digest('base64url');
    const res = await post_unsubscribe(makePostRequest({ token: `${payload}.${sig}` }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'invalid-token' });
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = {
      query: {},
      headers: { origin: 'https://carolina-futons-web.vercel.app' },
      body: { text: async () => 'not-json' },
    };
    const res = await post_unsubscribe(req);
    expect(res.status).toBe(400);
  });
});

describe('post_unsubscribe — server errors', () => {
  it('returns 500 when getSecret throws', async () => {
    mockGetSecret.mockRejectedValue(new Error('secrets unavailable'));
    const token = await signUnsubToken('user@example.com', 'all', TEST_SECRET);
    const res = await post_unsubscribe(makePostRequest({ token }));
    expect(res.status).toBe(500);
    expect(mockUnsubscribeContact).not.toHaveBeenCalled();
  });

  it('returns 500 when unsubscribeContact throws', async () => {
    mockUnsubscribeContact.mockRejectedValue(new Error('DB error'));
    const token = await signUnsubToken('user@example.com', 'all', TEST_SECRET);
    const res = await post_unsubscribe(makePostRequest({ token }));
    expect(res.status).toBe(500);
  });
});

describe('options_unsubscribe', () => {
  it('returns a CORS preflight response', () => {
    const req = { headers: { origin: 'https://carolina-futons-web.vercel.app' } };
    const res = options_unsubscribe(req);
    expect(res).toBeDefined();
  });
});

// ── Account preferences webMethods ───────────────────────────────────────────

import { getEmailOptOutStatus, resubscribeContact } from '../src/backend/unsubscribeService.web.js';

const OPTED_OUT_EMAIL = 'optout@example.com';
const SUBSCRIBED_EMAIL = 'active@example.com';

function seedUnsubscribes() {
  resetData();
  __seed('Unsubscribes', [
    { _id: 'u1', email: OPTED_OUT_EMAIL, sequenceType: 'all', unsubscribedAt: new Date() },
  ]);
  __seed('ResubscribeRateLimit', []);
}

describe('getEmailOptOutStatus', () => {
  beforeEach(seedUnsubscribes);

  it('returns optedOut:true when all-sequence opt-out exists', async () => {
    const res = await getEmailOptOutStatus(OPTED_OUT_EMAIL);
    expect(res).toMatchObject({ success: true, optedOut: true });
  });

  it('returns optedOut:false for email with no opt-out record', async () => {
    const res = await getEmailOptOutStatus(SUBSCRIBED_EMAIL);
    expect(res).toMatchObject({ success: true, optedOut: false });
  });

  it('returns optedOut:false when only a sequence-specific opt-out exists', async () => {
    resetData();
    __seed('Unsubscribes', [
      { _id: 'u2', email: SUBSCRIBED_EMAIL, sequenceType: 'welcome', unsubscribedAt: new Date() },
    ]);
    const res = await getEmailOptOutStatus(SUBSCRIBED_EMAIL);
    expect(res).toMatchObject({ success: true, optedOut: false });
  });

  it('returns success:false for invalid email format', async () => {
    const res = await getEmailOptOutStatus('not-an-email');
    expect(res).toMatchObject({ success: false, optedOut: false });
  });
});

describe('resubscribeContact', () => {
  beforeEach(seedUnsubscribes);

  it('removes all opt-out records for the email', async () => {
    const res = await resubscribeContact(OPTED_OUT_EMAIL);
    expect(res).toMatchObject({ success: true });
    const remaining = __getInserted('Unsubscribes');
    expect(remaining.some(r => r.email === OPTED_OUT_EMAIL)).toBe(false);
  });

  it('returns success:true even when no opt-out records exist', async () => {
    const res = await resubscribeContact(SUBSCRIBED_EMAIL);
    expect(res).toMatchObject({ success: true });
  });

  it('returns success:false for invalid email', async () => {
    const res = await resubscribeContact('bad-email@@');
    expect(res).toMatchObject({ success: false });
  });
});
