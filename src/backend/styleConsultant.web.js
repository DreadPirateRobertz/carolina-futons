/**
 * @module styleConsultant
 * @description AI Style Consultant — Feature 5.
 * Accepts a photo URL and/or free-text description from the user, calls the
 * Claude vision API to infer style preferences and furniture needs, then
 * returns ranked product recommendations from the Wix Stores catalog.
 *
 * Session persistence: a SHA-256 fingerprint hash generated client-side from
 * localStorage signals is used as a stable, anonymous session key. The key is
 * stored in StyleConsultantSessions CMS for per-session rate limiting and
 * recommendation caching.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-fetch  (for Claude API call — wired after zhora confirms rate limit strategy)
 *
 * @setup
 * Create CMS collection `StyleConsultantSessions` with the following fields:
 *   sessionKey      (Text, required, indexed)
 *                   — SHA-256 hex fingerprint hash from client localStorage (64 chars)
 *   lastConsulted   (Date/Time) — Timestamp of the most recent successful call
 *   windowStart     (Date/Time) — Start of the current rate-limit sliding window
 *   windowCallCount (Number)    — Calls made within the current window
 *   totalCallCount  (Number)    — All-time call count for this session
 *   lastInput       (Text)      — Sanitized text input from the last call (audit trail)
 *   lastPhotoUrl    (Text)      — Photo URL from the last call (audit trail)
 *   cachedRecs      (Text)      — JSON: last recommendations array (cache, may be stale)
 *
 * Add index on `sessionKey` for O(1) lookup.
 * Collection permissions: Anyone (read/write via backend only — no direct client access).
 *
 * Add to Wix Secrets Manager:
 *   ANTHROPIC_API_KEY — Claude API key (claude-sonnet-4-6, vision-capable)
 *
 * Rate limiting: pending zhora (gastown) review.
 *   Current placeholder: RATE_LIMIT_MAX calls per RATE_LIMIT_WINDOW_MS per sessionKey.
 *   Strategy TBD: per-session sliding window (CMS-backed) vs. global token bucket.
 *
 * @see jobs.config — no scheduled job required for this module.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, isWixMediaUrl } from 'backend/utils/sanitize';

const SESSION_COLLECTION = 'StyleConsultantSessions';

// Input constraints
const SESSION_KEY_LEN = 64;   // SHA-256 hex = exactly 64 chars
const TEXT_MAX = 1000;        // Max characters for free-text description

// Rate limiting — placeholder values, zhora to confirm strategy
// TODO(CF-vu30): replace with zhora-approved rate limit config after cross-rig review
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Validate the session key format.
 * Must be a 64-character lowercase hex string (SHA-256 output).
 * @param {string} key
 * @returns {string|null} Cleaned key, or null if invalid
 */
