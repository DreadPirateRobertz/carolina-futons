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

// cf-owrr: Wix's edge layer appends ONE entry to the X-Forwarded-For chain
// when a request reaches the Velo HTTP function. The chain shape is:
//
//   <client-supplied entries>, <wix-edge-observed-client-ip>
//
// The leftmost entries are CLIENT-CONTROLLABLE (the client can ship any
// X-Forwarded-For value in the request headers). Only the rightmost entry
// is trustworthy because it was written by the Wix edge after observing
// the actual TCP peer. Trusting the leftmost gives an attacker per-request
// bucket bypass: rotate the leftmost spoofed IP each request, never share
// a bucket with the previous request.
//
// Default trustedProxies = 1 strips the rightmost entry (Wix edge) and
// returns the entry just before it (the real client). If the chain has
// fewer entries than the trustedProxies count we don't have a reliable
// client IP, so return null and let the caller fall back to a different
// axis (e.g. imageUrl host).
const DEFAULT_TRUSTED_PROXIES = 1;

/**
 * Extract the trusted client IP from a Velo HTTP function request.
 *
 * Reads `request.headers['x-forwarded-for']` (with a case-insensitive
 * fallback), splits on commas, strips the rightmost `trustedProxies`
 * entries (default 1 = the Wix edge entry), and returns the new
 * rightmost entry — which is the actual client IP that Wix observed.
 *
 * Returns `null` when the chain is empty, the header is missing, or the
 * chain has fewer entries than `trustedProxies` (in which case the
 * caller should pick a different rate-limit axis rather than guess).
 *
 * @param {Object} request - Velo HTTP function `request` object.
 * @param {Object} [opts]
 * @param {number} [opts.trustedProxies] - Number of rightmost entries
 *   to strip before reading the client IP. Defaults to 1 for the Wix
 *   edge. Test harnesses can pass 0 when the test fakes the chain
 *   without the edge entry.
 * @returns {string|null} The trusted client IP, or null when unavailable.
 */
export function extractTrustedClientIp(request, opts = {}) {
  const trustedProxies = opts.trustedProxies ?? DEFAULT_TRUSTED_PROXIES;
  const headers = request && request.headers;
  if (!headers) return null;
  const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (typeof xff !== 'string' || xff.length === 0) return null;
  const entries = xff
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (entries.length === 0) return null;
  // Strip the rightmost `trustedProxies` entries. If we don't have enough
  // entries to do that safely, return null (caller falls back).
  if (entries.length <= trustedProxies) return null;
  return entries[entries.length - 1 - trustedProxies];
}

/**
 * One-way FNV-1a hash of a rate-limit key.
 * CF-sec1 CMEK compliance: bucket keys stored in wixData must not contain
 * plaintext PII (e.g. email addresses). Hashing is deterministic so the
 * rate-limit logic is unaffected, but the stored value is opaque.
 *
 * Uses FNV-1a because the Wix Velo backend does not expose the Web Crypto API.
 *
 * @param {string} key - Sanitized key (e.g. email, session ID).
 * @returns {string} 8-character lowercase hex digest.
 */
