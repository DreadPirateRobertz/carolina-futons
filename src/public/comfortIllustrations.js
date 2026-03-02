/**
 * comfortIllustrations.js — Hand-drawn SVG illustrations for comfort levels.
 * Blue Ridge Mountain aesthetic: watercolor textures, organic paths, warm palette.
 * @module comfortIllustrations
 */
import { colors } from 'public/sharedTokens.js';

export const COMFORT_SLUGS = ['plush', 'medium', 'firm'];

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
 * Plush comfort SVG — cloud-soft, sinking comfort.
 * Warm sunset sky, gentle mountains, figure sinking into clouds.
 * @returns {string} SVG markup
 */
function plushSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-plush">
  <title id="title-plush">Plush comfort illustration — a figure reclining into a cloud-soft cushion beneath a warm sunset sky over gentle Blue Ridge mountains</title>
  <defs>
    <filter id="watercolor-plush">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
    </filter>
    <filter id="paperGrain-plush">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="plush-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="25%" stop-color="${mountainBlueLight}"/>
      <stop offset="50%" stop-color="${sandLight}"/>
      <stop offset="75%" stop-color="${sunsetCoralLight}"/>
      <stop offset="90%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="plush-cloud-glow" cx="50%" cy="60%" r="40%">
      <stop offset="0%" stop-color="${offWhite}" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="${sandLight}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${sunsetCoralLight}" stop-opacity="0.1"/>
    </radialGradient>
    <linearGradient id="plush-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
  </defs>
  <g filter="url(#paperGrain-plush)">
    <g id="background">
      <rect x="0" y="0" width="800" height="500" fill="url(#plush-sky)" filter="url(#watercolor-plush)"/>
      <ellipse cx="650" cy="80" rx="55" ry="22" fill="${offWhite}" opacity="0.5"/>
      <ellipse cx="680" cy="75" rx="40" ry="18" fill="${sandLight}" opacity="0.4"/>
      <ellipse cx="180" cy="110" rx="60" ry="20" fill="${offWhite}" opacity="0.45"/>
      <ellipse cx="210" cy="105" rx="45" ry="16" fill="${white}" opacity="0.3"/>
      <path d="M720 60 Q730 52 740 58 Q748 50 758 56 Q762 48 772 55 Q765 62 758 60 Q750 66 742 62 Q735 68 725 63Z" fill="${offWhite}" opacity="0.55"/>
      <line x1="200" y1="55" x2="210" y2="50" stroke="${espresso}" stroke-width="1.5" opacity="0.3"/>
      <line x1="210" y1="50" x2="220" y2="56" stroke="${espresso}" stroke-width="1.5" opacity="0.3"/>
      <line x1="350" y1="40" x2="358" y2="34" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <line x1="358" y1="34" x2="366" y2="40" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <line x1="550" y1="70" x2="557" y2="64" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="557" y1="64" x2="564" y2="70" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path d="M0 320 Q50 260 120 280 Q180 240 250 270 Q310 230 380 260 Q440 220 500 250 Q560 210 630 240 Q700 200 770 230 Q800 220 800 240 L800 380 L0 380Z" fill="${mountainBlue}" opacity="0.35" filter="url(#watercolor-plush)"/>
      <path d="M0 340 Q80 290 160 310 Q220 270 300 300 Q380 260 460 290 Q520 250 600 280 Q680 240 760 270 Q800 260 800 270 L800 400 L0 400Z" fill="${mountainBlueDark}" opacity="0.25" filter="url(#watercolor-plush)"/>
      <path d="M60 370 L68 340 L72 338 L78 342 L84 370Z" fill="${success}" opacity="0.35"/>
      <path d="M140 365 L147 338 L150 336 L155 340 L160 365Z" fill="${success}" opacity="0.3"/>
      <path d="M680 360 L686 335 L690 333 L694 337 L700 360Z" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 400 Q100 385 200 392 Q350 378 500 388 Q650 375 800 385 L800 500 L0 500Z" fill="url(#plush-ground)" filter="url(#watercolor-plush)"/>
      <ellipse cx="400" cy="395" rx="140" ry="35" fill="${offWhite}" opacity="0.85" filter="url(#watercolor-plush)"/>
      <ellipse cx="380" cy="390" rx="120" ry="28" fill="${sandLight}" opacity="0.7"/>
      <ellipse cx="420" cy="392" rx="100" ry="22" fill="${white}" opacity="0.5"/>
      <path d="M370 370 Q375 350 385 345 Q390 340 395 345 Q400 340 405 345 Q410 342 412 348 Q418 360 415 375 Q410 380 400 382 Q390 385 380 380Z" fill="${sunsetCoralLight}" opacity="0.7"/>
      <ellipse cx="390" cy="358" rx="12" ry="8" fill="${sunsetCoral}" opacity="0.5"/>
      <circle cx="388" cy="348" r="3" fill="${espresso}" opacity="0.6"/>
      <path d="M372 375 Q365 378 360 382 Q355 390 358 395 Q350 385 352 378 Q356 372 365 370Z" fill="${sunsetCoralLight}" opacity="0.5"/>
      <path d="M412 372 Q420 375 425 380 Q430 388 428 395 Q432 384 430 376 Q426 370 418 368Z" fill="${sunsetCoralLight}" opacity="0.5"/>
      <circle cx="250" cy="430" r="3" fill="${sunsetCoral}" opacity="0.6"/>
      <path d="M248 440 L250 425 L252 440" stroke="${success}" stroke-width="1" fill="none" opacity="0.5"/>
      <circle cx="520" cy="435" r="2.5" fill="${sunsetCoralLight}" opacity="0.5"/>
      <path d="M518 445 L520 430 L522 445" stroke="${success}" stroke-width="1" fill="none" opacity="0.5"/>
      <circle cx="320" cy="445" r="2" fill="${mountainBlueLight}" opacity="0.5"/>
      <path d="M318 455 L320 442 L322 455" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <path d="M0 460 Q200 445 400 452 Q600 440 800 448 L800 500 L0 500Z" fill="${sandDark}" opacity="0.3"/>
    </g>
  </g>
</svg>`;
}

/**
 * Medium comfort SVG — balanced, even support.
 * Balanced ridgeline, sunrise sky, seated figure on even cushion.
 * @returns {string} SVG markup
 */
function mediumSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-medium">
  <title id="title-medium">Medium comfort illustration — a seated figure on a balanced cushion with even mountain peaks and a sunrise sky</title>
  <defs>
    <filter id="watercolor-medium">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
    </filter>
    <filter id="paperGrain-medium">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="medium-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="20%" stop-color="${mountainBlueLight}"/>
      <stop offset="45%" stop-color="${sandBase}"/>
      <stop offset="65%" stop-color="${sunsetCoralLight}"/>
      <stop offset="85%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="medium-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
    <linearGradient id="medium-cushion" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandLight}"/>
      <stop offset="50%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
  </defs>
  <g filter="url(#paperGrain-medium)">
    <g id="background">
      <rect x="0" y="0" width="800" height="500" fill="url(#medium-sky)" filter="url(#watercolor-medium)"/>
      <ellipse cx="400" cy="95" rx="70" ry="22" fill="${offWhite}" opacity="0.45"/>
      <ellipse cx="430" cy="90" rx="50" ry="18" fill="${white}" opacity="0.3"/>
      <ellipse cx="150" cy="130" rx="55" ry="18" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="650" cy="115" rx="60" ry="20" fill="${sandLight}" opacity="0.35"/>
      <line x1="250" y1="60" x2="258" y2="54" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <line x1="258" y1="54" x2="266" y2="60" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <line x1="500" y1="45" x2="507" y2="39" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="507" y1="39" x2="514" y2="45" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="680" y1="75" x2="686" y2="70" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="686" y1="70" x2="692" y2="75" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.75">
      <path d="M0 310 Q60 250 130 280 Q180 240 240 260 Q300 220 370 250 Q430 220 470 240 Q530 210 590 240 Q650 220 710 250 Q770 230 800 245 L800 380 L0 380Z" fill="${mountainBlue}" opacity="0.4" filter="url(#watercolor-medium)"/>
      <path d="M0 340 Q70 290 150 310 Q220 275 300 300 Q370 270 430 285 Q500 260 570 280 Q640 255 720 275 Q780 260 800 270 L800 400 L0 400Z" fill="${mountainBlueDark}" opacity="0.25" filter="url(#watercolor-medium)"/>
      <path d="M100 370 L108 342 L112 340 L116 344 L122 370Z" fill="${success}" opacity="0.35"/>
      <path d="M160 368 L166 345 L170 343 L174 347 L180 368Z" fill="${success}" opacity="0.3"/>
      <path d="M630 365 L636 340 L640 338 L644 342 L650 365Z" fill="${success}" opacity="0.35"/>
      <path d="M700 370 L706 348 L710 346 L714 350 L720 370Z" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 395 Q100 382 200 388 Q350 375 500 385 Q650 372 800 380 L800 500 L0 500Z" fill="url(#medium-ground)" filter="url(#watercolor-medium)"/>
      <rect x="340" y="380" width="120" height="18" rx="4" ry="4" fill="url(#medium-cushion)" opacity="0.85" filter="url(#watercolor-medium)"/>
      <path d="M345 382 Q400 375 455 382" stroke="${sandDark}" stroke-width="1" fill="none" opacity="0.5"/>
      <path d="M390 375 Q393 350 397 340 Q400 330 403 340 Q407 350 410 375" fill="${mountainBlue}" opacity="0.5"/>
      <ellipse cx="400" cy="335" rx="10" ry="12" fill="${sunsetCoralLight}" opacity="0.7"/>
      <circle cx="398" cy="332" r="2.5" fill="${espresso}" opacity="0.5"/>
      <path d="M388 345 Q380 355 375 365 Q372 370 375 375" stroke="${sunsetCoralLight}" stroke-width="2.5" fill="none" opacity="0.5"/>
      <path d="M412 345 Q420 355 425 365 Q428 370 425 375" stroke="${sunsetCoralLight}" stroke-width="2.5" fill="none" opacity="0.5"/>
      <path d="M385 375 Q382 382 380 388" stroke="${mountainBlue}" stroke-width="2" fill="none" opacity="0.4"/>
      <path d="M415 375 Q418 382 420 388" stroke="${mountainBlue}" stroke-width="2" fill="none" opacity="0.4"/>
      <circle cx="280" cy="425" r="2.5" fill="${sunsetCoral}" opacity="0.5"/>
      <path d="M278 435 L280 420 L282 435" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <circle cx="530" cy="420" r="3" fill="${mountainBlueLight}" opacity="0.5"/>
      <path d="M528 430 L530 415 L532 430" stroke="${success}" stroke-width="1" fill="none" opacity="0.45"/>
      <circle cx="450" cy="440" r="2" fill="${sunsetCoralLight}" opacity="0.45"/>
      <path d="M448 450 L450 437 L452 450" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.35"/>
      <path d="M0 455 Q200 442 400 448 Q600 438 800 445 L800 500 L0 500Z" fill="${sandDark}" opacity="0.3"/>
    </g>
  </g>
</svg>`;
}

