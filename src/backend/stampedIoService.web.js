/**
 * @module stampedIoService
 * @description Stamped.io review platform integration for Carolina Futons.
 *
 * Provides bidirectional sync between Stamped.io and our Reviews CMS collection,
 * plus API wrappers for fetching review data, aggregate ratings, and widget config.
 *
 * CF-gxn1: Epic 2A — Stamped.io review widget integration
 *
 * @requires wix-web-module
 * @requires wix-secrets-backend
 * @requires wix-fetch
 *
 * @setup
 * Add these secrets in Wix Dashboard > Secrets Manager:
 * - STAMPED_API_KEY — Stamped.io public API key
 * - STAMPED_API_SECRET — Stamped.io private API secret
 * - STAMPED_STORE_HASH — Stamped.io store identifier
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

const STAMPED_API_BASE = 'https://stamped.io/api/v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache for aggregate ratings (server-side, resets on cold start)
const _aggregateCache = new Map();

/**
 * Get Stamped.io API credentials from Wix Secrets Manager.
 * @returns {Promise<{apiKey: string, apiSecret: string, storeHash: string}>}
 */
async function getCredentials() {
  const [apiKey, apiSecret, storeHash] = await Promise.all([
    getSecret('STAMPED_API_KEY'),
    getSecret('STAMPED_API_SECRET'),
    getSecret('STAMPED_STORE_HASH'),
  ]);
  return { apiKey, apiSecret, storeHash };
}

/**
 * Make an authenticated request to the Stamped.io API.
 * @param {string} endpoint - API path (e.g., '/reviews')
 * @param {Object} [params] - Query parameters
 * @returns {Promise<Object>} Parsed JSON response
 */
async function stampedFetch(endpoint, params = {}) {
  const { apiKey, storeHash } = await getCredentials();

  const url = new URL(`${STAMPED_API_BASE}/${storeHash}${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Stamped.io API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get aggregate rating for a product from Stamped.io.
 * Cached for 5 minutes to reduce API calls.
 *
 * @param {string} productId - Wix product ID
 * @returns {Promise<{average: number, total: number, distribution: Object}>}
 */
export const getStampedRating = webMethod(
  Permissions.Anyone,
  async (productId) => {
    if (!productId || typeof productId !== 'string') {
      return { average: 0, total: 0, distribution: {} };
    }

    // Check cache
    const cached = _aggregateCache.get(productId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const data = await stampedFetch('/reviews/summary', {
        productId,
      });

      const result = {
        average: Number(data.rating) || 0,
        total: Number(data.total) || 0,
        distribution: data.distribution || {},
      };

      _aggregateCache.set(productId, { data: result, ts: Date.now() });
      return result;
    } catch (err) {
      console.error('[stampedIo] getStampedRating failed:', err?.message);
      return { average: 0, total: 0, distribution: {} };
    }
  }
);

/**
 * Get reviews for a product from Stamped.io.
 *
 * @param {string} productId - Wix product ID
 * @param {Object} [options]
 * @param {number} [options.page=1] - Page number (1-indexed for Stamped.io)
 * @param {number} [options.perPage=10] - Reviews per page
 * @param {string} [options.sort='recent'] - Sort: 'recent', 'highest', 'lowest', 'photos'
 * @returns {Promise<{reviews: Array, total: number, page: number}>}
 */
export const getStampedReviews = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    if (!productId || typeof productId !== 'string') {
      return { reviews: [], total: 0, page: 1 };
    }

    const { page = 1, perPage = 10, sort = 'recent' } = options;

    try {
      const data = await stampedFetch('/reviews', {
        productId,
        page,
        take: perPage,
        sort,
      });

      const reviews = (data.data || []).map(r => ({
        _id: r.id,
        author: r.author || 'Anonymous',
        rating: Number(r.reviewRating) || 5,
        title: r.reviewTitle || '',
        body: r.reviewMessage || '',
        date: r.dateCreated,
        verifiedPurchase: Boolean(r.isVerifiedBuyer),
        photos: (r.reviewPhotos || []).map(p => p.url),
        helpful: Number(r.reviewVotesUp) || 0,
      }));

      return {
        reviews,
        total: Number(data.total) || 0,
        page: Number(data.page) || 1,
      };
    } catch (err) {
      console.error('[stampedIo] getStampedReviews failed:', err?.message);
      return { reviews: [], total: 0, page: 1 };
    }
  }
);

/**
 * Batch-fetch aggregate ratings for multiple products.
 * Used by product card grids to show star ratings.
 *
 * @param {string[]} productIds - Array of product IDs (max 50)
 * @returns {Promise<Object>} Map of productId → { average, total }
 */
export const getBatchStampedRatings = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    if (!Array.isArray(productIds) || productIds.length === 0) return {};

    const ids = productIds.slice(0, 50).filter(id => typeof id === 'string' && id.length > 0);
    const results = {};

    // Check cache first, collect uncached
    const uncached = [];
    for (const id of ids) {
      const cached = _aggregateCache.get(id);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        results[id] = cached.data;
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return results;

    // Fetch uncached ratings individually (Stamped.io doesn't have a batch endpoint)
    // Limit concurrency to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      const fetches = batch.map(async (id) => {
        try {
          const data = await stampedFetch('/reviews/summary', { productId: id });
          const result = {
            average: Number(data.rating) || 0,
            total: Number(data.total) || 0,
          };
          _aggregateCache.set(id, { data: result, ts: Date.now() });
          results[id] = result;
        } catch {
          results[id] = { average: 0, total: 0 };
        }
      });
      await Promise.all(fetches);
    }

    return results;
  }
);

/**
 * Get Stamped.io widget configuration for embedding on product pages.
 * Returns the store hash and public API key needed for client-side widget init.
 *
 * @returns {Promise<{storeHash: string, apiKey: string}>}
 */
export const getStampedWidgetConfig = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const { apiKey, storeHash } = await getCredentials();
      return { storeHash, apiKey };
    } catch (err) {
      console.error('[stampedIo] getStampedWidgetConfig failed:', err?.message);
      return { storeHash: '', apiKey: '' };
    }
  }
);

/**
 * Clear the in-memory aggregate ratings cache.
 * Useful for testing and after bulk review imports.
 */
export function _resetCache() {
  _aggregateCache.clear();
}
