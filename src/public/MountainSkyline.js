/**
 * MountainSkyline.js — Programmatic SVG mountain skyline border
 *
 * Signature brand element: a mountain skyline silhouette with sky gradient
 * that repeats across page headers. Uses brand tokens for all colors.
 *
 * cf-989f: Mountain skyline SVG border for all page headers
 *
 * @module MountainSkyline
 */
import { colors } from 'public/sharedTokens';

const DEFAULT_HEIGHT = 120;
const VIEWBOX_WIDTH = 1440;

const GRADIENT_PRESETS = {
  sunrise: {
    top: colors.skyGradientTop,
    bottom: colors.skyGradientBottom,
  },
  sunset: {
    top: colors.sunsetCoral,
    bottom: colors.skyGradientBottom,
  },
};

/**
 * Generate an inline SVG string for the mountain skyline border.
 *
 * @param {Object} [options] - Generation options
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Gradient variant
 * @param {number} [options.height=120] - SVG height in pixels
 * @returns {string} Complete inline SVG markup
 */
export function generateMountainSVG(options) {
  const opts = options || {};
  const variant = GRADIENT_PRESETS[opts.variant] ? opts.variant : 'sunrise';
  const height = (typeof opts.height === 'number' && opts.height > 0)
    ? opts.height
    : DEFAULT_HEIGHT;
  const grad = GRADIENT_PRESETS[variant];
  const vbH = height;

  // Mountain silhouette path — irregular peaks spanning full viewBox width.
  // Coordinates are designed for a 1440-wide viewBox and scale responsively.
  const mountainPath = [
    `M0,${vbH}`,
    `L0,${vbH * 0.7}`,
    `L60,${vbH * 0.55}`,
    `L140,${vbH * 0.35}`,
    `L200,${vbH * 0.45}`,
    `L280,${vbH * 0.25}`,
    `L340,${vbH * 0.4}`,
    `L400,${vbH * 0.3}`,
    `L480,${vbH * 0.15}`,
    `L540,${vbH * 0.35}`,
    `L600,${vbH * 0.28}`,
    `L680,${vbH * 0.42}`,
    `L740,${vbH * 0.2}`,
    `L800,${vbH * 0.38}`,
    `L860,${vbH * 0.12}`,
    `L920,${vbH * 0.32}`,
    `L980,${vbH * 0.22}`,
    `L1060,${vbH * 0.4}`,
    `L1120,${vbH * 0.18}`,
    `L1200,${vbH * 0.35}`,
    `L1260,${vbH * 0.28}`,
    `L1340,${vbH * 0.42}`,
    `L1400,${vbH * 0.3}`,
    `L1440,${vbH * 0.5}`,
    `L1440,${vbH}`,
    'Z',
  ].join(' ');

  const gradId = `cf-sky-grad-${variant}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="100%" height="${height}"`,
    ` viewBox="0 0 ${VIEWBOX_WIDTH} ${vbH}"`,
    ` preserveAspectRatio="none"`,
    ` aria-hidden="true" role="presentation">`,
    `<defs>`,
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${grad.top}"/>`,
    `<stop offset="100%" stop-color="${grad.bottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${VIEWBOX_WIDTH}" height="${vbH}" fill="url(#${gradId})"/>`,
    `<path d="${mountainPath}" fill="${colors.espresso}"/>`,
    `</svg>`,
  ].join('');
}

/**
 * Initialize a mountain skyline SVG in a Wix $w container element.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [options] - Options
 * @param {string} [options.containerId='#mountainSkyline'] - Container element ID
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Gradient variant
 * @param {number} [options.height=120] - SVG height in pixels
 */
export function initMountainSkyline($w, options) {
  try {
    if (!$w) { return; }
    const opts = options || {};
    const containerId = opts.containerId || '#mountainSkyline';
    const container = $w(containerId);
    if (!container) { return; }
    container.html = generateMountainSVG({
      variant: opts.variant,
      height: opts.height,
    });
  } catch (_e) {
    // Element may not exist on all pages — fail silently
  }
}
