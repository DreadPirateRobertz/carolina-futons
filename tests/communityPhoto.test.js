/**
 * @file communityPhoto.test.js
 * @description cf-0h9q coverage for the customer photo gallery (UGC)
 * webMethod + HTTP wrapper. cfw posts {imageUrl, customerName, location,
 * caption, productSlug} anonymously to /_functions/submitCommunityPhoto;
 * the wrapper inserts into CommunityPhotos CMS with status:'pending'.
 *
 * Verifies (cf-yvs4 contract):
 *   - 200 + {success:true, photoId} on a clean insert
 *   - 4xx + {success:false, error} on validation failures (invalid URL,
 *     missing fields, oversized strings, bad slug)
 *   - 429 when the per-host rate-limit fires
 *   - 500 with errorId on infra throw
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/utils/rateLimit', async (importOriginal) => {
  // Real extractTrustedClientIp + hashRateLimitKey, mocked checkRateLimit.
  // Tests assert on the post-trim rate-limit key, so the helper must
  // execute with the real XFF parsing logic.
  const actual = await importOriginal();
  return { ...actual, checkRateLimit: vi.fn() };
});

import {
  post_submitCommunityPhoto,
  options_submitCommunityPhoto,
} from '../src/backend/http-functions.js';
import { submitCommunityPhoto, _validateCommunityPhoto } from 'backend/communityPhoto.web';
import { __reset as resetData, __seed, __getInserted, __setInsertError } from './__mocks__/wix-data.js';
import { checkRateLimit } from 'backend/utils/rateLimit';

const goodOrigin = 'https://carolina-futons-web.vercel.app';
const VALID_BODY = {
  imageUrl: 'https://cdn.example.com/uploads/p1.jpg',
  customerName: 'Sarah J.',
  location: 'Asheville, NC',
  caption: 'Loving the new frame in our living room',
  productSlug: 'eureka-futon-frame',
};

function flatReq(body, headers = {}) {
  return {
    body: { json: async () => body },
    headers: { origin: goodOrigin, ...headers },
  };
}

beforeEach(() => {
  resetData();
  __seed('CommunityPhotos', []);
  // cf-k5vr: clear before re-arming so per-test assertions on
  // `mock.calls` see only this test's calls, not accumulated history.
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
});

// ── _validateCommunityPhoto (pure, no I/O) ────────────────────────────────────

describe('cf-0h9q · _validateCommunityPhoto', () => {
  it('returns null on a valid payload', () => {
    expect(_validateCommunityPhoto(VALID_BODY)).toBeNull();
  });

  it('rejects null / non-object payloads', () => {
    expect(_validateCommunityPhoto(null)).toEqual({ error: 'Invalid payload' });
    expect(_validateCommunityPhoto('nope')).toEqual({ error: 'Invalid payload' });
  });

  it('rejects missing imageUrl', () => {
    const bad = { ...VALID_BODY, imageUrl: '' };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/imageUrl/i);
  });

  it('rejects http:// imageUrl (https only)', () => {
    const bad = { ...VALID_BODY, imageUrl: 'http://cdn.example.com/x.jpg' };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/https/);
  });

  it('rejects javascript: imageUrl (no XSS via URL)', () => {
    const bad = { ...VALID_BODY, imageUrl: 'javascript:alert(1)' };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/https/);
  });

  it('rejects oversized imageUrl', () => {
    const bad = { ...VALID_BODY, imageUrl: 'https://cdn.example.com/' + 'x'.repeat(600) };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/too long/i);
  });

  it('rejects missing customerName', () => {
    const bad = { ...VALID_BODY, customerName: '' };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/customerName/i);
  });

  it('rejects oversized caption', () => {
    const bad = { ...VALID_BODY, caption: 'x'.repeat(2100) };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/caption/i);
  });

  it('rejects invalid productSlug', () => {
    const bad = { ...VALID_BODY, productSlug: 'not a slug!!' };
    expect(_validateCommunityPhoto(bad)?.error).toMatch(/slug/i);
  });

  it('accepts payload without optional fields', () => {
    expect(_validateCommunityPhoto({ imageUrl: VALID_BODY.imageUrl, customerName: 'X' })).toBeNull();
  });
});

// ── submitCommunityPhoto (webMethod) ──────────────────────────────────────────

describe('cf-0h9q · submitCommunityPhoto webMethod', () => {
  it('inserts a pending row on a valid payload', async () => {
    const result = await submitCommunityPhoto(VALID_BODY);
    expect(result.success).toBe(true);
    expect(typeof result.photoId).toBe('string');

    const rows = __getInserted('CommunityPhotos');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      imageUrl: VALID_BODY.imageUrl,
      customerName: 'Sarah J.',
      status: 'pending',
      productSlug: 'eureka-futon-frame',
    });
    expect(rows[0].submittedAt).toBeInstanceOf(Date);
  });

  it('rate-limit fires on 6th submission within window', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false });
    const result = await submitCommunityPhoto(VALID_BODY);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
    expect(__getInserted('CommunityPhotos')).toHaveLength(0);
  });

  it('fails open when rate-limit infra throws', async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('ratelimit DB down'));
    const result = await submitCommunityPhoto(VALID_BODY);
    expect(result.success).toBe(true);
    expect(__getInserted('CommunityPhotos')).toHaveLength(1);
  });

  // cf-k5vr: per-client (IP) axis — preferred when wrapper supplies one.
  it('cf-k5vr: opts.rateLimitKey overrides imageUrl-host axis', async () => {
    await submitCommunityPhoto(VALID_BODY, { rateLimitKey: '203.0.113.7' });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      '203.0.113.7',
      expect.objectContaining({ max: 5, windowMs: 60 * 60 * 1000 }),
    );
  });

  it('cf-k5vr: falls back to imageUrl host when opts is omitted', async () => {
    await submitCommunityPhoto(VALID_BODY);
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      'cdn.example.com',
      expect.objectContaining({ max: 5, windowMs: 60 * 60 * 1000 }),
    );
  });

  it('cf-k5vr: falls back to host when opts.rateLimitKey is empty/blank', async () => {
    await submitCommunityPhoto(VALID_BODY, { rateLimitKey: '' });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      'cdn.example.com',
      expect.anything(),
    );
  });

  // Trim guard: leading-whitespace imageUrl previously broke the host-axis
  // bucket (regex /^https:.../ failed → 'unknown') AND landed leading
  // whitespace in the CMS row. Trimming once at the top of the webMethod
  // fixes both. Pin the host-bucket path so a future revert trips here.
  it('trims leading whitespace on imageUrl for host-axis bucket', async () => {
    await submitCommunityPhoto({
      ...VALID_BODY,
      imageUrl: '   https://cdn.example.com/uploads/p1.jpg',
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      'cdn.example.com',
      expect.anything(),
    );
  });

  it('trims leading whitespace on imageUrl before inserting into CMS', async () => {
    await submitCommunityPhoto({
      ...VALID_BODY,
      imageUrl: '   https://cdn.example.com/uploads/p1.jpg',
    });
    const rows = __getInserted('CommunityPhotos');
    expect(rows).toHaveLength(1);
    expect(rows[0].imageUrl).toBe('https://cdn.example.com/uploads/p1.jpg');
  });

  it('returns success:false on wixData.insert throw', async () => {
    __setInsertError('CommunityPhotos', new Error('Wix Data unavailable'));
    const result = await submitCommunityPhoto(VALID_BODY);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/please try again/i);
  });
});

// ── post_submitCommunityPhoto (HTTP wrapper) ──────────────────────────────────

describe('cf-0h9q · post_submitCommunityPhoto', () => {
  it('returns 200 + {success:true, photoId} on insert', async () => {
    const res = await post_submitCommunityPhoto(flatReq(VALID_BODY));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(typeof body.photoId).toBe('string');
  });

  it('cf-yvs4: 4xx on {success:false} envelope (validation)', async () => {
    const res = await post_submitCommunityPhoto(flatReq({ ...VALID_BODY, imageUrl: '' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({
      success: false,
      error: expect.stringMatching(/imageUrl/i),
    });
  });

  it('cf-yvs4: 429 when rate-limit returns "too many submissions"', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false });
    const res = await post_submitCommunityPhoto(flatReq(VALID_BODY));
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  // cf-owrr (was cf-k5vr): wrapper extracts the trusted client IP via
  // extractTrustedClientIp. The Wix edge appends ONE rightmost entry
  // (default trustedProxies=1), so the test chain shape is
  // "<client-supplied entries>..., <wix-edge>".
  //
  // The leftmost-trust pattern was the cf-owrr bug: an attacker could
  // spoof the leftmost XFF entry per request to land in fresh buckets.
  // The "leftmost spoofed, real client, edge" case below is the
  // regression pin for the actual fix.
  it('cf-owrr: wrapper trusts the entry just before the Wix edge — NOT the leftmost spoofed entry', async () => {
    // Chain: <attacker-spoofed>, <real-client>, <wix-edge>
    const req = flatReq(VALID_BODY, { 'x-forwarded-for': '1.1.1.1, 203.0.113.42, 10.0.0.1' });
    await post_submitCommunityPhoto(req);
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      '203.0.113.42', // NOT '1.1.1.1' (would be the leftmost-trust bug)
      expect.anything(),
    );
  });

  it('cf-owrr: rotating leftmost spoof does NOT create fresh buckets', async () => {
    // Same real-client behind Wix edge; attacker rotates leftmost
    // entry per request. All 3 calls must land in the same bucket.
    await post_submitCommunityPhoto(
      flatReq(VALID_BODY, { 'x-forwarded-for': '1.1.1.1, 203.0.113.42, 10.0.0.1' }),
    );
    await post_submitCommunityPhoto(
      flatReq(VALID_BODY, { 'x-forwarded-for': '2.2.2.2, 203.0.113.42, 10.0.0.1' }),
    );
    await post_submitCommunityPhoto(
      flatReq(VALID_BODY, { 'x-forwarded-for': '9.9.9.9, 203.0.113.42, 10.0.0.1' }),
    );
    const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['203.0.113.42', '203.0.113.42', '203.0.113.42']);
  });

  it('cf-k5vr: wrapper accepts X-Forwarded-For (canonical capitalization)', async () => {
    const req = flatReq(VALID_BODY, { 'X-Forwarded-For': '198.51.100.5, 10.0.0.1' });
    await post_submitCommunityPhoto(req);
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      '198.51.100.5',
      expect.anything(),
    );
  });

  it('cf-k5vr: missing x-forwarded-for falls back to host axis', async () => {
    await post_submitCommunityPhoto(flatReq(VALID_BODY)); // no XFF header
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      'cdn.example.com',
      expect.anything(),
    );
  });

  it('cf-owrr: chain shorter than trustedProxies (single edge entry) falls back to host axis', async () => {
    // A single-entry chain means we only see the Wix edge entry — no
    // client-supplied entries upstream. Helper returns null → host
    // fallback fires. Without this fallback, we would rate-limit every
    // request from the same edge instance into one bucket.
    await post_submitCommunityPhoto(
      flatReq(VALID_BODY, { 'x-forwarded-for': '10.0.0.1' }),
    );
    expect(checkRateLimit).toHaveBeenCalledWith(
      'CommunityPhotoRateLimit',
      'cdn.example.com', // host fallback, NOT '10.0.0.1'
      expect.anything(),
    );
  });

  it('cf-k5vr: same client IP across different image hosts shares one bucket', async () => {
    const xff = { 'x-forwarded-for': '203.0.113.99, 10.0.0.1' };
    await post_submitCommunityPhoto(
      flatReq({ ...VALID_BODY, imageUrl: 'https://cdn-a.example.com/p1.jpg' }, xff),
    );
    await post_submitCommunityPhoto(
      flatReq({ ...VALID_BODY, imageUrl: 'https://cdn-b.example.com/p2.jpg' }, xff),
    );
    const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['203.0.113.99', '203.0.113.99']);
  });

  it('cf-k5vr: different client IPs on the same image host get independent buckets', async () => {
    await post_submitCommunityPhoto(
      flatReq(VALID_BODY, { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }),
    );
    await post_submitCommunityPhoto(
      flatReq(VALID_BODY, { 'x-forwarded-for': '203.0.113.20, 10.0.0.1' }),
    );
    const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['203.0.113.10', '203.0.113.20']);
  });

  it('returns 400 invalid_json on body parse failure', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('bad json'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_submitCommunityPhoto(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('cf-0h9q.fu: returns 500 + errorId when submitCommunityPhoto throws past its own catch', async () => {
    // submitCommunityPhoto's own try/catch catches wixData.insert errors
    // and returns {success:false} (4xx, already covered above). The
    // wrapper's outer 500 path fires when submitCommunityPhoto itself
    // throws (not when it gracefully fails). vi.doMock + cache-buster
    // re-import forces submitCommunityPhoto to throw and asserts the
    // wrapper's serverError path is reached, including errorId in
    // console.error log for ops correlation.
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.doMock('backend/communityPhoto.web', () => ({ // vi-domock-legacy
      submitCommunityPhoto: vi.fn().mockRejectedValue(new Error('Velo runtime exploded')),
      _validateCommunityPhoto: vi.fn(() => null),
    }));
    const { post_submitCommunityPhoto: wrapper } = await import('../src/backend/http-functions.js?cf-0h9q-throw');
    const res = await wrapper(flatReq(VALID_BODY));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ success: false, error: 'server_error' });
    expect(typeof body.errorId).toBe('string');
    expect(body.errorId.length).toBeGreaterThan(0);
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain(body.errorId);
    expect(logged).toContain('post_submitCommunityPhoto');
    consoleErr.mockRestore();
    vi.doUnmock('backend/communityPhoto.web');
  });

  it('options preflight responds', () => {
    const res = options_submitCommunityPhoto({ headers: { origin: goodOrigin } });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
