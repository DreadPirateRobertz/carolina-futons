/**
 * @file wishlistServiceDispatcher.cfvtx5.test.js
 * @description cf-vtx5 reference implementation — `post_wishlistService`
 * dispatcher that routes /_functions/wishlistService/<method> to the
 * matching webMethod via request.path[0]. Same pattern godfrey will
 * replicate for gamificationCore, loyaltyService, referralService,
 * styleQuiz, pushNotificationService.
 *
 * Verifies:
 *   - method in allowlist + valid args → forwards to webMethod, returns its
 *     result envelope verbatim
 *   - method not in allowlist → 404 with `unknown_method`
 *   - missing/invalid JSON body → 400 with `invalid_json`
 *   - args not an Array → 400 with `args_must_be_array`
 *   - webMethod throws → 500 with errorId, error logged with same id
 *   - args spread positionally (callVelo's contract)
 *   - options_wishlistService returns a CORS preflight response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/wishlistService.web', () => ({
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  getWishlist: vi.fn(),
  getWishlistByMemberId: vi.fn(),
  isOnWishlist: vi.fn(),
}));

import {
  post_wishlistService,
  options_wishlistService,
} from '../src/backend/http-functions.js';
import {
  addToWishlist,
  getWishlist,
} from 'backend/wishlistService.web';

const makeRequest = (method, body = { args: [] }) => ({
  path: method ? [method] : [],
  body: { json: async () => body },
  headers: { origin: 'https://carolina-futons-web.vercel.app' },
});

beforeEach(() => {
  vi.mocked(addToWishlist).mockReset();
  vi.mocked(getWishlist).mockReset();
});

describe('cf-vtx5 · post_wishlistService dispatcher', () => {
  it('routes path[0] to the matching webMethod and returns its envelope verbatim', async () => {
    vi.mocked(getWishlist).mockResolvedValue({ success: true, items: [{ productId: 'p-1' }] });

    const res = await post_wishlistService(makeRequest('getWishlist'));

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ success: true, items: [{ productId: 'p-1' }] });
    expect(vi.mocked(getWishlist)).toHaveBeenCalledWith();
  });

  it('spreads body.args positionally into the webMethod call (callVelo contract)', async () => {
    vi.mocked(addToWishlist).mockResolvedValue({ success: true, item: { productId: 'p-9' } });

    await post_wishlistService(
      makeRequest('addToWishlist', {
        args: ['p-9', 'Eureka Slate', 1499, { imageUrl: 'https://cdn/p-9.jpg' }],
      }),
    );

    expect(vi.mocked(addToWishlist)).toHaveBeenCalledWith(
      'p-9',
      'Eureka Slate',
      1499,
      { imageUrl: 'https://cdn/p-9.jpg' },
    );
  });

  it('returns 404 unknown_method when the method is not in the allowlist', async () => {
    const res = await post_wishlistService(makeRequest('updateWishlistStock'));
    // updateWishlistStock IS exported by wishlistService but is Admin-only —
    // intentionally omitted from the allowlist; cfw must not be able to invoke it.
    expect(res.status).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('unknown_method');
    expect(body.method).toBe('updateWishlistStock');
  });

  it('returns 404 unknown_method when path is empty', async () => {
    const res = await post_wishlistService(makeRequest(null));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error).toBe('unknown_method');
  });

  it('returns 400 invalid_json on body parse failure', async () => {
    const req = {
      path: ['getWishlist'],
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: {},
    };
    const res = await post_wishlistService(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('returns 400 args_must_be_array when body lacks args[]', async () => {
    const res = await post_wishlistService(makeRequest('getWishlist', { foo: 'bar' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('args_must_be_array');
  });

  it('returns 500 with errorId when the webMethod throws', async () => {
    vi.mocked(getWishlist).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post_wishlistService(makeRequest('getWishlist'));

    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('server_error');
    expect(typeof body.errorId).toBe('string');
    expect(body.errorId.length).toBeGreaterThan(0);

    // errorId must appear in the server log for support correlation.
    const loggedCalls = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(loggedCalls).toContain(body.errorId);
    expect(loggedCalls).toContain('post_wishlistService:getWishlist');

    consoleErr.mockRestore();
  });

  it('cf-yvs4: maps security-class soft-failure ("Not authenticated") to 401', async () => {
    // PR #1164 originally returned 200 here. cf-yvs4 flipped to 4xx for
    // classified failures so cfw monitoring sees them. cf-mgnh refined the
    // mapper so business-logic outcomes still pass through as 200; only
    // security/authz/not-found/rate-limit/infra/validation get a 4xx/5xx.
    vi.mocked(addToWishlist).mockResolvedValue({ success: false, error: 'Not authenticated.' });
    const res = await post_wishlistService(makeRequest('addToWishlist', { args: ['p-1', 'x', 100] }));
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'Not authenticated.' });
  });

  it('cf-mgnh: business-logic soft-failure ("Wishlist is full") stays 200 + envelope', async () => {
    // The wishlist-full state is a successful authenticated request whose
    // outcome happens to be "no, can't add more". Treating it as 400 would
    // force cfw callers to wrap routine outcomes in try/catch (velo-client
    // throws VeloRpcError on non-2xx). 200 + envelope lets cfw branch on
    // body.success directly.
    vi.mocked(addToWishlist).mockResolvedValue({
      success: false,
      error: 'Wishlist is full (max 100 items).',
    });
    const res = await post_wishlistService(makeRequest('addToWishlist', { args: ['p-1', 'x', 100] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      success: false,
      error: 'Wishlist is full (max 100 items).',
    });
  });
});

describe('cf-vtx5 · options_wishlistService preflight', () => {
  it('returns a CORS preflight response', async () => {
    const res = await options_wishlistService({
      headers: { origin: 'https://carolina-futons-web.vercel.app' },
    });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
