// productCardVideoHelpers.js — Product card hover-play video (CF-nmvf)
// Wires Wix-hosted product demo videos to card grids via hover-play.
// Video IDs from videoPageHelpers.js; URL format per Wix Media spec.

const WIX_VIDEO_BASE = 'https://video.wixstatic.com/video';

/**
 * Test data: product slug → Wix Media video ID.
 * 3 futon frames with existing Wix-hosted demo videos.
 * URL format: https://video.wixstatic.com/video/{id}/1080p/mp4/file.mp4
 */
export const PRODUCT_CARD_VIDEOS = {
  'asheville-futon-frame': 'e04e89_ea16ef6edfe64c03a5bfdd0ee468ab7f',
  'sedona-futon-frame': 'e04e89_8483b56d2ef5417c95242c821934e2b2',
  'alpine-futon-frame': 'e04e89_dba4fc2f08ee4a42906dcb76bcb9b31a',
};

/**
 * Get the full Wix video URL for a product card, or null if none.
 * @param {string} slug - Product slug
 * @returns {string|null}
 */
export function getCardVideoUrl(slug) {
  const id = slug ? PRODUCT_CARD_VIDEOS[slug] : null;
  if (!id) return null;
  return `${WIX_VIDEO_BASE}/${id}/1080p/mp4/file.mp4`;
}

/**
 * Wire hover-play video on a product card.
 * Hides video initially; plays/shows on mouseIn, pauses/hides on mouseOut.
 * Swaps image↔video so card media is always one or the other.
 *
 * Compatible with initCardHover — Wix Velo supports multiple onMouseIn
 * handlers on the same container element.
 *
 * @param {Object} $containerEl - Card container (source of hover events)
 * @param {Object} $videoEl     - Wix video element (hidden by default)
 * @param {Object} $imageEl     - Card image element (hidden while video plays)
 * @param {string|null} videoUrl - Full video URL; no-op when falsy
 */
export function initCardVideo($containerEl, $videoEl, $imageEl, videoUrl) {
  if (!$containerEl || !$videoEl || !videoUrl) return;
  try {
    $videoEl.src = videoUrl;
    try { $videoEl.hide(); } catch (e) {}

    if (typeof $containerEl.onMouseIn === 'function') {
      $containerEl.onMouseIn(() => {
        try { $videoEl.play(); } catch (e) {}
        try { $videoEl.show(); } catch (e) {}
        try { if ($imageEl) $imageEl.hide(); } catch (e) {}
      });
    }

    if (typeof $containerEl.onMouseOut === 'function') {
      $containerEl.onMouseOut(() => {
        try { $videoEl.pause(); } catch (e) {}
        try { $videoEl.hide(); } catch (e) {}
        try { if ($imageEl) $imageEl.show(); } catch (e) {}
      });
    }
  } catch (e) { /* element may not support video ops */ }
}
