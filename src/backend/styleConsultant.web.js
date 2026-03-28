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
 * @requires wix-fetch  (dynamic import — Claude API calls)
 * @requires wix-secrets-backend  (dynamic import — ANTHROPIC_API_KEY)
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
 * Rate limiting: CMS-backed per-session sliding window.
 *   RATE_LIMIT_MAX calls per RATE_LIMIT_WINDOW_MS per sessionKey.
 *   CMS lookup failure returns AI_ERROR — rate limits are not bypassed on error.
 *
 * @see jobs.config — no scheduled job required for this module.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, isWixMediaUrl } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';

const SESSION_COLLECTION = 'StyleConsultantSessions';

// Input constraints
const SESSION_KEY_LEN = 64;   // SHA-256 hex = exactly 64 chars
const TEXT_MAX = 1000;        // Max characters for free-text description
const EXPLANATION_MAX = 500;  // Max characters for Claude explanation (applied after HTML stripping)

// Rate limiting — 5 calls per hour per session (confirmed via cross-rig review)
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Product recommendation settings
const MAX_RECS = 6;

/**
 * Maps Claude-inferred style tags to Wix Stores product category slugs.
 * Each entry lists the categories most relevant to that style.
 * Category slugs match those used in Stores/Products.categories field.
 */
const STYLE_CATEGORY_MAP = {
  'modern':      ['futon-frames', 'wall-huggers', 'platform-beds'],
  'minimalist':  ['wall-huggers', 'platform-beds'],
  'industrial':  ['futon-frames', 'platform-beds'],
  'mid-century': ['futon-frames', 'platform-beds'],
  'coastal':     ['futon-frames', 'wall-huggers'],
  'traditional': ['futon-frames', 'murphy-cabinet-beds', 'platform-beds'],
  'rustic':      ['futon-frames'],
  'bohemian':    ['futon-frames'],
  // Functional tags (may also come from Claude)
  'sleeping':    ['platform-beds', 'futon-frames', 'murphy-cabinet-beds'],
  'sitting':     ['futon-frames', 'wall-huggers'],
  'space-saving':['wall-huggers', 'murphy-cabinet-beds'],
};

// Claude API configuration
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 512;
const CLAUDE_ANTHROPIC_VERSION = '2023-06-01';

const STYLE_SYSTEM_PROMPT = `You are a furniture and home decor style analyst for Carolina Futons.
Analyze the provided room photo and/or text description to infer style preferences and furniture needs.

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "styleTags": ["tag1", "tag2"],
  "explanation": "Brief 1-2 sentence explanation of the style analysis."
}

Valid style tags — pick 1-4 most relevant:
modern, minimalist, industrial, mid-century, coastal, traditional, rustic, bohemian,
sleeping, sitting, space-saving`;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Convert a Wix Media URI to a publicly accessible CDN URL suitable
 * for inclusion in Claude API image content blocks.
 *
 * - wix:image://v1/{mediaId}/... → https://static.wixstatic.com/media/{mediaId}
 * - wix:video://v1/{mediaId}/... → https://static.wixstatic.com/media/{mediaId}
 * - Recognized Wix CDN domains (wixstatic.com, wixmp.com) are returned as-is.
 * - Any other input returns null.
 *
 * Domain restriction is intentional: only Wix-hosted media should be passed to
 * the Claude API image block. Non-Wix URLs are blocked here as a defence-in-depth
 * measure — `isWixMediaUrl` at the webMethod boundary is the primary gate.
 *
 * @param {string} wixUrl
 * @returns {string|null} Public Wix CDN URL, or null if conversion fails
 */
