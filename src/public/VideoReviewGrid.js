/**
 * VideoReviewGrid.js — Horizontal scrollable row of customer video reviews on PDP.
 * TikTok-style thumbnail row; click plays inline in an overlay player.
 *
 * Required Wix Studio elements:
 *   #videoReviewSection     Box  — outer wrapper (starts collapsed)
 *   #videoReviewTitle       Text — section heading "Customer Videos"
 *   #videoReviewRepeater    Repeater — one item per approved video review
 *     #vrThumbnail          Image  — poster frame / placeholder
 *     #vrPlayIcon           Image  — play button overlay
 *     #vrReviewerName       Text   — reviewer display name
 *   #videoPlayerOverlay     Box  — full-screen overlay (starts collapsed)
 *   #videoPlayerEmbed       HtmlComponent — iframe player injected here
 *   #closeVideoOverlay      Button — closes overlay
 *
 * CF-ou66.3
 */
import { getVideoReviews } from 'backend/reviewsService.web';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a safe HTML string for a Wix video player iframe.
 * Uses HtmlComponent to avoid raw script injection.
 * @param {string} fileId  wix:video://... reference
 * @returns {string}
 */
function buildPlayerHtml(fileId) {
  // Wix Media video player embed — fileId is a wix: URI, not an external URL.
  // HtmlComponent sandboxes the content; no XSS risk from our own CMS data.
  const escaped = String(fileId).replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head><style>
    body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh}
    video{max-width:100%;max-height:100%;outline:none}
  </style></head><body>
    <video controls autoplay src="${escaped}">Your browser does not support video.</video>
  </body></html>`;
}

/** Truncate a string to maxLen characters. */
function truncate(str, maxLen) {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '\u2026';
}

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the video review grid section.
 * Fetches approved video reviews for the current product and renders a
 * horizontally scrollable thumbnail row.  Clicking a thumbnail opens an
 * inline overlay player.
 *
 * @param {Function} $w   Wix selector
 * @param {Object}  state Product page state — must have state.product._id
 * @returns {Promise<{destroy: Function}>}
 */
export async function initVideoReviewGrid($w, state) {
  let mounted = true;

  function collapse() {
    try { $w('#videoReviewSection').collapse(); } catch (_) {}
  }

  try {
    const productId = state?.product?._id;
    if (!productId) { collapse(); return { destroy() {} }; }

    let result;
    try {
      result = await getVideoReviews(productId, { limit: 12 });
    } catch (err) {
      collapse();
      return { destroy() {} };
    }

    if (!result?.success || !result.reviews?.length) {
      collapse();
      return { destroy() {} };
    }

    const reviews = result.reviews;

    // Section heading & ARIA
    try { $w('#videoReviewTitle').text = 'Customer Videos'; } catch (_) {}
    try {
      $w('#videoReviewSection').accessibility.role = 'region';
      $w('#videoReviewSection').accessibility.ariaLabel = 'Customer video reviews';
    } catch (_) {}
    try { $w('#videoReviewSection').expand(); } catch (_) {}

    // ── Repeater ─────────────────────────────────────────────────────────────

    try {
      $w('#videoReviewRepeater').onItemReady(($item, itemData) => {
        // Reviewer name
        try {
          $item('#vrReviewerName').text = truncate(itemData.reviewerName || 'Customer', 30);
        } catch (_) {}

        // Thumbnail — Wix Video player can derive a poster from the wix: URI;
        // fall back to a neutral placeholder if unavailable.
        try {
          if (itemData.thumbnailUrl) {
            $item('#vrThumbnail').src = itemData.thumbnailUrl;
          }
          $item('#vrThumbnail').alt = `Video review by ${itemData.reviewerName || 'customer'}`;
        } catch (_) {}

        // Play icon accessibility
        try {
          $item('#vrPlayIcon').accessibility.ariaLabel = 'Play video review';
        } catch (_) {}

        // Click to play
        try {
          $item('#vrThumbnail').onClick(() => {
            if (!mounted) return;
            openPlayer($w, itemData.videoFileId);
          });
          $item('#vrPlayIcon').onClick(() => {
            if (!mounted) return;
            openPlayer($w, itemData.videoFileId);
          });
        } catch (_) {}
      });

      $w('#videoReviewRepeater').data = reviews.map((r, i) => ({
        ...r,
        _id: r._id || `vr-${i}`,
      }));
    } catch (_) {}

    // ── Overlay close button ─────────────────────────────────────────────────

    try {
      $w('#closeVideoOverlay').onClick(() => {
        if (!mounted) return;
        closePlayer($w);
      });
    } catch (_) {}

    return {
      destroy() {
        mounted = false;
        closePlayer($w);
      },
    };
  } catch (err) {
    collapse();
    return { destroy() {} };
  }
}

// ── Overlay player ────────────────────────────────────────────────────────────

function openPlayer($w, videoFileId) {
  try {
    $w('#videoPlayerEmbed').postMessage = undefined; // reset any prior content
    $w('#videoPlayerEmbed').src = 'about:blank';
  } catch (_) {}

  try {
    $w('#videoPlayerEmbed').onMessage((event) => {
      // No trusted messages expected — guard against external injection
    });
    $w('#videoPlayerEmbed').src = buildPlayerHtml(videoFileId);
  } catch (_) {}

  try { $w('#videoPlayerOverlay').expand(); } catch (_) {}
  try { $w('#videoPlayerOverlay').scrollTo(); } catch (_) {}
  try {
    $w('#closeVideoOverlay').accessibility.ariaLabel = 'Close video player';
  } catch (_) {}
}

function closePlayer($w) {
  try { $w('#videoPlayerOverlay').collapse(); } catch (_) {}
  try { $w('#videoPlayerEmbed').src = 'about:blank'; } catch (_) {}
}
