/**
 * @module emptyStateBuilder
 * @description Builds branded empty state HTML blocks using ported mountain illustrations.
 * Each builder returns a complete HTML string (SVG illustration + heading + subtext + CTA)
 * suitable for injection into Wix HtmlComponent elements via $w('#element').postMessage().
 *
 * Uses the warm Blue Ridge palette illustrations from illustrations.js.
 */
import {
  buildCartIllustration,
  buildErrorIllustration,
  buildSearchIllustration,
  buildWishlistIllustration,
} from 'public/illustrations';

// ── Content Registry ────────────────────────────────────────────────

const EMPTY_STATES = {
  cart: {
    heading: 'Your cart is as empty as a mountain trail at dawn',
    subtext: 'Explore our handcrafted futon frames, premium mattresses, and more.',
    ctaLabel: 'Start Shopping',
    ctaHref: '/shop-main',
    buildIllustration: buildCartIllustration,
  },
  wishlist: {
    heading: 'Start your mountain collection',
    subtext: 'Save your favorite pieces here. Tap the heart icon on any product to add it to your wishlist.',
    ctaLabel: 'Explore Products',
    ctaHref: '/shop-main',
    buildIllustration: buildWishlistIllustration,
  },
  search: {
    heading: 'We searched every peak and valley...',
    subtext: 'No results found. Try a different search term, or browse our popular categories.',
    ctaLabel: 'Browse All Products',
    ctaHref: '/shop-main',
    buildIllustration: buildSearchIllustration,
  },
  error: {
    heading: 'Oops — the trail washed out',
    subtext: 'Something went wrong on our end. Please try again, or head back to the homepage.',
    ctaLabel: 'Go Home',
    ctaHref: '/',
    buildIllustration: buildErrorIllustration,
  },
};

// ── Style Tokens ────────────────────────────────────────────────────

const STYLES = {
  fontFamily: "'Avenir', 'Helvetica Neue', sans-serif",
  headingColor: '#3A2518',
  subtextColor: '#5C4033',
  ctaBg: '#1a5276',
  ctaColor: '#FFFFFF',
  ctaHoverBg: '#154360',
  containerBg: '#FAF7F2',
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get the list of valid empty state keys.
 * @returns {string[]}
 */
export function getEmptyStateKeys() {
  return Object.keys(EMPTY_STATES);
}

/**
 * Check if a key is a valid empty state.
 * @param {string} key
 * @returns {boolean}
 */
export function isValidEmptyState(key) {
  return key != null && EMPTY_STATES.hasOwnProperty(key);
}

/**
 * Build a complete empty state HTML block.
 * @param {string} stateKey - One of: cart, wishlist, search, error
 * @param {Object} [options]
 * @param {string} [options.heading] - Override default heading
 * @param {string} [options.subtext] - Override default subtext
 * @param {string} [options.ctaLabel] - Override default CTA label
 * @param {string} [options.ctaHref] - Override default CTA href
 * @param {number} [options.illustrationWidth=280] - SVG width
 * @param {number} [options.illustrationHeight=200] - SVG height
 * @returns {string|null} HTML string or null if invalid key
 */
export function buildEmptyStateHtml(stateKey, options = {}) {
  const config = EMPTY_STATES[stateKey];
  if (!config) return null;

  const heading = options.heading || config.heading;
  const subtext = options.subtext || config.subtext;
  const ctaLabel = options.ctaLabel || config.ctaLabel;
  const ctaHref = options.ctaHref || config.ctaHref;
  const w = options.illustrationWidth || 280;
  const h = options.illustrationHeight || 200;

  const svg = config.buildIllustration({ width: w, height: h });

  return `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:40px 20px;background:${STYLES.containerBg};font-family:${STYLES.fontFamily};" role="status" aria-label="${escapeAttr(heading)}">
  <div style="max-width:${w}px;margin-bottom:24px;" aria-hidden="true">
    ${svg}
  </div>
  <h2 style="font-size:22px;font-weight:600;color:${STYLES.headingColor};margin:0 0 12px 0;line-height:1.3;">
    ${escapeHtml(heading)}
  </h2>
  <p style="font-size:15px;color:${STYLES.subtextColor};margin:0 0 24px 0;max-width:360px;line-height:1.5;">
    ${escapeHtml(subtext)}
  </p>
  <a href="${escapeAttr(ctaHref)}" style="display:inline-block;padding:12px 28px;background:${STYLES.ctaBg};color:${STYLES.ctaColor};border-radius:6px;text-decoration:none;font-size:15px;font-weight:500;transition:background 0.2s;" aria-label="${escapeAttr(ctaLabel)}">
    ${escapeHtml(ctaLabel)}
  </a>
</div>`;
}

/**
 * Build an empty state SVG data URI for use as a Wix image source.
 * @param {string} stateKey - One of: cart, wishlist, search, error
 * @param {Object} [options] - { width, height }
 * @returns {string} Data URI string, or empty string if invalid key
 */
export function getEmptyStateIllustrationUri(stateKey, options = {}) {
  const config = EMPTY_STATES[stateKey];
  if (!config) return '';

  const w = options.width || 280;
  const h = options.height || 200;
  const svg = config.buildIllustration({ width: w, height: h });
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ── Internal Helpers ────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
