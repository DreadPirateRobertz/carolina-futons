// mediaHelpers.js - Shared Wix media URL utilities
// Converts wix:image:// URIs to HTTPS URLs for external feeds and meta tags

/**
 * Convert a Wix media reference to an absolute HTTPS URL.
 * Handles wix:image://v1/... format, plain URLs, and media objects.
 *
 * @param {string|Object} media - Wix media URI, HTTP URL, or media object
 * @returns {string} Absolute HTTPS URL or empty string
 */
export function getImageUrl(media) {
  if (!media) return '';
  if (typeof media === 'string') {
    if (media.startsWith('http')) return media;
    if (media.startsWith('wix:image:')) {
      // Convert Wix media URI to static hosting URL
      const mediaId = media.replace('wix:image://v1/', '').split('/')[0].split('#')[0];
      return `https://static.wixstatic.com/media/${mediaId}`;
    }
    return media;
  }
  if (media.src) return getImageUrl(media.src);
  if (media.url) return media.url;
  return '';
}
