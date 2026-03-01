// Web AR support detection and product eligibility.
// Adapted from cfutons_mobile arSupport.ts — web-only subset.

import { hasARModel } from 'public/models3d.js';

/** Product categories eligible for AR viewing */
export const AR_CATEGORIES = new Set(['futons', 'frames', 'murphy-beds']);

/**
 * Check if the browser supports custom elements (required for <model-viewer>).
 */
export function checkWebARSupport() {
  try {
    return typeof customElements !== 'undefined' && customElements !== null;
  } catch {
    return false;
  }
}

/**
 * Check if a product is eligible for AR viewing.
 * Requires: AR-eligible category, in stock, has 3D model.
 */
export function isProductAREnabled(product) {
  if (!product) return false;
  if (!product.inStock) return false;
  if (!product._id) return false;

  const collections = product.collections;
  if (!Array.isArray(collections)) return false;

  const inARCategory = collections.some(c => AR_CATEGORIES.has(c));
  if (!inARCategory) return false;

  return hasARModel(product._id);
}
