// GalleryZoomLightbox.js — Product Gallery Zoom Lightbox
// Full-size image overlay triggered by clicking the main product image or a
// gallery thumbnail. Supports prev/next navigation, keyboard shortcuts
// (Escape, ArrowLeft, ArrowRight), mobile swipe, and ARIA accessibility.
// Returns a destroy handle for SPA navigation cleanup.
//
// Element nicknames:
//   zoomLightboxOverlay  — modal overlay container
//   zoomLightboxImage    — full-size image display
//   zoomLightboxClose    — close button
//   zoomLightboxPrev     — previous image button
//   zoomLightboxNext     — next image button
//   zoomLightboxCounter  — image counter label (e.g., "2 / 5")

import { announce } from 'public/a11yHelpers.js';
import { enableSwipe } from 'public/touchHelpers';

// ── initGalleryZoomLightbox ───────────────────────────────────────────

/**
 * Initialize the product gallery zoom lightbox.
 * Wires main image click and gallery thumbnail click to open a full-size
 * overlay with prev/next navigation, keyboard shortcuts, and swipe support.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object|null} state - Page state; if null or missing product, returns null
 * @returns {{destroy: Function}|null} Cleanup handle or null if no product
 */
export function initGalleryZoomLightbox($w, state) {
  try {
    try { $w('#zoomLightboxOverlay').collapse(); } catch (e) {
      console.warn('[GalleryZoomLightbox] collapse failed:', e?.message);
    }

    const product = state?.product;
    if (!product) return null;

    // Collect image list from mediaItems; fall back to mainMedia
    const mediaItems = product.mediaItems || [];
    const images = mediaItems
      .filter(item => item.type === 'image' || item.mediaType === 'image')
      .map(item => ({ src: item.src, alt: item.title || product.name || 'Product image' }));

    if (images.length === 0 && product.mainMedia) {
      images.push({ src: product.mainMedia, alt: product.name || 'Product image' });
    }

    let currentIndex = 0;
    let isOpen = false;

    // ARIA attributes
    try { $w('#zoomLightboxOverlay').accessibility.role = 'dialog'; } catch (e) {
      console.warn('[GalleryZoomLightbox] ARIA role failed:', e?.message);
    }
    try { $w('#zoomLightboxOverlay').accessibility.ariaModal = true; } catch (e) {
      console.warn('[GalleryZoomLightbox] ariaModal failed:', e?.message);
    }
    try { $w('#zoomLightboxClose').accessibility.ariaLabel = 'Close image lightbox'; } catch (e) {
      console.warn('[GalleryZoomLightbox] close ariaLabel failed:', e?.message);
    }
    try { $w('#zoomLightboxPrev').accessibility.ariaLabel = 'Previous image'; } catch (e) {
      console.warn('[GalleryZoomLightbox] prev ariaLabel failed:', e?.message);
    }
    try { $w('#zoomLightboxNext').accessibility.ariaLabel = 'Next image'; } catch (e) {
      console.warn('[GalleryZoomLightbox] next ariaLabel failed:', e?.message);
    }

    function showImage(index) {
      if (images.length === 0) return;
      currentIndex = ((index % images.length) + images.length) % images.length;

      try { $w('#zoomLightboxImage').src = images[currentIndex].src; } catch (e) {
        console.warn('[GalleryZoomLightbox] image src failed:', e?.message);
      }
      try { $w('#zoomLightboxImage').alt = images[currentIndex].alt; } catch (e) {}

      if (images.length > 1) {
        try { $w('#zoomLightboxCounter').text = `${currentIndex + 1} / ${images.length}`; } catch (e) {}
        try { $w('#zoomLightboxPrev').show(); } catch (e) {}
        try { $w('#zoomLightboxNext').show(); } catch (e) {}
      } else {
        try { $w('#zoomLightboxCounter').text = ''; } catch (e) {}
        try { $w('#zoomLightboxPrev').hide(); } catch (e) {}
        try { $w('#zoomLightboxNext').hide(); } catch (e) {}
      }

      announce($w, `Image ${currentIndex + 1} of ${images.length}`);
    }

    function openLightbox(index = 0) {
      isOpen = true;
      showImage(index);
      try { $w('#zoomLightboxOverlay').expand(); } catch (e) {
        console.warn('[GalleryZoomLightbox] expand failed:', e?.message);
      }
    }

    function closeLightbox() {
      isOpen = false;
      try { $w('#zoomLightboxOverlay').collapse(); } catch (e) {
        console.warn('[GalleryZoomLightbox] collapse on close failed:', e?.message);
      }
      announce($w, 'Image lightbox closed');
    }

    // Main image click → open at that image's index
    try {
      $w('#productMainImage').onClick(() => {
        try {
          const src = $w('#productMainImage').src;
          const idx = images.findIndex(img => img.src === src);
          openLightbox(idx >= 0 ? idx : 0);
        } catch (e) {
          console.error('[GalleryZoomLightbox] main image click failed:', e);
        }
      });
    } catch (e) {
      console.warn('[GalleryZoomLightbox] main image onClick wire failed:', e?.message);
    }

    // Gallery thumbnail click → open at that index
    try {
      $w('#productGallery').onItemClicked((event) => {
        try {
          const idx = images.findIndex(img => img.src === event.item?.src);
          openLightbox(idx >= 0 ? idx : 0);
        } catch (e) {
          console.error('[GalleryZoomLightbox] gallery click failed:', e);
        }
      });
    } catch (e) {
      console.warn('[GalleryZoomLightbox] gallery onItemClicked wire failed:', e?.message);
    }

    // Navigation controls
    try {
      $w('#zoomLightboxPrev').onClick(() => { try { showImage(currentIndex - 1); } catch (e) {} });
    } catch (e) {
      console.warn('[GalleryZoomLightbox] prev wire failed:', e?.message);
    }
    try {
      $w('#zoomLightboxNext').onClick(() => { try { showImage(currentIndex + 1); } catch (e) {} });
    } catch (e) {
      console.warn('[GalleryZoomLightbox] next wire failed:', e?.message);
    }

    // Close button
    try {
      $w('#zoomLightboxClose').onClick(closeLightbox);
    } catch (e) {
      console.warn('[GalleryZoomLightbox] close wire failed:', e?.message);
    }

    // Keyboard: Escape closes, arrows navigate
    function handleKeydown(e) {
      if (!isOpen) return;
      try {
        if (e.key === 'Escape') { closeLightbox(); }
        else if (e.key === 'ArrowLeft') { showImage(currentIndex - 1); }
        else if (e.key === 'ArrowRight') { showImage(currentIndex + 1); }
      } catch (err) {}
    }

    try {
      if (typeof document !== 'undefined') {
        document.addEventListener('keydown', handleKeydown);
      }
    } catch (e) {}

    // Mobile swipe navigation
    let cleanupSwipe = null;
    try {
      const overlayEl = $w('#zoomLightboxOverlay');
      if (overlayEl?.htmlElement?.addEventListener) {
        cleanupSwipe = enableSwipe(overlayEl.htmlElement, (direction) => {
          if (!isOpen) return;
          if (direction === 'left') showImage(currentIndex + 1);
          else if (direction === 'right') showImage(currentIndex - 1);
        }, { threshold: 40 });
      }
    } catch (e) {}

    return {
      destroy() {
        try {
          if (typeof document !== 'undefined') {
            document.removeEventListener('keydown', handleKeydown);
          }
          if (cleanupSwipe) { cleanupSwipe(); cleanupSwipe = null; }
        } catch (e) {}
      },
    };
  } catch (e) {
    console.error('[GalleryZoomLightbox] init failed:', e);
    return null;
  }
}
