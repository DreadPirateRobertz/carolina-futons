/**
 * Empty State Inline SVG Illustrations — Blue Ridge Mountain Aesthetic
 *
 * 8 hand-drawn-style SVG scenes for empty states, using brand tokens.
 * Each illustration uses gradients for a watercolor feel.
 *
 * @module emptyStateIllustrations
 */

import { colors } from 'public/sharedTokens';

const { sandBase, sandLight, sandDark, espresso, espressoLight, mountainBlue,
  mountainBlueDark, mountainBlueLight, sunsetCoral, sunsetCoralDark,
  sunsetCoralLight, offWhite, skyGradientTop, skyGradientBottom } = colors;

/**
 * Convert an SVG string to a data URI for use as Wix image src.
 * @param {string} svgString - Raw SVG markup
 * @returns {string} Data URI string, or empty string for falsy input
 */
export function svgToDataUri(svgString) {
  if (!svgString) return '';
  return 'data:image/svg+xml,' + encodeURIComponent(svgString);
}

/**
 * Map of empty state keys to inline SVG strings.
 * Each SVG uses brand tokens, gradients, and viewBox for responsive sizing.
 */
export const ILLUSTRATION_SVGS = {
  // Mountain trail at sunrise — warm coral/sand sky with winding path
  cart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="cart-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="${sandBase}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#cart-sky)"/>
  <path d="M0 140 Q30 110 70 120 Q110 95 140 105 Q180 80 220 100 Q260 90 280 110 L280 200 L0 200Z" fill="${mountainBlueDark}" opacity="0.3"/>
  <path d="M0 155 Q40 130 80 140 Q120 120 160 135 Q200 115 240 130 Q270 125 280 135 L280 200 L0 200Z" fill="${mountainBlue}" opacity="0.4"/>
  <path d="M0 170 Q50 160 100 165 Q140 155 180 162 Q220 158 280 165 L280 200 L0 200Z" fill="${sandDark}" opacity="0.5"/>
  <path d="M120 200 Q125 175 130 170 Q140 165 150 170 Q155 175 160 200" fill="${espressoLight}" opacity="0.5" stroke="${espresso}" stroke-width="0.5"/>
  <circle cx="200" cy="55" r="22" fill="${sunsetCoralLight}" opacity="0.7"/>
  <circle cx="200" cy="55" r="15" fill="${sunsetCoral}" opacity="0.5"/>
</svg>`,

  // Misty mountain — cool blue peaks with fog layers
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="search-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="search-mist" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${offWhite}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#search-sky)"/>
  <path d="M0 130 L60 70 L100 110 L150 55 L200 100 L250 65 L280 95 L280 200 L0 200Z" fill="${mountainBlueDark}" opacity="0.35"/>
  <path d="M0 150 L50 100 L90 130 L140 80 L190 120 L230 90 L280 120 L280 200 L0 200Z" fill="${mountainBlue}" opacity="0.45"/>
  <rect y="110" width="280" height="30" fill="url(#search-mist)"/>
  <path d="M0 165 Q60 155 120 160 Q180 150 240 158 Q265 155 280 160 L280 200 L0 200Z" fill="${sandLight}" opacity="0.6"/>
  <ellipse cx="70" cy="135" rx="50" ry="10" fill="${offWhite}" opacity="0.5"/>
  <ellipse cx="210" cy="128" rx="40" ry="8" fill="${offWhite}" opacity="0.4"/>
</svg>`,

  // Mountain cabin — cozy cabin among trees
  wishlist: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="wish-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#wish-sky)"/>
  <path d="M0 140 Q70 100 140 115 Q210 95 280 120 L280 200 L0 200Z" fill="${mountainBlue}" opacity="0.3"/>
  <path d="M0 165 Q70 150 140 155 Q210 148 280 158 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4"/>
  <polygon points="140,95 115,130 165,130" fill="${espresso}" opacity="0.8"/>
  <rect x="122" y="130" width="36" height="30" fill="${espressoLight}"/>
  <rect x="133" y="140" width="14" height="20" fill="${sandBase}"/>
  <polygon points="140,88 108,128 172,128" fill="none" stroke="${espresso}" stroke-width="1.5" opacity="0.5"/>
  <path d="M60 160 L60 130 Q65 110 70 130 L70 160" fill="${mountainBlueDark}" opacity="0.5"/>
  <path d="M55 140 Q65 125 75 140" fill="${mountainBlue}" opacity="0.3"/>
  <path d="M200 158 L200 125 Q205 105 210 125 L210 158" fill="${mountainBlueDark}" opacity="0.5"/>
  <path d="M195 138 Q205 120 215 138" fill="${mountainBlue}" opacity="0.3"/>
  <path d="M230 160 L230 135 Q233 120 236 135 L236 160" fill="${mountainBlueDark}" opacity="0.4"/>
  <circle cx="155" cy="120" r="3" fill="${sunsetCoral}" opacity="0.6"/>
</svg>`,

  // Mountain sunset — warm glow behind peaks
  reviews: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <radialGradient id="rev-sun" cx="50%" cy="65%" r="40%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sunsetCoralDark}" stop-opacity="0.1"/>
    </radialGradient>
    <linearGradient id="rev-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlue}" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="${sunsetCoralLight}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sandBase}"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#rev-sky)"/>
  <circle cx="140" cy="120" r="70" fill="url(#rev-sun)"/>
  <path d="M0 135 L40 95 L80 120 L120 75 L160 110 L200 80 L240 105 L280 90 L280 200 L0 200Z" fill="${espresso}" opacity="0.35"/>
  <path d="M0 155 L50 125 L100 145 L140 115 L180 140 L220 120 L280 140 L280 200 L0 200Z" fill="${espressoLight}" opacity="0.4"/>
  <path d="M0 175 Q70 165 140 170 Q210 163 280 172 L280 200 L0 200Z" fill="${sandDark}" opacity="0.5"/>
</svg>`,

  // Forest path — green-blue trees lining a trail
  category: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="cat-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#cat-sky)"/>
  <path d="M0 150 Q70 130 140 140 Q210 128 280 142 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4"/>
  <path d="M30 160 L30 110 Q40 80 50 110 L50 160" fill="${mountainBlueDark}" opacity="0.6"/>
  <path d="M20 125 Q40 95 60 125" fill="${mountainBlue}" opacity="0.35"/>
  <path d="M70 158 L70 120 Q78 95 86 120 L86 158" fill="${mountainBlueDark}" opacity="0.55"/>
  <path d="M62 130 Q78 105 94 130" fill="${mountainBlue}" opacity="0.3"/>
  <path d="M190 158 L190 115 Q198 88 206 115 L206 158" fill="${mountainBlueDark}" opacity="0.6"/>
  <path d="M182 128 Q198 98 214 128" fill="${mountainBlue}" opacity="0.35"/>
  <path d="M235 160 L235 125 Q241 105 247 125 L247 160" fill="${mountainBlueDark}" opacity="0.5"/>
  <path d="M228 135 Q241 112 254 135" fill="${mountainBlue}" opacity="0.3"/>
  <path d="M110 200 Q125 160 140 155 Q155 160 170 200" fill="${sandBase}" opacity="0.5" stroke="${espressoLight}" stroke-width="0.5"/>
  <ellipse cx="140" cy="165" rx="8" ry="3" fill="${sunsetCoral}" opacity="0.4"/>
  <ellipse cx="125" cy="172" rx="5" ry="2" fill="${sunsetCoralLight}" opacity="0.3"/>
  <ellipse cx="155" cy="170" rx="6" ry="2" fill="${sunsetCoralLight}" opacity="0.3"/>
</svg>`,

  // Storm clouds over ridge — dark, moody scene
  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="err-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${espresso}" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="${mountainBlueDark}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sandDark}" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="err-lightning" cx="50%" cy="40%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="280" height="200" fill="url(#err-sky)"/>
  <ellipse cx="90" cy="50" rx="60" ry="25" fill="${espressoLight}" opacity="0.5"/>
  <ellipse cx="130" cy="45" rx="50" ry="22" fill="${espresso}" opacity="0.4"/>
  <ellipse cx="180" cy="55" rx="55" ry="20" fill="${espressoLight}" opacity="0.45"/>
  <ellipse cx="160" cy="40" rx="45" ry="18" fill="${espresso}" opacity="0.35"/>
  <path d="M145 65 L148 85 L142 85 L146 105" stroke="${sunsetCoral}" stroke-width="2" fill="none" opacity="0.6"/>
  <circle cx="146" cy="75" r="25" fill="url(#err-lightning)"/>
  <path d="M0 140 L50 105 L100 125 L140 95 L190 115 L240 100 L280 120 L280 200 L0 200Z" fill="${espresso}" opacity="0.3"/>
  <path d="M0 165 Q70 150 140 158 Q210 148 280 160 L280 200 L0 200Z" fill="${espressoLight}" opacity="0.35"/>
  <path d="M0 180 Q70 172 140 176 Q210 170 280 178 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4"/>
</svg>`,

  // Fog in valley — serene, mysterious mist
  notFound: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="nf-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="nf-fog" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0"/>
      <stop offset="30%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="70%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#nf-sky)"/>
  <path d="M0 110 L40 75 L80 95 L130 55 L180 85 L230 60 L280 90 L280 200 L0 200Z" fill="${mountainBlue}" opacity="0.25"/>
  <rect y="95" width="280" height="40" fill="url(#nf-fog)"/>
  <path d="M0 140 L60 120 L120 135 L180 115 L240 130 L280 122 L280 200 L0 200Z" fill="${mountainBlueDark}" opacity="0.2"/>
  <rect y="130" width="280" height="25" fill="url(#nf-fog)"/>
  <ellipse cx="100" cy="120" rx="60" ry="12" fill="${offWhite}" opacity="0.6"/>
  <ellipse cx="200" cy="140" rx="50" ry="10" fill="${offWhite}" opacity="0.5"/>
  <path d="M0 170 Q70 162 140 166 Q210 160 280 168 L280 200 L0 200Z" fill="${sandLight}" opacity="0.5"/>
</svg>`,

  // Mountain stream — gentle water flowing between rocks
  sideCart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%">
  <defs>
    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
    <linearGradient id="sc-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${mountainBlue}" stop-opacity="0.4"/>
    </linearGradient>
  </defs>
  <rect width="280" height="200" fill="url(#sc-sky)"/>
  <path d="M0 130 Q70 115 140 125 Q210 110 280 122 L280 200 L0 200Z" fill="${sandDark}" opacity="0.35"/>
  <path d="M100 200 Q110 170 125 155 Q140 145 155 155 Q170 170 180 200" fill="url(#sc-water)"/>
  <path d="M115 165 Q140 155 165 165" fill="none" stroke="${offWhite}" stroke-width="1" opacity="0.5"/>
  <path d="M108 178 Q140 168 172 178" fill="none" stroke="${offWhite}" stroke-width="0.8" opacity="0.4"/>
  <ellipse cx="85" cy="165" rx="18" ry="10" fill="${espressoLight}" opacity="0.4"/>
  <ellipse cx="195" cy="162" rx="15" ry="8" fill="${espressoLight}" opacity="0.35"/>
  <ellipse cx="210" cy="172" rx="10" ry="6" fill="${espresso}" opacity="0.25"/>
  <path d="M0 155 Q30 148 60 152 Q80 150 85 155" fill="${sandBase}" opacity="0.4"/>
  <path d="M195 155 Q220 148 250 152 Q270 150 280 155" fill="${sandBase}" opacity="0.4"/>
  <circle cx="130" cy="160" r="2" fill="${offWhite}" opacity="0.6"/>
  <circle cx="150" cy="163" r="1.5" fill="${offWhite}" opacity="0.5"/>
</svg>`,
};
