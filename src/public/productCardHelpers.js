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
 * Render a single price element with call-for-price guard.
 * Use this for simple price displays (recently viewed, quick view, cross-sell)
 * where there is no sale strikethrough or badge. For full sale price rendering,
 * use formatCardPrice() instead.
 *
 * @param {Object} $el - Wix text element, or falsy to no-op
 * @param {Object} product - Product data with price/formattedPrice/formattedDiscountedPrice
 */
export function renderSimplePrice($el, product) {
  if (!$el) return;
  try {
    if (isCallForPrice(product)) {
      $el.text = CALL_FOR_PRICE_TEXT;
    } else {
      $el.text = product?.formattedDiscountedPrice || product?.formattedPrice || String(product?.price ?? '') || '';
    }
  } catch (e) { /* element may not support text */ }
}

// Matches batchAltText.web.js + imageAltText.web.js keyword convention (3 terms only).
// 'context' excluded — matches Wix CDN URL params. 'living/bedroom/setting' excluded — too broad.
const LIFESTYLE_KEYWORDS = ['lifestyle', 'room', 'scene'];

/**
 * Select the best image for a product card — lifestyle room shot preferred over
 * white-background product shots. Checks mediaItems title/alt/url for lifestyle
 * keywords; falls back to mainMedia when no match or when matched item has no url/src.
 *
 * Keywords aligned with batchAltText.web.js + imageAltText.web.js convention.
 * No index-based fallback — mediaItems[1] is not guaranteed to be a lifestyle
 * shot (could be a back view, dimension diagram, or detail photo).
 *
 * @param {Object} product - Wix product with mainMedia and optional mediaItems array
 * @returns {string} Image URL — keyword-matched lifestyle shot (url or src) if found
 *   and non-empty; else mainMedia; empty string if neither is available
 */
export function getLifestyleImage(product) {
  const mediaItems = product?.mediaItems;
  const fallback = product?.mainMedia || '';
  if (Array.isArray(mediaItems) && mediaItems.length > 0) {
    const keywordMatch = mediaItems.find(item => {
      if (!item) return false;
      const searchable = `${item.title || ''} ${item.alt || ''} ${item.url || ''} ${item.src || ''}`.toLowerCase();
      return LIFESTYLE_KEYWORDS.some(kw => searchable.includes(kw));
    });
    if (keywordMatch) {
      const url = keywordMatch.url || keywordMatch.src || '';
      if (!url) console.warn('[getLifestyleImage] keyword match has no url/src:', keywordMatch.title || keywordMatch.alt);
      return url || fallback;
    }
  }
  return fallback;
}

/**
 * Set card image src with placeholder fallback when missing.
 * Prefers lifestyle/room-context photography over white-background product shots
 * per CF-l5id — lifestyle photo first on product cards.
 * Optionally sets explicit dimensions to prevent CLS (Cumulative Layout Shift).
 * @param {Object} $el - Wix image element
 * @param {Object} product - Product data with mainMedia, mediaItems, and name
 * @param {string} [category] - Category slug for placeholder selection
 * @param {{ width: number, height: number }} [dimensions] - Explicit image dimensions to prevent CLS
 */
export function setCardImage($el, product, category, dimensions) {
  if (!$el) return;
  try {
    const src = getLifestyleImage(product);
    const name = product?.name;
    $el.src = src || getProductFallbackImage(category || '');
    $el.alt = name ? `${name} - Carolina Futons` : 'Product image';
    if (dimensions) {
      try {
        $el.style.width = '100%';
        $el.style.aspectRatio = `${dimensions.width} / ${dimensions.height}`;
      } catch (e) { /* style may not be settable */ }
    }
  } catch (e) { console.warn('[ProductCard] setCardImage error:', e?.message); }
}


/**
 * Render a financing badge on a product card using pre-fetched badge data.
 * Shows the first badge label from the badges array, or hides the element.
 * Badge ordering (Afterpay before installment financing) is controlled by
 * getBatchPaymentBadges in paymentOptions.web.js, not enforced here.
 *
 * Call getBatchPaymentBadges() once for all cards, then invoke this per card
 * in repeater.onItemReady — element ID: #gridFinancingBadge.
 *
 * @param {Object} $el - Wix text element (#gridFinancingBadge), or falsy to no-op
 * @param {Array|null} badges - Badge array from getBatchPaymentBadges, or null/empty
 */
// ── Assembly difficulty badge ─────────────────────────────────────────────────

/**
 * Map assembly difficulty tier to display label and background color.
 * Easy=green, Medium=gold, Expert=coral.
 *
 * @type {Object.<string, {label: string, bg: string, fg: string}>}
 */
export const ASSEMBLY_BADGE_CONFIG = {
  Easy:   { label: 'Easy Assembly',   bg: colors.success,    fg: colors.white },
  Medium: { label: 'Some Assembly',   bg: colors.badgeGold,  fg: colors.white },
  Expert: { label: 'Expert Assembly', bg: colors.badgeCoral, fg: colors.white },
};

/**
 * Render the assembly difficulty badge on a product card.
 * Shows a colored pill below the price: "Easy Assembly" | "Some Assembly" | "Expert Assembly"
 * Hides the element when difficulty is absent or unrecognized.
 *
 * @param {Object} $el - Wix element (#gridAssemblyBadge)
 * @param {string|null|undefined} difficulty - 'Easy' | 'Medium' | 'Expert' | null
 * @param {number|null|undefined} [assemblyTimeMinutes] - Optional, used for accessible label only
 * @returns {void}
 */
export function renderCardAssemblyBadge($el, difficulty, assemblyTimeMinutes) {
  if (!$el) return;
  const config = ASSEMBLY_BADGE_CONFIG[difficulty];
  if (!config) {
    try { $el.hide(); } catch (e) { /* element may not exist in this template */ }
    return;
  }
  try {
    $el.text = config.label;
    $el.show();
    try {
      $el.style.backgroundColor = config.bg;
      $el.style.color = config.fg;
      $el.style.borderRadius = borderRadius.sm;
      if (assemblyTimeMinutes) {
        $el.setAttribute('aria-label', `${config.label} — approximately ${assemblyTimeMinutes} minutes`);
      }
    } catch (e) { /* style props optional on some element types */ }
  } catch (e) {
    console.warn('[ProductCard] #gridAssemblyBadge render failed:', e?.message);
  }
}

export function renderCardFinancingBadge($el, badges) {
  if (!$el) return;
  const label = Array.isArray(badges) && badges.length > 0 ? badges[0]?.label : null;
  if (label) {
    try { $el.text = label; $el.show(); } catch (e) {
      console.warn('[ProductCard] #gridFinancingBadge show failed:', e?.message);
    }
  } else {
    try { $el.hide(); } catch (e) {
      console.warn('[ProductCard] #gridFinancingBadge hide failed:', e?.message);
    }
  }
}
