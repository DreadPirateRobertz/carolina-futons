/**
 * carolinaFutonsLogo.js — Carolina Futons brand logo.
 *
 * Primary: Real CF_SQUARE-blue.jpg logo from Wix Media (production asset).
 * Fallback: SVG text logo using Playfair Display font.
 *
 * @module carolinaFutonsLogo
 */
import { colors } from 'public/sharedTokens.js';

// Real CF logo from Wix Media Manager (production site header/footer)
const CF_LOGO_MEDIA_ID = 'e04e89_cab07c9f067748338ea32234e56dddf9~mv2.jpg';
const CF_LOGO_BASE = `https://static.wixstatic.com/media/${CF_LOGO_MEDIA_ID}`;

/**
 * Get the real CF logo image URL from Wix CDN.
 * @param {Object} [options]
 * @param {number} [options.width] - Target width (default: 291, matches prod)
 * @param {number} [options.height] - Target height (default: 140, matches prod)
 * @returns {string} Wix CDN image URL
 */
export function getLogoImageUrl({ width, height } = {}) {
  const w = width || 291;
  const h = height || 140;
  return `${CF_LOGO_BASE}/v1/fill/w_${w},h_${h},al_c,q_80/CF_SQUARE-blue.jpg`;
}

/**
 * Get a smaller logo for footer use.
 * @returns {string} Wix CDN image URL sized for footer
 */
export function getFooterLogoImageUrl() {
  return getLogoImageUrl({ width: 160, height: 77 });
}

/**
 * Generate the Carolina Futons logo SVG string.
 * Stacked layout: "Carolina" over "Futons" in Playfair Display.
 * @param {Object} [options]
 * @param {string} [options.color] - Text fill color (default: espresso from tokens)
 * @param {number} [options.width] - SVG width in px (default: 180)
 * @param {number} [options.height] - SVG height in px (default: 60)
 * @returns {string} SVG markup string
 */
export function getLogoSvg({ color, width, height } = {}) {
  const fill = color || colors.espresso;
  const w = width || 180;
  const h = height || 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 60" width="${w}" height="${h}" role="img" aria-label="Carolina Futons">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;display=swap');
    .cf-logo { font-family: 'Playfair Display', Georgia, serif; fill: ${fill}; }
  </style>
  <text class="cf-logo" x="90" y="26" text-anchor="middle" font-size="22" font-weight="700" letter-spacing="2">Carolina</text>
  <text class="cf-logo" x="90" y="52" text-anchor="middle" font-size="24" font-weight="700" letter-spacing="4">Futons</text>
</svg>`;
}

/**
 * Get the logo as a data URI suitable for Wix Image element src.
 * @param {Object} [options] - Same options as getLogoSvg
 * @returns {string} data:image/svg+xml URI
 */
export function getLogoDataUri(options) {
  const svg = getLogoSvg(options);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Footer logo variant — smaller, single-line "Carolina Futons".
 * @param {Object} [options]
 * @param {string} [options.color] - Text fill color (default: espresso)
 * @param {number} [options.width] - SVG width (default: 160)
 * @param {number} [options.height] - SVG height (default: 30)
 * @returns {string} SVG markup string
 */
export function getFooterLogoSvg({ color, width, height } = {}) {
  const fill = color || colors.espresso;
  const w = width || 160;
  const h = height || 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 30" width="${w}" height="${h}" role="img" aria-label="Carolina Futons">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;display=swap');
    .cf-logo-sm { font-family: 'Playfair Display', Georgia, serif; fill: ${fill}; }
  </style>
  <text class="cf-logo-sm" x="80" y="22" text-anchor="middle" font-size="18" font-weight="700" letter-spacing="1.5">Carolina Futons</text>
</svg>`;
}

/**
 * Footer logo as data URI.
 * @param {Object} [options] - Same options as getFooterLogoSvg
 * @returns {string} data:image/svg+xml URI
 */
export function getFooterLogoDataUri(options) {
  const svg = getFooterLogoSvg(options);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
