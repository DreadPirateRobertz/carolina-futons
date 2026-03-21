/**
 * @module videoHelpers
 * @description YouTube URL parsing and safe iframe embed generation.
 *
 * Used by Product Page.js to embed a product walkthrough video from
 * `product.videoUrl` (optional Text CMS field) into `#productVideoEmbed`.
 *
 * No Wix module dependencies — pure string utilities, safe to unit-test directly.
 */

// YouTube video IDs are 11 characters: A-Z a-z 0-9 _ -
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract the YouTube video ID from a URL.
 *
 * Supports:
 *  - https://www.youtube.com/watch?v=<id>
 *  - https://youtu.be/<id>
 *  - https://www.youtube.com/embed/<id>
 *
 * @param {string} url
 * @returns {string|null} 11-char video ID, or null if not recognised
 */
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;

  let id = null;

  // youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) id = shortMatch[1];

  // youtube.com/embed/<id>
  if (!id) {
    const embedMatch = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) id = embedMatch[1];
  }

  // youtube.com/watch?v=<id>
  if (!id) {
    const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watchMatch) id = watchMatch[1];
  }

  if (!id || !YT_ID_RE.test(id)) return null;
  return id;
}

/**
 * Build a safe YouTube iframe embed HTML string.
 *
 * Returns null when the URL is not a recognised YouTube video URL or contains
 * disallowed protocols (javascript:, data:, vbscript:).
 *
 * @param {string} url - YouTube video URL
 * @param {object} [options]
 * @param {boolean} [options.privacyEnhanced=false] - Use youtube-nocookie.com domain
 * @returns {string|null} Safe iframe HTML string, or null
 */
export function buildYouTubeEmbed(url, { privacyEnhanced = false } = {}) {
  if (!url || typeof url !== 'string') return null;

  // Block dangerous schemes regardless of further parsing
  const lower = url.toLowerCase().trim();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return null;
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const host = privacyEnhanced
    ? 'https://www.youtube-nocookie.com'
    : 'https://www.youtube.com';

  const src = `${host}/embed/${videoId}?enablejsapi=0&rel=0`;

  return (
    `<iframe ` +
    `width="100%" height="100%" ` +
    `src="${src}" ` +
    `title="Product video" ` +
    `frameborder="0" ` +
    `allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen` +
    `></iframe>`
  );
}
