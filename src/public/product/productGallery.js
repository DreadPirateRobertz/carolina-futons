// productGallery.js - Image Gallery, Zoom, Lightbox, Badge, Recently Viewed
// Thumbnail navigation, zoom effect, alt text injection, mobile swipe,
// product badge overlay, and recently viewed products section.

import {
  trackProductView,
  getRecentlyViewed,
  getProductBadge,
  initImageLightbox,
  initImageZoom,
} from 'public/galleryHelpers.js';
import { getProductFallbackImage, getPlaceholderProductImages } from 'public/placeholderImages.js';
import { generateAltText } from 'backend/seoHelpers.web';
import { enableSwipe } from 'public/touchHelpers';
import { trackGalleryInteraction } from 'public/engagementTracker';
import { buildGridAlt } from 'public/product/productSchema.js';

/**
 * Initialize the product image gallery with zoom, lightbox, and swipe.
 */
export function initImageGallery($w, product) {
  try {
    if (product) {
      const mainImage = $w('#productMainImage');
      if (mainImage) {
        if (!product.mainMedia) {
          const category = product.collections?.[0] || '';
          mainImage.src = getProductFallbackImage(category);
        }
        generateAltText(product, 'main').then(alt => {
          mainImage.alt = alt;
        });
      }

      // Fill gallery with placeholders when fewer than expected thumbnails
      const gallery = $w('#productGallery');
      if (gallery) {
        const mediaItems = product.mediaItems || [];
        if (mediaItems.length < 3) {
          const category = product.collections?.[0] || '';
          const placeholders = getPlaceholderProductImages(category, 4);
          const combined = [
            ...mediaItems,
            ...placeholders.slice(mediaItems.length).map(src => ({
              src,
              type: 'image',
              title: product.name || 'Product image',
            })),
          ];
          try {
            gallery.items = combined;
          } catch (e) {}
        }
      }
    }

    // Shared gallery index for click/swipe sync
    let currentGalleryIndex = 0;

    // Gallery thumbnail click handling
    const gallery = $w('#productGallery');
    if (gallery) {
      gallery.onItemClicked((event) => {
        try {
          $w('#productMainImage').src = event.item.src;
          // Sync swipe index with clicked item
          const items = gallery.items || [];
          const clickedIdx = items.findIndex(item => item.src === event.item.src);
          if (clickedIdx >= 0) currentGalleryIndex = clickedIdx;
        } catch (e) {}
      });
    }

    // Mobile swipe navigation on product gallery
    try {
      const galleryEl = gallery?.getElement?.() || (typeof document !== 'undefined' ? document.querySelector('[id*="productGallery"]') : null);
      if (galleryEl) {
        enableSwipe(galleryEl, (direction) => {
          try {
            const items = gallery.items || [];
            if (items.length === 0) return;
            if (direction === 'left') {
              currentGalleryIndex = Math.min(currentGalleryIndex + 1, items.length - 1);
            } else if (direction === 'right') {
              currentGalleryIndex = Math.max(currentGalleryIndex - 1, 0);
            }
            $w('#productMainImage').src = items[currentGalleryIndex].src;
            trackGalleryInteraction('swipe', direction);
          } catch (e) {}
        }, { threshold: 40 });
      }
    } catch (e) {}

    // Fullscreen lightbox on main image click
    initImageLightbox($w, $w('#productGallery'), $w('#productMainImage'));

    // Hover zoom on main product image
    initImageZoom($w, $w('#productMainImage'));

    // Preload gallery thumbnail images for smoother browsing
    // Intentional no-op: Wix gallery handles its own image loading.
    // Kept as stub in case future Wix API exposes preload controls.
  } catch (e) {}
}

/**
 * Load recently viewed products section.
 */
export async function loadRecentlyViewed($w, product) {
  try {
    const recentProducts = getRecentlyViewed(product?._id);

    if (!recentProducts || recentProducts.length === 0) {
      try { $w('#recentlyViewedSection').collapse(); } catch (e) {}
      return;
    }

    const repeater = $w('#recentlyViewedRepeater');
    if (!repeater) {
      try { $w('#recentlyViewedSection').collapse(); } catch (e) {}
      return;
    }

    $w('#recentlyViewedSection').expand();
    repeater.data = recentProducts;
    repeater.onItemReady(($item, itemData) => {
      $item('#recentImage').src = itemData.mainMedia;
      $item('#recentImage').alt = buildGridAlt(itemData);
      $item('#recentName').text = itemData.name;
      $item('#recentPrice').text = itemData.price;

      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#recentImage').onClick(navigateToProduct);
      $item('#recentName').onClick(navigateToProduct);

      // Keyboard navigation for recently viewed items
      try {
        $item('#recentImage').accessibility.tabIndex = 0;
        $item('#recentImage').accessibility.role = 'link';
        $item('#recentImage').accessibility.ariaLabel = `View ${itemData.name}`;
        $item('#recentImage').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') navigateToProduct();
        });
      } catch (e) {}
      try {
        $item('#recentName').accessibility.tabIndex = 0;
        $item('#recentName').accessibility.role = 'link';
        $item('#recentName').accessibility.ariaLabel = `View ${itemData.name} details`;
        $item('#recentName').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') navigateToProduct();
        });
      } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Show sale/new/featured badge on main image area.
 */
export function initProductBadge($w, product) {
  try {
    const badge = getProductBadge(product);
    const badgeOverlay = $w('#productBadgeOverlay');
    if (!badgeOverlay) return;

    if (badge) {
      badgeOverlay.text = badge;
      badgeOverlay.show();
    } else {
      badgeOverlay.hide();
    }
  } catch (e) {}
}
