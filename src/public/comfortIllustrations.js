/**
 * comfortIllustrations.js — Hand-drawn SVG illustrations for comfort levels.
 * Blue Ridge Mountain aesthetic: watercolor textures, organic paths, warm palette.
 * Each scene has 6+ mountain layers with atmospheric haze, cabin details,
 * pine trees, wildflowers, birds, and a comfort-specific mattress vignette.
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
 * Shared filter defs used by all three illustrations.
 * @param {string} prefix - Unique prefix to namespace filter IDs.
 * @returns {string} SVG filter definitions.
 */
function sharedFilters(prefix) {
  return `
    <filter id="wc-${prefix}">
      <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="4"/>
    </filter>
    <filter id="pg-${prefix}">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <filter id="haze-${prefix}">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>`;
}

/**
 * Bird V-shapes scattered across the sky.
 * @param {Array<{x:number,y:number,s:number,o:number}>} birds - Position, scale, opacity.
 * @returns {string} SVG path elements.
 */
function drawBirds(birds) {
  return birds.map(({ x, y, s, o }) =>
    `<path d="M${x - 6 * s} ${y + 3 * s} Q${x - 2 * s} ${y - 3 * s} ${x} ${y} Q${x + 2 * s} ${y - 3 * s} ${x + 6 * s} ${y + 3 * s}" stroke="${espresso}" stroke-width="${1.2 * s}" fill="none" opacity="${o}"/>`
  ).join('\n    ');
}

/**
 * Evergreen pine tree silhouette.
 * @param {number} cx - Center x.
 * @param {number} base - Base y.
 * @param {number} h - Height.
 * @param {number} o - Opacity.
 * @returns {string} SVG path element.
 */
function pineTree(cx, base, h, o) {
  const top = base - h;
  const w = h * 0.35;
  return `<path d="M${cx} ${top} ` +
    `L${cx + w * 0.4} ${top + h * 0.35} L${cx + w * 0.2} ${top + h * 0.3} ` +
    `L${cx + w * 0.6} ${top + h * 0.55} L${cx + w * 0.3} ${top + h * 0.5} ` +
    `L${cx + w * 0.7} ${top + h * 0.8} L${cx + w * 0.15} ${top + h * 0.75} ` +
    `L${cx + w * 0.2} ${base} L${cx - w * 0.2} ${base} L${cx - w * 0.15} ${top + h * 0.75} ` +
    `L${cx - w * 0.7} ${top + h * 0.8} L${cx - w * 0.3} ${top + h * 0.5} ` +
    `L${cx - w * 0.6} ${top + h * 0.55} L${cx - w * 0.2} ${top + h * 0.3} ` +
    `L${cx - w * 0.4} ${top + h * 0.35}Z" fill="${success}" opacity="${o}"/>`;
}

/**
 * Small wildflower cluster.
 * @param {number} x - Center x.
 * @param {number} y - Ground y.
 * @param {string} petalColor - Petal fill color.
 * @param {number} o - Opacity.
 * @returns {string} SVG elements.
 */
function wildflower(x, y, petalColor, o) {
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 12}" stroke="${success}" stroke-width="1" opacity="${o * 0.7}"/>
    <circle cx="${x}" cy="${y - 13}" r="3" fill="${petalColor}" opacity="${o}"/>
    <circle cx="${x}" cy="${y - 13}" r="1.2" fill="${sandLight}" opacity="${o * 0.8}"/>`;
}

/**
 * Cabin with chimney smoke.
 * @param {number} x - Left x.
 * @param {number} y - Base y.
 * @param {number} s - Scale factor.
 * @returns {string} SVG elements.
 */
function cabin(x, y, s) {
  const w = 40 * s;
  const h = 25 * s;
  const roofH = 18 * s;
  return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${espressoLight}" opacity="0.6"/>
    <path d="M${x - 4 * s} ${y - h} L${x + w / 2} ${y - h - roofH} L${x + w + 4 * s} ${y - h}" fill="${espresso}" opacity="0.5"/>
    <rect x="${x + w * 0.35}" y="${y - h * 0.7}" width="${w * 0.2}" height="${h * 0.45}" fill="${skyGradientBottom}" opacity="0.5"/>
    <rect x="${x + w * 0.75}" y="${y - h - roofH * 0.6}" width="${4 * s}" height="${roofH * 0.8}" fill="${espresso}" opacity="0.45"/>
    <path d="M${x + w * 0.77 + 2 * s} ${y - h - roofH * 0.6} Q${x + w * 0.77 - 2 * s} ${y - h - roofH * 0.6 - 12 * s} ${x + w * 0.77 + 5 * s} ${y - h - roofH * 0.6 - 20 * s} Q${x + w * 0.77 - 1 * s} ${y - h - roofH * 0.6 - 28 * s} ${x + w * 0.77 + 8 * s} ${y - h - roofH * 0.6 - 35 * s}" stroke="${sandLight}" stroke-width="${1.5 * s}" fill="none" opacity="0.35"/>`;
}

