/**
 * In-memory sliding-window rate limiter for Wix Velo web methods.
 *
 * Wix Velo doesn't expose caller IP in webMethod contexts, so callers
 * must provide an application-level key (e.g. email, order number).
 *
 * Uses in-memory storage (Map). Entries auto-expire on access.
 * Sufficient for single-instance Velo backends; if the site scales to
 * multiple workers, migrate to wix-data or an external store.
 */

const _buckets = new Map();

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 10;

/**
 * Check whether a key has exceeded its rate limit.
 *
 * @param {string} key - Identifier to rate-limit (email, order number, etc.)
 * @param {Object} [opts]
 * @param {number} [opts.windowMs=900000] - Sliding window in ms (default 15 min)
 * @param {number} [opts.maxRequests=10]  - Max requests per window
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(key, { windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS } = {}) {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create bucket for this key
  let timestamps = _buckets.get(key);
  if (!timestamps) {
    timestamps = [];
    _buckets.set(key, timestamps);
  }

  // Evict expired entries
  while (timestamps.length > 0 && timestamps[0] <= windowStart) {
    timestamps.shift();
  }

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  // Record this request
  timestamps.push(now);
  return { allowed: true, remaining: maxRequests - timestamps.length, retryAfterMs: 0 };
}

/**
 * Periodic cleanup — drop keys whose last timestamp has fully expired.
 * Called automatically every 5 minutes to prevent unbounded memory growth.
 */
function _cleanup() {
  const now = Date.now();
  for (const [key, timestamps] of _buckets) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] + DEFAULT_WINDOW_MS < now) {
      _buckets.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes (if setInterval is available in this runtime)
if (typeof setInterval !== 'undefined') {
  setInterval(_cleanup, 5 * 60 * 1000);
}
