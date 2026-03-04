/**
 * CartIllustrations.js — Cart Page SVG illustrations
 *
 * Two illustrations:
 * 1. Cart skyline hero — full-width mountain skyline for cart page header
 * 2. Empty cart scene — centered illustration for empty cart state
 *
 * Both meet the 8/8 SVG quality bar: feTurbulence + feDisplacementMap
 * watercolor, organic bezier paths, 15+ elements, 5+ gradient stops,
 * paper grain overlay, atmospheric depth layers, all colors from sharedTokens.
 *
 * cf-6a6d: Cart Page illustration expansion
 *
 * @module CartIllustrations
 */
import { colors } from 'public/sharedTokens';

// ══════════════════════════════════════════════════════════════════════
// ── Cart Skyline Hero (full-width header, 1440×200) ──────────────────
// ══════════════════════════════════════════════════════════════════════

const SKY_VB_W = 1440;
const SKY_VB_H = 200;
const SKY_DEFAULT_HEIGHT = 120;

const CART_SKY_GRADIENT = [
  { offset: '0%', color: colors.skyGradientTop, opacity: 1 },
  { offset: '18%', color: colors.mountainBlueLight, opacity: 0.85 },
  { offset: '40%', color: colors.skyGradientBottom, opacity: 0.7 },
  { offset: '60%', color: colors.sunsetCoralLight, opacity: 0.55 },
  { offset: '80%', color: colors.sandLight, opacity: 0.7 },
  { offset: '100%', color: colors.sandBase, opacity: 0.6 },
];

// 6 ridgeline layers — soft rolling Blue Ridge, distant→front
const CART_RIDGELINES = [
  {
    name: 'distant',
    path: 'M0,200 L0,100 C70,92 110,68 180,62 C250,56 290,78 360,72 C430,66 470,44 540,40 C610,36 650,58 720,52 C790,46 830,30 900,35 C970,40 1010,60 1080,55 C1150,50 1190,38 1260,42 C1330,46 1370,62 1440,58 L1440,200 Z',
    color: colors.mountainBlue,
    opacity: 0.12,
  },
  {
    name: 'far',
    path: 'M0,200 L0,115 C55,108 85,84 150,78 C215,72 250,96 320,88 C390,80 425,56 490,52 C555,48 590,72 660,66 C730,60 765,40 835,44 C905,48 940,68 1010,62 C1080,56 1120,42 1190,46 C1260,50 1300,70 1440,65 L1440,200 Z',
    color: colors.mountainBlue,
    opacity: 0.20,
  },
  {
    name: 'back',
    path: 'M0,200 L0,128 C45,122 75,96 135,88 C195,80 230,104 295,96 C360,88 395,62 460,58 C525,54 560,78 630,72 C700,66 738,48 805,52 C872,56 905,76 975,70 C1045,64 1080,50 1150,54 C1220,58 1260,78 1340,72 C1390,68 1420,80 1440,84 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.30,
  },
  {
    name: 'mid',
    path: 'M0,200 L0,142 C50,136 80,114 140,108 C200,102 235,124 300,118 C365,112 400,88 465,84 C530,80 565,102 635,96 C705,90 740,72 810,76 C880,80 915,98 985,92 C1055,86 1090,100 1160,96 C1230,92 1270,80 1340,84 C1400,87 1425,98 1440,102 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.48,
  },
  {
    name: 'near',
    path: 'M0,200 L0,155 C40,150 72,132 130,128 C188,124 220,142 282,138 C344,134 375,116 438,112 C501,108 535,126 598,122 C661,118 695,104 758,108 C821,112 855,128 918,124 C981,120 1015,108 1078,112 C1141,116 1175,132 1238,128 C1301,124 1340,114 1400,118 C1430,120 1438,130 1440,134 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.65,
  },
  {
    name: 'front',
    path: 'M0,200 L0,164 C48,160 78,146 132,142 C186,138 215,152 272,148 C329,144 358,130 418,126 C478,122 510,138 572,134 C634,130 665,118 728,122 C791,126 822,140 885,136 C948,132 980,122 1042,126 C1104,130 1138,144 1200,140 C1262,136 1298,126 1358,130 C1408,133 1430,144 1440,148 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.82,
  },
];

