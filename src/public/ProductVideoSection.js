// ProductVideoSection.js — Embedded product walkthrough videos & assembly tutorials
// Fetches videos from ProductVideos CMS collection and renders on product page.

import { getProductVideos } from 'backend/productVideos.web';
import { announce } from 'public/a11yHelpers.js';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Format duration in seconds to MM:SS or H:MM:SS.
 * @param {number|null} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds == null || typeof seconds !== 'number') return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/** Map video type to display label */
function typeLabel(type) {
  const labels = {
    assembly: 'Assembly',
    demo: 'Demo',
    overview: 'Overview',
    animation: 'Animation',
    review: 'Review',
  };
  return labels[type] || 'Video';
}

// ── Main Init ────────────────────────────────────────────────────────

/**
 * Initialize the product video section on the product page.
 * Fetches videos from backend, populates repeater, and sets up player.
 *
 * Required Wix Studio elements:
 * - #videoSection: Box — outer wrapper (starts collapsed)
 * - #videoSectionTitle: Text — section heading
 * - #videoRepeater: Repeater — video thumbnail grid
 *   - #videoThumbnail: Image — thumbnail
 *   - #videoTitle: Text — video title
 *   - #videoDuration: Text — formatted duration
 *   - #videoTypeBadge: Text — type label
 * - #videoPlayerContainer: Box — player wrapper (starts collapsed)
 * - #videoPlayerEmbed: HtmlComponent — embeds iframe/video player
 * - #nowPlayingTitle: Text — currently playing title
 * - #assemblyVideoSection: Box — assembly tutorial callout (starts collapsed)
 * - #assemblyVideoTitle: Text
 * - #assemblyVideoName: Text
 * - #assemblyDuration: Text
 * - #assemblyPlayBtn: Button
 *
 * @param {Function} $w - Wix selector
 * @param {Object} state - Product page state
 * @returns {Promise<{destroy: Function}>}
 */
export async function initProductVideoSection($w, state) {
  let mounted = true;

  try {
    if (!state?.product?.slug) {
      try { $w('#videoSection').collapse(); } catch (e) {}
      return { destroy() {} };
    }

    let result;
    try {
      result = await getProductVideos(state.product.slug);
    } catch (err) {
      try { $w('#videoSection').collapse(); } catch (e) {}
      return { destroy() {} };
    }

    if (!result?.success || !result.data?.length) {
      try { $w('#videoSection').collapse(); } catch (e) {}
      return { destroy() {} };
    }

    const videos = result.data;

    // Section heading & ARIA
    try { $w('#videoSectionTitle').text = 'See It In Action'; } catch (e) {}
    try { $w('#videoSection').accessibility.role = 'region'; } catch (e) {}
    try { $w('#videoSection').accessibility.ariaLabel = 'Product videos'; } catch (e) {}
    try { $w('#videoSection').expand(); } catch (e) {}

    // ── Video Repeater ─────────────────────────────────────────────

    try {
      $w('#videoRepeater').onItemReady(($item, itemData) => {
        try { $item('#videoTitle').text = itemData.title || ''; } catch (e) {}
        try { $item('#videoDuration').text = formatDuration(itemData.duration); } catch (e) {}
        try { $item('#videoTypeBadge').text = typeLabel(itemData.type); } catch (e) {}

        // Thumbnail
        try {
          if (itemData.thumbnailUrl) {
            $item('#videoThumbnail').src = itemData.thumbnailUrl;
            $item('#videoThumbnail').alt = `Play ${itemData.title || 'video'}`;
          } else {
            $item('#videoThumbnail').hide();
          }
        } catch (e) {}

        // Click to play
        try {
          $item('#videoThumbnail').onClick(() => {
            if (!mounted) return;
            playVideo($w, itemData);
          });
        } catch (e) {}
      });

      $w('#videoRepeater').data = videos.map((v, i) => ({ ...v, _id: v.videoId || `vid-${i}` }));
    } catch (e) {}

    // ── Assembly Tutorial Section ────────────────────────────────────

    const assemblyVideo = videos.find(v => v.type === 'assembly');
    if (assemblyVideo) {
      try { $w('#assemblyVideoTitle').text = 'Assembly Tutorial'; } catch (e) {}
      try { $w('#assemblyVideoName').text = assemblyVideo.title || ''; } catch (e) {}
      try { $w('#assemblyDuration').text = formatDuration(assemblyVideo.duration); } catch (e) {}
      try { $w('#assemblyVideoSection').expand(); } catch (e) {}
      try {
        $w('#assemblyPlayBtn').onClick(() => {
          if (!mounted) return;
          playVideo($w, assemblyVideo);
        });
      } catch (e) {}
    } else {
      try { $w('#assemblyVideoSection').collapse(); } catch (e) {}
    }

    return {
      destroy() {
        mounted = false;
        try { $w('#videoPlayerContainer').collapse(); } catch (e) {}
      },
    };
  } catch (e) {
    try { $w('#videoSection').collapse(); } catch (e2) {}
    return { destroy() {} };
  }
}

// ── Player ───────────────────────────────────────────────────────────

function playVideo($w, video) {
  try { $w('#videoPlayerContainer').expand(); } catch (e) {}
  try { $w('#nowPlayingTitle').text = video.title || ''; } catch (e) {}

  try {
    if (video.embedUrl) {
      $w('#videoPlayerEmbed').postMessage({
        type: 'loadVideo',
        embedUrl: video.embedUrl,
        videoType: 'youtube',
        title: video.title || '',
      });
    } else if (video.mp4Url) {
      $w('#videoPlayerEmbed').postMessage({
        type: 'loadVideo',
        mp4Url: video.mp4Url,
        videoType: 'mp4',
        title: video.title || '',
      });
    }
  } catch (e) {}

  try { announce($w, `Now playing: ${video.title || 'video'}`); } catch (e) {}
}
