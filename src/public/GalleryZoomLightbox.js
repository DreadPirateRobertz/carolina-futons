// GalleryZoomLightbox.js — Product Gallery Zoom Lightbox
// Full-size image overlay triggered by clicking the main product image or a
// gallery thumbnail. Supports prev/next navigation, keyboard shortcuts
// (Escape via setupAccessibleDialog, ArrowLeft/ArrowRight), mobile swipe,
// and ARIA accessibility (role, focus trapping via setupAccessibleDialog).
// Returns a destroy handle for SPA navigation cleanup.
//
// Element nicknames:
//   zoomLightboxOverlay  — modal overlay container
//   zoomLightboxImage    — full-size image display
//   zoomLightboxClose    — close button
//   zoomLightboxPrev     — previous image button
//   zoomLightboxNext     — next image button
//   zoomLightboxCounter  — image counter label (e.g., "2 / 5")

import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { enableSwipe } from 'public/touchHelpers';

// ── initGalleryZoomLightbox ───────────────────────────────────────────

/**
 * Initialize the product gallery zoom lightbox.
 * Wires main image click and gallery thumbnail click to open a full-size
 * overlay with prev/next navigation, keyboard shortcuts, and swipe support.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object|null} state - Page state. Expected shape:
 *   { product: { _id?: string, name?: string, mediaItems?: Array, mainMedia?: string } }
 *   Returns null if state is null or state.product is falsy.
 * @returns {{destroy: Function}|null} Cleanup handle or null if no product/images
 */