export function _wixMediaToCdnUrl(wixUrl) {
  if (typeof wixUrl !== 'string' || !wixUrl.trim()) return null;
  const url = wixUrl.trim();
  // Recognized Wix CDN domains — pass through directly
  if (/^https:\/\/static\.wixstatic\.com\//i.test(url)) return url;
  if (/^https:\/\/[^/]*\.wixmp\.com\//i.test(url)) return url;
  // wix:image://v1/{mediaId}/filename.jpg#...  or  wix:video://v1/...
  const match = url.match(/^wix:(?:image|video):\/\/v1\/([^/#?]+)/);
  if (!match) return null;
  return `https://static.wixstatic.com/media/${match[1]}`;
}

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
 *
 * Throws if the CMS returns a malformed response (missing `items` array) rather
 * than silently returning null — this prevents a malformed response from being
 * mistaken for a new (never-seen) session, which would bypass rate limiting.
 *
 * @param {string} sessionKey - Validated 64-char hex key
 * @returns {Promise<Object|null>} Session record, or null if definitively not found
 * @throws {Error} If the CMS query fails or returns a malformed response
 */
async function lookupSession(sessionKey) {
  const result = await wixData.query(SESSION_COLLECTION)
    .eq('sessionKey', sessionKey)
    .find();
  if (!result || !Array.isArray(result.items)) {
    throw new Error('cms_malformed_response');
  }
  return result.items.length > 0 ? result.items[0] : null;
}

/**
 * Check per-session rate limit using a CMS-backed sliding window.
 * Returns allowed=true if the call may proceed; false if the quota is exhausted.
 *
 * A null session (first call, or CMS lookup failure) is always allowed.
 * The window resets when windowAge >= RATE_LIMIT_WINDOW_MS.
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
 * @param {string} photoUrl - Validated Wix Media URI (wix:image://... or wix CDN domain). Stored
 *   as-is for audit trail — this is the internal URI, not the public CDN URL. Do not forward
 *   this value to external services without re-validating via isWixMediaUrl + _wixMediaToCdnUrl.
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
 * Loads ANTHROPIC_API_KEY from Wix Secrets Manager, converts the Wix Media URI
 * to a CDN URL, then calls claude-sonnet-4-6 via wix-fetch.
 *
 * Throws named errors: claude_rate_limited, claude_auth_error, claude_bad_request,
 * claude_api_error_{status}, claude_empty_response, claude_parse_error.
 *
 * @param {string} photoUrl - Validated Wix Media URL (empty string if text-only)
 * @param {string} textInput - Sanitized free-text description (empty string if photo-only)
 * @returns {Promise<{ styleTags: string[], explanation: string }>}
 */
// Test injection hook — allows tests to mock the AI call without network access.
// Set via _setCallClaudeVision(fn) in beforeEach; clear with _setCallClaudeVision(null).
let _callClaudeVisionImpl = null;

async function callClaudeVision(photoUrl, textInput) {
  if (_callClaudeVisionImpl) {
    return _callClaudeVisionImpl(photoUrl, textInput);
  }

  // Load API key from Wix Secrets Manager (errors here are config failures, not AI failures)
  const { getSecret } = await import('wix-secrets-backend');
  const apiKey = await getSecret('ANTHROPIC_API_KEY');

  // Build user content blocks — image first (if provided), then text prompt
  const contentBlocks = [];
  let hasImage = false;

  if (photoUrl) {
    const cdnUrl = _wixMediaToCdnUrl(photoUrl);
    if (cdnUrl) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'url', url: cdnUrl },
      });
      hasImage = true;
    } else {
      console.warn('[styleConsultant] Could not convert photo URL to CDN URL — proceeding text-only:', photoUrl);
    }
  }

  const textPrompt = textInput
    ? `Analyze this room for furniture style. The customer says: "${textInput}"`
    : hasImage
      ? 'Analyze this room photo for furniture style preferences.'
      : 'Suggest furniture styles based on the customer description.';
  contentBlocks.push({ type: 'text', text: textPrompt });

  // Call Claude API via wix-fetch with a 30s abort timeout to prevent Velo runtime exhaustion
  const { fetch } = await import('wix-fetch');
  const controller = new AbortController();
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('claude_timeout'));
    }, 30000);
  });
  // Promise.race handles this rejection, but fake-timer test environments fire
  // the callback synchronously before race's internal handler is linked.
  // This .catch() marks the rejection as handled without affecting race behavior.
  // The rejection still propagates through Promise.race — it is NOT suppressed.
  // `void` discards the derived promise so no-floating-promises linters stay quiet.
  void timeoutPromise.catch(() => {});
  const res = await Promise.race([
    fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: STYLE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);

  if (!res.ok) {
    const status = res.status;
    if (status === 429) throw new Error('claude_rate_limited');
    if (status === 401) throw new Error('claude_auth_error');
    if (status === 400) throw new Error('claude_bad_request');
    throw new Error(`claude_api_error_${status}`);
  }

  const data = await res.json();
  const raw = data?.content?.[0]?.text;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('claude_empty_response');

  // Parse JSON — Claude may occasionally wrap in a markdown code fence
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!fence) throw new Error('claude_parse_error');
    try {
      parsed = JSON.parse(fence[1]);
    } catch (__) {
      throw new Error('claude_parse_error');
    }
  }

  const styleTags = Array.isArray(parsed?.styleTags) ? parsed.styleTags : [];
  // Sanitize explanation before returning to client — prevents XSS if rendered in a DOM context.
  const explanation = typeof parsed?.explanation === 'string'
    ? sanitize(parsed.explanation, EXPLANATION_MAX)
    : '';

  return { styleTags, explanation };
}

