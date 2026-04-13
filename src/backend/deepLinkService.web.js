/**
 * @module deepLinkService.web
 * @description Deep link builder for the Carolina Futons mobile app.
 * Produces carolinafutons:// app URLs and carolinafutons.com web fallbacks.
 *
 * App scheme: carolinafutons:// — configured in cfutons_mobile app.json
 *
 * Exports:
 *   - DEEP_LINK_TYPES — canonical link type constants
 *   - buildDeepLink(type, params) — returns { appUrl, webFallback, success }
 */

const APP_SCHEME = 'carolinafutons://';
const WEB_BASE = 'https://www.carolinafutons.com';

export const DEEP_LINK_TYPES = {
  CHALLENGE: 'challenge',
  TRAIL: 'trail',
  PRODUCT: 'product',
  LEADERBOARD: 'leaderboard',
  BADGE: 'badge',
};

/**
 * Build a deep link for the mobile app with a web fallback.
 *
 * @param {string} type   - One of DEEP_LINK_TYPES values
 * @param {object} params - Type-specific parameters
 * @returns {{ success: boolean, appUrl?: string, webFallback?: string, error?: string }}
 */
export function buildDeepLink(type, params = {}) {
  switch (type) {
    case DEEP_LINK_TYPES.CHALLENGE:
      return {
        success: true,
        appUrl: `${APP_SCHEME}challenges/${params.challengeId || ''}`,
        webFallback: `${WEB_BASE}/gamification/challenges`,
      };
    case DEEP_LINK_TYPES.TRAIL:
      return {
        success: true,
        appUrl: `${APP_SCHEME}trails/${params.trailId || ''}`,
        webFallback: `${WEB_BASE}/gamification/trails`,
      };
    case DEEP_LINK_TYPES.PRODUCT:
      return {
        success: true,
        appUrl: `${APP_SCHEME}products/${params.productId || ''}`,
        webFallback: `${WEB_BASE}/product-page/${params.slug || ''}`,
      };
    case DEEP_LINK_TYPES.LEADERBOARD:
      return {
        success: true,
        appUrl: `${APP_SCHEME}leaderboard`,
        webFallback: `${WEB_BASE}/gamification/leaderboard`,
      };
    case DEEP_LINK_TYPES.BADGE:
      return {
        success: true,
        appUrl: `${APP_SCHEME}badges/${params.badgeId || ''}`,
        webFallback: `${WEB_BASE}/gamification/badges`,
      };
    default:
      return { success: false, error: `unknown deep link type: ${type}` };
  }
}
