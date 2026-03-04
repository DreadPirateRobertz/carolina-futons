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
  // ridgelines in background, chimney smoke, pine trees, birds, wildflower meadow
  showroom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="100%" height="100%" role="img" aria-labelledby="title-showroom">
  <title id="title-showroom">Carolina Futons showroom — a cozy mountain cabin nestled in the Blue Ridge foothills with a map location pin</title>
  <defs>
    <filter id="wc-show">
      <feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="5" seed="7" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5"/>
    </filter>
    <filter id="pg-show">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <filter id="haze-show">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
    <filter id="smoke-show">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <linearGradient id="show-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="0.95"/>
      <stop offset="15%" stop-color="${mountainBlueLight}" stop-opacity="0.8"/>
      <stop offset="35%" stop-color="${skyGradientBottom}" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="${sandLight}" stop-opacity="0.65"/>
      <stop offset="70%" stop-color="${sunsetCoralLight}" stop-opacity="0.4"/>
      <stop offset="85%" stop-color="${sandBase}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="show-pin-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.7"/>
      <stop offset="35%" stop-color="${sunsetCoralLight}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="show-cabin-glow" cx="50%" cy="65%" r="55%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="${sandLight}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${sandLight}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#pg-show)">
    <g id="background">
      <rect width="400" height="280" fill="url(#show-sky)" filter="url(#wc-show)"/>
      <ellipse cx="65" cy="48" rx="44" ry="13" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="88" cy="45" rx="30" ry="9" fill="${white}" opacity="0.3"/>
      <ellipse cx="320" cy="42" rx="38" ry="11" fill="${offWhite}" opacity="0.35"/>
      <ellipse cx="340" cy="40" rx="22" ry="7" fill="${white}" opacity="0.2"/>
      <line x1="115" y1="34" x2="121" y2="27" stroke="${espresso}" stroke-width="1.2" opacity="0.3"/>
      <line x1="121" y1="27" x2="127" y2="34" stroke="${espresso}" stroke-width="1.2" opacity="0.3"/>
      <line x1="270" y1="26" x2="275" y2="20" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="275" y1="20" x2="280" y2="26" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="345" y1="32" x2="349" y2="27" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="349" y1="27" x2="353" y2="32" stroke="${espresso}" stroke-width="0.8" opacity="0.2"/>
      <line x1="160" y1="40" x2="164" y2="35" stroke="${espresso}" stroke-width="0.7" opacity="0.18"/>
      <line x1="164" y1="35" x2="168" y2="40" stroke="${espresso}" stroke-width="0.7" opacity="0.18"/>
    </g>
    <g id="midground" opacity="0.85">
      <path d="M0 140 C18 132 35 118 55 112 C75 106 92 115 115 108 C138 101 155 88 180 82 C205 76 225 90 250 84 C275 78 295 68 320 65 C345 62 368 72 390 76 L400 78 L400 160 L0 160Z" fill="${mountainBlueDark}" opacity="0.2" filter="url(#wc-show)"/>
      <rect x="0" y="105" width="400" height="20" fill="${mountainBlueLight}" opacity="0.08" filter="url(#haze-show)"/>
      <path d="M0 155 C20 148 42 135 68 130 C94 125 115 138 142 132 C169 126 190 112 218 108 C246 104 268 118 295 112 C322 106 345 95 372 92 L400 90 L400 175 L0 175Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-show)"/>
      <path d="M0 170 C25 164 48 152 78 148 C108 144 130 156 160 150 C190 144 212 132 242 128 C272 124 295 136 325 130 C355 124 378 115 400 112 L400 192 L0 192Z" fill="${mountainBlue}" opacity="0.4" filter="url(#wc-show)"/>
      <rect x="0" y="140" width="400" height="22" fill="${skyGradientTop}" opacity="0.06" filter="url(#haze-show)"/>
      <path d="M0 185 C22 180 45 170 72 166 C99 162 118 172 148 168 C178 164 200 154 228 150 C256 146 278 156 308 152 C338 148 362 140 400 138 L400 208 L0 208Z" fill="${espressoLight}" opacity="0.45" filter="url(#wc-show)"/>
      <path d="M0 198 C28 193 52 185 82 182 C112 179 135 188 162 184 C189 180 210 172 238 168 C266 164 288 173 318 170 C348 167 375 160 400 158 L400 220 L0 220Z" fill="${espresso}" opacity="0.5" filter="url(#wc-show)"/>
      <rect x="0" y="170" width="400" height="18" fill="${mountainBlueDark}" opacity="0.05" filter="url(#haze-show)"/>
      <path d="M45 200 L50 178 C53 170 56 165 58 170 L62 178 L66 200Z" fill="${success}" opacity="0.55"/>
      <path d="M48 196 L52 176 C54 169 56 166 58 169 L61 176 L64 196Z" fill="${success}" opacity="0.65"/>
      <path d="M50 192 L53 180 C55 174 57 172 58 174 L60 180 L62 192Z" fill="${espressoLight}" opacity="0.4"/>
      <path d="M335 198 L339 180 C341 174 344 170 346 174 L349 180 L352 198Z" fill="${success}" opacity="0.5"/>
      <path d="M337 194 L340 178 C342 173 344 171 345 173 L348 178 L350 194Z" fill="${success}" opacity="0.6"/>
      <path d="M30 204 L34 188 C36 182 38 179 40 182 L43 188 L46 204Z" fill="${success}" opacity="0.4"/>
      <path d="M355 202 L358 190 C360 185 361 183 363 185 L365 190 L367 202Z" fill="${success}" opacity="0.45"/>
    </g>
    <g id="foreground">
      <path d="M0 215 C30 208 55 200 85 196 C115 192 140 202 170 198 C200 194 225 186 255 184 C285 182 310 192 340 188 C365 185 385 180 400 178 L400 280 L0 280Z" fill="${sandDark}" opacity="0.6" filter="url(#wc-show)"/>
      <path d="M0 230 C35 224 65 218 95 215 C125 212 152 220 182 217 C212 214 238 208 268 206 C298 204 325 212 355 210 C380 208 395 204 400 202 L400 280 L0 280Z" fill="${sandBase}" opacity="0.7"/>
      <ellipse cx="200" cy="210" rx="65" ry="30" fill="url(#show-cabin-glow)"/>
      <rect x="155" y="185" width="90" height="55" fill="${espressoLight}" opacity="0.75" rx="2"/>
      <rect x="248" y="210" width="22" height="30" fill="${espressoLight}" opacity="0.6" rx="1"/>
      <polygon points="148,188 200,158 252,188" fill="${espresso}" opacity="0.8"/>
      <rect x="166" y="210" width="20" height="28" fill="${sandLight}" opacity="0.65" rx="1"/>
      <rect x="170" y="214" width="5" height="10" fill="${skyGradientTop}" opacity="0.3"/>
      <rect x="178" y="214" width="5" height="10" fill="${skyGradientTop}" opacity="0.3"/>
      <rect x="195" y="198" width="24" height="16" fill="${skyGradientTop}" opacity="0.45" rx="1"/>
      <rect x="222" y="198" width="18" height="16" fill="${skyGradientTop}" opacity="0.4" rx="1"/>
      <rect x="197" y="163" width="7" height="24" fill="${espresso}" opacity="0.6" rx="1"/>
      <ellipse cx="200" cy="160" rx="5" ry="4" fill="${espressoLight}" opacity="0.4"/>
      <ellipse cx="203" cy="152" rx="8" ry="5" fill="${offWhite}" opacity="0.15" filter="url(#smoke-show)"/>
      <ellipse cx="207" cy="145" rx="10" ry="6" fill="${white}" opacity="0.1" filter="url(#smoke-show)"/>
      <ellipse cx="212" cy="138" rx="12" ry="7" fill="${offWhite}" opacity="0.08" filter="url(#smoke-show)"/>
      <circle cx="200" cy="140" r="18" fill="url(#show-pin-glow)"/>
      <path d="M200 153 L190 138 C188 132 190 126 200 124 C210 126 212 132 210 138 Z" fill="${sunsetCoral}" opacity="0.9"/>
      <circle cx="200" cy="134" r="5" fill="${white}" opacity="0.8"/>
      <line x1="75" y1="252" x2="75" y2="240" stroke="${success}" stroke-width="1.2" opacity="0.6"/>
      <circle cx="75" cy="238" r="3" fill="${sunsetCoral}" opacity="0.65"/>
      <line x1="88" y1="254" x2="89" y2="243" stroke="${success}" stroke-width="1" opacity="0.5"/>
      <circle cx="89" cy="241" r="2.5" fill="${sunsetCoralLight}" opacity="0.6"/>
      <line x1="100" y1="256" x2="101" y2="246" stroke="${success}" stroke-width="0.9" opacity="0.45"/>
      <circle cx="101" cy="244" r="2" fill="${sandBase}" opacity="0.55"/>
      <line x1="115" y1="255" x2="115" y2="245" stroke="${success}" stroke-width="0.8" opacity="0.4"/>
      <circle cx="115" cy="243" r="2.5" fill="${mountainBlueLight}" opacity="0.45"/>
      <line x1="290" y1="248" x2="290" y2="237" stroke="${success}" stroke-width="1.1" opacity="0.55"/>
      <circle cx="290" cy="235" r="3" fill="${sunsetCoralLight}" opacity="0.6"/>
      <line x1="305" y1="250" x2="306" y2="240" stroke="${success}" stroke-width="0.9" opacity="0.45"/>
      <circle cx="306" cy="238" r="2.5" fill="${sunsetCoral}" opacity="0.55"/>
      <line x1="318" y1="252" x2="319" y2="243" stroke="${success}" stroke-width="0.8" opacity="0.4"/>
      <circle cx="319" cy="241" r="2" fill="${sandBase}" opacity="0.5"/>
      <line x1="330" y1="250" x2="330" y2="242" stroke="${success}" stroke-width="0.7" opacity="0.35"/>
      <circle cx="330" cy="240" r="1.8" fill="${mountainBlueLight}" opacity="0.4"/>
    </g>
  </g>
