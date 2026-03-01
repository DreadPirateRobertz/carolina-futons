/**
 * StarRatingCard.js — Star rating display for product grid cards
 *
 * Renders star ratings (★★★★½ format) and review count on product cards.
 * Batch-loads review summaries from backend with caching to minimize queries.
 * Used by Home.js and Category Page.js repeaters.
 *
 * CF-ys3q: Star ratings + wishlist UI hookup
 *
 * @module StarRatingCard
 */
import { colors } from 'public/designTokens.js';

// ── Cache ───────────────────────────────────────────────────────────

let _ratingsCache = null;
let _ratingsPromise = null;

/**
 * Generate a 5-character star string from a numeric rating.
 * Full stars (★), half star (½) for fractional >= 0.5, empty stars (☆).
 *
 * @param {number} average - Rating 0-5
 * @returns {string} Star string, always 5 characters
 */
export function generateStarString(average) {
  const rating = Math.max(0, Math.min(5, Number(average) || 0));
  const fullStars = Math.floor(rating);
  const halfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

/**
 * Batch-load aggregate ratings for multiple products.
 * Results are cached — subsequent calls with same IDs return cached data.
 *
 * @param {string[]} productIds - Array of product IDs
 * @returns {Promise<Object>} Map of productId -> { average, total }
 */
export async function batchLoadRatings(productIds) {
  if (!productIds || productIds.length === 0) return {};

  if (_ratingsCache) return _ratingsCache;
  if (_ratingsPromise) return _ratingsPromise;

  _ratingsPromise = (async () => {
    try {
      const { getCategoryReviewSummaries } = await import('backend/reviewsService.web');
      _ratingsCache = await getCategoryReviewSummaries(productIds);
      return _ratingsCache;
    } catch (e) {
      return {};
    }
  })();

  return _ratingsPromise;
}

/**
 * Render star rating and review count on a product card.
 *
 * @param {Function} $item - Wix repeater item selector
 * @param {string} productId - Product ID to look up in ratingsMap
 * @param {Object} ratingsMap - Map of productId -> { average, total }
 */
export function renderCardStarRating($item, productId, ratingsMap) {
  try {
    const summary = ratingsMap && productId ? ratingsMap[productId] : null;

    const safeTotal = summary ? Math.max(0, Math.floor(Number(summary.total) || 0)) : 0;

    if (!summary || safeTotal === 0) {
      try { const s = $item('#gridReviewStars'); if (s) s.collapse(); } catch (e) {}
      try {
        const c = $item('#gridReviewCount');
        if (c) {
          c.text = 'No reviews yet';
          c.expand();
        }
      } catch (e) {}
      return;
    }

    try {
      const starsEl = $item('#gridReviewStars');
      if (starsEl) {
        starsEl.text = generateStarString(summary.average);
        starsEl.style.color = colors.sunsetCoral;
        starsEl.accessibility.ariaLabel = `${summary.average} out of 5 stars`;
        starsEl.expand();
      }
    } catch (e) {}

    try {
      const countEl = $item('#gridReviewCount');
      if (countEl) {
        countEl.text = `(${safeTotal})`;
        countEl.expand();
      }
    } catch (e) {}
  } catch (e) {}
}

/**
 * Reset the ratings cache. Used for testing and page navigation.
 */
export function _resetCache() {
  _ratingsCache = null;
  _ratingsPromise = null;
}
