// product360Data.js — 360-degree image data for product spin viewers.
// Maps product slugs to ordered image sequences for drag-to-rotate display.

/**
 * 360° image catalog. Each entry is a product slug mapped to an array
 * of image objects [{src, alt}] ordered by rotation angle (0°–360°).
 *
 * In production, images are hosted in Wix Media Manager or a CDN.
 * This module provides the lookup layer — the actual URLs come from
 * the ProductImages CMS collection or are statically configured here
 * for products with manufacturer-supplied spin sets.
 *
 * @type {Record<string, Array<{src: string, alt: string}>>}
 */
const SPIN_SETS = {};

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
