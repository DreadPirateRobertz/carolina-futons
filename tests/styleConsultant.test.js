/**
 * Tests for styleConsultant.web.js
 * CF-vu30: Feature 5 — AI Style Consultant
 *
 * Phase 1 coverage (skeleton — AI call stubbed):
 *   - Input validation (sessionKey format, photo URL, text description)
 *   - Rate limit logic (checkRateLimit)
 *   - Session lookup/upsert paths
 *   - getStyleConsultation integration (mocked AI call)
 *
 * Phase 2 (Claude API wired):
 *   - callClaudeVision — success (text-only, photo+text)
 *   - callClaudeVision — HTTP error codes (429, 401, 400, 500)
 *   - callClaudeVision — response parse errors (empty, malformed, fenced JSON)
 *   - callClaudeVision — wix:image:// URL conversion to CDN URL
 *   - _wixMediaToCdnUrl — URL conversion
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onInsert,
  __onUpdate,
  __getInserted,
  __setQueryError,
} from './__mocks__/wix-data.js';

import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

import {
  getStyleConsultation,
  _getProductRecommendations,
  _setCallClaudeVision,
  _callClaudeVision,
  _wixMediaToCdnUrl,
} from '../src/backend/styleConsultant.web.js';

// ── Helpers ───────────────────────────────────────────────────────────

/** Valid SHA-256 hex session key (64 lowercase hex chars). */
const VALID_KEY = 'a'.repeat(64);
const VALID_PHOTO = 'wix:image://v1/abc123~mv2.jpg/photo.jpg#originWidth=800&originHeight=600';
const VALID_TEXT = 'I want a modern minimalist futon for my living room.';