</svg>`,

  // ── Mountain Skyline Hero ──────────────────────────────────────────
  // Wide panoramic Blue Ridge skyline with warm sunrise, 7 ridgeline layers
  // fading into purple-blue atmospheric depth, sun with rays, birds, pine
  // trees, wildflower meadow
  hero: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 220" width="100%" height="100%" role="img" aria-labelledby="title-hero">
  <title id="title-hero">Blue Ridge mountain skyline at sunrise — layered ridgelines fading into warm morning haze</title>
  <defs>
    <filter id="wc-hero">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="5" seed="33" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="6"/>
    </filter>
    <filter id="pg-hero">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed="11" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <filter id="haze-hero">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <filter id="glow-hero">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sunsetCoralLight}" stop-opacity="0.6"/>
      <stop offset="12%" stop-color="${sunsetCoral}" stop-opacity="0.5"/>
      <stop offset="25%" stop-color="${skyGradientBottom}" stop-opacity="0.65"/>
      <stop offset="40%" stop-color="${sandLight}" stop-opacity="0.75"/>
      <stop offset="55%" stop-color="${sandBase}" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="${skyGradientTop}" stop-opacity="0.55"/>
      <stop offset="85%" stop-color="${mountainBlueLight}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="hero-sun-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.6"/>
      <stop offset="30%" stop-color="${sunsetCoralLight}" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="${skyGradientBottom}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${skyGradientBottom}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#pg-hero)">
    <g id="background">
      <rect width="1440" height="220" fill="url(#hero-sky)" filter="url(#wc-hero)"/>
      <circle cx="1180" cy="35" r="55" fill="url(#hero-sun-glow)"/>
      <circle cx="1180" cy="35" r="28" fill="${sunsetCoralLight}" opacity="0.6" filter="url(#glow-hero)"/>
      <circle cx="1180" cy="35" r="18" fill="${sunsetCoral}" opacity="0.5"/>
      <circle cx="1180" cy="35" r="10" fill="${white}" opacity="0.3"/>
      <line x1="1180" y1="60" x2="1180" y2="90" stroke="${sunsetCoralLight}" stroke-width="2" opacity="0.15"/>
      <line x1="1210" y1="55" x2="1235" y2="75" stroke="${sunsetCoralLight}" stroke-width="1.5" opacity="0.12"/>
      <line x1="1150" y1="55" x2="1125" y2="75" stroke="${sunsetCoralLight}" stroke-width="1.5" opacity="0.12"/>
      <line x1="1220" y1="40" x2="1250" y2="45" stroke="${skyGradientBottom}" stroke-width="1" opacity="0.1"/>
      <line x1="1140" y1="40" x2="1110" y2="45" stroke="${skyGradientBottom}" stroke-width="1" opacity="0.1"/>
      <ellipse cx="220" cy="40" rx="55" ry="15" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="250" cy="37" rx="38" ry="11" fill="${white}" opacity="0.3"/>
      <ellipse cx="750" cy="45" rx="48" ry="13" fill="${offWhite}" opacity="0.35"/>
      <ellipse cx="780" cy="42" rx="30" ry="9" fill="${white}" opacity="0.22"/>
      <ellipse cx="450" cy="50" rx="35" ry="10" fill="${offWhite}" opacity="0.25"/>
      <line x1="340" y1="28" x2="347" y2="20" stroke="${espresso}" stroke-width="1.3" opacity="0.3"/>
      <line x1="347" y1="20" x2="354" y2="28" stroke="${espresso}" stroke-width="1.3" opacity="0.3"/>
      <line x1="520" y1="22" x2="526" y2="15" stroke="${espresso}" stroke-width="1.1" opacity="0.25"/>
      <line x1="526" y1="15" x2="532" y2="22" stroke="${espresso}" stroke-width="1.1" opacity="0.25"/>
      <line x1="680" y1="30" x2="685" y2="24" stroke="${espresso}" stroke-width="1" opacity="0.22"/>
      <line x1="685" y1="24" x2="690" y2="30" stroke="${espresso}" stroke-width="1" opacity="0.22"/>
      <line x1="900" y1="26" x2="905" y2="20" stroke="${espresso}" stroke-width="0.9" opacity="0.2"/>
      <line x1="905" y1="20" x2="910" y2="26" stroke="${espresso}" stroke-width="0.9" opacity="0.2"/>
      <line x1="1050" y1="32" x2="1054" y2="27" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
      <line x1="1054" y1="27" x2="1058" y2="32" stroke="${espresso}" stroke-width="0.8" opacity="0.18"/>
      <line x1="1320" y1="24" x2="1324" y2="19" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
      <line x1="1324" y1="19" x2="1328" y2="24" stroke="${espresso}" stroke-width="0.7" opacity="0.16"/>
    </g>
    <g id="midground" opacity="0.85">
      <path d="M0 220 L0 92 C35 88 55 72 95 65 C135 58 165 70 210 62 C255 54 285 38 340 32 C395 26 430 42 488 36 C546 30 580 18 645 22 C710 26 745 42 812 36 C879 30 912 20 978 25 C1044 30 1078 45 1145 40 C1212 35 1248 24 1312 28 C1365 31 1400 45 1440 52 L1440 220Z" fill="${mountainBlueDark}" opacity="0.15" filter="url(#wc-hero)"/>
      <rect x="0" y="55" width="1440" height="25" fill="${mountainBlueLight}" opacity="0.08" filter="url(#haze-hero)"/>
      <path d="M0 220 L0 105 C40 100 62 85 108 78 C154 71 182 88 232 82 C282 76 312 58 368 52 C424 46 458 64 518 58 C578 52 615 35 685 38 C755 41 790 58 858 52 C926 46 960 34 1028 38 C1096 42 1132 58 1198 52 C1264 46 1298 36 1360 40 C1408 43 1430 55 1440 62 L1440 220Z" fill="${mountainBlueDark}" opacity="0.22" filter="url(#wc-hero)"/>
      <path d="M0 220 L0 118 C38 112 58 98 105 92 C152 86 178 102 228 96 C278 90 310 72 365 68 C420 64 452 80 512 75 C572 70 608 52 678 55 C748 58 782 75 852 70 C922 65 958 50 1025 54 C1092 58 1128 72 1195 68 C1262 64 1298 52 1358 55 C1405 57 1428 68 1440 74 L1440 220Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-hero)"/>
      <rect x="0" y="85" width="1440" height="22" fill="${skyGradientTop}" opacity="0.06" filter="url(#haze-hero)"/>
      <path d="M0 220 L0 132 C42 126 65 112 115 106 C165 100 195 116 248 110 C301 104 332 88 388 84 C444 80 478 96 538 92 C598 88 635 70 705 72 C775 74 810 90 878 86 C946 82 980 68 1048 72 C1116 76 1152 90 1218 86 C1284 82 1318 72 1378 74 C1415 76 1432 86 1440 90 L1440 220Z" fill="${espressoLight}" opacity="0.38" filter="url(#wc-hero)"/>
      <path d="M0 220 L0 148 C45 142 68 128 122 122 C176 116 208 132 265 128 C322 124 355 108 412 104 C469 100 505 116 565 112 C625 108 662 92 732 94 C802 96 838 112 905 108 C972 104 1008 90 1072 94 C1136 98 1172 112 1238 108 C1304 104 1338 92 1395 96 C1425 98 1438 108 1440 112 L1440 220Z" fill="${espresso}" opacity="0.45" filter="url(#wc-hero)"/>
      <rect x="0" y="110" width="1440" height="20" fill="${mountainBlueDark}" opacity="0.05" filter="url(#haze-hero)"/>
      <path d="M0 220 L0 160 C48 155 72 142 128 138 C184 134 215 148 272 144 C329 140 362 126 420 122 C478 118 512 134 572 130 C632 126 668 112 738 114 C808 116 842 130 910 126 C978 122 1012 110 1078 112 C1144 114 1178 128 1245 124 C1312 120 1348 110 1402 114 C1428 116 1438 124 1440 128 L1440 220Z" fill="${espresso}" opacity="0.58" filter="url(#wc-hero)"/>
    </g>
    <g id="foreground">
      <path d="M0 220 L0 174 C50 168 78 155 135 152 C192 149 222 162 280 158 C338 154 368 142 428 138 C488 134 522 148 582 145 C642 142 678 130 740 128 C802 126 835 140 898 137 C961 134 995 122 1058 124 C1121 126 1158 140 1222 136 C1286 132 1322 122 1380 126 C1418 128 1435 138 1440 142 L1440 220Z" fill="${espresso}" opacity="0.72" filter="url(#wc-hero)"/>
      <rect x="180" y="160" width="5" height="32" fill="${espresso}" opacity="0.65" rx="1"/>
      <path d="M162 168 C170 152 176 144 182 136 C188 144 194 152 202 168" fill="${espressoLight}" opacity="0.45"/>
      <path d="M166 162 C172 148 178 142 183 136 C188 142 194 148 200 162" fill="${success}" opacity="0.5"/>
      <path d="M170 156 C175 144 179 140 183 134 C187 140 191 144 196 156" fill="${espresso}" opacity="0.55"/>
      <rect x="700" y="162" width="4" height="28" fill="${espresso}" opacity="0.55" rx="1"/>
      <path d="M685 168 C692 154 696 148 702 142 C708 148 712 154 718 168" fill="${espressoLight}" opacity="0.4"/>
      <path d="M688 163 C694 150 698 146 702 140 C706 146 710 150 716 163" fill="${success}" opacity="0.45"/>
      <path d="M692 158 C696 148 700 144 702 139 C704 144 708 148 712 158" fill="${espresso}" opacity="0.5"/>
      <rect x="1050" y="158" width="4" height="26" fill="${espresso}" opacity="0.5" rx="1"/>
      <path d="M1038 164 C1044 152 1048 146 1052 140 C1056 146 1060 152 1066 164" fill="${espressoLight}" opacity="0.38"/>
      <path d="M1041 160 C1046 148 1050 144 1052 139 C1054 144 1058 148 1063 160" fill="${success}" opacity="0.42"/>
      <line x1="350" y1="185" x2="350" y2="174" stroke="${success}" stroke-width="1.2" opacity="0.6"/>
      <circle cx="350" cy="172" r="3" fill="${sunsetCoral}" opacity="0.65"/>
      <line x1="368" y1="188" x2="369" y2="178" stroke="${success}" stroke-width="1" opacity="0.5"/>
      <circle cx="369" cy="176" r="2.5" fill="${sunsetCoralLight}" opacity="0.6"/>
      <line x1="385" y1="190" x2="386" y2="181" stroke="${success}" stroke-width="0.9" opacity="0.45"/>
      <circle cx="386" cy="179" r="2" fill="${sandBase}" opacity="0.55"/>
      <line x1="850" y1="182" x2="850" y2="172" stroke="${success}" stroke-width="1.1" opacity="0.55"/>
      <circle cx="850" cy="170" r="3" fill="${sunsetCoral}" opacity="0.6"/>
      <line x1="868" y1="184" x2="869" y2="175" stroke="${success}" stroke-width="0.9" opacity="0.45"/>
      <circle cx="869" cy="173" r="2.5" fill="${mountainBlueLight}" opacity="0.5"/>
      <line x1="1260" y1="180" x2="1260" y2="170" stroke="${success}" stroke-width="1" opacity="0.5"/>
      <circle cx="1260" cy="168" r="2.5" fill="${sunsetCoralLight}" opacity="0.55"/>
      <line x1="1278" y1="182" x2="1279" y2="174" stroke="${success}" stroke-width="0.8" opacity="0.4"/>
      <circle cx="1279" cy="172" r="2" fill="${sandBase}" opacity="0.5"/>
    </g>
  </g>
</svg>`,
};

