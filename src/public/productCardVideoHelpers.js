// productCardVideoHelpers.js — Product card hover-play video (CF-nmvf)
// Wires Wix-hosted product demo videos to card grids via hover-play.
// Video data derived from videoPageHelpers.js — single source of truth.
import { getVideoData } from 'public/videoPageHelpers.js';

const WIX_VIDEO_BASE = 'https://video.wixstatic.com/video';

/**
 * Product slug → Wix Media video ID, derived from videoPageHelpers.js.
 * Only Wix-hosted videos with a productSlug are eligible for card hover-play.
 */
export const PRODUCT_CARD_VIDEOS = Object.fromEntries(
  getVideoData()
    .filter(v => v.source === 'wix' && v.productSlug)
    .map(v => [v.productSlug, v.videoUri])
);

/**
 * Get the full Wix video URL for a product card, or null if none.
 * @param {string} slug - Product slug
 * @returns {string|null}
 */
export function getCardVideoUrl(slug) {
  const id = slug ? PRODUCT_CARD_VIDEOS[slug] : null;
  if (!id) {
    if (slug) console.warn(`[ProductCardVideo] No video found for slug: ${slug}`);
    return null;
  }
  return `${WIX_VIDEO_BASE}/${id}/1080p/mp4/file.mp4`;
}

/**
 * Wire hover-play video on a product card.
 * Hides video initially; plays/shows on mouseIn, pauses/hides on mouseOut.
 * Swaps image<->video so card media is always one or the other.
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
    try { $videoEl.hide(); } catch (e) { console.warn('[ProductCardVideo] hide video failed:', e?.message); }

    if (typeof $containerEl.onMouseIn === 'function') {
      $containerEl.onMouseIn(() => {
        try { $videoEl.play(); } catch (e) { console.warn('[ProductCardVideo] play failed:', e?.message); }
        try { $videoEl.show(); } catch (e) { console.warn('[ProductCardVideo] show video failed:', e?.message); }
        try { if ($imageEl) $imageEl.hide(); } catch (e) { console.warn('[ProductCardVideo] hide image failed:', e?.message); }
      });
    }

    if (typeof $containerEl.onMouseOut === 'function') {
      $containerEl.onMouseOut(() => {
        try { $videoEl.pause(); } catch (e) { console.warn('[ProductCardVideo] pause failed:', e?.message); }
        try { $videoEl.hide(); } catch (e) { console.warn('[ProductCardVideo] hide video failed:', e?.message); }
        try { if ($imageEl) $imageEl.show(); } catch (e) { console.warn('[ProductCardVideo] show image failed:', e?.message); }
      });
    }
  } catch (e) { console.warn('[ProductCardVideo] initCardVideo error:', e?.message); }
}
