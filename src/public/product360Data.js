// product360Data.js — 360-degree image data for product spin viewers.
// Maps product slugs to ordered image sequences for drag-to-rotate display.

/** CDN base URL for 360° spin set images. */
export const SPIN_CDN_BASE = 'https://cdn.carolinafutons.com/360';

/** Standard frame count for turntable photography (10° increments). */
export const DEFAULT_FRAME_COUNT = 36;

/**
 * Build a spin set array from CDN convention: {base}/{slug}/{slug}-{NN}.jpg
 * @param {string} slug - Product slug
 * @param {string} productName - Human-readable product name for alt text
 * @param {number} [frameCount=36] - Number of frames in the spin set
 * @returns {Array<{src: string, alt: string}>}
 */
export function buildSpinSet(slug, productName, frameCount = DEFAULT_FRAME_COUNT) {
  return Array.from({ length: frameCount }, (_, i) => ({
    src: `${SPIN_CDN_BASE}/${slug}/${slug}-${String(i).padStart(2, '0')}.jpg`,
    alt: `${productName} — 360° view, angle ${i * (360 / frameCount)}°`,
  }));
}

/**
 * 360° image catalog. Each entry is a product slug mapped to an array
 * of image objects [{src, alt}] ordered by rotation angle (0°–360°).
 *
 * In production, images are hosted in Wix Media Manager or a CDN.
 * This module provides the lookup layer — the actual URLs come from
 * the ProductImages CMS collection or are statically configured here
 * for products with manufacturer-supplied spin sets.
 *
 * Spin sets are generated from CDN convention once turntable photos
 * are uploaded. Products listed here are "ready" — the viewer will
 * attempt to load images from these URLs.
 *
 * @type {Record<string, Array<{src: string, alt: string}>>}
 */
const SPIN_SETS = {
  // Murphy Cabinet Beds (Phase 1 — all have 3D models too)
  'murphy-queen-vertical': buildSpinSet('murphy-queen-vertical', 'Murphy Queen Vertical'),
  'murphy-full-horizontal': buildSpinSet('murphy-full-horizontal', 'Murphy Full Horizontal'),
  'murphy-queen-bookcase': buildSpinSet('murphy-queen-bookcase', 'Murphy Queen Bookcase'),
  'murphy-twin-cabinet': buildSpinSet('murphy-twin-cabinet', 'Murphy Twin Cabinet'),
  'murphy-queen-desk': buildSpinSet('murphy-queen-desk', 'Murphy Queen with Desk'),
  'murphy-full-storage': buildSpinSet('murphy-full-storage', 'Murphy Full Storage'),

  // Futon Frames (Phase 1 — top sellers)
  'asheville': buildSpinSet('asheville', 'Asheville Futon Frame'),
  'blue-ridge': buildSpinSet('blue-ridge', 'Blue Ridge Futon Frame'),
  'pisgah': buildSpinSet('pisgah', 'Pisgah Futon Frame'),
  'biltmore': buildSpinSet('biltmore', 'Biltmore Loveseat Frame'),
  'monterey': buildSpinSet('monterey', 'Monterey Futon Frame'),
};

/**
 * Get 360° image set for a product.
 * @param {string} slugOrId - Product slug or ID
 * @returns {Array<{src: string, alt: string}>}
 */
export function get360Images(slugOrId) {
  if (!slugOrId || typeof slugOrId !== 'string') return [];
  return SPIN_SETS[slugOrId] || [];
}

/**
 * Check if a product has a 360° view available.
 * @param {Object} product - Product object with slug or _id
 * @returns {boolean}
 */
export function has360View(product) {
  if (!product) return false;
  const images = get360Images(product.slug || product._id);
  return images.length > 0;
}

/**
 * Register a spin set for a product (used by admin tools or CMS sync).
 * @param {string} slug - Product slug
 * @param {Array<{src: string, alt: string}>} images - Ordered image frames
 */
export function register360SpinSet(slug, images) {
  if (!slug || !Array.isArray(images)) return;
  SPIN_SETS[slug] = images;
}
