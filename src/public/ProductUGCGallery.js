/**
 * @module ProductUGCGallery
 * @description PDP "Real Rooms" widget — horizontal scroll of customer photos for this product.
 * Shows approved/featured UGC photos tagged to the current product, an "X rooms using this"
 * counter, and a click-to-expand lightbox.
 *
 * Element IDs required in Wix Studio:
 *   #pdpUGCSection      — outer container Box (collapse when no photos)
 *   #pdpUGCCount        — Text: "X rooms using this"
 *   #pdpUGCRepeater     — HorizontalList/Repeater
 *     #ugcPhoto         — Image per item
 *     #ugcCaption       — Text per item (caption, truncated)
 *   #pdpUGCEmpty        — Text or Box shown when no photos exist
 *   #pdpUGCLightbox     — Box (expanded photo overlay)
 *     #pdpUGCLightboxPhoto   — Image
 *     #pdpUGCLightboxCaption — Text
 *     #pdpUGCLightboxClose   — Button
 *
 * CF-rw9i.2
 */

import { getProductUGCPhotos } from 'backend/ugcService.web';

/**
 * Initialise the PDP UGC gallery widget.
 *
 * @param {Function} $w - Wix element selector
 * @param {{ product: { _id: string } }} state - Product Page state
 */
export async function initProductUGCGallery($w, state) {
  const productId = state?.product?._id;
  if (!productId) return;

  let photos = [];

  try {
    const result = await getProductUGCPhotos(productId, { limit: 20, sort: 'recent' });
    if (!result.success || !result.photos) {
      try { $w('#pdpUGCSection').collapse(); } catch (e) {}
      return;
    }
    photos = result.photos;
    const total = result.totalCount || photos.length;

    if (photos.length === 0) {
      try { $w('#pdpUGCSection').collapse(); } catch (e) {}
      return;
    }

    // Count label
    try {
      $w('#pdpUGCCount').text = `${total} room${total !== 1 ? 's' : ''} using this`;
    } catch (e) {}

    // Hide empty state
    try { $w('#pdpUGCEmpty').collapse(); } catch (e) {}

    // Populate repeater
    try {
      const repeater = $w('#pdpUGCRepeater');
      repeater.data = photos.map(p => ({ _id: p._id, ...p }));

      repeater.onItemReady(($item, itemData) => {
        try { $item('#ugcPhoto').src = itemData.photoUrl || ''; } catch (e) {}
        try {
          const cap = (itemData.caption || '').slice(0, 80);
          $item('#ugcCaption').text = cap || ' ';
        } catch (e) {}

        // Click → open lightbox
        try {
          $item('#ugcPhoto').onClick(() => _openLightbox($w, itemData));
        } catch (e) {}
      });
    } catch (e) {}

    // Wire lightbox close
    try {
      $w('#pdpUGCLightboxClose').onClick(() => _closeLightbox($w));
    } catch (e) {}

    // Expand section
    try { $w('#pdpUGCSection').expand(); } catch (e) {}
  } catch (err) {
    console.error('[ProductUGCGallery] init failed:', err);
    try { $w('#pdpUGCSection').collapse(); } catch (e) {}
  }
}

function _openLightbox($w, photo) {
  try { $w('#pdpUGCLightboxPhoto').src = photo.photoUrl || ''; } catch (e) {}
  try { $w('#pdpUGCLightboxCaption').text = photo.caption || ''; } catch (e) {}
  try { $w('#pdpUGCLightbox').expand(); } catch (e) {}
}

function _closeLightbox($w) {
  try { $w('#pdpUGCLightbox').collapse(); } catch (e) {}
}
