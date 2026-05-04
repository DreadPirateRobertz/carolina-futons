import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies before importing the module under test ─────────────────

vi.mock('wix-http-functions', () => ({
  ok: vi.fn((opts) => ({ status: 200, ...opts })),
  badRequest: vi.fn((opts) => ({ status: 400, ...opts })),
  serverError: vi.fn((opts) => ({ status: 500, ...opts })),
  response: vi.fn((opts) => ({ ...opts })),
}));

const { mockUnsubscribeContact, mockGetSecret } = vi.hoisted(() => ({
  mockUnsubscribeContact: vi.fn(),
  mockGetSecret: vi.fn(),
}));

vi.mock('backend/emailAutomation.web', () => ({
  unsubscribeContact: mockUnsubscribeContact,
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: mockGetSecret,
}));

// Import after mocks
import { signUnsubToken } from '../src/backend/utils/unsubToken.js';
import * as httpFunctions from '../src/backend/http-functions.js';
import * as wixHttp from 'wix-http-functions';

const TEST_SECRET = 'test-unsub-secret';

function makeRequest(token) {
  return {
    query: { token },
    headers: {},
    method: 'GET',
    path: '/_functions/unsubscribe',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSecret.mockResolvedValue(TEST_SECRET);
  mockUnsubscribeContact.mockResolvedValue({ success: true });
});

describe('get_unsubscribe — valid token', () => {
  it('calls unsubscribeContact with decoded email and seq', async () => {
    const token = await signUnsubToken('user@example.com', 'welcome', TEST_SECRET);
    await httpFunctions.get_unsubscribe(makeRequest(token));
    expect(mockUnsubscribeContact).toHaveBeenCalledWith('user@example.com', 'welcome');
  });

  it('returns 200 HTML confirmation page on success', async () => {
    const token = await signUnsubToken('user@example.com', 'all', TEST_SECRET);
    await httpFunctions.get_unsubscribe(makeRequest(token));
    expect(wixHttp.ok).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'text/html' }) }),
    );
  });

  it('handles seq=all correctly', async () => {
    const token = await signUnsubToken('bulk@example.com', 'all', TEST_SECRET);
    await httpFunctions.get_unsubscribe(makeRequest(token));
    expect(mockUnsubscribeContact).toHaveBeenCalledWith('bulk@example.com', 'all');
  });
});

describe('get_unsubscribe — invalid / missing token', () => {
  it('returns 400 for missing token', async () => {
    await httpFunctions.get_unsubscribe(makeRequest(undefined));
    expect(wixHttp.badRequest).toHaveBeenCalled();
    expect(mockUnsubscribeContact).not.toHaveBeenCalled();
  });

  it('returns 400 for empty token', async () => {
    await httpFunctions.get_unsubscribe(makeRequest(''));
    expect(wixHttp.badRequest).toHaveBeenCalled();
    expect(mockUnsubscribeContact).not.toHaveBeenCalled();
  });

  it('returns 400 for tampered token', async () => {
    const token = await signUnsubToken('user@example.com', 'all', TEST_SECRET);
    const [payload] = token.split('.');
    const tampered = `${payload}.badsignature`;
    await httpFunctions.get_unsubscribe(makeRequest(tampered));
    expect(wixHttp.badRequest).toHaveBeenCalled();
    expect(mockUnsubscribeContact).not.toHaveBeenCalled();
  });

  it('returns 400 for expired token', async () => {
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from(JSON.stringify({ email: 'u@e.com', seq: 'all', exp: 1 })).toString('base64url');
    const sig = createHmac('sha256', TEST_SECRET).update(payload).digest('base64url');
    await httpFunctions.get_unsubscribe(makeRequest(`${payload}.${sig}`));
    expect(wixHttp.badRequest).toHaveBeenCalled();
  });
});

describe('get_unsubscribe — unsubscribeContact failure', () => {
  it('returns 500 when unsubscribeContact throws', async () => {
    mockUnsubscribeContact.mockRejectedValue(new Error('DB error'));
    const token = await signUnsubToken('user@example.com', 'all', TEST_SECRET);
    await httpFunctions.get_unsubscribe(makeRequest(token));
    expect(wixHttp.serverError).toHaveBeenCalled();
  });
});