function validateSessionKey(key) {
  if (typeof key !== 'string') return null;
  const cleaned = key.trim().toLowerCase();
  if (cleaned.length !== SESSION_KEY_LEN) return null;
  if (!/^[0-9a-f]{64}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Fetch existing StyleConsultantSessions record for the given sessionKey,
 * or return null if not found.
 * @param {string} sessionKey - Validated 64-char hex key
 * @returns {Promise<Object|null>}
 */
async function lookupSession(sessionKey) {
  const result = await wixData.query(SESSION_COLLECTION)
    .eq('sessionKey', sessionKey)
    .find();
  return result.items.length > 0 ? result.items[0] : null;
}

/**
 * Check and update per-session rate limit using a sliding window.
 * Returns true if the call is allowed; false if the session is rate-limited.
 *
 * TODO(CF-vu30): zhora to review — replace with confirmed strategy before
 *   wiring the Claude API call. Current implementation: simple CMS-backed
 *   sliding window with RATE_LIMIT_MAX calls per RATE_LIMIT_WINDOW_MS.
 *
 * @param {Object|null} session - Existing session record, or null for new sessions
 * @returns {{ allowed: boolean, updatedCounts: { windowStart: Date, windowCallCount: number } }}
 */
function checkRateLimit(session) {
  const now = new Date();

  if (!session) {
    // First call — always allowed
    return {
      allowed: true,
      updatedCounts: { windowStart: now, windowCallCount: 1 },
    };
  }

  const windowStart = session.windowStart ? new Date(session.windowStart) : now;
  const windowAge = now - windowStart;

  if (windowAge >= RATE_LIMIT_WINDOW_MS) {
    // Window expired — reset
    return {
      allowed: true,
      updatedCounts: { windowStart: now, windowCallCount: 1 },
    };
  }

  const currentCount = session.windowCallCount || 0;
  if (currentCount >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      updatedCounts: { windowStart: windowStart, windowCallCount: currentCount },
    };
  }

  return {
    allowed: true,
    updatedCounts: { windowStart: windowStart, windowCallCount: currentCount + 1 },
  };
}

/**
 * Upsert a StyleConsultantSessions record after a successful consultation.
 * Writes rate-limit counters, audit fields, and cached recommendations.
 *
 * @param {Object|null} existing - Existing session record (null to insert)
 * @param {string} sessionKey
 * @param {{ windowStart: Date, windowCallCount: number }} updatedCounts
 * @param {string} textInput - Sanitized text input
 * @param {string} photoUrl - Validated photo URL (may be '')
 * @param {Array} recommendations - Recommendation results to cache
 * @returns {Promise<void>}
 */
async function upsertSession(existing, sessionKey, updatedCounts, textInput, photoUrl, recommendations) {
  const now = new Date();
  const cachedRecs = JSON.stringify(recommendations);

  if (existing) {
    await wixData.update(SESSION_COLLECTION, {
      ...existing,
      lastConsulted: now,
      windowStart: updatedCounts.windowStart,
      windowCallCount: updatedCounts.windowCallCount,
      totalCallCount: (existing.totalCallCount || 0) + 1,
      lastInput: textInput,
      lastPhotoUrl: photoUrl,
      cachedRecs,
    });
  } else {
    await wixData.insert(SESSION_COLLECTION, {
      sessionKey,
      lastConsulted: now,
      windowStart: updatedCounts.windowStart,
      windowCallCount: updatedCounts.windowCallCount,
      totalCallCount: 1,
      lastInput: textInput,
      lastPhotoUrl: photoUrl,
      cachedRecs,
    });
  }
}

/**
 * Call Claude vision API to analyze the user's style from photo and/or text.
 * Returns an array of style tags and a natural-language explanation.
 *
 * TODO(CF-vu30): STUB — wire actual Claude API call after zhora confirms
 *   rate limit strategy and model selection. Blocked on cross-rig review.
 *
 * @param {string} photoUrl - Validated Wix Media URL (empty string if text-only)
 * @param {string} textInput - Sanitized free-text description (empty string if photo-only)
 * @returns {Promise<{ styleTags: string[], explanation: string }>}
 */
async function callClaudeVision(photoUrl, textInput) {
  // STUB: replace with real implementation after zhora review
  // Expected implementation outline:
  //   1. Fetch ANTHROPIC_API_KEY from wixSecretsManager
  //   2. Build Claude messages array:
  //      - system: style analysis prompt scoped to futon/furniture
  //      - user: text + optional image_url content block
  //   3. Call claude-sonnet-4-6 via fetch (wix-fetch)
  //   4. Parse response: extract style tags + explanation
  //   5. Handle errors: rate limit (429), context length, content policy
  throw new Error('Claude vision call not yet implemented — pending zhora rate limit review (CF-vu30)');
}

/**
 * Query the Wix Stores catalog for products matching the given style tags.
 * Returns up to MAX_RECS products scored by tag overlap.
 *
 * @param {string[]} styleTags - Style tags from Claude analysis
 * @returns {Promise<Array<{ productId: string, name: string, score: number, matchedTags: string[] }>>}
 */
async function getProductRecommendations(styleTags) {
  // TODO(CF-vu30): implement catalog query by style tags
  // Pattern: query Products collection filtered by style/category tags,
  // score by number of matched tags, return top MAX_RECS.
  // Placeholder: returns empty array until wired.
  return [];
}

// ── Exported webMethod ────────────────────────────────────────────────

/**
 * Get AI-powered product recommendations based on a room photo and/or
 * free-text style description.
 *
 * The caller must supply a `sessionKey` — a 64-character lowercase hex
 * SHA-256 fingerprint hash generated client-side from localStorage signals.
 * This key is used to enforce per-session rate limits and cache results.
 *
 * At least one of `photoUrl` or `textDescription` must be non-empty.
 * `photoUrl` must be a recognized Wix Media Manager URL.
 *
 * @function getStyleConsultation
 * @param {string} sessionKey - 64-char hex fingerprint hash
 * @param {{ photoUrl?: string, textDescription?: string }} input
 * @returns {Promise<{
 *   success: boolean,
 *   recommendations?: Array<{ productId: string, name: string, score: number, explanation: string }>,
 *   sessionKey?: string,
 *   error?: string,
 *   errorCode?: 'INVALID_SESSION_KEY' | 'INVALID_INPUT' | 'RATE_LIMITED' | 'AI_ERROR' | 'NO_RESULTS'
 * }>}
 */
export const getStyleConsultation = webMethod(
  Permissions.Anyone,
  async (sessionKey, input = {}) => {
    // 1. Validate session key
    const cleanKey = validateSessionKey(sessionKey);
    if (!cleanKey) {
      return { success: false, error: 'Invalid session key.', errorCode: 'INVALID_SESSION_KEY' };
    }

    // 2. Validate input — at least one of photoUrl or textDescription required
    const rawPhoto = typeof input.photoUrl === 'string' ? input.photoUrl.trim() : '';
    const rawText = typeof input.textDescription === 'string' ? input.textDescription : '';

    if (!rawPhoto && !rawText.trim()) {
      return { success: false, error: 'Provide a photo URL, a text description, or both.', errorCode: 'INVALID_INPUT' };
    }

    const photoUrl = rawPhoto;
    if (photoUrl && !isWixMediaUrl(photoUrl)) {
      return { success: false, error: 'Photo must be a Wix Media Manager URL.', errorCode: 'INVALID_INPUT' };
    }

    const textInput = sanitize(rawText, TEXT_MAX);

    // 3. Session lookup and rate-limit check
    let session;
    try {
      session = await lookupSession(cleanKey);
    } catch (err) {
      console.error('[styleConsultant] Session lookup failed:', err?.message ?? err);
      return { success: false, error: 'Session lookup failed. Please try again.', errorCode: 'AI_ERROR' };
    }

    const { allowed, updatedCounts } = checkRateLimit(session);
    if (!allowed) {
      return {
        success: false,
        error: 'Too many requests. Please wait before trying again.',
        errorCode: 'RATE_LIMITED',
      };
    }

    // 4. Call Claude vision API
    // TODO(CF-vu30): remove this guard once callClaudeVision is implemented
    let styleTags, explanation;
    try {
      const aiResult = await callClaudeVision(photoUrl, textInput);
      styleTags = aiResult.styleTags;
      explanation = aiResult.explanation;
    } catch (err) {
      console.error('[styleConsultant] Claude API call failed:', err?.message ?? err);
      return { success: false, error: 'Style analysis unavailable. Please try again later.', errorCode: 'AI_ERROR' };
    }

    // 5. Match products from catalog
    let recommendations;
    try {
      recommendations = await getProductRecommendations(styleTags);
    } catch (err) {
      console.error('[styleConsultant] Product matching failed:', err?.message ?? err);
      return { success: false, error: 'Could not fetch recommendations. Please try again.', errorCode: 'AI_ERROR' };
    }

    // 6. Persist session record (non-fatal — don't fail the call if CMS write fails)
    try {
      await upsertSession(session, cleanKey, updatedCounts, textInput, photoUrl, recommendations);
    } catch (err) {
      console.error('[styleConsultant] Session upsert failed:', err?.message ?? err);
    }

    if (recommendations.length === 0) {
      return { success: false, error: 'No matching products found for your style.', errorCode: 'NO_RESULTS' };
    }

    return {
      success: true,
      sessionKey: cleanKey,
      styleTags,
      explanation,
      recommendations,
    };
  },
);