function buildCartSkyFilters() {
  return [
    '<filter id="cart-watercolor" x="-5%" y="-5%" width="110%" height="110%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="61" result="turbulence"/>',
    '<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="3" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    '<filter id="cart-paper-grain" x="0" y="0" width="100%" height="100%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="19" result="grain"/>',
    '<feColorMatrix in="grain" type="saturate" values="0" result="greyGrain"/>',
    '<feBlend in="SourceGraphic" in2="greyGrain" mode="multiply"/>',
    '</filter>',
    '<filter id="cart-haze" x="0" y="0" width="100%" height="100%">',
    '<feGaussianBlur stdDeviation="2"/>',
    '</filter>',
  ].join('');
}

function buildCartSkyBirds() {
  const c = colors.espresso;
  return [
    '<g class="bird" opacity="0.35">',
    `<path d="M280,32 C284,28 288,26 292,29 C296,26 300,28 304,32" fill="none" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/>`,
    `<path d="M620,22 C623,19 626,17 628,19 C630,17 633,19 636,22" fill="none" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/>`,
    `<path d="M910,38 C913,35 916,33 918,35 C920,33 923,35 926,38" fill="none" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>`,
    `<path d="M1150,28 C1153,25 1156,23 1158,25 C1160,23 1163,25 1166,28" fill="none" stroke="${c}" stroke-width="1" stroke-linecap="round"/>`,
    '</g>',
  ].join('');
}

function buildCartSkyPines() {
  const trunk = colors.espresso;
  const foliage = colors.espresso;
  return [
    '<g class="pine" opacity="0.55">',
    // Left cluster
    `<rect x="165" y="142" width="4" height="28" fill="${trunk}" opacity="0.7" rx="1"/>`,
    `<path d="M148,148 C156,132 163,122 167,114 C171,122 178,132 186,148" fill="${foliage}" opacity="0.4"/>`,
    `<path d="M152,140 C158,128 164,120 167,112 C170,120 176,128 182,140" fill="${foliage}" opacity="0.5"/>`,
    `<path d="M156,132 C160,122 165,118 167,110 C169,118 174,122 178,132" fill="${foliage}" opacity="0.6"/>`,
    // Right cluster
    `<rect x="1260" y="148" width="3" height="22" fill="${trunk}" opacity="0.6" rx="1"/>`,
    `<path d="M1248,152 C1253,142 1258,136 1262,130 C1266,136 1271,142 1276,152" fill="${foliage}" opacity="0.35"/>`,
    `<path d="M1251,146 C1255,138 1259,134 1262,128 C1265,134 1269,138 1273,146" fill="${foliage}" opacity="0.45"/>`,
    `<path d="M1254,140 C1257,134 1260,130 1262,126 C1264,130 1267,134 1270,140" fill="${foliage}" opacity="0.55"/>`,
    '</g>',
  ].join('');
}

function buildCartSkyFlora() {
  const p = colors.sunsetCoral;
  const s = colors.espresso;
  return [
    '<g class="flora" opacity="0.45">',
    `<line x1="120" y1="180" x2="120" y2="170" stroke="${s}" stroke-width="1" opacity="0.5"/>`,
    `<circle cx="120" cy="168" r="2.5" fill="${p}" opacity="0.6"/>`,
    `<line x1="140" y1="182" x2="141" y2="174" stroke="${s}" stroke-width="0.8" opacity="0.4"/>`,
    `<circle cx="141" cy="172" r="2" fill="${colors.sandBase}" opacity="0.5"/>`,
    `<line x1="720" y1="178" x2="720" y2="169" stroke="${s}" stroke-width="0.9" opacity="0.5"/>`,
    `<circle cx="720" cy="167" r="2.8" fill="${p}" opacity="0.55"/>`,
    `<line x1="1340" y1="177" x2="1340" y2="168" stroke="${s}" stroke-width="0.9" opacity="0.45"/>`,
    `<circle cx="1340" cy="166" r="2.5" fill="${p}" opacity="0.5"/>`,
    '</g>',
  ].join('');
}

/**
 * Generate cart page skyline hero SVG (full-width mountain header).
 * @param {Object} [options]
 * @param {number} [options.height=120] - SVG height in pixels
 * @returns {string} Complete inline SVG markup
 */
