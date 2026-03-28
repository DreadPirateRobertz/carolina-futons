/**
 * @module RealRoomsGallery
 * @description Shoppable UGC gallery with product hotspot tags.
 * Tap a tag → product card flyout → add to cart.
 *
 * Element IDs:
 *   #realRoomsSection      — Container section
 *   #realRoomsRepeater     — Gallery repeater
 *   #realRoomImage         — Photo image (repeater child)
 *   #realRoomLocation      — "Asheville, NC" text (repeater child)
 *   #realRoomMember        — Member name (repeater child)
 *   #realRoomCaption       — Caption text (repeater child)
 *   #realRoomTagCount      — "3 products tagged" text (repeater child)
 *   #realRoomsEmpty        — Empty state (no photos yet)
 *   #realRoomsLoadMore     — Load more button
 *
 * CF-v62e
 */

import { colors } from 'public/designTokens.js';
import { announce } from 'public/a11yHelpers.js';

const PAGE_SIZE = 12;
let currentSkip = 0;

/**
 * Initialize the Real Rooms gallery on a page.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [opts]
 * @param {string} [opts.productId] - Filter by tagged product
 * @param {string} [opts.state] - Filter by state
 */
export async function initRealRoomsGallery($w, opts = {}) {
  try {
    const { getGalleryPhotos } = await import('backend/realRoomsGallery.web');
    const result = await getGalleryPhotos({
      limit: PAGE_SIZE,
      skip: 0,
      productId: opts.productId,
      state: opts.state,
    });

    if (!result.success || result.photos.length === 0) {
      try { $w('#realRoomsEmpty').expand(); } catch (_) {}
      try { $w('#realRoomsRepeater').collapse(); } catch (_) {}
      return;
    }

    const repeater = $w('#realRoomsRepeater');
    repeater.onItemReady(($item, itemData) => {
      try { $item('#realRoomImage').src = itemData.imageUrl; } catch (_) {}
      try { $item('#realRoomImage').alt = itemData.altText; } catch (_) {}
      try { $item('#realRoomLocation').text = `${itemData.city}, ${itemData.state}`; } catch (_) {}
      try { $item('#realRoomMember').text = itemData.memberName; } catch (_) {}
      try { $item('#realRoomCaption').text = itemData.caption || ''; } catch (_) {}
      try {
        const tagCount = itemData.tags?.length || 0;
        $item('#realRoomTagCount').text = tagCount === 1
          ? '1 product tagged'
          : `${tagCount} products tagged`;
      } catch (_) {}

      // ARIA for image
      try {
        $item('#realRoomImage').accessibility = {
          ariaLabel: itemData.altText,
          role: 'img',
        };
      } catch (_) {}
    });

    repeater.data = result.photos.map(p => ({ ...p, _id: p._id }));
    currentSkip = result.photos.length;

    try { $w('#realRoomsEmpty').collapse(); } catch (_) {}

    // Load more button
    if (result.total > PAGE_SIZE) {
      try {
        $w('#realRoomsLoadMore').expand();
        $w('#realRoomsLoadMore').onClick(async () => {
          try {
            const more = await getGalleryPhotos({
              limit: PAGE_SIZE,
              skip: currentSkip,
              productId: opts.productId,
              state: opts.state,
            });
            if (more.success && more.photos.length > 0) {
              const existing = repeater.data || [];
              repeater.data = [...existing, ...more.photos.map(p => ({ ...p, _id: p._id }))];
              currentSkip += more.photos.length;
              announce($w, `Loaded ${more.photos.length} more photos`);

              if (currentSkip >= more.total) {
                $w('#realRoomsLoadMore').collapse();
              }
            }
          } catch (_) {}
        });
      } catch (_) {}
    }

    $w('#realRoomsSection').expand();
  } catch (err) {
    try { $w('#realRoomsSection').collapse(); } catch (_) {}
  }
}
