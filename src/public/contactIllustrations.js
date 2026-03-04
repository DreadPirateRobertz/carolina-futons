/**
 * contactIllustrations.js — Contact page SVG illustrations
 *
 * Two hand-drawn-style SVG scenes for the Contact page:
 * - showroom: Illustrated showroom/map scene with cabin, map pin, and mountain backdrop
 * - hero: Mountain skyline hero with warm sunrise palette
 *
 * Both meet the 8-point quality bar: watercolor filter, paper grain,
 * organic paths, 15+ elements, 5+ gradient stops, atmospheric depth,
 * brand tokens only, accessibility.
 *
 * @module contactIllustrations
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
 * Map of contact illustration keys to inline SVG strings.
 */
export const CONTACT_ILLUSTRATIONS = {
  // ── Showroom / Map Scene ──────────────────────────────────────────
  // A cozy mountain cabin showroom with map pin marker, rolling Blue Ridge
  // ridgelines in background, pine trees, birds, wildflowers
  showroom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="100%" height="100%" role="img" aria-labelledby="title-showroom">
  <title id="title-showroom">Carolina Futons showroom — a cozy mountain cabin nestled in the Blue Ridge foothills with a map location pin</title>
  <defs>
    <filter id="wc-show">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
    </filter>
    <filter id="pg-show">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <filter id="haze-show">
      <feGaussianBlur stdDeviation="1.5"/>
    </filter>
    <linearGradient id="show-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.9"/>
      <stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.7"/>
      <stop offset="45%" stop-color="${skyGradientBottom}" stop-opacity="0.5"/>
      <stop offset="65%" stop-color="${sandLight}" stop-opacity="0.6"/>
      <stop offset="80%" stop-color="${sunsetCoralLight}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="show-pin-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#pg-show)">
    <g id="background">
      <rect width="400" height="280" fill="url(#show-sky)" filter="url(#wc-show)"/>
      <ellipse cx="70" cy="55" rx="40" ry="12" fill="${offWhite}" opacity="0.35"/>
      <ellipse cx="90" cy="52" rx="28" ry="9" fill="${white}" opacity="0.25"/>
      <ellipse cx="330" cy="48" rx="35" ry="10" fill="${offWhite}" opacity="0.3"/>
      <line x1="120" y1="38" x2="126" y2="32" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="126" y1="32" x2="132" y2="38" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="280" y1="30" x2="285" y2="25" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="285" y1="25" x2="290" y2="30" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="350" y1="42" x2="354" y2="38" stroke="${espresso}" stroke-width="0.7" opacity="0.18"/>
      <line x1="354" y1="38" x2="358" y2="42" stroke="${espresso}" stroke-width="0.7" opacity="0.18"/>
    </g>
    <g id="midground" opacity="0.8">
      <path d="M0 160 Q30 130 60 142 Q95 110 130 128 Q170 100 210 118 Q245 95 280 112 Q315 100 350 115 Q375 108 400 120 L400 185 L0 185Z" fill="${mountainBlueDark}" opacity="0.25" filter="url(#wc-show)"/>
      <path d="M0 175 Q40 152 80 160 Q120 138 160 150 Q200 130 240 145 Q280 128 320 140 Q360 132 400 148 L400 200 L0 200Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-show)"/>
      <path d="M0 190 Q45 172 90 178 Q135 160 180 170 Q225 155 270 165 Q310 152 350 162 Q380 156 400 168 L400 215 L0 215Z" fill="${espressoLight}" opacity="0.35" filter="url(#wc-show)"/>
      <rect x="0" y="155" width="400" height="30" fill="${mountainBlueLight}" opacity="0.06" filter="url(#haze-show)"/>
      <path d="M55 195 L60 175 Q63 168 66 175 L70 195Z" fill="${success}" opacity="0.4"/>
      <path d="M57 190 L60 173 Q63 167 66 173 L69 190Z" fill="${success}" opacity="0.5"/>
      <path d="M340 192 L344 176 Q347 170 350 176 L354 192Z" fill="${success}" opacity="0.35"/>
      <path d="M342 188 L345 174 Q347 169 349 174 L352 188Z" fill="${success}" opacity="0.45"/>
    </g>
    <g id="foreground">
      <path d="M0 210 Q50 200 100 205 Q150 198 200 203 Q250 196 300 202 Q350 198 400 208 L400 280 L0 280Z" fill="${sandDark}" opacity="0.5" filter="url(#wc-show)"/>
      <path d="M0 225 Q60 218 120 222 Q180 215 240 220 Q300 214 360 220 Q385 218 400 222 L400 280 L0 280Z" fill="${sandBase}" opacity="0.6"/>
      <rect x="155" y="185" width="90" height="55" fill="${espressoLight}" opacity="0.7" rx="2"/>
      <polygon points="150,188 200,162 250,188" fill="${espresso}" opacity="0.75"/>
      <rect x="168" y="210" width="18" height="28" fill="${sandLight}" opacity="0.6" rx="1"/>
      <rect x="195" y="200" width="22" height="14" fill="${skyGradientTop}" opacity="0.4" rx="1"/>
      <rect x="220" y="200" width="16" height="14" fill="${skyGradientTop}" opacity="0.35" rx="1"/>
      <rect x="196" y="165" width="8" height="22" fill="${espresso}" opacity="0.5" rx="1"/>
      <path d="M198 165 Q200 158 202 165" fill="${espressoLight}" opacity="0.4"/>
      <circle cx="200" cy="145" r="14" fill="url(#show-pin-glow)"/>
      <path d="M200 155 L192 142 Q192 132 200 130 Q208 132 208 142 Z" fill="${sunsetCoral}" opacity="0.85"/>
      <circle cx="200" cy="139" r="4" fill="${white}" opacity="0.7"/>
      <line x1="90" y1="248" x2="90" y2="238" stroke="${success}" stroke-width="1" opacity="0.5"/>
      <circle cx="90" cy="236" r="2.5" fill="${sunsetCoral}" opacity="0.55"/>
      <line x1="110" y1="250" x2="111" y2="241" stroke="${success}" stroke-width="0.8" opacity="0.4"/>
      <circle cx="111" cy="239" r="2" fill="${sandBase}" opacity="0.5"/>
      <line x1="300" y1="245" x2="300" y2="236" stroke="${success}" stroke-width="0.9" opacity="0.45"/>
      <circle cx="300" cy="234" r="2.5" fill="${sunsetCoralLight}" opacity="0.5"/>
      <line x1="320" y1="248" x2="321" y2="240" stroke="${success}" stroke-width="0.7" opacity="0.35"/>
      <circle cx="321" cy="238" r="1.8" fill="${mountainBlueLight}" opacity="0.4"/>
    </g>
  </g>
</svg>`,

  // ── Mountain Skyline Hero ──────────────────────────────────────────
  // Wide panoramic mountain skyline with warm sunrise colors,
  // 5 ridgeline layers, birds, pine trees, wildflowers, atmospheric haze
  hero: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 200" width="100%" height="100%" role="img" aria-labelledby="title-hero">
  <title id="title-hero">Blue Ridge mountain skyline at sunrise — layered ridgelines fading into warm morning haze</title>
  <defs>
    <filter id="wc-hero">
      <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="4" seed="33" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
    </filter>
    <filter id="pg-hero">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="11" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <filter id="haze-hero">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
    <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sunsetCoralLight}" stop-opacity="0.5"/>
      <stop offset="15%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="30%" stop-color="${skyGradientBottom}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="${sandLight}" stop-opacity="0.7"/>
      <stop offset="70%" stop-color="${skyGradientTop}" stop-opacity="0.5"/>
      <stop offset="85%" stop-color="${mountainBlueLight}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-hero)">
    <g id="background">
      <rect width="1440" height="200" fill="url(#hero-sky)" filter="url(#wc-hero)"/>
      <circle cx="1200" cy="40" r="22" fill="${sunsetCoralLight}" opacity="0.5"/>
      <circle cx="1200" cy="40" r="14" fill="${sunsetCoral}" opacity="0.35"/>
      <ellipse cx="200" cy="45" rx="50" ry="14" fill="${offWhite}" opacity="0.35"/>
      <ellipse cx="230" cy="42" rx="35" ry="10" fill="${white}" opacity="0.25"/>
      <ellipse cx="800" cy="50" rx="45" ry="12" fill="${offWhite}" opacity="0.3"/>
      <line x1="350" y1="32" x2="356" y2="26" stroke="${espresso}" stroke-width="1.1" opacity="0.25"/>
      <line x1="356" y1="26" x2="362" y2="32" stroke="${espresso}" stroke-width="1.1" opacity="0.25"/>
      <line x1="620" y1="25" x2="625" y2="20" stroke="${espresso}" stroke-width="0.9" opacity="0.2"/>
      <line x1="625" y1="20" x2="630" y2="25" stroke="${espresso}" stroke-width="0.9" opacity="0.2"/>
      <line x1="950" y1="35" x2="954" y2="30" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
      <line x1="954" y1="30" x2="958" y2="35" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
      <line x1="1080" y1="28" x2="1084" y2="24" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
      <line x1="1084" y1="24" x2="1088" y2="28" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    </g>
    <g id="midground" opacity="0.8">
      <path d="M0 200 L0 108 C55 102 78 78 140 72 C202 66 228 88 295 80 C362 72 390 52 455 48 C520 44 548 62 618 56 C688 50 720 35 795 40 C870 45 900 62 975 56 C1050 50 1080 65 1155 58 C1230 51 1265 42 1335 48 C1380 52 1410 62 1440 66 L1440 200Z" fill="${mountainBlueDark}" opacity="0.18" filter="url(#wc-hero)"/>
      <path d="M0 200 L0 122 C50 116 72 95 135 88 C198 81 225 100 290 94 C355 88 385 68 448 64 C511 60 540 78 610 72 C680 66 715 48 790 52 C865 56 895 72 965 68 C1035 64 1070 50 1140 54 C1210 58 1245 72 1310 66 C1375 60 1405 76 1440 74 L1440 200Z" fill="${mountainBlue}" opacity="0.25" filter="url(#wc-hero)"/>
      <path d="M0 200 L0 135 C42 130 60 110 105 102 C150 94 170 112 215 105 C260 98 288 72 345 68 C402 64 425 85 488 80 C551 75 575 55 645 52 C715 49 738 68 808 65 C878 62 902 48 968 54 C1034 60 1058 78 1128 72 C1198 66 1228 52 1288 56 C1348 60 1378 75 1440 82 L1440 200Z" fill="${espressoLight}" opacity="0.32" filter="url(#wc-hero)"/>
      <path d="M0 200 L0 148 C48 142 70 125 128 120 C186 115 210 132 272 128 C334 124 360 108 422 104 C484 100 512 118 575 114 C638 110 668 95 738 92 C808 89 835 105 905 102 C975 99 1005 85 1068 90 C1131 95 1160 110 1225 106 C1290 102 1320 90 1380 94 C1415 96 1432 108 1440 112 L1440 200Z" fill="${espresso}" opacity="0.4" filter="url(#wc-hero)"/>
      <path d="M0 200 L0 158 C45 153 68 140 125 136 C182 132 210 148 268 144 C326 140 355 125 415 122 C475 119 505 135 568 132 C631 129 665 115 728 112 C791 109 822 125 885 122 C948 119 978 108 1038 112 C1098 116 1128 130 1192 126 C1256 122 1288 112 1345 116 C1398 119 1425 132 1440 138 L1440 200Z" fill="${espresso}" opacity="0.55" filter="url(#wc-hero)"/>
      <rect x="0" y="65" width="1440" height="35" fill="${mountainBlueLight}" opacity="0.06" filter="url(#haze-hero)"/>
      <rect x="0" y="100" width="1440" height="25" fill="${skyGradientTop}" opacity="0.04" filter="url(#haze-hero)"/>
    </g>
    <g id="foreground">
      <path d="M0 200 L0 168 C50 162 75 150 130 148 C185 146 215 158 270 155 C325 152 355 140 415 138 C475 136 510 150 570 148 C630 146 665 135 725 132 C785 129 818 142 878 140 C938 138 968 128 1028 130 C1088 132 1122 145 1182 142 C1242 139 1278 130 1338 133 C1395 136 1422 148 1440 152 L1440 200Z" fill="${espresso}" opacity="0.7" filter="url(#wc-hero)"/>
      <rect x="210" y="152" width="4" height="28" fill="${espresso}" opacity="0.6" rx="1"/>
      <path d="M194 158 C200 144 206 136 212 130 C218 136 224 144 230 158" fill="${espressoLight}" opacity="0.4"/>
      <path d="M197 152 C202 140 208 134 212 128 C216 134 222 140 227 152" fill="${espressoLight}" opacity="0.5"/>
      <path d="M200 146 C205 136 209 132 212 126 C215 132 219 136 224 146" fill="${espresso}" opacity="0.55"/>
      <rect x="960" y="155" width="3" height="22" fill="${espresso}" opacity="0.5" rx="1"/>
      <path d="M948 160 C953 148 958 142 962 138 C966 142 971 148 976 160" fill="${espressoLight}" opacity="0.35"/>
      <path d="M951 155 C955 145 959 140 962 136 C965 140 969 145 973 155" fill="${espressoLight}" opacity="0.45"/>
      <line x1="400" y1="178" x2="400" y2="168" stroke="${success}" stroke-width="1" opacity="0.5"/>
      <circle cx="400" cy="166" r="2.5" fill="${sunsetCoral}" opacity="0.55"/>
      <line x1="420" y1="180" x2="421" y2="172" stroke="${success}" stroke-width="0.8" opacity="0.4"/>
      <circle cx="421" cy="170" r="2" fill="${sandBase}" opacity="0.5"/>
      <line x1="1100" y1="175" x2="1100" y2="166" stroke="${success}" stroke-width="0.9" opacity="0.45"/>
      <circle cx="1100" cy="164" r="2.5" fill="${sunsetCoralLight}" opacity="0.5"/>
      <line x1="1120" y1="177" x2="1121" y2="170" stroke="${success}" stroke-width="0.7" opacity="0.35"/>
      <circle cx="1121" cy="168" r="1.8" fill="${mountainBlueLight}" opacity="0.4"/>
    </g>
  </g>
</svg>`,
};

/**
 * Initialize the Contact page hero skyline illustration on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.containerId='#contactHeroSkyline'] - Container element ID
 */
export function initContactHeroSkyline($w, options) {
  try {
    if (!$w) return;
    const opts = options || {};
    const containerId = opts.containerId || '#contactHeroSkyline';
    const container = $w(containerId);
    if (!container) return;
    container.html = CONTACT_ILLUSTRATIONS.hero;
  } catch (_e) { /* Element may not exist */ }
}

/**
 * Initialize the Contact page showroom scene illustration on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.containerId='#contactShowroomScene'] - Container element ID
 */
export function initContactShowroomScene($w, options) {
  try {
    if (!$w) return;
    const opts = options || {};
    const containerId = opts.containerId || '#contactShowroomScene';
    const container = $w(containerId);
    if (!container) return;
    container.html = CONTACT_ILLUSTRATIONS.showroom;
  } catch (_e) { /* Element may not exist */ }
}