/**
 * Firm comfort SVG — structured, upright support.
 * Angular peaks, structured sky, upright figure on flat surface.
 * @returns {string} SVG markup
 */
function firmSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-firm">
  <title id="title-firm">Firm comfort illustration — an upright figure on a structured surface beneath angular mountain peaks and a clear sky</title>
  <defs>
    <filter id="watercolor-firm">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
    </filter>
    <filter id="paperGrain-firm">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="firm-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="22%" stop-color="${mountainBlue}"/>
      <stop offset="48%" stop-color="${sandBase}"/>
      <stop offset="72%" stop-color="${sandDark}"/>
      <stop offset="90%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="firm-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandDark}"/>
      <stop offset="100%" stop-color="${espressoLight}"/>
    </linearGradient>
    <linearGradient id="firm-platform" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${espressoLight}"/>
      <stop offset="100%" stop-color="${espresso}"/>
    </linearGradient>
  </defs>
  <g filter="url(#paperGrain-firm)">
    <g id="background">
      <rect x="0" y="0" width="800" height="500" fill="url(#firm-sky)" filter="url(#watercolor-firm)"/>
      <ellipse cx="550" cy="100" rx="50" ry="16" fill="${offWhite}" opacity="0.3"/>
      <ellipse cx="200" cy="120" rx="45" ry="14" fill="${sandLight}" opacity="0.25"/>
      <line x1="300" y1="55" x2="308" y2="48" stroke="${espresso}" stroke-width="1.3" opacity="0.3"/>
      <line x1="308" y1="48" x2="316" y2="55" stroke="${espresso}" stroke-width="1.3" opacity="0.3"/>
      <line x1="600" y1="65" x2="607" y2="58" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
      <line x1="607" y1="58" x2="614" y2="65" stroke="${espresso}" stroke-width="1" opacity="0.25"/>
    </g>
    <g id="midground" opacity="0.8">
      <path d="M0 350 Q40 270 100 260 Q140 240 200 220 Q240 250 280 260 Q330 210 400 230 Q450 200 500 215 Q560 230 620 240 Q680 210 740 230 Q780 240 800 260 L800 400 L0 400Z" fill="${mountainBlueDark}" opacity="0.45" filter="url(#watercolor-firm)"/>
      <path d="M0 370 Q50 300 120 290 Q170 270 230 260 Q280 285 330 290 Q390 250 450 270 Q510 250 570 260 Q630 240 700 255 Q760 245 800 265 L800 420 L0 420Z" fill="${espresso}" opacity="0.2" filter="url(#watercolor-firm)"/>
      <polygon points="80,375 90,348 96,346 102,350 110,375" fill="${success}" opacity="0.4"/>
      <polygon points="150,372 158,350 162,348 166,352 174,372" fill="${success}" opacity="0.35"/>
      <polygon points="620,368 628,342 632,340 636,344 644,368" fill="${success}" opacity="0.4"/>
      <polygon points="710,372 716,352 720,350 724,354 730,372" fill="${success}" opacity="0.35"/>
      <polygon points="260,370 266,355 270,353 274,357 280,370" fill="${success}" opacity="0.3"/>
    </g>
    <g id="foreground">
      <path d="M0 400 Q200 388 400 394 Q600 385 800 392 L800 500 L0 500Z" fill="url(#firm-ground)" filter="url(#watercolor-firm)"/>
      <rect x="350" y="378" width="100" height="12" rx="2" ry="2" fill="url(#firm-platform)" opacity="0.9"/>
      <line x1="350" y1="378" x2="450" y2="378" stroke="${espresso}" stroke-width="1.5" opacity="0.6"/>
      <rect x="395" y="330" width="10" height="48" rx="2" ry="2" fill="${mountainBlue}" opacity="0.55"/>
      <ellipse cx="400" cy="322" rx="9" ry="11" fill="${sunsetCoralLight}" opacity="0.7"/>
      <circle cx="399" cy="319" r="2.5" fill="${espresso}" opacity="0.55"/>
      <path d="M392 335 Q385 342 380 350 Q378 356 380 360" stroke="${mountainBlue}" stroke-width="2.5" fill="none" opacity="0.45"/>
      <path d="M408 335 Q415 342 420 350 Q422 356 420 360" stroke="${mountainBlue}" stroke-width="2.5" fill="none" opacity="0.45"/>
      <line x1="398" y1="378" x2="392" y2="400" stroke="${espresso}" stroke-width="2" opacity="0.4"/>
      <line x1="402" y1="378" x2="408" y2="400" stroke="${espresso}" stroke-width="2" opacity="0.4"/>
      <circle cx="300" cy="425" r="2" fill="${sunsetCoral}" opacity="0.45"/>
      <path d="M298 434 L300 420 L302 434" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.4"/>
      <circle cx="510" cy="420" r="2.5" fill="${mountainBlueLight}" opacity="0.4"/>
      <path d="M508 430 L510 416 L512 430" stroke="${success}" stroke-width="0.8" fill="none" opacity="0.35"/>
      <path d="M0 460 Q200 448 400 454 Q600 445 800 452 L800 500 L0 500Z" fill="${espressoLight}" opacity="0.25"/>
    </g>
  </g>
</svg>`;
}

const SVG_MAP = { plush: plushSvg, medium: mediumSvg, firm: firmSvg };

/**
 * Get the SVG illustration string for a comfort level.
 * @param {string} slug - Comfort level slug (plush, medium, firm).
 * @returns {string|null} SVG markup string or null if slug is invalid.
 */
export function getComfortSvg(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const fn = SVG_MAP[slug];
  return fn ? fn() : null;
}
