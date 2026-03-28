/**
 * @file rateLimit.js
 * @description Shared server-side rate limiting utility for anonymous CMS writes.
 *
 * Uses a wixData collection as a persistent backing store so limits survive
 * serverless cold starts. Each service passes its own collection name so
 * buckets are isolated (QARateLimit, ReviewRateLimit, etc.).
 *
 * Pattern mirrors newsletterService._checkRateLimit (CF-r2xj).
 */

import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check and record a rate-limit attempt for a given key in a given collection.
 * Allows up to RATE_LIMIT_MAX calls per RATE_LIMIT_WINDOW_MS per key.
 * Fails open (allows) if the DB check itself errors, to avoid blocking
 * legitimate users on infrastructure issues.
 *
 * @param {string} collection - wixData collection name (e.g. 'QARateLimit').
 * @param {string} key - Normalized identifier (typically email).
 * @param {Object} [opts]
 * @param {number} [opts.now] - Timestamp override for testing (internal use only — never accept from callers).
 * @param {number} [opts.max] - Max calls per window (defaults to RATE_LIMIT_MAX). Callers may override per endpoint.
 * @param {number} [opts.windowMs] - Window duration in ms (defaults to RATE_LIMIT_WINDOW_MS = 1 hour). Use 60_000 for per-minute limits.
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function checkRateLimit(collection, key, opts = {}) {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  try {
    const cleanKey = sanitize(key, 254).toLowerCase();

    const existing = await wixData.query(collection)
      .eq('key', cleanKey)
      .limit(1)
      .find();

    if (existing.items.length === 0) {
      await wixData.insert(collection, {
        key: cleanKey,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    const record = existing.items[0];
    const windowAge = now - new Date(record.windowStart).getTime();

    if (windowAge > windowMs) {
      // Window expired — reset counter
      await wixData.update(collection, {
        ...record,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    const max = opts.max ?? RATE_LIMIT_MAX;
    if (record.count >= max) {
      return { allowed: false, reason: 'rate_limited' };
    }

    await wixData.update(collection, {
      ...record,
      count: record.count + 1,
    });
    return { allowed: true };
  } catch (err) {
    logError(`rateLimit.checkRateLimit[${collection}/${cleanKey}]`, err);
    return { allowed: true }; // Fail open — don't block on DB errors
  }
}
