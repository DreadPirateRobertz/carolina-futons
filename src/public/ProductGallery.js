/**
 * @module ProductGallery
 * Product Page image gallery, video player, and badge overlay.
 * Handles thumbnail navigation, mobile swipe, keyboard arrow-key
 * navigation (WCAG 2.1.1), lightbox, zoom, placeholder fallbacks,
 * and cleanup for SPA navigation.
 */
import { generateAltText } from 'backend/seoHelpers.web';
import { getProductBadge, initImageLightbox, initImageZoom } from 'public/galleryHelpers.js';
import { getProductFallbackImage, getPlaceholderProductImages } from 'public/placeholderImages.js';
import { enableSwipe } from 'public/touchHelpers';
import { trackGalleryInteraction } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers.js';

/**
 * Initialize the main product image gallery with thumbnail clicks, mobile
 * swipe, keyboard arrow navigation, lightbox, and zoom. Falls back to
 * category-specific placeholder images when the product has fewer than 3
 * media items.
 * @param {Function} $w - Wix Velo selector function for querying page elements
 * @param {Object} state - Shared product page state
 * @param {Object} state.product - Current Wix Stores product object
 * @returns {{ destroy: Function }} Cleanup handle — call destroy() on SPA navigation to remove keydown listeners
 */
export function initImageGallery($w, state) {
  try {
    const product = state.product;
    if (!product) return { destroy() {} };

    const mainImage = $w('#productMainImage');
    if (mainImage) {
      if (!product.mainMedia) {
        const category = product.collections?.[0] || '';
        mainImage.src = getProductFallbackImage(category);
      }
      generateAltText(product, 'main').then(alt => { mainImage.alt = alt; });
    }

    const gallery = $w('#productGallery');
    if (gallery) {
      // Fill gallery with placeholders when fewer than expected thumbnails
      const mediaItems = product.mediaItems || [];
      if (mediaItems.length < 3) {
        const category = product.collections?.[0] || '';
        const placeholders = getPlaceholderProductImages(category, 4);
        const combined = [
          ...mediaItems,
          ...placeholders.slice(mediaItems.length).map(src => ({
            src, type: 'image', title: product.name || 'Product image',
          })),
        ];
        try { gallery.items = combined; } catch (e) {}
      }

      // Thumbnail click switches main image
      gallery.onItemClicked((event) => {
        try { $w('#productMainImage').src = event.item.src; } catch (e) {}
      });

      // Mobile swipe navigation
      try {
        const galleryEl = gallery?.getElement?.() ||
          (typeof document !== 'undefined' ? document.querySelector('[id*="productGallery"]') : null);
        if (galleryEl) {
          let idx = 0;
          enableSwipe(galleryEl, (direction) => {
            try {
              const items = gallery.items || [];
              if (items.length === 0) return;
              if (direction === 'left') idx = Math.min(idx + 1, items.length - 1);
              else if (direction === 'right') idx = Math.max(idx - 1, 0);
              $w('#productMainImage').src = items[idx].src;
              trackGalleryInteraction('swipe', direction);
            } catch (e) {}
          }, { threshold: 40 });
        }
      } catch (e) {}
    }

    // Keyboard arrow key navigation for gallery (WCAG 2.1.1)
    let galleryKeyHandler = null;
    try {
      if (typeof document !== 'undefined' && gallery) {
        let kbIdx = 0;
        try { mainImage.accessibility.ariaLabel = 'Product image gallery, use arrow keys to navigate'; } catch (e) {}
        try { mainImage.accessibility.ariaRoledescription = 'carousel'; } catch (e) {}

        galleryKeyHandler = (e) => {
          // Only handle arrow keys when gallery area has focus
          try {
            const items = gallery.items || [];
            if (items.length === 0) return;
            const active = document.activeElement;
            const isGalleryFocused = active && (
              active.id?.includes('productMainImage') ||
              active.id?.includes('productGallery') ||
              active.closest?.('[id*="productGallery"]') ||
              active.closest?.('[id*="productMainImage"]')
            );
            if (!isGalleryFocused) return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              kbIdx = Math.min(kbIdx + 1, items.length - 1);
              $w('#productMainImage').src = items[kbIdx].src;
              announce($w, `Image ${kbIdx + 1} of ${items.length}`);
              trackGalleryInteraction('keyboard', 'next');
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              kbIdx = Math.max(kbIdx - 1, 0);
              $w('#productMainImage').src = items[kbIdx].src;
              announce($w, `Image ${kbIdx + 1} of ${items.length}`);
              trackGalleryInteraction('keyboard', 'prev');
            }
          } catch (e) {}
        };
        document.addEventListener('keydown', galleryKeyHandler);
      }
    } catch (e) {}

    const lightbox = initImageLightbox($w, $w('#productGallery'), $w('#productMainImage'));
    initImageZoom($w, $w('#productMainImage'));

    // Return cleanup function for SPA navigation
    return {
      destroy() {
        try {
          if (typeof document !== 'undefined' && galleryKeyHandler) {
            document.removeEventListener('keydown', galleryKeyHandler);
            galleryKeyHandler = null;
          }
          if (lightbox && lightbox.destroy) lightbox.destroy();
        } catch (e) {}
      },
    };
  } catch (e) {}
  return { destroy() {} };
}

/**
 * Show or hide the product badge overlay (e.g., "Sale", "New", "In-Store Only")
 * based on the product's ribbon, discount, or creation date.
 * @param {Function} $w - Wix Velo selector function for querying page elements
 * @param {Object} state - Shared product page state
 * @param {Object} state.product - Current Wix Stores product object
 * @returns {void}
 */
export function initProductBadge($w, state) {
  try {
    const badge = getProductBadge(state.product);
    const overlay = $w('#productBadgeOverlay');
    if (!overlay) return;
    if (badge) { overlay.text = badge; overlay.show(); }
    else { overlay.hide(); }
  } catch (e) {}
}

/**
 * If the product has a video media item, expand the video section, load
 * the player (muted for autoplay compliance), and wire up the "View All
 * Videos" link. Collapses the section when no video exists.
 * @param {Function} $w - Wix Velo selector function for querying page elements
 * @param {Object} state - Shared product page state
 * @param {Object} state.product - Current Wix Stores product object
 * @returns {void}
 */
export function initProductVideo($w, state) {
  try {
    const section = $w('#productVideoSection');
    if (!section || !state.product) return;

    const mediaItems = state.product.mediaItems || [];
    const video = mediaItems.find(item => item.mediaType === 'video' || item.type === 'video');
    if (!video) { section.collapse(); return; }

    try { $w('#productVideoTitle').text = 'See It In Action'; } catch (e) {}
    try {
      const player = $w('#productVideo');
      if (player) { player.src = video.src || video.url; player.mute(); }
    } catch (e) {}
    try {
      $w('#viewAllVideosLink').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/product-videos'));
      });
    } catch (e) {}

    section.expand();
  } catch (e) {
    try { $w('#productVideoSection').collapse(); } catch (e2) {}
  }
}

/**
 * No-op stub retained for backward compatibility — Wix gallery handles
 * its own image loading natively.
 * @returns {void}
 */
export function preloadGalleryThumbnails() {}