/**
 * Generate hero SVG with optional custom height.
 * @param {Object} [options]
 * @param {number} [options.height] - Override height in SVG root
 * @returns {string} SVG markup
 */
export function generateHeroSVG(options) {
  const opts = options || {};
  const svg = CONTACT_ILLUSTRATIONS.hero;
  if (typeof opts.height === 'number' && opts.height > 0) {
    return svg.replace(/height="100%"/, `height="${opts.height}"`);
  }
  return svg;
}

/**
 * Generate showroom SVG with optional custom height.
 * @param {Object} [options]
 * @param {number} [options.height] - Override height in SVG root
 * @returns {string} SVG markup
 */
export function generateShowroomSVG(options) {
  const opts = options || {};
  const svg = CONTACT_ILLUSTRATIONS.showroom;
  if (typeof opts.height === 'number' && opts.height > 0) {
    return svg.replace(/height="100%"/, `height="${opts.height}"`);
  }
  return svg;
}

/**
 * Initialize the Contact page hero skyline illustration on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.containerId='#contactHeroSkyline'] - Container element ID
 * @param {number} [options.height] - Override SVG height
 */
export function initContactHeroSkyline($w, options) {
  try {
    if (!$w) return;
    const opts = options || {};
    const containerId = opts.containerId || '#contactHeroSkyline';
    const container = $w(containerId);
    if (!container) return;
    container.html = generateHeroSVG(opts);
  } catch (e) { console.warn('[contactIllustrations] hero element not found:', e); }
}

/**
 * Initialize the Contact page showroom scene illustration on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.containerId='#contactShowroomScene'] - Container element ID
 * @param {number} [options.height] - Override SVG height
 */
export function initContactShowroomScene($w, options) {
  try {
    if (!$w) return;
    const opts = options || {};
    const containerId = opts.containerId || '#contactShowroomScene';
    const container = $w(containerId);
    if (!container) return;
    container.html = generateShowroomSVG(opts);
  } catch (e) { console.warn('[contactIllustrations] showroom element not found:', e); }
}