export function initGalleryZoomLightbox($w, state) {
  try {
    try { $w('#zoomLightboxOverlay').collapse(); } catch (e) {
      console.warn('[GalleryZoomLightbox] collapse failed:', e?.message);
    }

    const product = state?.product;
    if (!product) return null;

    // Wix mediaItems use 'type' on newer APIs and 'mediaType' on older ones; check both.
    const mediaItems = product.mediaItems || [];
    const images = mediaItems
      .filter(item => item.type === 'image' || item.mediaType === 'image')
      .map(item => ({ src: item.src, alt: item.title || product.name || 'Product image' }));

    if (images.length === 0 && product.mainMedia) {
      images.push({ src: product.mainMedia, alt: product.name || 'Product image' });
    }

    if (images.length === 0) {
      console.warn('[GalleryZoomLightbox] no images found for product:', product._id || product.name);
      return null;
    }

    let currentIndex = 0;
    let isOpen = false;

    // ARIA labels on nav controls (role/ariaModal/Escape handled by setupAccessibleDialog)
    try { $w('#zoomLightboxPrev').accessibility.ariaLabel = 'Previous image'; } catch (e) {
      console.warn('[GalleryZoomLightbox] prev ariaLabel failed:', e?.message);
    }
    try { $w('#zoomLightboxNext').accessibility.ariaLabel = 'Next image'; } catch (e) {
      console.warn('[GalleryZoomLightbox] next ariaLabel failed:', e?.message);
    }

    // Normalises index to always be in-range (handles negative wrap-around via double-modulo),
    // then updates image src/alt, counter text, nav button visibility, and announces to screen readers.
    function showImage(index) {
      if (images.length === 0) return;
      currentIndex = ((index % images.length) + images.length) % images.length;

      try { $w('#zoomLightboxImage').src = images[currentIndex].src; } catch (e) {
        console.warn('[GalleryZoomLightbox] image src failed:', e?.message);
      }
      try { $w('#zoomLightboxImage').alt = images[currentIndex].alt; } catch (e) {
        console.warn('[GalleryZoomLightbox] image alt failed:', e?.message);
      }

      if (images.length > 1) {
        try { $w('#zoomLightboxCounter').text = `${currentIndex + 1} / ${images.length}`; } catch (e) {
          console.warn('[GalleryZoomLightbox] counter text failed:', e?.message);
        }
        try { $w('#zoomLightboxPrev').show(); } catch (e) {
          console.warn('[GalleryZoomLightbox] prev show failed:', e?.message);
        }
        try { $w('#zoomLightboxNext').show(); } catch (e) {
          console.warn('[GalleryZoomLightbox] next show failed:', e?.message);
        }
      } else {
        try { $w('#zoomLightboxCounter').text = ''; } catch (e) {
          console.warn('[GalleryZoomLightbox] counter clear failed:', e?.message);
        }
        try { $w('#zoomLightboxPrev').hide(); } catch (e) {
          console.warn('[GalleryZoomLightbox] prev hide failed:', e?.message);
        }
        try { $w('#zoomLightboxNext').hide(); } catch (e) {
          console.warn('[GalleryZoomLightbox] next hide failed:', e?.message);
        }
      }

      announce($w, `Image ${currentIndex + 1} of ${images.length}`);
    }

    // setupAccessibleDialog handles: ARIA role/ariaModal on overlay, close button wiring,
    // Escape key, and focus trapping. onClose resets isOpen so arrow handler becomes inactive.
    const dialog = setupAccessibleDialog($w, {
      panelId: '#zoomLightboxOverlay',
      closeId: '#zoomLightboxClose',
      focusableIds: ['#zoomLightboxClose', '#zoomLightboxPrev', '#zoomLightboxNext'],
      onClose: () => {
        isOpen = false;
        announce($w, 'Image lightbox closed');
      },
    });

    // Populate image then open. isOpen is set true only after a successful open so that
    // the ArrowLeft/ArrowRight keyboard handler is not active for an invisible overlay.
    function openLightbox(index = 0) {
      showImage(index);
      try {
        if (dialog) dialog.open();
        isOpen = true;
      } catch (e) {
        console.warn('[GalleryZoomLightbox] open failed:', e?.message);
      }
    }

    // Main image click → open at the matching index (falls back to 0 if src not found)
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
      $w('#zoomLightboxPrev').onClick(() => {
        try { showImage(currentIndex - 1); } catch (e) {
          console.error('[GalleryZoomLightbox] prev click failed:', e);
        }
      });
    } catch (e) {
      console.warn('[GalleryZoomLightbox] prev wire failed:', e?.message);
    }
    try {
      $w('#zoomLightboxNext').onClick(() => {
        try { showImage(currentIndex + 1); } catch (e) {
          console.error('[GalleryZoomLightbox] next click failed:', e);
        }
      });
    } catch (e) {
      console.warn('[GalleryZoomLightbox] next wire failed:', e?.message);
    }

    // Keyboard arrow navigation. Escape is handled by setupAccessibleDialog.
    // isOpen guard ensures arrows only navigate when the overlay is visible.
    function handleArrows(e) {
      if (!isOpen) return;
      try {
        if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
        else if (e.key === 'ArrowRight') showImage(currentIndex + 1);
      } catch (err) {
        console.error('[GalleryZoomLightbox] keyboard navigation failed:', err);
      }
    }

    try {
      if (typeof document !== 'undefined') {
        document.addEventListener('keydown', handleArrows);
      }
    } catch (e) {
      console.warn('[GalleryZoomLightbox] keydown listener registration failed:', e?.message);
    }

    // Mobile swipe: 'left' (finger moves left) = advance forward; 'right' = go back.
    // Matches standard carousel UX: swipe in the direction content flows.
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
    } catch (e) {
      console.warn('[GalleryZoomLightbox] swipe initialization failed:', e?.message);
    }

    return {
      destroy() {
        try {
          if (typeof document !== 'undefined') {
            document.removeEventListener('keydown', handleArrows);
          }
          if (cleanupSwipe) { cleanupSwipe(); cleanupSwipe = null; }
        } catch (e) {
          console.warn('[GalleryZoomLightbox] destroy cleanup failed:', e?.message);
        }
      },
    };
  } catch (e) {
    console.error('[GalleryZoomLightbox] init failed:', e);
    return null;
  }
}
