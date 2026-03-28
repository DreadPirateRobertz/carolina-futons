/**
 * FitScoreBadge.js — Renders "94% match for you" badges on product cards.
 *
 * CF-hx8m: NOVEL — Futon Fit Score
 *
 * Usage in repeater onItemReady:
 *   renderFitScoreBadge($item('#fitScoreBadge'), product);
 *
 * Requires editor element: #fitScoreBadge (Text) inside each product card
 * repeater item. Element should be styled with small font, positioned at
 * top-right of card.
 */
import { computeFitScore, getFitScoreLabel, getProfile } from 'public/fitScoreEngine.js';
import { colors } from 'public/designTokens.js';

/** Minimum score to display the badge. Below this, badge is hidden. */
const MIN_DISPLAY_SCORE = 40;

/**
 * Render a Fit Score badge on a product card.
 * Shows "94% match" with color coding. Hides badge if score < 40 or no profile signals.
 *
 * @param {Object} $el - Wix text element (#fitScoreBadge), or falsy to no-op
 * @param {Object} product - Product data
 * @param {Object} [profile] - Override visitor profile (for testing)
 */
export function renderFitScoreBadge($el, product, profile) {
  if (!$el) return;

  try {
    const p = profile || getProfile();
    const hasSignals = p.roomType || p.primaryUse || p.stylePreference ||
      p.budgetRange || (p.viewedCategories && p.viewedCategories.length > 0) ||
      p.viewedPriceRange;

    if (!hasSignals) {
      try { $el.collapse(); } catch (e) {}
      return;
    }

    const score = computeFitScore(product, p);

    if (score < MIN_DISPLAY_SCORE) {
      try { $el.collapse(); } catch (e) {}
      return;
    }

    const label = getFitScoreLabel(score);
    $el.text = label ? `${score}% match · ${label}` : `${score}% match for you`;

    try {
      if (score >= 90) {
        $el.style.color = colors.successGreen || '#2d8a4e';
      } else if (score >= 75) {
        $el.style.color = colors.mountainBlue || '#4a7c9b';
      } else {
        $el.style.color = colors.espresso || '#3a2518';
      }
    } catch { /* style props optional */ }

    try { $el.expand(); } catch (e) {}
  } catch {
    try { $el.collapse(); } catch (e) {}
  }
}

/**
 * Batch-render Fit Score badges for a list of products.
 * Returns the products sorted by fit score (highest first).
 *
 * @param {Array} products - Array of product data
 * @param {Object} [profile] - Override visitor profile
 * @returns {Array<{product: Object, fitScore: number}>} Sorted by score desc
 */
export function rankByFitScore(products, profile) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const p = profile || getProfile();
  return products
    .map(product => ({
      ...product,
      _fitScore: computeFitScore(product, p),
    }))
    .sort((a, b) => b._fitScore - a._fitScore);
}
