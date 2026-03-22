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
 * Phase 2 (after zhora review + Claude API wired):
 *   - callClaudeVision error handling (429, content policy, timeout)
 *   - Product matching from style tags
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onInsert,
  __onUpdate,
  __getInserted,
} from './__mocks__/wix-data.js';

import { getStyleConsultation, _getProductRecommendations } from '../src/backend/styleConsultant.web.js';

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
// 3. Session persistence
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
// 4. Product recommendations (catalog query)
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
