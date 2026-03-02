// ProductPagePolish.js — Design token application for Product Page UX
// Centralizes Blue Ridge aesthetic styling: warm shadows, coral CTAs,
// Mountain Blue accents, espresso-tinted UI.
import { colors, shadows, transitions, spacing, borderRadius } from 'public/designTokens.js';

/**
 * Style a gallery thumbnail based on active state.
 * Active: Mountain Blue border. Inactive: sandDark border.
 * @param {Object} el - Wix element
 * @param {boolean} isActive - Whether this thumbnail is selected
 */
export function styleGalleryThumbnail(el, isActive) {
  if (!el) return;
  try {
    el.style.borderColor = isActive ? colors.mountainBlue : colors.sandDark;
    el.style.borderWidth = isActive ? '3px' : '1px';
    el.style.transition = transitions.fast;
    el.style.borderRadius = '4px';
  } catch (e) {}
}

/**
 * Apply brand styling to the sticky add-to-cart bar.
 * Espresso background, sand text, coral CTA.
 * @param {Function} $w - Wix selector function
 */
export function styleStickyCartBar($w) {
  try {
    const bar = $w('#stickyCartBar');
    if (!bar) return;
    bar.style.backgroundColor = colors.espresso;
    bar.style.boxShadow = shadows.card;
  } catch (e) {}

  try { $w('#stickyProductName').style.color = colors.sand; } catch (e) {}
  try { $w('#stickyPrice').style.color = colors.sand; } catch (e) {}

  try {
    const btn = $w('#stickyAddBtn');
    if (btn) {
      btn.style.backgroundColor = colors.sunsetCoral;
      btn.style.color = colors.white;
    }
  } catch (e) {}
}

/**
 * Calculate styled star display for a rating.
 * Returns filled/half/empty counts with brand colors.
 * @param {number} rating - Rating value (0-5)
 * @returns {{ filled: number, half: boolean, empty: number, filledColor: string, emptyColor: string }}
 */
export function styleReviewStars(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const filled = Math.floor(r);
  const half = r - filled >= 0.5;
  const empty = 5 - filled - (half ? 1 : 0);

  return {
    filled,
    half,
    empty,
    filledColor: colors.sunsetCoral,
    emptyColor: colors.sandDark,
  };
}

/**
 * Style a rating breakdown bar with Mountain Blue fill.
 * @param {Object} el - Bar fill element
 * @param {number} percentage - Fill percentage (0-100)
 * @param {Object} [trackEl] - Optional track background element
 */
export function styleRatingBar(el, percentage, trackEl) {
  if (!el) return;
  try {
    const pct = Math.max(0, Math.min(100, percentage));
    el.style.backgroundColor = colors.mountainBlue;
    el.style.width = `${pct}%`;
  } catch (e) {}

  if (trackEl) {
    try { trackEl.style.backgroundColor = colors.sandLight; } catch (e) {}
  }
}

/**
 * Style a review card with warm shadow and brand colors.
 * @param {Object} el - Card container element
 */
export function styleReviewCard(el) {
  if (!el) return;
  try {
    el.style.boxShadow = shadows.card;
    el.style.borderRadius = borderRadius.card;
    el.style.backgroundColor = colors.offWhite;
    el.style.padding = spacing.lg;
  } catch (e) {}
}

/**
 * Style the comfort section container.
 * @param {Function} $w - Wix selector function
 */
export function styleComfortSection($w) {
  try {
    const section = $w('#comfortSection');
    if (!section) return;
    section.style.backgroundColor = colors.sandLight;
    section.style.borderRadius = borderRadius.card;
    section.style.padding = spacing.xl;
  } catch (e) {}
}

/**
 * Style a comfort card element.
 * @param {Object} el - Card element
 * @param {boolean} isActive - Whether this comfort level matches the product
 */
export function styleComfortCard(el, isActive) {
  if (!el) return;
  try {
    el.style.boxShadow = shadows.card;
    el.style.backgroundColor = colors.offWhite;
    el.style.transition = transitions.medium;
    if (isActive) {
      el.style.borderColor = colors.mountainBlue;
      el.style.borderWidth = '2px';
    }
  } catch (e) {}
}

/**
 * Style a cross-sell repeater for horizontal scroll.
 * @param {Function} $w - Wix selector function
 * @param {string} repeaterId - Repeater element selector
 */
export function styleCrossSellSection($w, repeaterId) {
  try {
    const repeater = $w(repeaterId);
    if (!repeater) return;
    repeater.style.overflowX = 'auto';
    repeater.style.display = 'flex';
    repeater.style.flexWrap = 'nowrap';
    repeater.style.gap = spacing.lg;
  } catch (e) {}
}

/**
 * Apply all design tokens to Product Page elements.
 * Called once during page init after all sections are wired.
 * @param {Function} $w - Wix selector function
 */
export function applyProductPageTokens($w) {
  // Sticky cart bar
  styleStickyCartBar($w);

  // Comfort section
  styleComfortSection($w);

  // Cross-sell repeaters
  styleCrossSellSection($w, '#relatedRepeater');
  styleCrossSellSection($w, '#collectionRepeater');

  // Main CTA button
  try {
    const cta = $w('#addToCartButton');
    if (cta) {
      cta.style.backgroundColor = colors.sunsetCoral;
      cta.style.color = colors.white;
    }
  } catch (e) {}

  // Wishlist button
  try {
    const wishlist = $w('#wishlistBtn');
    if (wishlist) {
      wishlist.style.borderColor = colors.mountainBlue;
    }
  } catch (e) {}

  // Reviews section title
  try { $w('#reviewsSectionTitle').style.color = colors.espresso; } catch (e) {}

  // Review sort dropdown
  try { $w('#reviewsSortDropdown').style.borderColor = colors.mountainBlue; } catch (e) {}
}
