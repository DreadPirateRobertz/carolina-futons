/**
 * @module MultiImageGallery
 * Enhanced product gallery features: image counter overlay, active thumbnail
 * tracking with screen reader announcements, category-aware gallery config
 * application, and thumbnail strip scrolling for galleries with many images.
 *
 * Layers on top of ProductGallery.js — call these initializers after
 * initImageGallery for the enhanced multi-image experience.
 *
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} state - Product page state with state.product
 */
import { getGalleryConfig } from 'public/galleryConfig.js';
import { announce } from 'public/a11yHelpers.js';

// ── Gallery Counter ──────────────────────────────────────────────

/**
 * Initialize an image counter overlay showing "1 / N" on the main product image.
 * Hides the counter for single-image products. Sets ARIA live region for
 * screen reader announcements on navigation.
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state
 * @returns {{ update: Function }} Controller with update(index) method
 */
export function initGalleryCounter($w, state) {
  const noop = { update() {} };
  try {
    if (!state?.product) return noop;

    const items = state.product.mediaItems || [];
    const total = items.length;

    if (total <= 1) {
      try { $w('#galleryCounter').hide(); } catch (e) {}
      return noop;
    }

    try { $w('#galleryCounter').accessibility.ariaLive = 'polite'; } catch (e) {}
    try { $w('#galleryCounter').text = `1 / ${total}`; } catch (e) {}

    return {
      /** @param {number} index - 0-based image index */
      update(index) {
        try {
          const clamped = Math.max(0, Math.min(index, total - 1));
          $w('#galleryCounter').text = `${clamped + 1} / ${total}`;
        } catch (e) {}
      },
    };
  } catch (e) {
    return noop;
  }
}

// ── Active Thumbnail Tracking ────────────────────────────────────

/**
 * Track and announce the currently active gallery image. Updates a
 * thumbnail indicator element and announces changes via screen reader.
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state
 * @returns {{ setActive: Function, getActive: Function }} Tracker controller
 */
export function initActiveThumbnail($w, state) {
  let activeIndex = 0;
  const noop = { setActive() {}, getActive: () => 0 };

  try {
    if (!state?.product) return noop;

    const items = state.product.mediaItems || [];
    if (items.length === 0) return noop;

    const total = items.length;

    return {
      setActive(index) {
        try {
          activeIndex = Math.max(0, Math.min(index, total - 1));
          const display = activeIndex + 1;
          try {
            $w('#galleryThumbnailIndicator').text = `Image ${display} of ${total}`;
          } catch (e) {}

          const title = items[activeIndex]?.title;
          const message = title
            ? `Image ${display} of ${total}: ${title}`
            : `Image ${display} of ${total}`;
          announce($w, message);
        } catch (e) {}
      },
      getActive: () => activeIndex,
    };
  } catch (e) {
    return noop;
  }
}

// ── Category-Aware Gallery Config ────────────────────────────────

/**
 * Apply per-category gallery configuration. Reads config from galleryConfig.js
 * based on the product's first collection and applies visibility settings
 * (zoom, lightbox, thumbnail strip) to page elements.
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state
 * @returns {Object} The resolved gallery config
 */
export function applyGalleryConfig($w, state) {
  const defaultConfig = {
    thumbnailCount: 4, enableZoom: true, enableLightbox: true,
    zoomLevel: 2, autoPlayGallery: false, showThumbnailStrip: true,
    thumbnailPosition: 'bottom', mainImageFit: 'contain',
  };

  try {
    if (!state?.product) return defaultConfig;

    const category = (state.product.collections || [])[0] || '';
    const config = getGalleryConfig(category);

    if (!config.enableZoom) {
      try { $w('#imageZoomOverlay').hide(); } catch (e) {}
    }
    if (!config.enableLightbox) {
      try { $w('#lightboxOverlay').hide(); } catch (e) {}
    }
    if (!config.showThumbnailStrip) {
      try { $w('#productGallery').hide(); } catch (e) {}
    }

    return config;
  } catch (e) {
    return defaultConfig;
  }
}

// ── Thumbnail Scroll ─────────────────────────────────────────────

/**
 * Initialize scroll navigation for the thumbnail strip when the number of
 * images exceeds the category's configured thumbnail count. Wires prev/next
 * buttons and hides them when scrolling is unnecessary.
 * @param {Function} $w - Wix selector function
 * @param {Object} state - Product page state
 * @returns {{ scrollTo: Function }} Scroll controller
 */
export function initThumbnailScroll($w, state) {
  const noop = { scrollTo() {} };

  try {
    if (!state?.product) return noop;

    const items = state.product.mediaItems || [];
    if (items.length === 0) return noop;

    const category = (state.product.collections || [])[0] || '';
    const config = getGalleryConfig(category);
    const maxVisible = config.thumbnailCount || 4;
    let scrollOffset = 0;

    if (items.length <= maxVisible) {
      try { $w('#thumbScrollPrev').hide(); } catch (e) {}
      try { $w('#thumbScrollNext').hide(); } catch (e) {}
      return { scrollTo() {} };
    }

    try {
      $w('#thumbScrollPrev').accessibility.ariaLabel = 'Scroll to previous thumbnails';
    } catch (e) {}
    try {
      $w('#thumbScrollNext').accessibility.ariaLabel = 'Scroll to next thumbnails';
    } catch (e) {}

    try {
      $w('#thumbScrollPrev').onClick(() => {
        scrollOffset = Math.max(0, scrollOffset - 1);
      });
    } catch (e) {}

    try {
      $w('#thumbScrollNext').onClick(() => {
        scrollOffset = Math.min(items.length - maxVisible, scrollOffset + 1);
      });
    } catch (e) {}

    return {
      scrollTo(index) {
        try {
          scrollOffset = Math.max(0, Math.min(index, items.length - maxVisible));
        } catch (e) {}
      },
    };
  } catch (e) {
    return noop;
  }
}
