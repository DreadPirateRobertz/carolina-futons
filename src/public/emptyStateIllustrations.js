/**
 * Empty State Inline SVG Illustrations — Blue Ridge Mountain Aesthetic
 *
 * 8 hand-drawn-style SVG scenes for empty states, using brand tokens.
 * Each illustration meets the 8-point quality bar: watercolor filter,
 * paper grain, organic paths, 15+ elements, 5+ gradient stops,
 * atmospheric depth layers, all brand tokens, accessibility.
 *
 * @module emptyStateIllustrations
 */

import { colors } from 'public/sharedTokens';

const { sandBase, sandLight, sandDark, espresso, espressoLight, mountainBlue,
  mountainBlueDark, mountainBlueLight, sunsetCoral, sunsetCoralDark,
  sunsetCoralLight, offWhite, skyGradientTop, skyGradientBottom, success, white } = colors;

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
 * Each SVG uses brand tokens, filters, gradients, atmospheric layers,
 * and viewBox for responsive sizing.
 */
export const ILLUSTRATION_SVGS = {
  // Mountain trail at sunrise — warm coral/sand sky with winding path
  cart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-cart">
  <title id="title-cart">Empty cart — a winding mountain trail at sunrise through Blue Ridge foothills</title>
  <defs>
    <filter id="wc-cart">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-cart">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="cart-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="20%" stop-color="${sunsetCoralLight}" stop-opacity="0.5"/>
      <stop offset="40%" stop-color="${sandBase}" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="${sandLight}" stop-opacity="0.7"/>
      <stop offset="80%" stop-color="${skyGradientBottom}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-cart)">
    <g id="background">
      <rect width="280" height="200" fill="url(#cart-sky)" filter="url(#wc-cart)"/>
      <circle cx="220" cy="40" r="18" fill="${sunsetCoralLight}" opacity="0.6"/>
      <circle cx="220" cy="40" r="12" fill="${sunsetCoral}" opacity="0.4"/>
      <ellipse cx="60" cy="50" rx="35" ry="10" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="80" cy="48" rx="25" ry="8" fill="${white}" opacity="0.3"/>
      <line x1="100" y1="30" x2="106" y2="25" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="106" y1="25" x2="112" y2="30" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="170" y1="22" x2="175" y2="18" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="175" y1="18" x2="180" y2="22" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 130 Q25 105 55 115 Q85 90 115 105 Q150 78 185 98 Q215 82 245 95 Q265 88 280 100 L280 160 L0 160Z" fill="${mountainBlueDark}" opacity="0.3" filter="url(#wc-cart)"/>
      <path d="M0 145 Q35 125 70 132 Q105 112 140 125 Q175 108 210 120 Q245 110 280 125 L280 175 L0 175Z" fill="${mountainBlue}" opacity="0.35" filter="url(#wc-cart)"/>
      <path d="M45 155 L50 135 Q53 128 56 135 L60 155Z" fill="${success}" opacity="0.35"/>
      <path d="M230 152 L234 134 Q237 128 240 134 L244 152Z" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 165 Q50 158 100 162 Q140 155 180 160 Q220 154 280 162 L280 200 L0 200Z" fill="${sandDark}" opacity="0.5" filter="url(#wc-cart)"/>
      <path d="M110 200 Q118 178 126 172 Q140 164 154 172 Q162 178 170 200" fill="${espressoLight}" opacity="0.4" stroke="${espresso}" stroke-width="0.5"/>
      <circle cx="135" cy="175" r="2" fill="${sunsetCoral}" opacity="0.5"/>
      <path d="M133 182 L135 172 L137 182" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <circle cx="80" cy="180" r="1.5" fill="${sunsetCoralLight}" opacity="0.4"/>
      <circle cx="200" cy="178" r="1.8" fill="${mountainBlueLight}" opacity="0.4"/>
      <path d="M0 185 Q70 178 140 182 Q210 176 280 183 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Misty mountain — cool blue peaks with fog layers
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-search">
  <title id="title-search">No results — misty Blue Ridge peaks fading into fog layers</title>
  <defs>
    <filter id="wc-search">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-search">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="search-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.6"/>
      <stop offset="40%" stop-color="${mountainBlue}" stop-opacity="0.3"/>
      <stop offset="60%" stop-color="${sandLight}" stop-opacity="0.5"/>
      <stop offset="80%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="search-mist" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${offWhite}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-search)">
    <g id="background">
      <rect width="280" height="200" fill="url(#search-sky)" filter="url(#wc-search)"/>
      <ellipse cx="200" cy="40" rx="40" ry="12" fill="${offWhite}" opacity="0.45"/>
      <ellipse cx="220" cy="38" rx="28" ry="9" fill="${white}" opacity="0.3"/>
      <line x1="60" y1="28" x2="66" y2="22" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="66" y1="22" x2="72" y2="28" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="150" y1="20" x2="155" y2="15" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="155" y1="15" x2="160" y2="20" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 120 L45 72 L80 100 Q110 62 150 55 L195 90 L240 65 L280 88 L280 160 L0 160Z" fill="${mountainBlueDark}" opacity="0.3" filter="url(#wc-search)"/>
      <path d="M0 140 L40 98 L80 120 Q120 85 160 80 L200 110 L240 88 L280 108 L280 175 L0 175Z" fill="${mountainBlue}" opacity="0.35" filter="url(#wc-search)"/>
      <rect y="105" width="280" height="25" fill="url(#search-mist)"/>
      <ellipse cx="70" cy="125" rx="45" ry="8" fill="${offWhite}" opacity="0.5"/>
      <ellipse cx="210" cy="118" rx="35" ry="7" fill="${offWhite}" opacity="0.4"/>
    </g>
    <g id="foreground">
      <path d="M0 160 Q60 152 120 156 Q180 148 240 155 Q265 152 280 157 L280 200 L0 200Z" fill="${sandLight}" opacity="0.5" filter="url(#wc-search)"/>
      <rect y="148" width="280" height="18" fill="url(#search-mist)" opacity="0.6"/>
      <circle cx="100" cy="170" r="2" fill="${sunsetCoral}" opacity="0.4"/>
      <path d="M98 178 L100 167 L102 178" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.35"/>
      <circle cx="185" cy="172" r="1.5" fill="${mountainBlueLight}" opacity="0.4"/>
      <path d="M0 182 Q70 176 140 180 Q210 174 280 179 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Mountain cabin — cozy cabin among trees
  wishlist: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-wishlist">
  <title id="title-wishlist">Empty wishlist — a cozy mountain cabin nestled among Blue Ridge pines</title>
  <defs>
    <filter id="wc-wish">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-wish">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="wish-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.5"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.4"/>
      <stop offset="40%" stop-color="${sandLight}" stop-opacity="0.6"/>
      <stop offset="60%" stop-color="${sandBase}" stop-opacity="0.5"/>
      <stop offset="80%" stop-color="${skyGradientBottom}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-wish)">
    <g id="background">
      <rect width="280" height="200" fill="url(#wish-sky)" filter="url(#wc-wish)"/>
      <ellipse cx="210" cy="35" rx="30" ry="10" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="225" cy="33" rx="20" ry="7" fill="${white}" opacity="0.3"/>
      <line x1="50" y1="25" x2="55" y2="20" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="55" y1="20" x2="60" y2="25" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="170" y1="18" x2="174" y2="14" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="174" y1="14" x2="178" y2="18" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 130 Q55 100 110 112 Q165 88 220 105 Q250 95 280 108 L280 165 L0 165Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-wish)"/>
      <path d="M55 158 L60 128 Q64 112 68 128 L72 158Z" fill="${success}" opacity="0.35"/>
      <path d="M48 140 Q64 120 80 140" fill="${mountainBlue}" opacity="0.25"/>
      <path d="M195 155 L200 122 Q204 108 208 122 L212 155Z" fill="${success}" opacity="0.35"/>
      <path d="M188 135 Q204 115 220 135" fill="${mountainBlue}" opacity="0.25"/>
      <path d="M232 158 L236 132 Q239 120 242 132 L246 158Z" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 160 Q70 152 140 156 Q210 148 280 155 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4" filter="url(#wc-wish)"/>
      <polygon points="140,90 112,125 168,125" fill="${espresso}" opacity="0.75"/>
      <rect x="122" y="125" width="36" height="30" fill="${espressoLight}"/>
      <rect x="133" y="135" width="14" height="20" fill="${sandBase}"/>
      <polygon points="140,84 105,122 175,122" fill="none" stroke="${espresso}" stroke-width="1.2" opacity="0.4"/>
      <circle cx="155" cy="115" r="2.5" fill="${sunsetCoral}" opacity="0.6"/>
      <path d="M148 92 Q145 88 148 85 Q146 82 148 80" stroke="${espressoLight}" stroke-width="0.8" fill="none" opacity="0.3"/>
      <circle cx="90" cy="170" r="1.5" fill="${sunsetCoralLight}" opacity="0.4"/>
      <circle cx="180" cy="168" r="1.8" fill="${mountainBlueLight}" opacity="0.4"/>
      <path d="M0 180 Q70 174 140 178 Q210 172 280 177 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Mountain sunset — warm glow behind peaks
  reviews: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-reviews">
  <title id="title-reviews">No reviews yet — a warm mountain sunset glowing behind Blue Ridge peaks</title>
  <defs>
    <filter id="wc-rev">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-rev">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="rev-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlue}" stop-opacity="0.3"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="${sunsetCoralLight}" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="${sunsetCoral}" stop-opacity="0.3"/>
      <stop offset="80%" stop-color="${skyGradientBottom}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${sandBase}"/>
    </linearGradient>
    <radialGradient id="rev-sun" cx="50%" cy="60%" r="40%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sunsetCoralDark}" stop-opacity="0.1"/>
    </radialGradient>
  </defs>
  <g filter="url(#pg-rev)">
    <g id="background">
      <rect width="280" height="200" fill="url(#rev-sky)" filter="url(#wc-rev)"/>
      <circle cx="140" cy="108" r="55" fill="url(#rev-sun)"/>
      <line x1="80" y1="28" x2="86" y2="22" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="86" y1="22" x2="92" y2="28" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="200" y1="35" x2="205" y2="30" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="205" y1="30" x2="210" y2="35" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.75">
      <path d="M0 125 L35 90 L70 112 Q100 72 140 75 L175 100 L210 78 L250 98 L280 85 L280 165 L0 165Z" fill="${espresso}" opacity="0.3" filter="url(#wc-rev)"/>
      <path d="M0 148 L45 118 L90 138 Q125 105 160 110 L195 132 L230 115 L280 132 L280 180 L0 180Z" fill="${espressoLight}" opacity="0.35" filter="url(#wc-rev)"/>
      <path d="M60 160 L65 142 Q68 136 71 142 L75 160Z" fill="${success}" opacity="0.3"/>
      <path d="M220 158 L224 140 Q227 134 230 140 L234 158Z" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 170 Q70 162 140 166 Q210 158 280 165 L280 200 L0 200Z" fill="${sandDark}" opacity="0.5" filter="url(#wc-rev)"/>
      <circle cx="120" cy="178" r="2" fill="${sunsetCoral}" opacity="0.5"/>
      <path d="M118 185 L120 175 L122 185" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <circle cx="170" cy="180" r="1.5" fill="${mountainBlueLight}" opacity="0.4"/>
      <circle cx="50" cy="176" r="1.8" fill="${sunsetCoralLight}" opacity="0.4"/>
      <path d="M0 186 Q70 180 140 184 Q210 178 280 183 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Forest path — green-blue trees lining a trail
  category: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-category">
  <title id="title-category">Empty category — a forest trail lined with Blue Ridge pines</title>
  <defs>
    <filter id="wc-cat">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-cat">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="cat-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.4"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="${sandLight}" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="${sandBase}" stop-opacity="0.4"/>
      <stop offset="80%" stop-color="${skyGradientBottom}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-cat)">
    <g id="background">
      <rect width="280" height="200" fill="url(#cat-sky)" filter="url(#wc-cat)"/>
      <ellipse cx="180" cy="30" rx="35" ry="10" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="195" cy="28" rx="22" ry="7" fill="${white}" opacity="0.3"/>
      <line x1="50" y1="22" x2="55" y2="17" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="55" y1="17" x2="60" y2="22" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="240" y1="18" x2="244" y2="14" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="244" y1="14" x2="248" y2="18" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 142 Q55 128 110 135 Q165 120 220 130 Q250 122 280 132 L280 170 L0 170Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-cat)"/>
      <path d="M25 158 L30 108 Q36 82 42 108 L47 158Z" fill="${mountainBlueDark}" opacity="0.55"/>
      <path d="M17 122 Q36 96 55 122" fill="${mountainBlue}" opacity="0.3"/>
      <path d="M68 155 L72 118 Q77 95 82 118 L86 155Z" fill="${mountainBlueDark}" opacity="0.5"/>
      <path d="M60 128 Q77 105 94 128" fill="${mountainBlue}" opacity="0.25"/>
      <path d="M192 155 L196 112 Q200 90 204 112 L208 155Z" fill="${mountainBlueDark}" opacity="0.55"/>
      <path d="M184 125 Q200 98 216 125" fill="${mountainBlue}" opacity="0.3"/>
      <path d="M235 158 L239 122 Q242 108 245 122 L249 158Z" fill="${mountainBlueDark}" opacity="0.48"/>
      <path d="M228 132 Q242 112 256 132" fill="${mountainBlue}" opacity="0.25"/>
    </g>
    <g id="foreground">
      <path d="M0 162 Q70 155 140 158 Q210 150 280 157 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4" filter="url(#wc-cat)"/>
      <path d="M108 200 Q120 165 132 158 Q140 152 148 158 Q160 165 172 200" fill="${sandBase}" opacity="0.45" stroke="${espressoLight}" stroke-width="0.5"/>
      <circle cx="135" cy="168" r="2" fill="${sunsetCoral}" opacity="0.5"/>
      <path d="M133 175 L135 165 L137 175" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <circle cx="120" cy="174" r="1.5" fill="${sunsetCoralLight}" opacity="0.35"/>
      <circle cx="155" cy="172" r="1.5" fill="${mountainBlueLight}" opacity="0.35"/>
      <path d="M0 182 Q70 176 140 179 Q210 173 280 178 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Storm clouds over ridge — dark, moody scene
  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-error">
  <title id="title-error">Error — storm clouds gathering over a dark Blue Ridge ridgeline</title>
  <defs>
    <filter id="wc-err">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-err">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="err-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${espresso}" stop-opacity="0.4"/>
      <stop offset="20%" stop-color="${espressoLight}" stop-opacity="0.35"/>
      <stop offset="40%" stop-color="${mountainBlueDark}" stop-opacity="0.3"/>
      <stop offset="60%" stop-color="${mountainBlue}" stop-opacity="0.2"/>
      <stop offset="80%" stop-color="${sandDark}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sandDark}" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="err-lightning" cx="50%" cy="40%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#pg-err)">
    <g id="background">
      <rect width="280" height="200" fill="url(#err-sky)" filter="url(#wc-err)"/>
      <ellipse cx="80" cy="42" rx="55" ry="22" fill="${espressoLight}" opacity="0.5"/>
      <ellipse cx="120" cy="38" rx="45" ry="18" fill="${espresso}" opacity="0.4"/>
      <ellipse cx="175" cy="48" rx="50" ry="18" fill="${espressoLight}" opacity="0.42"/>
      <ellipse cx="155" cy="35" rx="40" ry="15" fill="${espresso}" opacity="0.35"/>
    </g>
    <g id="midground" opacity="0.75">
      <path d="M140 58 L143 78 L137 78 L141 98" stroke="${sunsetCoral}" stroke-width="1.5" fill="none" opacity="0.6"/>
      <circle cx="141" cy="70" r="22" fill="url(#err-lightning)"/>
      <path d="M0 130 L40 98 L80 115 Q115 82 150 90 L190 108 L235 95 L280 112 L280 170 L0 170Z" fill="${espresso}" opacity="0.28" filter="url(#wc-err)"/>
      <path d="M0 150 Q55 132 110 142 Q150 125 195 135 Q235 122 280 138 L280 185 L0 185Z" fill="${espressoLight}" opacity="0.32" filter="url(#wc-err)"/>
      <path d="M50 165 L54 148 Q57 142 60 148 L64 165Z" fill="${mountainBlueDark}" opacity="0.35"/>
      <path d="M215 162 L219 145 Q222 140 225 145 L229 162Z" fill="${mountainBlueDark}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 172 Q70 164 140 168 Q210 160 280 167 L280 200 L0 200Z" fill="${sandDark}" opacity="0.4" filter="url(#wc-err)"/>
      <circle cx="100" cy="180" r="1.5" fill="${sunsetCoralLight}" opacity="0.35"/>
      <circle cx="190" cy="178" r="1.8" fill="${mountainBlueLight}" opacity="0.3"/>
      <path d="M0 185 Q70 180 140 183 Q210 177 280 182 L280 200 L0 200Z" fill="${espressoLight}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Fog in valley — serene, mysterious mist
  notFound: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-notfound">
  <title id="title-notfound">Page not found — fog filling a quiet Blue Ridge valley</title>
  <defs>
    <filter id="wc-nf">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-nf">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="nf-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.4"/>
      <stop offset="20%" stop-color="${skyGradientTop}" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="${mountainBlue}" stop-opacity="0.2"/>
      <stop offset="60%" stop-color="${sandLight}" stop-opacity="0.4"/>
      <stop offset="80%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="nf-fog" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0"/>
      <stop offset="30%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="70%" stop-color="${offWhite}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-nf)">
    <g id="background">
      <rect width="280" height="200" fill="url(#nf-sky)" filter="url(#wc-nf)"/>
      <ellipse cx="70" cy="35" rx="30" ry="10" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="220" cy="30" rx="35" ry="10" fill="${offWhite}" opacity="0.35"/>
      <line x1="130" y1="20" x2="135" y2="15" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="135" y1="15" x2="140" y2="20" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 102 L35 72 L70 88 Q105 52 140 55 L180 78 L225 58 L280 82 L280 155 L0 155Z" fill="${mountainBlue}" opacity="0.22" filter="url(#wc-nf)"/>
      <rect y="90" width="280" height="32" fill="url(#nf-fog)"/>
      <path d="M0 130 L50 112 L100 125 Q140 105 180 110 L230 122 L280 115 L280 168 L0 168Z" fill="${mountainBlueDark}" opacity="0.18" filter="url(#wc-nf)"/>
      <rect y="122" width="280" height="22" fill="url(#nf-fog)" opacity="0.7"/>
      <ellipse cx="90" cy="112" rx="50" ry="10" fill="${offWhite}" opacity="0.55"/>
      <ellipse cx="200" cy="130" rx="42" ry="8" fill="${offWhite}" opacity="0.48"/>
    </g>
    <g id="foreground">
      <path d="M0 162 Q70 155 140 158 Q210 152 280 158 L280 200 L0 200Z" fill="${sandLight}" opacity="0.45" filter="url(#wc-nf)"/>
      <circle cx="110" cy="172" r="1.5" fill="${sunsetCoralLight}" opacity="0.35"/>
      <circle cx="175" cy="170" r="2" fill="${mountainBlueLight}" opacity="0.35"/>
      <path d="M173 178 L175 168 L177 178" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.3"/>
      <circle cx="60" cy="175" r="1.2" fill="${sunsetCoral}" opacity="0.3"/>
      <path d="M0 180 Q70 175 140 178 Q210 172 280 177 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,

  // Mountain stream — gentle water flowing between rocks
  sideCart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" height="100%" role="img" aria-labelledby="title-sidecart">
  <title id="title-sidecart">Empty side cart — a gentle mountain stream winding through Blue Ridge rocks</title>
  <defs>
    <filter id="wc-sc">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-sc">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.3"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="${sandLight}" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="${sandBase}" stop-opacity="0.4"/>
      <stop offset="80%" stop-color="${skyGradientBottom}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandLight}"/>
    </linearGradient>
    <linearGradient id="sc-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mountainBlueLight}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${mountainBlue}" stop-opacity="0.4"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-sc)">
    <g id="background">
      <rect width="280" height="200" fill="url(#sc-sky)" filter="url(#wc-sc)"/>
      <ellipse cx="70" cy="35" rx="30" ry="10" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="85" cy="33" rx="20" ry="7" fill="${white}" opacity="0.3"/>
      <line x1="180" y1="22" x2="185" y2="17" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="185" y1="17" x2="190" y2="22" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="240" y1="28" x2="244" y2="24" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="244" y1="24" x2="248" y2="28" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 122 Q55 108 110 115 Q165 100 220 112 Q250 105 280 115 L280 160 L0 160Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-sc)"/>
      <path d="M0 140 Q55 128 110 135 Q165 122 220 132 Q250 125 280 135 L280 175 L0 175Z" fill="${sandDark}" opacity="0.3" filter="url(#wc-sc)"/>
    </g>
    <g id="foreground">
      <path d="M0 152 Q30 145 60 148 Q80 146 85 150" fill="${sandBase}" opacity="0.4"/>
      <path d="M195 150 Q220 143 250 147 Q270 145 280 150" fill="${sandBase}" opacity="0.4"/>
      <path d="M95 200 Q108 168 122 155 Q140 142 158 155 Q172 168 185 200" fill="url(#sc-water)" filter="url(#wc-sc)"/>
      <path d="M112 162 Q140 152 168 162" fill="none" stroke="${offWhite}" stroke-width="0.8" opacity="0.5"/>
      <path d="M105 175 Q140 165 175 175" fill="none" stroke="${offWhite}" stroke-width="0.6" opacity="0.4"/>
      <ellipse cx="80" cy="162" rx="15" ry="8" fill="${espressoLight}" opacity="0.38"/>
      <ellipse cx="200" cy="158" rx="12" ry="6" fill="${espressoLight}" opacity="0.32"/>
      <ellipse cx="215" cy="168" rx="8" ry="5" fill="${espresso}" opacity="0.22"/>
      <circle cx="128" cy="158" r="1.5" fill="${offWhite}" opacity="0.55"/>
      <circle cx="152" cy="160" r="1.2" fill="${offWhite}" opacity="0.45"/>
      <circle cx="140" cy="170" r="1" fill="${offWhite}" opacity="0.4"/>
      <path d="M0 182 Q70 176 140 180 Q210 174 280 179 L280 200 L0 200Z" fill="${sandBase}" opacity="0.3"/>
    </g>
  </g>
</svg>`,
};
