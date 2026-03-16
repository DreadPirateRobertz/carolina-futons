/**
 * SocialFeedEmbed.js — Social media feed embeds for homepage & footer
 *
 * Renders Instagram grid, TikTok embed, and Pinterest board widgets
 * using platform embed scripts. Handles lazy loading and fallback states.
 *
 * CF-iix7: Website content injection
 *
 * @module SocialFeedEmbed
 */
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors, spacing } from 'public/designTokens.js';

// ── Social platform configuration ───────────────────────────────────
const SOCIAL_CONFIG = {
  instagram: {
    handle: 'carolinafutons',
    url: 'https://www.instagram.com/carolinafutons',
    embedBaseUrl: 'https://www.instagram.com/carolinafutons/embed',
    fallbackText: 'Follow us on Instagram for design inspiration, new arrivals, and behind-the-scenes at our Hendersonville showroom.',
    ariaLabel: 'Carolina Futons Instagram feed',
  },
  tiktok: {
    handle: '@carolinafutons',
    url: 'https://www.tiktok.com/@carolinafutons',
    fallbackText: 'Watch our latest videos on TikTok — futon transformations, showroom tours, and setup tips.',
    ariaLabel: 'Carolina Futons TikTok videos',
  },
  pinterest: {
    handle: 'carolinafutons',
    url: 'https://www.pinterest.com/carolinafutons',
    fallbackText: 'Browse our Pinterest boards for room inspiration, color palettes, and small-space furniture ideas.',
    ariaLabel: 'Carolina Futons Pinterest boards',
  },
};

/**
 * Build the HTML for a social feed section header.
 * @param {string} platform - Platform key (instagram, tiktok, pinterest)
 * @param {string} title - Display title
 * @returns {string} HTML string for the section header
 */
function buildSectionHeader(platform, title) {
  const config = SOCIAL_CONFIG[platform];
  if (!config) return '';
  return `<div style="text-align:center;margin-bottom:${spacing.md};">` +
    `<h3 style="font-size:18px;color:${colors.espresso};margin-bottom:${spacing.xs};">${title}</h3>` +
    `<a href="${config.url}" target="_blank" rel="noopener noreferrer" ` +
    `style="color:${colors.mountainBlue};font-size:14px;text-decoration:none;" ` +
    `aria-label="${config.ariaLabel}">@${config.handle} &rarr;</a>` +
    `</div>`;
}

/**
 * Build fallback HTML when embed fails or is loading.
 * @param {string} platform - Platform key
 * @returns {string} HTML string
 */
function buildFallbackCard(platform) {
  const config = SOCIAL_CONFIG[platform];
  if (!config) return '';
  return `<div style="background:${colors.sandBase};border-radius:8px;padding:${spacing.lg};text-align:center;" ` +
    `role="region" aria-label="${config.ariaLabel}">` +
    `<p style="color:${colors.espressoLight};font-size:14px;line-height:1.6;margin-bottom:${spacing.md};">${config.fallbackText}</p>` +
    `<a href="${config.url}" target="_blank" rel="noopener noreferrer" ` +
    `style="display:inline-block;background:${colors.sunsetCoral};color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">` +
    `Follow on ${platform.charAt(0).toUpperCase() + platform.slice(1)}</a>` +
    `</div>`;
}

/**
 * Build the Instagram embed iframe HTML.
 * Uses Instagram's oEmbed-style iframe for a grid preview.
 * @returns {string} HTML string
 */
function buildInstagramEmbed() {
  const config = SOCIAL_CONFIG.instagram;
  return `<iframe src="${config.embedBaseUrl}" ` +
    `width="100%" height="480" frameborder="0" scrolling="no" ` +
    `loading="lazy" title="${config.ariaLabel}" ` +
    `style="border:none;border-radius:8px;max-width:100%;"></iframe>`;
}

/**
 * Initialize the Instagram feed section on the homepage.
 * Shows an embedded Instagram grid with fallback card.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [state] - Shared page state
 */
export function initInstagramFeed($w, state) {
  try {
    const container = $w('#instagramFeedContainer');
    if (!container) return;

    const headerHtml = buildSectionHeader('instagram', 'On the Gram');
    const embedHtml = buildInstagramEmbed();
    const fallback = buildFallbackCard('instagram');

    container.html = headerHtml + embedHtml +
      `<noscript>${fallback}</noscript>`;

    container.accessibility = { ariaLabel: SOCIAL_CONFIG.instagram.ariaLabel, role: 'region' };

    trackEvent('social_feed_loaded', { platform: 'instagram', location: 'homepage' });
  } catch (e) {
    // Fallback: show static follow card
    try {
      const container = $w('#instagramFeedContainer');
      if (container) container.html = buildFallbackCard('instagram');
    } catch (_) {}
  }
}

/**
 * Initialize the TikTok embed section.
 * Shows a follow-card with link to TikTok profile since TikTok embeds
 * require per-video URLs (no profile grid embed available).
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [state] - Shared page state
 */
export function initTikTokFeed($w, state) {
  try {
    const container = $w('#tiktokFeedContainer');
    if (!container) return;

    const headerHtml = buildSectionHeader('tiktok', 'Watch Us on TikTok');
    const cardHtml = buildFallbackCard('tiktok');

    container.html = headerHtml + cardHtml;
    container.accessibility = { ariaLabel: SOCIAL_CONFIG.tiktok.ariaLabel, role: 'region' };

    trackEvent('social_feed_loaded', { platform: 'tiktok', location: 'homepage' });
  } catch (e) {
    try {
      const container = $w('#tiktokFeedContainer');
      if (container) container.html = buildFallbackCard('tiktok');
    } catch (_) {}
  }
}

/**
 * Initialize the Pinterest board widget.
 * Shows a follow-card with link to Pinterest profile.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [state] - Shared page state
 */
export function initPinterestBoard($w, state) {
  try {
    const container = $w('#pinterestBoardContainer');
    if (!container) return;

    const headerHtml = buildSectionHeader('pinterest', 'Room Inspiration');
    const cardHtml = buildFallbackCard('pinterest');

    container.html = headerHtml + cardHtml;
    container.accessibility = { ariaLabel: SOCIAL_CONFIG.pinterest.ariaLabel, role: 'region' };

    trackEvent('social_feed_loaded', { platform: 'pinterest', location: 'homepage' });
  } catch (e) {
    try {
      const container = $w('#pinterestBoardContainer');
      if (container) container.html = buildFallbackCard('pinterest');
    } catch (_) {}
  }
}

/**
 * Initialize all social feed embeds in a single call.
 * Used by homepage and any page that shows the social feeds section.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [state] - Shared page state
 */
export function initSocialFeeds($w, state) {
  initInstagramFeed($w, state);
  initTikTokFeed($w, state);
  initPinterestBoard($w, state);
}

// ── Exports for testing ─────────────────────────────────────────────
export { SOCIAL_CONFIG, buildSectionHeader, buildFallbackCard, buildInstagramEmbed };