/**
 * Query the Wix Stores catalog for products matching the given style tags.
 * Derives target categories from STYLE_CATEGORY_MAP, fetches matching products
 * via wixData, scores each by category overlap with the tag-derived set,
 * and returns up to MAX_RECS sorted by score descending then salesRank ascending.
 *
 * @param {string[]} styleTags - Style tags inferred from Claude analysis
 * @returns {Promise<Array<{
 *   productId: string,
 *   name: string,
 *   price: number,
 *   formattedPrice: string,
 *   imageUrl: string,
 *   score: number,
 *   matchedTags: string[]
 * }>>}
 */
async function getProductRecommendations(styleTags) {
  if (!Array.isArray(styleTags) || styleTags.length === 0) return [];

  // Build the union of target categories from all matched style tags
  const targetCategories = [...new Set(
    styleTags.flatMap(tag => STYLE_CATEGORY_MAP[tag] || [])
  )];

  if (targetCategories.length === 0) return [];

  const result = await wixData.query('Stores/Products')
    .hasSome('categories', targetCategories)
    .ascending('salesRank')
    .limit(MAX_RECS * 3)  // Over-fetch to allow scoring + trim
    .find();

  const items = Array.isArray(result?.items) ? result.items : [];

  // Score each product by how many target categories it matches
  const scored = items.map(p => {
    const productCats = Array.isArray(p.categories) ? p.categories : [];
    const matchedCats = productCats.filter(c => targetCategories.includes(c));
    return {
      productId: p._id,
      name: p.name || '',
      price: p.price || 0,
      formattedPrice: p.formattedPrice || (p.price ? `$${p.price}` : ''),
      imageUrl: p.mainMedia || '',
      score: matchedCats.length,
      matchedTags: styleTags.filter(tag =>
        (STYLE_CATEGORY_MAP[tag] || []).some(c => matchedCats.includes(c))
      ),
    };
  });

  // Sort: highest score first, then salesRank (ascending, already from query)
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_RECS);
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
 * @returns {Promise<
 *   | { success: true, sessionKey: string, styleTags: string[], explanation: string,
 *       recommendations: Array<{ productId: string, name: string, score: number, explanation: string }> }
 *   | { success: false, error: string,
 *       errorCode: 'INVALID_SESSION_KEY' | 'INVALID_INPUT' | 'AI_ERROR' | 'NO_RESULTS' }
 *   | { status: 429, error: string }
 * >}
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
      return { success: false, status: 429, error: 'Rate limit exceeded', errorCode: 'RATE_LIMITED' };
    }

    // 4. Call Claude vision API
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

    logAuditEvent('StyleConsultantSessions', 'consultation', cleanKey, { resultCount: recommendations.length });
    return {
      success: true,
      sessionKey: cleanKey,
      styleTags,
      explanation,
      recommendations,
    };
  },
);

// ── Export internals for testing (do not call from other Velo modules) ───────
export { getProductRecommendations as _getProductRecommendations };
export { callClaudeVision as _callClaudeVision };

/**
 * Inject a mock implementation for callClaudeVision in tests.
 * Call with null to restore the default (stubbed) behaviour.
 * @param {Function|null} fn
 */
export function _setCallClaudeVision(fn) {
  _callClaudeVisionImpl = fn;
}