/**
 * Plush comfort SVG — cloud-soft, sinking comfort.
 * Warm sunset sky with 6 rolling mountain layers, figure sinking into billowing clouds.
 * @returns {string} SVG markup
 */
function plushSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-plush">
  <title id="title-plush">Plush comfort illustration — a figure reclining into a cloud-soft cushion beneath a warm sunset sky over gentle Blue Ridge mountains</title>
  <defs>
    ${sharedFilters('plush')}
    <linearGradient id="plush-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="18%" stop-color="${mountainBlueLight}"/>
      <stop offset="38%" stop-color="${sandLight}"/>
      <stop offset="55%" stop-color="${sunsetCoralLight}"/>
      <stop offset="72%" stop-color="${sunsetCoral}"/>
      <stop offset="88%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="plush-glow" cx="50%" cy="55%" r="45%">
      <stop offset="0%" stop-color="${sunsetCoralLight}" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="${sandLight}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${offWhite}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="plush-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="50%" stop-color="${sandLight}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-plush)">
    <g id="background">
      <rect x="0" y="0" width="800" height="500" fill="url(#plush-sky)" filter="url(#wc-plush)"/>
      <rect x="0" y="0" width="800" height="500" fill="url(#plush-glow)"/>
      <ellipse cx="620" cy="75" rx="65" ry="22" fill="${offWhite}" opacity="0.45"/>
      <ellipse cx="660" cy="68" rx="45" ry="16" fill="${sandLight}" opacity="0.35"/>
      <ellipse cx="160" cy="95" rx="55" ry="18" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="195" cy="88" rx="38" ry="14" fill="${white}" opacity="0.25"/>
      <ellipse cx="420" cy="60" rx="40" ry="12" fill="${offWhite}" opacity="0.3"/>
      <path d="M700 55 Q712 45 722 52 Q730 42 742 50 Q746 40 758 48 Q752 56 744 52 Q736 58 728 54 Q720 60 710 56Z" fill="${white}" opacity="0.4"/>
      ${drawBirds([
        { x: 180, y: 50, s: 1.0, o: 0.3 },
        { x: 220, y: 42, s: 0.8, o: 0.25 },
        { x: 550, y: 55, s: 0.9, o: 0.22 },
        { x: 590, y: 48, s: 0.7, o: 0.2 },
        { x: 380, y: 35, s: 0.6, o: 0.18 },
      ])}
    </g>
    <g id="midground">
      <path d="M0 310 Q40 275 90 285 Q130 260 180 272 Q230 248 290 262 Q350 238 410 255 Q470 232 530 248 Q590 225 650 242 Q710 220 760 235 Q800 228 800 240 L800 340 L0 340Z" fill="${mountainBlueLight}" opacity="0.2" filter="url(#haze-plush)"/>
      <path d="M0 325 Q55 280 120 295 Q175 260 240 278 Q300 245 370 265 Q430 235 490 252 Q550 228 620 248 Q680 225 740 240 Q790 232 800 245 L800 360 L0 360Z" fill="${mountainBlue}" opacity="0.28" filter="url(#wc-plush)"/>
      <path d="M0 345 Q70 300 150 318 Q210 280 280 298 Q350 265 420 285 Q480 258 540 275 Q610 250 680 268 Q740 248 800 262 L800 380 L0 380Z" fill="${mountainBlue}" opacity="0.35" filter="url(#wc-plush)"/>
      <path d="M0 360 Q80 320 170 335 Q240 300 320 318 Q390 288 460 305 Q530 278 600 295 Q670 270 750 288 Q800 278 800 290 L800 400 L0 400Z" fill="${mountainBlueDark}" opacity="0.3" filter="url(#wc-plush)"/>
      <path d="M0 375 Q90 345 180 355 Q260 328 340 342 Q410 315 480 330 Q550 310 630 325 Q700 305 780 318 Q800 312 800 320 L800 410 L0 410Z" fill="${mountainBlueDark}" opacity="0.22" filter="url(#wc-plush)"/>
      <path d="M0 388 Q100 365 200 372 Q300 350 400 360 Q500 342 600 352 Q700 338 800 348 L800 420 L0 420Z" fill="${espressoLight}" opacity="0.15" filter="url(#wc-plush)"/>
      ${pineTree(65, 395, 38, 0.35)}
      ${pineTree(130, 390, 32, 0.3)}
      ${pineTree(700, 388, 35, 0.32)}
      ${pineTree(745, 392, 28, 0.28)}
      ${cabin(580, 385, 0.7)}
    </g>
    <g id="foreground">
      <path d="M0 410 Q100 395 200 400 Q350 388 500 395 Q650 382 800 390 L800 500 L0 500Z" fill="url(#plush-ground)" filter="url(#wc-plush)"/>
      <ellipse cx="400" cy="405" rx="150" ry="42" fill="${offWhite}" opacity="0.8" filter="url(#wc-plush)"/>
      <ellipse cx="390" cy="400" rx="130" ry="34" fill="${sandLight}" opacity="0.7"/>
      <ellipse cx="410" cy="402" rx="110" ry="26" fill="${white}" opacity="0.5"/>
      <ellipse cx="395" cy="398" rx="85" ry="18" fill="${offWhite}" opacity="0.6"/>
      <path d="M368 378 Q374 356 382 348 Q388 340 395 346 Q400 338 405 346 Q412 340 418 348 Q426 356 432 378 Q425 384 400 388 Q375 384 368 378Z" fill="${sunsetCoralLight}" opacity="0.65"/>
      <ellipse cx="400" cy="365" rx="15" ry="10" fill="${sunsetCoral}" opacity="0.45"/>
      <circle cx="397" cy="354" r="3.5" fill="${espresso}" opacity="0.5"/>
      <path d="M385 350 Q378 348 372 352" stroke="${sunsetCoralLight}" stroke-width="2" fill="none" opacity="0.4"/>
      <path d="M415 350 Q422 348 428 352" stroke="${sunsetCoralLight}" stroke-width="2" fill="none" opacity="0.4"/>
      <path d="M375 380 Q365 386 358 395 Q352 405 356 412" fill="${sunsetCoralLight}" opacity="0.4"/>
      <path d="M425 380 Q435 386 442 395 Q448 405 444 412" fill="${sunsetCoralLight}" opacity="0.4"/>
      ${wildflower(240, 435, sunsetCoral, 0.55)}
      ${wildflower(260, 438, mountainBlueLight, 0.5)}
      ${wildflower(520, 432, sunsetCoralLight, 0.5)}
      ${wildflower(545, 436, sunsetCoral, 0.45)}
      ${wildflower(330, 445, mountainBlueLight, 0.4)}
      ${wildflower(480, 440, sunsetCoralLight, 0.42)}
      <path d="M0 465 Q200 452 400 458 Q600 448 800 455 L800 500 L0 500Z" fill="${sandDark}" opacity="0.25"/>
    </g>
  </g>
