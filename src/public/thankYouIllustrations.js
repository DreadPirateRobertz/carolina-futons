/**
 * thankYouIllustrations.js — Hand-drawn SVG illustrations for the Thank You page.
 * Blue Ridge Mountain sunset celebration scene: watercolor textures, organic paths, warm palette.
 * @module thankYouIllustrations
 */
import { colors } from 'public/sharedTokens.js';

export const THANK_YOU_SLUGS = ['celebration'];

const {
  sandBase, sandLight, sandDark,
  espresso, espressoLight,
  mountainBlue, mountainBlueDark, mountainBlueLight,
  sunsetCoral, sunsetCoralDark, sunsetCoralLight,
  offWhite, white,
  skyGradientTop, skyGradientBottom,
  success, mutedBrown,
} = colors;

/**
 * Celebration SVG — Blue Ridge sunset with warm cabin, post-purchase celebration.
 * Golden hour palette, cabin glow, chimney smoke, birds, fireflies, delivery package.
 * @returns {string} SVG markup
 */
function celebrationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-celebration">
  <title id="title-celebration">Post-purchase celebration — a warm cabin with glowing windows beneath a Blue Ridge sunset sky, chimney smoke rising, birds in flight, fireflies emerging at twilight</title>
  <defs>
    <filter id="watercolor-celebration">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="4"/>
    </filter>
    <filter id="paperGrain-celebration">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="celebration-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="15%" stop-color="${mountainBlueLight}"/>
      <stop offset="35%" stop-color="${sandLight}"/>
      <stop offset="55%" stop-color="${sunsetCoralLight}"/>
      <stop offset="72%" stop-color="${sunsetCoral}"/>
      <stop offset="88%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="cabin-glow" cx="50%" cy="72%" r="30%">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0.85"/>
      <stop offset="35%" stop-color="${sunsetCoralLight}" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="${skyGradientBottom}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandBase}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="celebration-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="60%" stop-color="${sandDark}"/>
      <stop offset="100%" stop-color="${espressoLight}"/>
    </linearGradient>
  </defs>
  <g filter="url(#paperGrain-celebration)">
    <g id="background">
      <!-- Sky -->
      <rect x="0" y="0" width="800" height="500" fill="url(#celebration-sky)" filter="url(#watercolor-celebration)"/>
      <!-- Cabin glow overlay -->
      <rect x="0" y="0" width="800" height="500" fill="url(#cabin-glow)" opacity="0.6"/>

      <!-- Clouds (wispy ellipse groups) -->
      <ellipse cx="160" cy="65" rx="65" ry="18" fill="${offWhite}" opacity="0.45"/>
      <ellipse cx="190" cy="60" rx="45" ry="14" fill="${white}" opacity="0.3"/>
      <ellipse cx="620" cy="85" rx="55" ry="16" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="650" cy="80" rx="40" ry="12" fill="${sandLight}" opacity="0.3"/>

      <!-- Far ridgeline layer 1 (most distant — lightest) -->
      <path d="M0 230 Q35 205 80 215 Q125 195 170 210 Q220 190 265 205 Q315 185 360 200 Q410 180 455 195 Q505 178 550 192 Q600 175 650 190 Q700 172 745 188 Q790 178 800 185 L800 280 L0 280Z" fill="${mountainBlueLight}" opacity="0.2" filter="url(#watercolor-celebration)"/>

      <!-- Far ridgeline layer 2 -->
      <path d="M0 248 Q45 222 95 235 Q145 215 195 228 Q248 210 298 225 Q350 205 400 220 Q455 200 505 218 Q558 198 608 215 Q660 195 710 212 Q758 200 800 208 L800 295 L0 295Z" fill="${mountainBlue}" opacity="0.25" filter="url(#watercolor-celebration)"/>

      <!-- Far ridgeline layer 3 -->
      <path d="M0 268 Q55 240 110 255 Q165 232 220 248 Q278 228 335 245 Q392 225 445 242 Q502 222 558 240 Q615 220 670 238 Q728 218 780 235 Q800 228 800 310 L0 310Z" fill="${mountainBlueDark}" opacity="0.3" filter="url(#watercolor-celebration)"/>

      <!-- Birds (V-shapes in sky) -->
      <line x1="220" y1="100" x2="230" y2="92" stroke="${espresso}" stroke-width="1.5" opacity="0.3" class="bird-1"/>
      <line x1="230" y1="92" x2="240" y2="100" stroke="${espresso}" stroke-width="1.5" opacity="0.3" class="bird-1"/>
      <line x1="380" y1="75" x2="388" y2="68" stroke="${espresso}" stroke-width="1.2" opacity="0.25" class="bird-2"/>
      <line x1="388" y1="68" x2="396" y2="75" stroke="${espresso}" stroke-width="1.2" opacity="0.25" class="bird-2"/>
      <line x1="520" y1="110" x2="527" y2="104" stroke="${espresso}" stroke-width="1" opacity="0.22" class="bird-3"/>
      <line x1="527" y1="104" x2="534" y2="110" stroke="${espresso}" stroke-width="1" opacity="0.22" class="bird-3"/>
      <line x1="680" y1="55" x2="686" y2="49" stroke="${espresso}" stroke-width="1" opacity="0.2" class="bird-4"/>
      <line x1="686" y1="49" x2="692" y2="55" stroke="${espresso}" stroke-width="1" opacity="0.2" class="bird-4"/>
    </g>
    <g id="midground" opacity="0.7">
      <!-- Mid ridgeline layer 4 -->
      <path d="M0 295 Q60 265 125 280 Q190 255 255 272 Q325 248 390 268 Q455 245 520 265 Q585 242 650 262 Q718 240 780 258 Q800 252 800 330 L0 330Z" fill="${mountainBlueDark}" opacity="0.4" filter="url(#watercolor-celebration)"/>

      <!-- Mid ridgeline layer 5 (with haze) -->
      <path d="M0 315 Q70 288 140 302 Q215 278 285 296 Q358 272 430 292 Q505 268 575 288 Q648 265 720 285 Q788 268 800 275 L800 355 L0 355Z" fill="${espressoLight}" opacity="0.25" filter="url(#watercolor-celebration)"/>

      <!-- Pine tree cluster left -->
      <path d="M80 340 L90 308 L94 306 L100 310 L108 340Z" fill="${success}" opacity="0.4"/>
      <path d="M92 335 L98 315 L102 313 L106 317 L112 335Z" fill="${success}" opacity="0.35"/>
      <path d="M105 338 L112 312 L116 310 L120 314 L126 338Z" fill="${success}" opacity="0.3"/>

      <!-- Pine tree cluster center-right -->
      <path d="M600 335 L608 305 L612 303 L616 307 L624 335Z" fill="${success}" opacity="0.38"/>
      <path d="M615 340 L622 312 L626 310 L630 314 L636 340Z" fill="${success}" opacity="0.32"/>

      <!-- Pine tree cluster far right -->
      <path d="M720 332 L726 310 L730 308 L734 312 L740 332Z" fill="${success}" opacity="0.35"/>
      <path d="M735 336 L740 315 L744 313 L748 317 L752 336Z" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <!-- Near ridgeline layer 6 -->
      <path d="M0 350 Q80 328 160 342 Q245 322 330 338 Q415 318 500 335 Q585 316 670 332 Q755 315 800 325 L800 380 L0 380Z" fill="${espressoLight}" opacity="0.35" filter="url(#watercolor-celebration)"/>

      <!-- Ground -->
      <path d="M0 375 Q100 360 200 368 Q350 352 500 362 Q650 348 800 358 L800 500 L0 500Z" fill="url(#celebration-ground)" filter="url(#watercolor-celebration)"/>

      <!-- Winding trail from foreground to cabin -->
      <path d="M350 490 Q360 470 380 450 Q395 430 400 410 Q405 400 400 392" stroke="${sandDark}" stroke-width="3" fill="none" opacity="0.4" stroke-linecap="round"/>

      <!-- Cabin — walls -->
      <rect x="370" y="355" width="60" height="40" fill="${espressoLight}" opacity="0.85" filter="url(#watercolor-celebration)"/>
      <!-- Cabin — peaked roof -->
      <path d="M362 358 L400 328 L438 358Z" fill="${espresso}" opacity="0.8"/>
      <!-- Cabin — chimney -->
      <rect x="418" y="325" width="8" height="18" fill="${espresso}" opacity="0.75"/>
      <!-- Cabin — door -->
      <rect x="392" y="375" width="16" height="20" rx="2" fill="${sunsetCoralLight}" opacity="0.85"/>
      <!-- Cabin — left window with glow -->
      <rect x="376" y="365" width="10" height="8" rx="1" fill="${offWhite}" opacity="0.9"/>
      <!-- Cabin — right window with glow -->
      <rect x="414" y="365" width="10" height="8" rx="1" fill="${offWhite}" opacity="0.9"/>

      <!-- Chimney smoke (organic curling paths) -->
      <path d="M422 325 Q420 315 424 305 Q428 295 422 285 Q418 275 422 268" stroke="${sandLight}" stroke-width="2.5" fill="none" opacity="0.35" stroke-linecap="round" class="smoke-1"/>
      <path d="M424 322 Q428 310 424 298 Q420 288 425 278 Q430 270 426 262" stroke="${offWhite}" stroke-width="2" fill="none" opacity="0.25" stroke-linecap="round" class="smoke-2"/>

      <!-- Package on porch -->
      <rect x="410" y="387" width="12" height="8" rx="1" fill="${sandBase}" opacity="0.8"/>
      <path d="M410 391 L422 391 M416 387 L416 395" stroke="${sunsetCoral}" stroke-width="1" opacity="0.7"/>

      <!-- Wildflowers at base -->
      <circle cx="280" cy="420" r="3" fill="${sunsetCoral}" opacity="0.55"/>
      <path d="M278 430 L280 415 L282 430" stroke="${success}" stroke-width="1" fill="none" opacity="0.45"/>
      <circle cx="320" cy="430" r="2.5" fill="${sunsetCoralLight}" opacity="0.5"/>
      <path d="M318 440 L320 425 L322 440" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <circle cx="490" cy="418" r="2.5" fill="${mountainBlueLight}" opacity="0.5"/>
      <path d="M488 428 L490 413 L492 428" stroke="${success}" stroke-width="1" fill="none" opacity="0.4"/>
      <circle cx="530" cy="425" r="3" fill="${sunsetCoralLight}" opacity="0.45"/>
      <path d="M528 435 L530 420 L532 435" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.35"/>

      <!-- Fireflies (small warm circles with low opacity) -->
      <circle cx="340" cy="380" r="2" fill="${skyGradientBottom}" opacity="0.5"/>
      <circle cx="460" cy="370" r="1.8" fill="${offWhite}" opacity="0.45"/>
      <circle cx="300" cy="395" r="1.5" fill="${skyGradientBottom}" opacity="0.4"/>

      <!-- Bottom edge -->
      <path d="M0 460 Q200 445 400 452 Q600 440 800 448 L800 500 L0 500Z" fill="${espressoLight}" opacity="0.3"/>
    </g>
  </g>
</svg>`;
}

const SVG_MAP = { celebration: celebrationSvg };

/**
 * Get the SVG illustration string for a Thank You page scene.
 * @param {string} slug - Scene slug (celebration).
 * @returns {string|null} SVG markup string or null if slug is invalid.
 */
export function getThankYouSvg(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const fn = SVG_MAP[slug];
  return fn ? fn() : null;
}

/**
 * Convert an SVG string to an inline data URI for use in image src attributes.
 * @param {string} svgString - Raw SVG markup.
 * @returns {string} Data URI string, or empty string if input is falsy.
 */
export function svgToDataUri(svgString) {
  if (!svgString) return '';
  return 'data:image/svg+xml,' + encodeURIComponent(svgString);
}