export function generateCartSkylineSVG(options) {
  const opts = options || {};
  const height = (typeof opts.height === 'number' && opts.height > 0) ? opts.height : SKY_DEFAULT_HEIGHT;
  const gradId = 'cart-sky-grad';

  const stops = CART_SKY_GRADIENT.map(
    (s) => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`
  ).join('');

  const ridges = CART_RIDGELINES.map(
    (r) => `<path class="ridge-${r.name}" d="${r.path}" fill="${r.color}" opacity="${r.opacity}" filter="url(#cart-watercolor)"/>`
  ).join('');

  const hazeColor = colors.skyGradientTop;
  const haze = [
    '<g class="atmospheric-haze">',
    `<rect x="0" y="55" width="${SKY_VB_W}" height="40" fill="${hazeColor}" opacity="0.08" filter="url(#cart-haze)"/>`,
    `<rect x="0" y="95" width="${SKY_VB_W}" height="30" fill="${hazeColor}" opacity="0.05" filter="url(#cart-haze)"/>`,
    `<rect x="0" y="125" width="${SKY_VB_W}" height="20" fill="${hazeColor}" opacity="0.03"/>`,
    '</g>',
  ].join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" viewBox="0 0 ${SKY_VB_W} ${SKY_VB_H}" preserveAspectRatio="none" aria-hidden="true" role="presentation">`,
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>${buildCartSkyFilters()}</defs>`,
    `<rect width="${SKY_VB_W}" height="${SKY_VB_H}" fill="url(#${gradId})"/>`,
    buildCartSkyBirds(),
    ridges,
    haze,
    buildCartSkyPines(),
    buildCartSkyFlora(),
    `<rect width="${SKY_VB_W}" height="${SKY_VB_H}" filter="url(#cart-paper-grain)" opacity="0.06" fill="${colors.espresso}"/>`,
    '</svg>',
  ].join('');
}

// ══════════════════════════════════════════════════════════════════════
// ── Empty Cart Scene (centered, 280×200) ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════

const SCENE_VB_W = 280;
const SCENE_VB_H = 200;

function buildEmptyCartFilters() {
  return [
    '<filter id="ec-watercolor" x="-5%" y="-5%" width="110%" height="110%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="73" result="turbulence"/>',
    '<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="2" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    '<filter id="ec-paper-grain" x="0" y="0" width="100%" height="100%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="31" result="grain"/>',
    '<feColorMatrix in="grain" type="saturate" values="0" result="greyGrain"/>',
    '<feBlend in="SourceGraphic" in2="greyGrain" mode="multiply"/>',
    '</filter>',
    '<filter id="ec-haze" x="0" y="0" width="100%" height="100%">',
    '<feGaussianBlur stdDeviation="1.5"/>',
    '</filter>',
  ].join('');
}

/**
 * Generate empty cart illustration SVG — quiet mountain trail scene.
 * @returns {string} Complete inline SVG markup
 */
export function generateEmptyCartSVG() {
  const {
    skyGradientTop, mountainBlueLight, skyGradientBottom, sunsetCoralLight,
    sandLight, sandBase, mountainBlue, mountainBlueDark, espresso,
    sunsetCoral, success, offWhite,
  } = colors;

  // Sky gradient (6 stops — sunrise warmth)
  const skyStops = [
    `<stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="1"/>`,
    `<stop offset="20%" stop-color="${mountainBlueLight}" stop-opacity="0.9"/>`,
    `<stop offset="42%" stop-color="${skyGradientBottom}" stop-opacity="0.7"/>`,
    `<stop offset="62%" stop-color="${sunsetCoralLight}" stop-opacity="0.5"/>`,
    `<stop offset="82%" stop-color="${sandLight}" stop-opacity="0.75"/>`,
    `<stop offset="100%" stop-color="${sandBase}" stop-opacity="0.65"/>`,
  ].join('');

  // Sun glow (radial gradient)
  const sunGlow = [
    `<stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>`,
    `<stop offset="40%" stop-color="${sunsetCoralLight}" stop-opacity="0.2"/>`,
    `<stop offset="100%" stop-color="${skyGradientBottom}" stop-opacity="0"/>`,
  ].join('');

  // Background layer — sky + sun
  const background = [
    '<g id="background">',
    `<rect width="${SCENE_VB_W}" height="${SCENE_VB_H}" fill="url(#ec-sky)"/>`,
    `<circle cx="220" cy="42" r="28" fill="url(#ec-sun)" opacity="0.7"/>`,
    // Wispy clouds
    `<ellipse cx="70" cy="38" rx="30" ry="6" fill="${offWhite}" opacity="0.25" filter="url(#ec-haze)"/>`,
    `<ellipse cx="180" cy="30" rx="22" ry="4" fill="${offWhite}" opacity="0.2" filter="url(#ec-haze)"/>`,
    // Birds
    '<g class="bird" opacity="0.3">',
    `<path d="M90,25 C93,22 96,20 98,22 C100,20 103,22 106,25" fill="none" stroke="${espresso}" stroke-width="0.8" stroke-linecap="round"/>`,
    `<path d="M200,35 C202,33 204,31 205,33 C206,31 208,33 210,35" fill="none" stroke="${espresso}" stroke-width="0.7" stroke-linecap="round"/>`,
    `<path d="M148,20 C150,18 152,17 153,18 C154,17 156,18 158,20" fill="none" stroke="${espresso}" stroke-width="0.6" stroke-linecap="round"/>`,
    '</g>',
    '</g>',
  ].join('');

  // Midground — mountain ridgelines (3 layers, atmospheric depth)
  const midground = [
    '<g id="midground">',
    // Distant ridge
    `<path class="ridge-distant" d="M0,90 C30,82 55,60 80,55 C105,50 125,68 155,62 C185,56 210,42 240,38 C255,36 270,48 280,52 L280,120 L0,120 Z" fill="${mountainBlue}" opacity="0.22" filter="url(#ec-watercolor)"/>`,
    // Mid ridge
    `<path class="ridge-mid" d="M0,108 C25,100 48,78 78,72 C108,66 132,88 162,82 C192,76 218,58 248,54 C262,52 274,64 280,68 L280,140 L0,140 Z" fill="${mountainBlueDark}" opacity="0.35" filter="url(#ec-watercolor)"/>`,
    // Near ridge
    `<path class="ridge-near" d="M0,125 C22,118 42,98 68,92 C94,86 118,108 148,102 C178,96 200,76 230,72 C250,69 268,82 280,88 L280,155 L0,155 Z" fill="${espresso}" opacity="0.45" filter="url(#ec-watercolor)"/>`,
    // Atmospheric haze between layers
    `<rect x="0" y="85" width="${SCENE_VB_W}" height="25" fill="${skyGradientTop}" opacity="0.06" filter="url(#ec-haze)"/>`,
    `<rect x="0" y="110" width="${SCENE_VB_W}" height="20" fill="${skyGradientTop}" opacity="0.04" filter="url(#ec-haze)"/>`,
    '</g>',
  ].join('');

  // Foreground — trail, fence post, pack frame, flora
  const foreground = [
    '<g id="foreground">',
    // Ground base
    `<rect x="0" y="150" width="${SCENE_VB_W}" height="50" fill="${sandBase}" opacity="0.8"/>`,
    `<path d="M0,155 C40,148 80,152 140,150 C200,148 240,154 280,150 L280,200 L0,200 Z" fill="${sandLight}" opacity="0.6"/>`,
    // Winding trail path
    `<path class="trail" d="M110,200 C115,185 120,172 128,162 C136,152 145,150 155,152 C165,154 170,158 168,165 C166,172 158,178 150,185 C142,192 135,198 130,200" fill="${sandBase}" opacity="0.5" stroke="${espresso}" stroke-width="0.5" stroke-opacity="0.15"/>`,
    // Fence post
    `<rect x="180" y="142" width="5" height="30" fill="${espresso}" opacity="0.6" rx="1"/>`,
    `<rect x="178" y="140" width="9" height="4" fill="${espresso}" opacity="0.5" rx="1"/>`,
    // Pack frame leaning against post (empty cart metaphor)
    `<path d="M188,144 C190,138 194,130 192,124 C190,118 186,116 184,120 C182,124 183,132 185,140 L188,144" fill="${mountainBlue}" opacity="0.4" stroke="${espresso}" stroke-width="0.6" stroke-opacity="0.3"/>`,
    `<line x1="185" y1="126" x2="191" y2="128" stroke="${espresso}" stroke-width="0.5" opacity="0.4"/>`,
    `<line x1="184" y1="132" x2="190" y2="134" stroke="${espresso}" stroke-width="0.5" opacity="0.4"/>`,
    // Pine trees at edges
    '<g class="pine" opacity="0.5">',
    `<rect x="30" y="138" width="3" height="22" fill="${espresso}" opacity="0.7" rx="1"/>`,
    `<path d="M20,142 C25,132 29,126 32,120 C35,126 39,132 44,142" fill="${espresso}" opacity="0.4"/>`,
    `<path d="M23,136 C27,128 30,124 32,118 C34,124 37,128 41,136" fill="${espresso}" opacity="0.5"/>`,
    `<path d="M26,130 C29,124 31,122 32,116 C33,122 35,124 38,130" fill="${espresso}" opacity="0.6"/>`,
    `<rect x="248" y="140" width="3" height="20" fill="${espresso}" opacity="0.6" rx="1"/>`,
    `<path d="M240,144 C244,136 247,130 250,126 C253,130 256,136 260,144" fill="${espresso}" opacity="0.35"/>`,
    `<path d="M242,139 C245,133 248,129 250,125 C252,129 255,133 258,139" fill="${espresso}" opacity="0.45"/>`,
    '</g>',
    // Wildflowers / flora
    '<g class="flora" opacity="0.5">',
    `<line x1="60" y1="162" x2="60" y2="154" stroke="${success}" stroke-width="0.8" opacity="0.5"/>`,
    `<circle cx="60" cy="152" r="2" fill="${sunsetCoral}" opacity="0.6"/>`,
    `<line x1="72" y1="164" x2="73" y2="156" stroke="${success}" stroke-width="0.7" opacity="0.4"/>`,
    `<circle cx="73" cy="154" r="1.8" fill="${sandBase}" opacity="0.5"/>`,
    `<line x1="210" y1="160" x2="210" y2="153" stroke="${success}" stroke-width="0.8" opacity="0.5"/>`,
    `<circle cx="210" cy="151" r="2.2" fill="${sunsetCoral}" opacity="0.55"/>`,
    `<line x1="224" y1="163" x2="225" y2="155" stroke="${success}" stroke-width="0.7" opacity="0.4"/>`,
    `<circle cx="225" cy="153" r="1.5" fill="${mountainBlueLight}" opacity="0.4"/>`,
    '</g>',
    '</g>',
  ].join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_VB_W} ${SCENE_VB_H}" width="100%" height="100%" role="img" aria-labelledby="title-empty-cart">`,
    '<title id="title-empty-cart">Empty cart — a quiet mountain trail with a pack frame resting against a fence post in the Blue Ridge foothills</title>',
    `<defs><linearGradient id="ec-sky" x1="0" y1="0" x2="0" y2="1">${skyStops}</linearGradient>`,
    `<radialGradient id="ec-sun" cx="50%" cy="50%">${sunGlow}</radialGradient>`,
    buildEmptyCartFilters(),
    '</defs>',
    background,
    midground,
    foreground,
    `<rect width="${SCENE_VB_W}" height="${SCENE_VB_H}" filter="url(#ec-paper-grain)" opacity="0.06" fill="${espresso}"/>`,
    '</svg>',
  ].join('');
}

// ══════════════════════════════════════════════════════════════════════
// ── Init Wrappers ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

/**
 * Inject cart skyline hero into a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {number} [options.height] - SVG height in pixels
 */
export function initCartSkyline($w, options) {
  try {
    if (!$w) return;
    const container = $w('#cartHeroSkyline');
    if (!container) return;
    container.html = generateCartSkylineSVG(options);
  } catch (_e) { /* Element may not exist */ }
}

/**
 * Inject empty cart illustration into a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 */
export function initEmptyCartIllustration($w) {
  try {
    if (!$w) return;
    const container = $w('#emptyCartIllustration');
    if (!container) return;
    container.html = generateEmptyCartSVG();
  } catch (_e) { /* Element may not exist */ }
}