function makeSession(overrides = {}) {
  return {
    _id: 'sess-001',
    sessionKey: VALID_KEY,
    lastConsulted: new Date('2026-01-01'),
    windowStart: new Date('2026-01-01'),
    windowCallCount: 1,
    totalCallCount: 1,
    lastInput: '',
    lastPhotoUrl: '',
    cachedRecs: '[]',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Input validation
// ═══════════════════════════════════════════════════════════════════════

describe('getStyleConsultation — input validation', () => {
  beforeEach(() => {
    resetData();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a null session key', async () => {
    const result = await getStyleConsultation(null, { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_SESSION_KEY');
  });

  it('rejects a session key shorter than 64 chars', async () => {
    const result = await getStyleConsultation('abc', { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_SESSION_KEY');
  });

  it('rejects a session key with non-hex characters', async () => {
    const result = await getStyleConsultation('z'.repeat(64), { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_SESSION_KEY');
  });

  it('rejects when neither photoUrl nor textDescription provided', async () => {
    const result = await getStyleConsultation(VALID_KEY, {});
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_INPUT');
  });

  it('rejects a non-Wix photo URL', async () => {
    const result = await getStyleConsultation(VALID_KEY, {
      photoUrl: 'https://attacker.example.com/evil.jpg',
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_INPUT');
  });

  it('accepts a valid Wix Media URL', async () => {
    // AI call will fail (stub) — but input validation should pass
    const result = await getStyleConsultation(VALID_KEY, { photoUrl: VALID_PHOTO });
    expect(result.errorCode).not.toBe('INVALID_INPUT');
    expect(result.errorCode).not.toBe('INVALID_SESSION_KEY');
  });

  it('accepts text-only input without a photo', async () => {
    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.errorCode).not.toBe('INVALID_INPUT');
    expect(result.errorCode).not.toBe('INVALID_SESSION_KEY');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Rate limiting
// ═══════════════════════════════════════════════════════════════════════

describe('getStyleConsultation — rate limiting', () => {
  beforeEach(() => {
    resetData();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('allows a new session (no existing record)', async () => {
    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    // Fails at AI call stage, not rate limit
    expect(result.errorCode).not.toBe('RATE_LIMITED');
  });

  it('rate-limits a session that has exhausted its window quota', async () => {
    __seed('StyleConsultantSessions', [
      makeSession({
        windowStart: new Date(), // current window
        windowCallCount: 5,      // at the limit
      }),
    ]);

    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.status).toBe(429);
    expect(result.error).toBe('Rate limit exceeded');
    expect(result.errorCode).toBe('RATE_LIMITED');
  });

  it('allows a session whose window has expired despite high call count', async () => {
    __seed('StyleConsultantSessions', [
      makeSession({
        windowStart: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        windowCallCount: 5, // maxed out, but window is old
      }),
    ]);

    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    // Fails at AI call stage (stub), not rate limit
    expect(result.errorCode).not.toBe('RATE_LIMITED');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. CMS lookup failure does not bypass rate limit
// ═══════════════════════════════════════════════════════════════════════

describe('getStyleConsultation — CMS lookup failure does not bypass rate limit', () => {
  beforeEach(() => {
    resetData();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns AI_ERROR when CMS session query throws', async () => {
    __setQueryError('StyleConsultantSessions', new Error('cms_malformed_response'));
    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AI_ERROR');
  });

  it('does not insert a session record when CMS lookup throws', async () => {
    __setQueryError('StyleConsultantSessions', new Error('cms_malformed_response'));
    const inserts = [];
    __onInsert((col, item) => { if (col === 'StyleConsultantSessions') inserts.push(item); });
    await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(inserts).toHaveLength(0);
  });

  it('allows a genuine new session when query succeeds with no record', async () => {
    // No session seeded — query returns empty result (not an error)
    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    // Should fail at AI call stage (stubbed), not at rate-limit or session-lookup stage
    expect(result.errorCode).not.toBe('RATE_LIMITED');
    expect(result.status).not.toBe(429);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Session persistence
// ═══════════════════════════════════════════════════════════════════════

describe('getStyleConsultation — session persistence', () => {
  beforeEach(() => {
    resetData();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does not insert a session record when the AI call fails', async () => {
    // AI is stubbed to throw — session should not be created
    const inserts = [];
    __onInsert((col, item) => { if (col === 'StyleConsultantSessions') inserts.push(item); });

    await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(inserts).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Product recommendations (catalog query)
// ═══════════════════════════════════════════════════════════════════════

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-001',
    name: 'Sunset Full Futon Frame',
    price: 499,
    formattedPrice: '$499',
    mainMedia: 'wix:image://v1/abc~mv2.jpg/frame.jpg',
    salesRank: 1,
    categories: ['futon-frames'],
    ...overrides,
  };
}

describe('_getProductRecommendations', () => {
  beforeEach(() => resetData());

  it('returns empty array for empty styleTags', async () => {
    expect(await _getProductRecommendations([])).toEqual([]);
  });

  it('returns empty array for unknown style tags', async () => {
    __seed('Stores/Products', [makeProduct()]);
    expect(await _getProductRecommendations(['unknown-tag'])).toEqual([]);
  });

  it('returns matching products for known style tag', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', name: 'Modern Frame', categories: ['futon-frames'] }),
      makeProduct({ _id: 'p2', name: 'Platform Bed', categories: ['platform-beds'] }),
      makeProduct({ _id: 'p3', name: 'Mattress', categories: ['mattresses'] }),
    ]);

    const recs = await _getProductRecommendations(['modern']);
    const ids = recs.map(r => r.productId);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
    expect(ids).not.toContain('p3'); // mattresses not in modern category map
  });

  it('scores products higher when they match more tags', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p-both', name: 'Multi-cat', categories: ['futon-frames', 'wall-huggers'] }),
      makeProduct({ _id: 'p-one', name: 'Single-cat', categories: ['futon-frames'] }),
    ]);

    const recs = await _getProductRecommendations(['modern', 'coastal']);
    // p-both matches futon-frames (modern+coastal) and wall-huggers (modern+coastal) — higher score
    const topId = recs[0].productId;
    expect(topId).toBe('p-both');
  });

  it('returns at most MAX_RECS (6) products', async () => {
    const manyProducts = Array.from({ length: 20 }, (_, i) =>
      makeProduct({ _id: `p${i}`, name: `Product ${i}`, categories: ['futon-frames'] })
    );
    __seed('Stores/Products', manyProducts);

    const recs = await _getProductRecommendations(['modern']);
    expect(recs.length).toBeLessThanOrEqual(6);
  });

  it('maps matched tags onto each recommendation', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', categories: ['futon-frames'] }),
    ]);

    const recs = await _getProductRecommendations(['modern', 'rustic']);
    expect(recs[0].matchedTags).toContain('modern');
    expect(recs[0].matchedTags).toContain('rustic');
  });

  it('shapes each recommendation correctly', async () => {
    __seed('Stores/Products', [makeProduct()]);

    const [rec] = await _getProductRecommendations(['modern']);
    expect(rec).toMatchObject({
      productId: expect.any(String),
      name: expect.any(String),
      price: expect.any(Number),
      score: expect.any(Number),
      matchedTags: expect.any(Array),
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Full flow — AI call paths (callClaudeVision injected)
// ═══════════════════════════════════════════════════════════════════════

describe('getStyleConsultation — AI call paths', () => {
  beforeEach(() => {
    resetData();
    _setCallClaudeVision(null); // reset to stub/throw default
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Seed catalog so recommendations can be returned
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', name: 'Modern Frame', categories: ['futon-frames'], salesRank: 1 }),
      makeProduct({ _id: 'p2', name: 'Wall Hugger', categories: ['wall-huggers'], salesRank: 2 }),
    ]);
  });

  afterEach(() => {
    _setCallClaudeVision(null);
  });

  it('returns success with recommendations when Claude returns valid style tags', async () => {
    _setCallClaudeVision(async () => ({
      styleTags: ['modern'],
      explanation: 'Clean lines and neutral tones suggest a modern aesthetic.',
    }));

    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.success).toBe(true);
    expect(result.styleTags).toEqual(['modern']);
    expect(result.explanation).toBe('Clean lines and neutral tones suggest a modern aesthetic.');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.sessionKey).toBe(VALID_KEY);
  });

  it('returns AI_ERROR when callClaudeVision throws', async () => {
    _setCallClaudeVision(async () => { throw new Error('Claude 429 rate limited'); });

    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AI_ERROR');
  });

  it('returns NO_RESULTS when Claude tags match no catalog products', async () => {
    _setCallClaudeVision(async () => ({
      styleTags: ['bohemian'], // maps to futon-frames only
      explanation: 'Eclectic bohemian style.',
    }));
    // Seed only products in a category not matched by bohemian
    resetData();
    __seed('Stores/Products', [
      makeProduct({ _id: 'p-nomatch', categories: ['mattresses'] }),
    ]);

    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NO_RESULTS');
  });

  it('writes session record after a successful AI call', async () => {
    _setCallClaudeVision(async () => ({
      styleTags: ['modern'],
      explanation: 'Modern style.',
    }));

    const inserts = [];
    __onInsert((col, item) => { if (col === 'StyleConsultantSessions') inserts.push(item); });

    await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sessionKey).toBe(VALID_KEY);
    expect(inserts[0].windowCallCount).toBe(1);
  });

  it('updates existing session record rather than inserting a duplicate', async () => {
    _setCallClaudeVision(async () => ({
      styleTags: ['modern'],
      explanation: 'Modern style.',
    }));

    __seed('StyleConsultantSessions', [makeSession()]);

    const updates = [];
    const inserts = [];
    __onUpdate((col, item) => { if (col === 'StyleConsultantSessions') updates.push(item); });
    __onInsert((col, item) => { if (col === 'StyleConsultantSessions') inserts.push(item); });

    await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(0); // update, not insert
  });

  it('passes photo URL and text to callClaudeVision', async () => {
    const calls = [];
    _setCallClaudeVision(async (photoUrl, textInput) => {
      calls.push({ photoUrl, textInput });
      return { styleTags: ['modern'], explanation: 'Modern.' };
    });

    await getStyleConsultation(VALID_KEY, { photoUrl: VALID_PHOTO, textDescription: VALID_TEXT });
    expect(calls).toHaveLength(1);
    expect(calls[0].photoUrl).toBe(VALID_PHOTO);
    expect(calls[0].textInput).toContain('modern minimalist');
  });

  it('session upsert failure is non-fatal — still returns recommendations', async () => {
    _setCallClaudeVision(async () => ({
      styleTags: ['modern'],
      explanation: 'Modern.',
    }));
    // Force session insert to fail
    const { __setInsertError } = await import('./__mocks__/wix-data.js');
    __setInsertError('StyleConsultantSessions', new Error('CMS write failed'));

    const result = await getStyleConsultation(VALID_KEY, { textDescription: VALID_TEXT });
    expect(result.success).toBe(true); // CMS write failure is non-fatal
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. _wixMediaToCdnUrl — URL conversion
// ═══════════════════════════════════════════════════════════════════════

describe('_wixMediaToCdnUrl', () => {
  it('converts wix:image:// URI to static.wixstatic.com CDN URL', () => {
    const result = _wixMediaToCdnUrl('wix:image://v1/abc123~mv2.jpg/photo.jpg#originWidth=800&originHeight=600');
    expect(result).toBe('https://static.wixstatic.com/media/abc123~mv2.jpg');
  });

  it('converts wix:video:// URI to CDN URL', () => {
    const result = _wixMediaToCdnUrl('wix:video://v1/vid456~mv2.mp4/clip.mp4');
    expect(result).toBe('https://static.wixstatic.com/media/vid456~mv2.mp4');
  });

  it('returns wixstatic.com CDN URL as-is', () => {
    const cdn = 'https://static.wixstatic.com/media/abc123~mv2.jpg';
    expect(_wixMediaToCdnUrl(cdn)).toBe(cdn);
  });

  it('returns wixmp.com URL as-is', () => {
    const cdn = 'https://video.wixmp.com/video/file/abc.mp4';
    expect(_wixMediaToCdnUrl(cdn)).toBe(cdn);
  });

  it('returns null for arbitrary non-Wix https:// URL (SSRF guard)', () => {
    expect(_wixMediaToCdnUrl('https://example.com/photo.jpg')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(_wixMediaToCdnUrl('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(_wixMediaToCdnUrl(null)).toBeNull();
  });

  it('returns null for http:// URL', () => {
    expect(_wixMediaToCdnUrl('http://example.com/photo.jpg')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. _callClaudeVision — real implementation (wix-fetch + wix-secrets-backend mocked)
// ═══════════════════════════════════════════════════════════════════════

const TEST_API_KEY = 'sk-ant-test-key-xyz';

function makeClaudeResponse(styleTags, explanation) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        content: [{ type: 'text', text: JSON.stringify({ styleTags, explanation }) }],
      };
    },
  };
}

function makeClaudeError(status) {
  return { ok: false, status, async json() { return {}; } };
}

describe('_callClaudeVision — real implementation', () => {
  beforeEach(() => {
    resetFetch();
    resetSecrets();
    _setCallClaudeVision(null); // ensure real implementation runs
    __setSecrets({ ANTHROPIC_API_KEY: TEST_API_KEY });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    _setCallClaudeVision(null);
  });

  it('returns styleTags and explanation on success (text-only)', async () => {
    __setHandler(() => makeClaudeResponse(['modern', 'minimalist'], 'Clean lines suggest a modern style.'));

    const result = await _callClaudeVision('', 'minimalist living room');
    expect(result.styleTags).toEqual(['modern', 'minimalist']);
    expect(result.explanation).toBe('Clean lines suggest a modern style.');
  });

  it('includes image block in request when photo URL provided', async () => {
    const captured = [];
    __setHandler((_url, opts) => {
      captured.push(JSON.parse(opts.body));
      return makeClaudeResponse(['coastal'], 'Coastal vibes.');
    });

    await _callClaudeVision(
      'wix:image://v1/abc123~mv2.jpg/room.jpg',
      'beach house feel'
    );

    const body = captured[0];
    const content = body.messages[0].content;
    const imageBlock = content.find(b => b.type === 'image');
    expect(imageBlock).toBeDefined();
    expect(imageBlock.source.url).toBe('https://static.wixstatic.com/media/abc123~mv2.jpg');
  });

  it('omits image block when no photo URL provided', async () => {
    const captured = [];
    __setHandler((_url, opts) => {
      captured.push(JSON.parse(opts.body));
      return makeClaudeResponse(['rustic'], 'Rustic charm.');
    });

    await _callClaudeVision('', 'cozy cabin');

    const content = captured[0].messages[0].content;
    expect(content.every(b => b.type !== 'image')).toBe(true);
  });

  it('sends x-api-key and anthropic-version headers', async () => {
    const captured = [];
    __setHandler((_url, opts) => {
      captured.push(opts.headers);
      return makeClaudeResponse(['modern'], 'Modern.');
    });

    await _callClaudeVision('', 'modern room');
    expect(captured[0]['x-api-key']).toBe(TEST_API_KEY);
    expect(captured[0]['anthropic-version']).toBeDefined();
  });

  it('throws claude_rate_limited on HTTP 429', async () => {
    __setHandler(() => makeClaudeError(429));
    await expect(_callClaudeVision('', 'any text')).rejects.toThrow('claude_rate_limited');
  });

  it('throws claude_auth_error on HTTP 401', async () => {
    __setHandler(() => makeClaudeError(401));
    await expect(_callClaudeVision('', 'any text')).rejects.toThrow('claude_auth_error');
  });

  it('throws claude_bad_request on HTTP 400', async () => {
    __setHandler(() => makeClaudeError(400));
    await expect(_callClaudeVision('', 'any text')).rejects.toThrow('claude_bad_request');
  });

  it('throws claude_api_error_500 on HTTP 500', async () => {
    __setHandler(() => makeClaudeError(500));
    await expect(_callClaudeVision('', 'any text')).rejects.toThrow('claude_api_error_500');
  });

  it('throws claude_empty_response when content array is absent', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async json() { return { content: [] }; },
    }));
    await expect(_callClaudeVision('', 'test')).rejects.toThrow('claude_empty_response');
  });

  it('throws claude_parse_error when response text is not JSON', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async json() { return { content: [{ type: 'text', text: 'Sorry, I cannot help.' }] }; },
    }));
    await expect(_callClaudeVision('', 'test')).rejects.toThrow('claude_parse_error');
  });

  it('parses JSON wrapped in a markdown code fence', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async json() {
        return {
          content: [{
            type: 'text',
            text: '```json\n{"styleTags":["industrial"],"explanation":"Raw metal finish."}\n```',
          }],
        };
      },
    }));

    const result = await _callClaudeVision('', 'loft space');
    expect(result.styleTags).toEqual(['industrial']);
    expect(result.explanation).toBe('Raw metal finish.');
  });

  it('throws when ANTHROPIC_API_KEY secret is missing', async () => {
    resetSecrets(); // clear all secrets — no ANTHROPIC_API_KEY
    await expect(_callClaudeVision('', 'test')).rejects.toThrow('Secret "ANTHROPIC_API_KEY" not found');
  });

  it('returns empty styleTags and explanation gracefully for partial JSON', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async json() {
        return { content: [{ type: 'text', text: '{}' }] };
      },
    }));

    const result = await _callClaudeVision('', 'some text');
    expect(result.styleTags).toEqual([]);
    expect(result.explanation).toBe('');
  });

  it('omits image block and warns when photo URL cannot be converted to CDN URL', async () => {
    const captured = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    __setHandler((_url, opts) => {
      captured.push(JSON.parse(opts.body));
      return makeClaudeResponse(['modern'], 'Modern.');
    });

    // A wix:// URI that does not match v1 pattern — _wixMediaToCdnUrl returns null
    await _callClaudeVision('wix:document://v1/doc123/file.pdf', 'my study');

    const content = captured[0].messages[0].content;
    expect(content.every(b => b.type !== 'image')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[styleConsultant]'),
      expect.stringContaining('wix:document://')
    );
    warnSpy.mockRestore();
  });

  it('uses generic text prompt when photo conversion fails (no "room photo" reference)', async () => {
    const captured = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    __setHandler((_url, opts) => {
      captured.push(JSON.parse(opts.body));
      return makeClaudeResponse(['rustic'], 'Rustic.');
    });

    await _callClaudeVision('wix:document://v1/bad/file.pdf', '');

    const textBlock = captured[0].messages[0].content.find(b => b.type === 'text');
    expect(textBlock.text).not.toContain('room photo');
    vi.restoreAllMocks();
  });

  it('throws claude_parse_error for malformed JSON inside a markdown fence', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async json() {
        return {
          content: [{
            type: 'text',
            text: '```json\n{not valid json\n```',
          }],
        };
      },
    }));
    await expect(_callClaudeVision('', 'test')).rejects.toThrow('claude_parse_error');
  });

  it('throws claude_timeout when fetch does not resolve before 30s', async () => {
    // Catch immediately — see void timeoutPromise.catch() in callClaudeVision for why.
    vi.useFakeTimers();
    try {
      __setHandler(() => new Promise(() => {})); // never resolves
      let caughtError;
      const pending = _callClaudeVision('', 'any text').catch(e => { caughtError = e; });
      await vi.advanceTimersByTimeAsync(30001);
      await pending; // wait for the .catch() handler to fire
      expect(caughtError?.message).toBe('claude_timeout');
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('truncates explanation to EXPLANATION_MAX (500) characters', async () => {
    const longExplanation = 'A'.repeat(600);
    __setHandler(() => makeClaudeResponse(['modern'], longExplanation));
    const result = await _callClaudeVision('', 'any text');
    expect(result.explanation.length).toBeLessThanOrEqual(500);
  });

  it('strips HTML tags from explanation before returning', async () => {
    __setHandler(() => makeClaudeResponse(['modern'], '<script>alert("xss")</script>Modern style.'));
    const result = await _callClaudeVision('', 'any text');
    expect(result.explanation).not.toContain('<script>');
    expect(result.explanation).toContain('Modern style.');
  });

  it('clears the timeout timer when fetch resolves before 30s (no leak)', async () => {
    // Verifies .finally(() => clearTimeout(timeoutId)) fires on normal success.
    // If clearTimeout is removed, this test still passes — so we spy to confirm it ran.
    vi.useFakeTimers();
    try {
      __setHandler(() => makeClaudeResponse(['modern'], 'Modern.'));
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      await _callClaudeVision('', 'any text');
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