</svg>`;
}

/**
 * Medium comfort SVG — balanced, even support.
 * Sunrise sky with 6 balanced ridgelines, figure seated on even cushion.
 * @returns {string} SVG markup
 */
function mediumSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-medium">
  <title id="title-medium">Medium comfort illustration — a seated figure on a balanced cushion with even mountain peaks and a sunrise sky</title>
  <defs>
    ${sharedFilters('medium')}
    <linearGradient id="medium-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="15%" stop-color="${mountainBlueLight}"/>
      <stop offset="35%" stop-color="${sandBase}"/>
      <stop offset="52%" stop-color="${sandLight}"/>
      <stop offset="70%" stop-color="${sunsetCoralLight}"/>
      <stop offset="85%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="medium-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
    <linearGradient id="medium-cushion" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandLight}"/>
      <stop offset="40%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
    <radialGradient id="medium-sun" cx="50%" cy="35%" r="30%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="${sunsetCoralLight}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${sandLight}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#pg-medium)">
    <g id="background">
      <rect x="0" y="0" width="800" height="500" fill="url(#medium-sky)" filter="url(#wc-medium)"/>
      <rect x="0" y="0" width="800" height="500" fill="url(#medium-sun)"/>
      <ellipse cx="400" cy="85" rx="65" ry="20" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="435" cy="78" rx="45" ry="15" fill="${white}" opacity="0.25"/>
      <ellipse cx="140" cy="110" rx="50" ry="16" fill="${offWhite}" opacity="0.35"/>
      <ellipse cx="660" cy="100" rx="55" ry="18" fill="${sandLight}" opacity="0.3"/>
      <ellipse cx="300" cy="65" rx="35" ry="10" fill="${white}" opacity="0.22"/>
      ${drawBirds([
        { x: 250, y: 55, s: 1.0, o: 0.28 },
        { x: 290, y: 48, s: 0.7, o: 0.22 },
        { x: 520, y: 42, s: 0.85, o: 0.25 },
        { x: 680, y: 68, s: 0.75, o: 0.2 },
      ])}
    </g>
    <g id="midground">
      <path d="M0 305 Q50 268 110 278 Q170 248 240 262 Q310 235 380 252 Q440 228 510 245 Q570 222 640 240 Q710 218 770 235 Q800 228 800 238 L800 340 L0 340Z" fill="${mountainBlueLight}" opacity="0.18" filter="url(#haze-medium)"/>
      <path d="M0 320 Q60 278 130 290 Q200 258 270 272 Q340 242 410 260 Q470 235 540 252 Q610 228 680 248 Q750 225 800 240 L800 355 L0 355Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-medium)"/>
      <path d="M0 340 Q75 298 155 312 Q225 278 300 295 Q365 262 440 280 Q505 255 575 272 Q640 248 720 265 Q780 250 800 260 L800 375 L0 375Z" fill="${mountainBlue}" opacity="0.38" filter="url(#wc-medium)"/>
      <path d="M0 358 Q85 322 170 335 Q245 300 325 318 Q400 288 470 305 Q540 278 620 295 Q690 272 770 288 Q800 280 800 290 L800 395 L0 395Z" fill="${mountainBlueDark}" opacity="0.28" filter="url(#wc-medium)"/>
      <path d="M0 372 Q95 345 185 355 Q265 328 345 342 Q420 315 495 330 Q565 310 645 325 Q720 305 800 318 L800 405 L0 405Z" fill="${mountainBlueDark}" opacity="0.2" filter="url(#wc-medium)"/>
      <path d="M0 385 Q110 365 220 372 Q330 352 440 362 Q550 345 660 355 Q770 342 800 350 L800 415 L0 415Z" fill="${espressoLight}" opacity="0.12" filter="url(#wc-medium)"/>
      ${pineTree(95, 388, 35, 0.35)}
      ${pineTree(155, 385, 30, 0.3)}
      ${pineTree(640, 382, 33, 0.33)}
      ${pineTree(695, 386, 28, 0.28)}
      ${cabin(200, 382, 0.65)}
    </g>
    <g id="foreground">
      <path d="M0 400 Q100 385 200 392 Q350 378 500 388 Q650 375 800 382 L800 500 L0 500Z" fill="url(#medium-ground)" filter="url(#wc-medium)"/>
      <rect x="330" y="385" width="140" height="20" rx="5" ry="5" fill="url(#medium-cushion)" opacity="0.8" filter="url(#wc-medium)"/>
      <path d="M335 387 Q400 378 465 387" stroke="${sandDark}" stroke-width="1.2" fill="none" opacity="0.45"/>
      <path d="M338 402 Q400 398 462 402" stroke="${sandDark}" stroke-width="0.8" fill="none" opacity="0.3"/>
      <rect x="393" y="340" width="14" height="45" rx="3" ry="3" fill="${mountainBlue}" opacity="0.5"/>
      <ellipse cx="400" cy="332" rx="12" ry="14" fill="${sunsetCoralLight}" opacity="0.65"/>
      <circle cx="398" cy="328" r="3" fill="${espresso}" opacity="0.5"/>
      <path d="M390 348 Q380 358 374 368 Q370 375 373 380" stroke="${sunsetCoralLight}" stroke-width="2.5" fill="none" opacity="0.5"/>
      <path d="M410 348 Q420 358 426 368 Q430 375 427 380" stroke="${sunsetCoralLight}" stroke-width="2.5" fill="none" opacity="0.5"/>
      <path d="M387 385 Q383 392 380 400" stroke="${mountainBlue}" stroke-width="2" fill="none" opacity="0.4"/>
      <path d="M413 385 Q417 392 420 400" stroke="${mountainBlue}" stroke-width="2" fill="none" opacity="0.4"/>
      ${wildflower(270, 428, sunsetCoral, 0.5)}
      ${wildflower(295, 432, mountainBlueLight, 0.45)}
      ${wildflower(510, 425, sunsetCoralLight, 0.48)}
      ${wildflower(540, 430, sunsetCoral, 0.42)}
      ${wildflower(450, 442, mountainBlueLight, 0.38)}
      <path d="M0 458 Q200 445 400 452 Q600 442 800 448 L800 500 L0 500Z" fill="${sandDark}" opacity="0.28"/>
    </g>
  </g>
</svg>`;
}

