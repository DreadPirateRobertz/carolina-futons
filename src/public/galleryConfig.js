// Gallery image configuration for Carolina Futons
// Image sizing constants matching WIX-STUDIO-BUILD-SPEC.md element dimensions
// Per-category gallery settings for consistent product display

import { breakpoints } from 'public/designTokens.js';

// ── Image Sizing Constants ──────────────────────────────────────────
export const imageSizes = {
  hero: { width: 1920, height: 600 },
  productGridCard: { width: 400, height: 400 },   // 1:1 ratio
  productPageMain: { width: 800, height: 800 },    // 1:1 ratio
  thumbnail: { width: 100, height: 100 },
  categoryCard: { width: 600, height: 400 },       // 3:2 ratio
};

// Re-export breakpoints from design tokens for consumers that import from here
export { breakpoints };

// ── Default Gallery Settings ────────────────────────────────────────
const defaultGalleryConfig = {
  thumbnailCount: 4,
  enableZoom: true,
  enableLightbox: true,
  zoomLevel: 2,
  autoPlayGallery: false,
  showThumbnailStrip: true,
  thumbnailPosition: 'bottom', // bottom | left
  mainImageFit: 'contain',     // contain | cover
};

// ── Per-Category Gallery Overrides ──────────────────────────────────
const categoryOverrides = {
  'futon-frames': {
    thumbnailCount: 5,
    zoomLevel: 2.5,
    thumbnailPosition: 'left',
  },
  'mattresses': {
    thumbnailCount: 3,
    zoomLevel: 2,
    thumbnailPosition: 'bottom',
  },
  'murphy-cabinet-beds': {
    thumbnailCount: 6,
    zoomLevel: 2,
    thumbnailPosition: 'left',
    autoPlayGallery: true,
  },
  'platform-beds': {
    thumbnailCount: 5,
    zoomLevel: 2.5,
    thumbnailPosition: 'left',
  },
  'casegoods-accessories': {
    thumbnailCount: 4,
    zoomLevel: 2,
    thumbnailPosition: 'bottom',
  },
  'wall-huggers': {
    thumbnailCount: 4,
    zoomLevel: 2.5,
    thumbnailPosition: 'left',
  },
  'unfinished-wood': {
    thumbnailCount: 4,
    zoomLevel: 3,
    thumbnailPosition: 'left',
  },
};

/**
 * Get gallery configuration for a specific category.
 * Merges category overrides onto default settings.
 * @param {string} categorySlug
 * @returns {object} Gallery config
 */
export function getGalleryConfig(categorySlug) {
  const overrides = categoryOverrides[categorySlug] || {};
  return { ...defaultGalleryConfig, ...overrides };
}

/**
 * Get the correct image dimensions for a given context.
 * @param {'hero'|'productGridCard'|'productPageMain'|'thumbnail'|'categoryCard'} context
 * @returns {{ width: number, height: number }}
 */
export function getImageDimensions(context) {
  return imageSizes[context] || imageSizes.productGridCard;
}

/**
 * Determine the number of product grid columns based on viewport width.
 * @param {number} viewportWidth
 * @returns {number} Column count
 */
export function getGridColumns(viewportWidth) {
  if (viewportWidth >= breakpoints.desktop) return 3;
  if (viewportWidth >= breakpoints.tablet) return 2;
  return 1;
}