export function hashRateLimitKey(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

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
  const cleanKey = sanitize(key, 254).toLowerCase();
  // CF-sec1: hash before storing — bucket keys must not contain plaintext PII
  const storedKey = hashRateLimitKey(cleanKey);
  try {

    const existing = await wixData.query(collection)
      .eq('key', storedKey)
      .limit(1)
      .find();

    if (existing.items.length === 0) {
      await wixData.insert(collection, {
        key: storedKey,
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
    logError(`rateLimit.checkRateLimit[${collection}/${storedKey}]`, err);
    return { allowed: true }; // Fail open — don't block on DB errors
  }
}

// cf-3ldu.F2 (P2): canonical list of every wixData collection used as a
// rate-limit bucket in this codebase. Built statically (extracted via
// grep at audit time, 2026-05-10) — Velo's stateless dispatch means
// there's no module-load inventory phase to discover this at runtime.
// Update this list any time a new `checkRateLimit('XYZ', ...)` call
// lands; the `verifyRateLimitCollections()` probe relies on it to
// detect missing pre-cutover collections that would otherwise silently
// fail-open on the helper's catch-all.
//
// Includes `ReturnsLookupRateLimit` (cf-3ldu.1 added in PR #1288) and
// `NewsletterRateLimit` (newsletterService.web.js custom impl, F4).
export const RATE_LIMIT_COLLECTIONS = Object.freeze([
  'AbTestEventRateLimit',
  'AchievementsRateLimit',
  'ActivityRateLimit',
  'AnalyticsEventRateLimit',
  'BackInStockRateLimit',
  'BadgesPublicRateLimit',
  'BrowseSessionRateLimit',
  'BundleAddRateLimit',
  'BurnRateLimit',
  'BusEventRateLimit',
  'ChatMessageRateLimit',
  'CheckoutTrackingRateLimit',
  'ComfortTimelineRateLimit',
  'CommunityPhotoRateLimit',
  'ComparisonRateLimit',
  'ContactRateLimits',
  'CouponValidationRateLimit',
  'CustomerRoomPhotosRateLimit',
  'DeliveryReservationRateLimit',
  'EmailEventRateLimit',
  'ErrorLogRateLimit',
  'ExperimentVariantRateLimit',
  'GiftCardBalanceRateLimit',
  'LeaderboardPublicRateLimit',
  'MetricsReportRateLimit',
  'NewsletterRateLimit',
  'PriceLockRateLimit',
  'ProtectionPlanRateLimit',
  'QARateLimit',
  'QuizLeadRateLimit',
  'RealRoomsRateLimit',
  'RegistryPurchaseRateLimit',
  'RemindMeRateLimit',
  'ResubscribeRateLimit',
  'ReturnsLookupRateLimit',
  'ReviewRateLimit',
  'SommelierRateLimit',
  'SpinWheelRateLimit',
  'SupportTicketRateLimit',
  'SwatchRequestRateLimit',
  'TrackingRateLimit',
  'UnsubscribeRateLimit',
  'ViewerCountRateLimit',
  'ViewerTrackerRateLimit',
  'VisualSearchExportRateLimit',
  'WhiteGloveBookingRateLimit',
]);

/**
 * Probe every rate-limit collection and report which exist vs which
 * are missing. Pre-cutover gate (cf-3qt.8): if a rate-limit collection
 * doesn't exist on the live site, the helper's fail-open catch silently
 * disables protection on every endpoint that uses it.
 *
 * Each collection is queried for one item (`limit(1)`) — cheap, no
 * mutation. A missing collection rejects with `WD_COLLECTION_NOT_FOUND`
 * (or substrings like "not found" / "does not exist") which we capture
 * verbatim in the report.
 *
 * @returns {Promise<{
 *   total: number,
 *   existing: string[],
 *   missing: Array<{collection: string, error: string}>,
 *   errored: Array<{collection: string, error: string}>,
 * }>}
 */
export async function verifyRateLimitCollections() {
  const existing = [];
  const missing = [];
  const errored = [];

  for (const collection of RATE_LIMIT_COLLECTIONS) {
    try {
      await wixData.query(collection).limit(1).find();
      existing.push(collection);
    } catch (err) {
      const msg = String(err && (err.message || err)) || '';
      const lowered = msg.toLowerCase();
      if (
        lowered.includes('not found')
        || lowered.includes('does not exist')
        || lowered.includes('wd_collection_not_found')
      ) {
        missing.push({ collection, error: msg });
      } else {
        errored.push({ collection, error: msg });
      }
    }
  }

  return {
    total: RATE_LIMIT_COLLECTIONS.length,
    existing,
    missing,
    errored,
  };
}