/**
 * Firm comfort SVG — structured, upright support.
 * Clear morning sky with 6 angular ridgelines, upright figure on solid platform.
 * @returns {string} SVG markup
 */
function firmSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-firm">
  <title id="title-firm">Firm comfort illustration — an upright figure on a structured surface beneath angular mountain peaks and a clear sky</title>
  <defs>
    ${sharedFilters('firm')}
    <linearGradient id="firm-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="20%" stop-color="${mountainBlue}"/>
      <stop offset="40%" stop-color="${mountainBlueLight}"/>
      <stop offset="55%" stop-color="${sandBase}"/>
      <stop offset="75%" stop-color="${sandDark}"/>
      <stop offset="90%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="firm-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandDark}"/>
      <stop offset="100%" stop-color="${espressoLight}"/>
    </linearGradient>
    <linearGradient id="firm-platform" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${espressoLight}"/>
      <stop offset="50%" stop-color="${espresso}"/>
      <stop offset="100%" stop-color="${espresso}"/>
    </linearGradient>
  </defs>
  <g filter="url(#pg-firm)">
    <g id="background">
      <rect x="0" y="0" width="800" height="500" fill="url(#firm-sky)" filter="url(#wc-firm)"/>
      <ellipse cx="520" cy="90" rx="48" ry="14" fill="${offWhite}" opacity="0.28"/>
      <ellipse cx="200" cy="105" rx="42" ry="12" fill="${sandLight}" opacity="0.22"/>
      <ellipse cx="700" cy="75" rx="35" ry="10" fill="${white}" opacity="0.2"/>
      ${drawBirds([
        { x: 300, y: 48, s: 1.1, o: 0.3 },
        { x: 340, y: 40, s: 0.8, o: 0.25 },
        { x: 600, y: 58, s: 0.9, o: 0.25 },
        { x: 150, y: 65, s: 0.7, o: 0.2 },
      ])}
    </g>
    <g id="midground">
      <path d="M0 320 Q30 265 80 252 Q130 235 190 218 Q230 240 270 248 Q320 205 390 225 Q440 198 500 212 Q560 225 620 235 Q680 205 740 225 Q790 218 800 230 L800 350 L0 350Z" fill="${mountainBlueLight}" opacity="0.2" filter="url(#haze-firm)"/>
      <path d="M0 340 Q40 275 100 262 Q150 242 210 225 Q250 250 295 258 Q340 212 405 235 Q455 205 515 220 Q575 235 635 245 Q695 215 755 235 Q800 225 800 240 L800 370 L0 370Z" fill="${mountainBlue}" opacity="0.38" filter="url(#wc-firm)"/>
      <path d="M0 358 Q50 295 120 285 Q175 262 240 250 Q285 278 335 285 Q395 242 460 265 Q520 242 580 255 Q640 232 710 248 Q770 238 800 255 L800 390 L0 390Z" fill="${mountainBlueDark}" opacity="0.4" filter="url(#wc-firm)"/>
      <path d="M0 375 Q60 318 135 308 Q190 285 255 275 Q300 300 350 308 Q410 268 475 288 Q535 268 595 280 Q655 258 725 272 Q780 262 800 275 L800 405 L0 405Z" fill="${mountainBlueDark}" opacity="0.28" filter="url(#wc-firm)"/>
      <path d="M0 388 Q70 348 150 340 Q210 320 275 312 Q320 335 370 340 Q430 305 490 322 Q550 305 620 318 Q680 300 750 312 Q800 305 800 315 L800 415 L0 415Z" fill="${espresso}" opacity="0.18" filter="url(#wc-firm)"/>
      <path d="M0 398 Q80 368 170 362 Q260 348 350 355 Q440 338 530 348 Q620 332 720 342 Q800 335 800 342 L800 425 L0 425Z" fill="${espressoLight}" opacity="0.12" filter="url(#wc-firm)"/>
      ${pineTree(75, 398, 40, 0.4)}
      ${pineTree(140, 395, 34, 0.35)}
      ${pineTree(250, 392, 28, 0.3)}
      ${pineTree(620, 390, 36, 0.38)}
      ${pineTree(700, 394, 30, 0.32)}
      ${cabin(470, 388, 0.6)}
    </g>
    <g id="foreground">
      <path d="M0 405 Q200 392 400 398 Q600 388 800 395 L800 500 L0 500Z" fill="url(#firm-ground)" filter="url(#wc-firm)"/>
      <rect x="345" y="382" width="110" height="14" rx="2" ry="2" fill="url(#firm-platform)" opacity="0.85"/>
      <line x1="345" y1="382" x2="455" y2="382" stroke="${espresso}" stroke-width="1.8" opacity="0.55"/>
      <line x1="345" y1="396" x2="455" y2="396" stroke="${espresso}" stroke-width="1" opacity="0.3"/>
      <rect x="394" y="332" width="12" height="50" rx="2" ry="2" fill="${mountainBlue}" opacity="0.5"/>
      <ellipse cx="400" cy="324" rx="10" ry="13" fill="${sunsetCoralLight}" opacity="0.65"/>
      <circle cx="399" cy="320" r="3" fill="${espresso}" opacity="0.5"/>
      <path d="M392 340 Q384 348 378 358 Q375 365 378 370" stroke="${mountainBlue}" stroke-width="2.5" fill="none" opacity="0.42"/>
      <path d="M408 340 Q416 348 422 358 Q425 365 422 370" stroke="${mountainBlue}" stroke-width="2.5" fill="none" opacity="0.42"/>
      <line x1="397" y1="382" x2="390" y2="405" stroke="${espresso}" stroke-width="2" opacity="0.38"/>
      <line x1="403" y1="382" x2="410" y2="405" stroke="${espresso}" stroke-width="2" opacity="0.38"/>
      ${wildflower(285, 425, sunsetCoral, 0.45)}
      ${wildflower(310, 430, mountainBlueLight, 0.4)}
      ${wildflower(500, 422, sunsetCoralLight, 0.42)}
      ${wildflower(525, 428, sunsetCoral, 0.38)}
      <path d="M0 462 Q200 450 400 456 Q600 448 800 454 L800 500 L0 500Z" fill="${espressoLight}" opacity="0.22"/>
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
