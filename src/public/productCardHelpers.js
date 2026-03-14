// productCardHelpers.js — Product card structure, badges, and hover effects
// cf-biba: Shared helpers for Home.js and Category Page.js repeater cards
import { colors, borderRadius, shadows, transitions } from 'public/designTokens.js';
import { getProductFallbackImage } from 'public/placeholderImages.js';
import { isCallForPrice, CALL_FOR_PRICE_TEXT } from 'public/productPageUtils.js';

/**
 * Apply card container styles: white bg, 12px radius, card shadow, transition.
 * @param {Object} $el - Wix element (card container inside repeater)
 */
export function styleCardContainer($el) {
  if (!$el || !$el.style) return;
  try {
    $el.style.backgroundColor = colors.white;
    $el.style.borderRadius = borderRadius.card;
    $el.style.boxShadow = shadows.card;
    $el.style.transition = transitions.cardHover;
  } catch (e) { /* element may not support all style props */ }
}

/**
 * Get badge background color by badge type.
 * Sale/Clearance = coral, everything else = mountainBlue.
 * @param {string} badgeText - Badge label text
 * @returns {string|null} Hex color or null for empty input
 */
export function getBadgeColor(badgeText) {
  if (!badgeText) return null;
  const lower = badgeText.toLowerCase();
  if (lower === 'sale' || lower === 'clearance') return colors.sunsetCoral;
  return colors.mountainBlue;
}

/**
 * Style and show/hide a badge element by type.
 * @param {Object} $el - Wix badge element
 * @param {string|null} badgeType - Badge label or null to hide
 */
export function styleBadge($el, badgeType) {
  if (!$el) return;
  try {
    if (!badgeType) {
      $el.hide();
      return;
    }
    // Wix Velo .text is a plain-text setter (not innerHTML) — no XSS vector
    $el.text = badgeType;
    $el.show();
    // Style properties may not exist on all element types
    try {
      const bgColor = getBadgeColor(badgeType);
      $el.style.backgroundColor = bgColor;
      $el.style.color = bgColor === colors.sunsetCoral ? colors.espresso : colors.white;
      $el.style.borderRadius = borderRadius.sm;
    } catch (e) { /* style props optional */ }
  } catch (e) { /* element may not exist */ }
}

/**
 * Register hover effect: elevate shadow on mouseIn, restore on mouseOut.
 * @param {Object} $el - Wix card container element
 */
export function initCardHover($el) {
  if (!$el) return;
  try {
    if (typeof $el.onMouseIn === 'function') {
      $el.onMouseIn(() => {
        try { $el.style.boxShadow = shadows.cardHover; } catch (e) {}
      });
    }
    if (typeof $el.onMouseOut === 'function') {
      $el.onMouseOut(() => {
        try { $el.style.boxShadow = shadows.card; } catch (e) {}
      });
    }
  } catch (e) { /* mouse handlers may not be available */ }
}

/**
 * Format card price: show discounted price + strikethrough original when on sale.
 * @param {Object} $priceEl - Price text element
 * @param {Object} $origPriceEl - Original price text element (strikethrough)
 * @param {Object} $saleBadgeEl - Sale badge element
 * @param {Object} product - Product data with formattedPrice/formattedDiscountedPrice
 */
export function formatCardPrice($priceEl, $origPriceEl, $saleBadgeEl, product) {
  // Call-for-price products use $0 or $1.00 placeholder — show CTA instead
  if (isCallForPrice(product)) {
    if ($priceEl) {
      try { $priceEl.text = CALL_FOR_PRICE_TEXT; } catch (e) {}
    }
    try { if ($origPriceEl) { $origPriceEl.hide(); } } catch (e) {}
    try { if ($saleBadgeEl) { $saleBadgeEl.hide(); } } catch (e) {}
    return;
  }

  const price = product?.formattedPrice;
  const discounted = product?.formattedDiscountedPrice;

  if ($priceEl) {
    try {
      $priceEl.text = discounted || price || 'Price unavailable';
    } catch (e) { console.warn('[ProductCard] Price element error:', e); }
  }

  if (discounted && price) {
    try { if ($origPriceEl) { $origPriceEl.text = price; $origPriceEl.show(); } } catch (e) {}
    try { if ($saleBadgeEl) { $saleBadgeEl.show(); } } catch (e) {}
  } else {
    try { if ($origPriceEl) { $origPriceEl.hide(); } } catch (e) {}
    try { if ($saleBadgeEl) { $saleBadgeEl.hide(); } } catch (e) {}
  }
}

/**
 * Set card image src with placeholder fallback when missing.
 * Optionally sets explicit dimensions to prevent CLS (Cumulative Layout Shift).
 * @param {Object} $el - Wix image element
 * @param {Object} product - Product data with mainMedia and name
 * @param {string} [category] - Category slug for placeholder selection
 * @param {{ width: number, height: number }} [dimensions] - Explicit image dimensions to prevent CLS
 */
export function setCardImage($el, product, category, dimensions) {
  if (!$el) return;
  try {
    const src = product?.mainMedia;
    const name = product?.name;
    $el.src = src || getProductFallbackImage(category || '');
    $el.alt = name ? `${name} - Carolina Futons` : 'Product image';
    if (dimensions) {
      try {
        $el.style.width = '100%';
        $el.style.aspectRatio = `${dimensions.width} / ${dimensions.height}`;
      } catch (e) { /* style may not be settable */ }
    }
  } catch (e) { /* element may not support src/alt */ }
}
