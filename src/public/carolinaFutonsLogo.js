/**
 * carolinaFutonsLogo.js — Carolina Futons brand logo as inline SVG.
 *
 * Provides the text-based logo matching the hand-lettered style from design.jpeg.
 * Uses Playfair Display (brand heading font) with espresso color from sharedTokens.
 *
 * Usage: Import and inject into an HtmlComponent for SVG rendering, or use
 * getLogoDataUri() as an image src for Wix Image elements.
 *
 * @module carolinaFutonsLogo
 */
import { colors } from 'public/sharedTokens.js';

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
