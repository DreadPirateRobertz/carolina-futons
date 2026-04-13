/**
 * @module RatingsRollup
 * @description Aggregate star rating and review count widget for the Product Detail Page.
 * Renders a star bar, numeric average, and review count from approved reviews.
 * Shows a "No reviews yet" CTA for products with zero reviews.
 * Collapses the section on missing state or backend error.
 *
 * Elements:
 *   #ratingsRollupSection — Box wrapper; collapsed on error, expanded on success
 *   #ratingsStarBar       — Text; star character string (★★★½☆); hidden for 0 reviews
 *   #ratingsAverage       — Text; numeric average e.g. "4.2"; hidden for 0 reviews
 *   #ratingsCount         — Text; "(N reviews)" or "(1 review)"; always shown
 *   #ratingsNoReviews     — Box/Text; "No reviews yet" CTA; shown only for 0 reviews
 *
 * CF-356
 */
import { getAggregateRating as _defaultGetAggregateRating } from 'backend/reviewsService.web';
import { generateStarString } from 'public/StarRatingCard.js';

/**
 * Initialise the ratings rollup widget on the Product Detail Page.
 * Call once per page load from $w.onReady.
 *
 * @param {Function} $w    - Wix element selector
 * @param {Object}   state - Page state. If state.product._id is absent the section
 *                           collapses gracefully and nothing is rendered.
 * @param {Object}  [opts] - Injectable overrides for testing
 * @param {Function} [opts.getAggregateRating] - Overrides backend call.
 *   Must return `Promise<{ average: number, total: number, breakdown: Object }>`.
 * @returns {Promise<void>}
 */
export async function initRatingsRollup($w, state, opts = {}) {
  const getAggregateRating = opts.getAggregateRating ?? _defaultGetAggregateRating;

  const section = $w('#ratingsRollupSection');
  const productId = state?.product?._id;
  if (!productId) {
    section.collapse();
    return;
  }

  let rating;
  try {
    rating = await getAggregateRating(productId);
  } catch (err) {
    console.warn('[RatingsRollup] getAggregateRating failed:', err?.message ?? err);
    section.collapse();
    return;
  }

  const total = rating?.total ?? 0;

  if (total === 0) {
    // Zero-review state: hide score elements, show CTA so visitors can write the first review.
    $w('#ratingsStarBar').hide();
    $w('#ratingsAverage').hide();
    $w('#ratingsNoReviews').show();
  } else {
    // Round to 1 decimal — Math.round(x * 10) / 10 avoids floating-point artefacts
    // (e.g. 4.25000000001 → 4.3). Guard against missing average with ?? 0.
    const average = Math.round((rating.average ?? 0) * 10) / 10;
    $w('#ratingsStarBar').text = generateStarString(average);
    $w('#ratingsStarBar').show();
    $w('#ratingsAverage').text = String(average);
    $w('#ratingsAverage').show();
    $w('#ratingsCount').text = total === 1 ? '(1 review)' : `(${total} reviews)`;
    $w('#ratingsNoReviews').hide();
  }

  section.expand();
}
