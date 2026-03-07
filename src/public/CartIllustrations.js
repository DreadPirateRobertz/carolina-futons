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
 * Enhanced per Overseer Quality Directive: distinctive Blue Ridge Mountains
 * with visible watercolor textures, strong atmospheric haze between layers,
 * warm sunset palette, cabin silhouette detail, rich detail elements.
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

// Warm sunset sky — stronger coral/gold presence than standard skyline
const CART_SKY_GRADIENT = [
  { offset: '0%', color: colors.skyGradientTop, opacity: 1 },
  { offset: '15%', color: colors.mountainBlueLight, opacity: 0.9 },
  { offset: '32%', color: colors.skyGradientBottom, opacity: 0.8 },
  { offset: '50%', color: colors.sunsetCoralLight, opacity: 0.65 },
  { offset: '70%', color: colors.sunsetCoral, opacity: 0.35 },
  { offset: '85%', color: colors.sandLight, opacity: 0.7 },
  { offset: '100%', color: colors.sandBase, opacity: 0.6 },
];

// 6 ridgeline layers — Blue Ridge signature: 3 blue distant + 3 espresso near
// Soft rolling undulation with extra control points for organic feel
const CART_RIDGELINES = [
  {
    name: 'distant',
    path: 'M0,200 L0,92 C40,86 75,62 140,55 C205,48 240,72 320,65 C400,58 440,38 520,32 C600,26 640,50 720,44 C800,38 840,22 920,28 C1000,34 1040,54 1120,48 C1200,42 1240,30 1320,36 C1380,40 1420,56 1440,52 L1440,200 Z',
    color: colors.mountainBlue,
    opacity: 0.18,
  },
  {
    name: 'far',
    path: 'M0,200 L0,108 C50,100 82,76 148,70 C214,64 248,88 318,80 C388,72 422,48 492,44 C562,40 596,64 668,58 C740,52 775,34 848,38 C921,42 952,62 1025,56 C1098,50 1135,38 1208,42 C1281,46 1318,66 1440,60 L1440,200 Z',
    color: colors.mountainBlue,
    opacity: 0.28,
  },
  {
    name: 'back',
    path: 'M0,200 L0,124 C42,118 72,90 132,82 C192,74 228,98 294,90 C360,82 396,56 462,52 C528,48 564,72 634,66 C704,60 742,42 812,46 C882,50 912,70 982,64 C1052,58 1088,44 1158,48 C1228,52 1268,72 1348,66 C1398,62 1428,74 1440,78 L1440,200 Z',
    color: colors.mountainBlueDark,
    opacity: 0.38,
  },
  {
    name: 'mid',
    path: 'M0,200 L0,142 C48,136 78,112 138,106 C198,100 232,122 298,116 C364,110 398,86 464,82 C530,78 564,100 634,94 C704,88 738,70 808,74 C878,78 912,96 982,90 C1052,84 1088,98 1158,94 C1228,90 1268,78 1338,82 C1398,85 1425,96 1440,100 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.52,
  },
  {
    name: 'near',
    path: 'M0,200 L0,155 C38,150 70,130 128,126 C186,122 218,140 280,136 C342,132 374,114 438,110 C502,106 536,124 600,120 C664,116 698,102 762,106 C826,110 858,126 922,122 C986,118 1018,106 1082,110 C1146,114 1178,130 1242,126 C1306,122 1342,112 1404,116 C1432,118 1440,128 1440,132 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.68,
  },
  {
    name: 'front',
    path: 'M0,200 L0,166 C46,162 76,148 130,144 C184,140 214,154 270,150 C326,146 356,132 416,128 C476,124 508,140 570,136 C632,132 664,120 726,124 C788,128 820,142 882,138 C944,134 976,124 1038,128 C1100,132 1134,146 1196,142 C1258,138 1294,128 1356,132 C1406,135 1430,146 1440,150 L1440,200 Z',
    color: colors.espresso,
    opacity: 0.85,
  },
];

function buildCartSkyFilters() {
  return [
    // Watercolor texture — stronger displacement for visible edge wobble
    '<filter id="cart-watercolor" x="-5%" y="-5%" width="110%" height="110%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="5" seed="61" result="turbulence"/>',
    '<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="5" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    // Paper grain — stronger for hand-drawn feel
    '<filter id="cart-paper-grain" x="0" y="0" width="100%" height="100%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" seed="19" result="grain"/>',
    '<feColorMatrix in="grain" type="saturate" values="0" result="greyGrain"/>',
    '<feBlend in="SourceGraphic" in2="greyGrain" mode="multiply"/>',
    '</filter>',
    // Atmospheric haze blur
    '<filter id="cart-haze" x="0" y="0" width="100%" height="100%">',
    '<feGaussianBlur stdDeviation="3"/>',
    '</filter>',
    // Soft glow for sunset warmth
    '<filter id="cart-glow" x="-20%" y="-20%" width="140%" height="140%">',
    '<feGaussianBlur stdDeviation="12"/>',
    '</filter>',
  ].join('');
}

function buildCartSkyBirds() {
  const c = colors.espresso;
  return [
    '<g class="bird" opacity="0.4">',
    // 6 birds at varying sizes and positions for depth
    `<path d="M220,28 C225,23 230,20 234,24 C238,20 243,23 248,28" fill="none" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>`,
    `<path d="M260,36 C263,33 266,31 268,33 C270,31 273,33 276,36" fill="none" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>`,
    `<path d="M580,20 C584,16 588,14 591,17 C594,14 598,16 602,20" fill="none" stroke="${c}" stroke-width="1" stroke-linecap="round"/>`,
    `<path d="M830,32 C833,29 836,27 838,29 C840,27 843,29 846,32" fill="none" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/>`,
    `<path d="M1080,24 C1083,21 1086,19 1088,21 C1090,19 1093,21 1096,24" fill="none" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/>`,
    `<path d="M1200,38 C1202,36 1204,35 1205,36 C1206,35 1208,36 1210,38" fill="none" stroke="${c}" stroke-width="0.7" stroke-linecap="round"/>`,
    '</g>',
  ].join('');
}

function buildCartSkyPines() {
  const trunk = colors.espresso;
  const foliage = colors.espresso;
  return [
    '<g class="pine" opacity="0.6">',
    // Left cluster — tall pine
    `<rect x="125" y="138" width="4" height="32" fill="${trunk}" opacity="0.7" rx="1"/>`,
    `<path d="M106,146 C114,128 121,116 127,106 C133,116 140,128 148,146" fill="${foliage}" opacity="0.4"/>`,
    `<path d="M110,138 C116,124 122,114 127,104 C132,114 138,124 144,138" fill="${foliage}" opacity="0.52"/>`,
    `<path d="M114,130 C118,120 124,112 127,102 C130,112 136,120 140,130" fill="${foliage}" opacity="0.64"/>`,
    // Left companion — shorter
    `<rect x="152" y="148" width="3" height="22" fill="${trunk}" opacity="0.6" rx="1"/>`,
    `<path d="M140,152 C144,142 150,136 154,130 C158,136 164,142 168,152" fill="${foliage}" opacity="0.38"/>`,
    `<path d="M143,146 C147,138 151,134 154,128 C157,134 161,138 165,146" fill="${foliage}" opacity="0.48"/>`,
    // Center cluster near cabin
    `<rect x="680" y="146" width="3" height="24" fill="${trunk}" opacity="0.55" rx="1"/>`,
    `<path d="M668,150 C672,140 678,134 682,128 C686,134 692,140 696,150" fill="${foliage}" opacity="0.35"/>`,
    `<path d="M671,144 C675,136 679,132 682,126 C685,132 689,136 693,144" fill="${foliage}" opacity="0.45"/>`,
    // Right cluster — tall pine
    `<rect x="1300" y="142" width="4" height="28" fill="${trunk}" opacity="0.65" rx="1"/>`,
    `<path d="M1284,148 C1290,134 1296,126 1302,118 C1308,126 1314,134 1320,148" fill="${foliage}" opacity="0.38"/>`,
    `<path d="M1288,140 C1292,130 1298,124 1302,116 C1306,124 1312,130 1316,140" fill="${foliage}" opacity="0.48"/>`,
    `<path d="M1292,132 C1295,124 1299,120 1302,114 C1305,120 1309,124 1312,132" fill="${foliage}" opacity="0.58"/>`,
    // Right companion
    `<rect x="1328" y="150" width="3" height="20" fill="${trunk}" opacity="0.55" rx="1"/>`,
    `<path d="M1318,154 C1322,146 1326,140 1330,136 C1334,140 1338,146 1342,154" fill="${foliage}" opacity="0.35"/>`,
    '</g>',
  ].join('');
}

function buildCartSkyCabin() {
  const wall = colors.sandBase;
  const roof = colors.espresso;
  const smoke = colors.mountainBlueLight;
  return [
    // Small cabin silhouette nestled in mid-distance
    '<g class="cabin" opacity="0.45">',
    // Cabin body
    `<rect x="720" y="128" width="22" height="16" fill="${wall}" opacity="0.5"/>`,
    // Roof (triangle)
    `<path d="M716,128 L731,114 L746,128 Z" fill="${roof}" opacity="0.55"/>`,
    // Door
    `<rect x="728" y="136" width="5" height="8" fill="${roof}" opacity="0.4"/>`,
    // Window
    `<rect x="735" y="131" width="4" height="4" fill="${smoke}" opacity="0.3"/>`,
    // Chimney
    `<rect x="738" y="116" width="4" height="12" fill="${roof}" opacity="0.45"/>`,
    // Chimney smoke — curling wisps
    `<path d="M740,116 C742,110 738,104 740,98 C742,92 744,88 742,82" fill="none" stroke="${smoke}" stroke-width="1.5" stroke-opacity="0.2" stroke-linecap="round"/>`,
    `<path d="M741,114 C744,108 741,102 743,96 C745,90 748,86 746,80" fill="none" stroke="${smoke}" stroke-width="1" stroke-opacity="0.15" stroke-linecap="round"/>`,
    '</g>',
  ].join('');
}

function buildCartSkyFlora() {
  const p = colors.sunsetCoral;
  const s = colors.espresso;
  const g = colors.success;
  return [
    '<g class="flora" opacity="0.55">',
    // Left wildflowers
    `<line x1="95" y1="180" x2="95" y2="170" stroke="${g}" stroke-width="1" opacity="0.6"/>`,
    `<circle cx="95" cy="168" r="2.8" fill="${p}" opacity="0.65"/>`,
    `<line x1="108" y1="182" x2="109" y2="173" stroke="${g}" stroke-width="0.9" opacity="0.5"/>`,
    `<circle cx="109" cy="171" r="2.2" fill="${colors.sandBase}" opacity="0.55"/>`,
    `<line x1="180" y1="178" x2="180" y2="169" stroke="${g}" stroke-width="0.8" opacity="0.5"/>`,
    `<circle cx="180" cy="167" r="2" fill="${p}" opacity="0.5"/>`,
    // Center wildflowers
    `<line x1="650" y1="178" x2="650" y2="168" stroke="${g}" stroke-width="1" opacity="0.6"/>`,
    `<circle cx="650" cy="166" r="3" fill="${p}" opacity="0.6"/>`,
    `<line x1="665" y1="180" x2="666" y2="172" stroke="${g}" stroke-width="0.8" opacity="0.45"/>`,
    `<circle cx="666" cy="170" r="2" fill="${colors.mountainBlueLight}" opacity="0.45"/>`,
    // Right wildflowers
    `<line x1="1260" y1="176" x2="1260" y2="167" stroke="${g}" stroke-width="1" opacity="0.55"/>`,
    `<circle cx="1260" cy="165" r="2.8" fill="${p}" opacity="0.55"/>`,
    `<line x1="1278" y1="179" x2="1279" y2="171" stroke="${g}" stroke-width="0.7" opacity="0.4"/>`,
    `<circle cx="1279" cy="169" r="1.8" fill="${colors.sandBase}" opacity="0.5"/>`,
    // Grass tufts
    `<path d="M200,180 C202,174 204,178 206,172 C208,178 210,174 212,180" fill="none" stroke="${s}" stroke-width="0.6" opacity="0.2"/>`,
    `<path d="M1350,178 C1352,172 1354,176 1356,170 C1358,176 1360,172 1362,178" fill="none" stroke="${s}" stroke-width="0.6" opacity="0.2"/>`,
    '</g>',
  ].join('');
}

/**
 * Generate cart page skyline hero SVG (full-width mountain header).
 * Enhanced with stronger watercolor texture, warm sunset glow, cabin
 * silhouette, rich atmospheric haze, and 3-layer Blue Ridge color
 * progression for distinctive character.
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

  // Sunset glow — warm radial accent behind the mountains
  const sunsetGlow = [
    `<circle cx="1100" cy="45" r="120" fill="url(#cart-sunset-glow)" opacity="0.5"/>`,
  ].join('');

  // Atmospheric haze — stronger for visible Blue Ridge layering
  const hazeColor = colors.skyGradientTop;
  const warmHaze = colors.sunsetCoralLight;
  const haze = [
    '<g class="atmospheric-haze">',
    `<rect x="0" y="45" width="${SKY_VB_W}" height="45" fill="${hazeColor}" opacity="0.15" filter="url(#cart-haze)"/>`,
    `<rect x="0" y="85" width="${SKY_VB_W}" height="35" fill="${hazeColor}" opacity="0.10" filter="url(#cart-haze)"/>`,
    `<rect x="0" y="115" width="${SKY_VB_W}" height="25" fill="${warmHaze}" opacity="0.06" filter="url(#cart-haze)"/>`,
    `<rect x="0" y="140" width="${SKY_VB_W}" height="15" fill="${hazeColor}" opacity="0.04"/>`,
    '</g>',
  ].join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" viewBox="0 0 ${SKY_VB_W} ${SKY_VB_H}" preserveAspectRatio="none" aria-hidden="true" role="presentation">`,
    `<defs>`,
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`,
    `<radialGradient id="cart-sunset-glow" cx="50%" cy="50%"><stop offset="0%" stop-color="${colors.sunsetCoral}" stop-opacity="0.4"/><stop offset="50%" stop-color="${colors.sunsetCoralLight}" stop-opacity="0.15"/><stop offset="100%" stop-color="${colors.skyGradientBottom}" stop-opacity="0"/></radialGradient>`,
    buildCartSkyFilters(),
    `</defs>`,
    `<rect width="${SKY_VB_W}" height="${SKY_VB_H}" fill="url(#${gradId})"/>`,
    sunsetGlow,
    buildCartSkyBirds(),
    ridges,
    haze,
    buildCartSkyCabin(),
    buildCartSkyPines(),
    buildCartSkyFlora(),
    `<rect width="${SKY_VB_W}" height="${SKY_VB_H}" filter="url(#cart-paper-grain)" opacity="0.10" fill="${colors.espresso}"/>`,
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
    // Watercolor — stronger displacement for visible texture
    '<filter id="ec-watercolor" x="-5%" y="-5%" width="110%" height="110%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="73" result="turbulence"/>',
    '<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="4" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    // Paper grain — stronger
    '<filter id="ec-paper-grain" x="0" y="0" width="100%" height="100%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" seed="31" result="grain"/>',
    '<feColorMatrix in="grain" type="saturate" values="0" result="greyGrain"/>',
    '<feBlend in="SourceGraphic" in2="greyGrain" mode="multiply"/>',
    '</filter>',
    // Haze blur — stronger for atmospheric depth
    '<filter id="ec-haze" x="0" y="0" width="100%" height="100%">',
    '<feGaussianBlur stdDeviation="2"/>',
    '</filter>',
    // Light rays glow
    '<filter id="ec-glow" x="-20%" y="-20%" width="140%" height="140%">',
    '<feGaussianBlur stdDeviation="6"/>',
    '</filter>',
  ].join('');
}

/**
 * Generate empty cart illustration SVG — quiet mountain trail scene.
 * Enhanced with 5 ridgeline layers, distant cabin with chimney smoke,
 * stronger watercolor texture, visible light rays, richer flora,
 * and warm sunset palette for distinctive Blue Ridge character.
 * @returns {string} Complete inline SVG markup
 */
export function generateEmptyCartSVG() {
  const {
    skyGradientTop, mountainBlueLight, skyGradientBottom, sunsetCoralLight,
    sandLight, sandBase, mountainBlue, mountainBlueDark, espresso,
    sunsetCoral, success, offWhite, espressoLight,
  } = colors;

  // Sky gradient (7 stops — warm sunset emphasis)
  const skyStops = [
    `<stop offset="0%" stop-color="${skyGradientTop}" stop-opacity="1"/>`,
    `<stop offset="15%" stop-color="${mountainBlueLight}" stop-opacity="0.92"/>`,
    `<stop offset="30%" stop-color="${skyGradientBottom}" stop-opacity="0.75"/>`,
    `<stop offset="48%" stop-color="${sunsetCoralLight}" stop-opacity="0.6"/>`,
    `<stop offset="62%" stop-color="${sunsetCoral}" stop-opacity="0.3"/>`,
    `<stop offset="80%" stop-color="${sandLight}" stop-opacity="0.75"/>`,
    `<stop offset="100%" stop-color="${sandBase}" stop-opacity="0.65"/>`,
  ].join('');

  // Sun glow (radial gradient — larger, warmer)
  const sunGlow = [
    `<stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.5"/>`,
    `<stop offset="30%" stop-color="${sunsetCoralLight}" stop-opacity="0.3"/>`,
    `<stop offset="60%" stop-color="${skyGradientBottom}" stop-opacity="0.1"/>`,
    `<stop offset="100%" stop-color="${skyGradientTop}" stop-opacity="0"/>`,
  ].join('');

  // Background layer — sky + sun + light rays
  const background = [
    '<g id="background">',
    `<rect width="${SCENE_VB_W}" height="${SCENE_VB_H}" fill="url(#ec-sky)"/>`,
    // Light rays from sun
    `<line x1="215" y1="42" x2="185" y2="95" stroke="${sunsetCoralLight}" stroke-width="8" opacity="0.06" stroke-linecap="round" filter="url(#ec-glow)"/>`,
    `<line x1="218" y1="42" x2="240" y2="100" stroke="${sunsetCoralLight}" stroke-width="6" opacity="0.05" stroke-linecap="round" filter="url(#ec-glow)"/>`,
    `<line x1="212" y1="42" x2="160" y2="85" stroke="${skyGradientBottom}" stroke-width="5" opacity="0.04" stroke-linecap="round" filter="url(#ec-glow)"/>`,
    // Sun
    `<circle cx="215" cy="42" r="32" fill="url(#ec-sun)" opacity="0.8"/>`,
    // Wispy clouds
    `<ellipse cx="60" cy="34" rx="32" ry="7" fill="${offWhite}" opacity="0.28" filter="url(#ec-haze)"/>`,
    `<ellipse cx="155" cy="26" rx="24" ry="5" fill="${offWhite}" opacity="0.22" filter="url(#ec-haze)"/>`,
    `<ellipse cx="120" cy="42" rx="18" ry="4" fill="${offWhite}" opacity="0.18" filter="url(#ec-haze)"/>`,
    // Birds (4 at varying depths)
    '<g class="bird" opacity="0.35">',
    `<path d="M80,22 C84,18 88,16 91,19 C94,16 98,18 102,22" fill="none" stroke="${espresso}" stroke-width="0.9" stroke-linecap="round"/>`,
    `<path d="M190,30 C192,28 194,26 195,28 C196,26 198,28 200,30" fill="none" stroke="${espresso}" stroke-width="0.7" stroke-linecap="round"/>`,
    `<path d="M140,17 C142,15 144,14 145,15 C146,14 148,15 150,17" fill="none" stroke="${espresso}" stroke-width="0.6" stroke-linecap="round"/>`,
    `<path d="M45,30 C47,28 49,27 50,28 C51,27 53,28 55,30" fill="none" stroke="${espresso}" stroke-width="0.65" stroke-linecap="round"/>`,
    '</g>',
    '</g>',
  ].join('');

  // Midground — 5 mountain ridgeline layers (atmospheric depth)
  const midground = [
    '<g id="midground">',
    // Distant ridge — faint blue
    `<path class="ridge-distant" d="M0,82 C25,74 52,52 82,46 C112,40 135,58 165,52 C195,46 222,32 252,28 C266,26 274,38 280,42 L280,110 L0,110 Z" fill="${mountainBlue}" opacity="0.20" filter="url(#ec-watercolor)"/>`,
    // Far ridge — blue
    `<path class="ridge-far" d="M0,95 C22,88 48,66 78,60 C108,54 130,74 160,68 C190,62 215,46 245,42 C260,40 272,52 280,56 L280,125 L0,125 Z" fill="${mountainBlue}" opacity="0.30" filter="url(#ec-watercolor)"/>`,
    // Mid ridge — dark blue
    `<path class="ridge-mid" d="M0,108 C20,102 42,78 72,72 C102,66 126,86 156,80 C186,74 210,56 242,52 C258,50 272,62 280,66 L280,140 L0,140 Z" fill="${mountainBlueDark}" opacity="0.40" filter="url(#ec-watercolor)"/>`,
    // Near ridge — espresso
    `<path class="ridge-near" d="M0,122 C18,116 38,96 64,90 C90,84 114,104 144,98 C174,92 196,74 226,70 C248,67 266,80 280,86 L280,152 L0,152 Z" fill="${espresso}" opacity="0.52" filter="url(#ec-watercolor)"/>`,
    // Front ridge — dark espresso
    `<path class="ridge-front" d="M0,134 C16,130 34,114 58,110 C82,106 104,120 132,116 C160,112 182,96 210,92 C234,89 256,100 280,105 L280,160 L0,160 Z" fill="${espresso}" opacity="0.65" filter="url(#ec-watercolor)"/>`,
    // Atmospheric haze between layers — stronger
    `<rect x="0" y="75" width="${SCENE_VB_W}" height="28" fill="${skyGradientTop}" opacity="0.12" filter="url(#ec-haze)"/>`,
    `<rect x="0" y="100" width="${SCENE_VB_W}" height="22" fill="${skyGradientTop}" opacity="0.08" filter="url(#ec-haze)"/>`,
    `<rect x="0" y="125" width="${SCENE_VB_W}" height="15" fill="${sunsetCoralLight}" opacity="0.04" filter="url(#ec-haze)"/>`,
    // Distant cabin with chimney smoke
    '<g class="distant-cabin" opacity="0.35">',
    `<rect x="195" y="82" width="12" height="10" fill="${sandBase}" opacity="0.5"/>`,
    `<path d="M192,82 L201,74 L210,82 Z" fill="${espressoLight}" opacity="0.5"/>`,
    `<rect x="204" y="76" width="2.5" height="6" fill="${espressoLight}" opacity="0.4"/>`,
    `<path d="M205,76 C206,72 204,68 205.5,64 C207,60 208,57 207,54" fill="none" stroke="${mountainBlueLight}" stroke-width="1.2" stroke-opacity="0.2" stroke-linecap="round"/>`,
    '</g>',
    '</g>',
  ].join('');

  // Foreground — trail, fence post, pack frame, flora, stepping stones
  const foreground = [
    '<g id="foreground">',
    // Ground base
    `<rect x="0" y="152" width="${SCENE_VB_W}" height="48" fill="${sandBase}" opacity="0.85"/>`,
    `<path d="M0,156 C35,150 75,154 140,152 C205,150 245,156 280,152 L280,200 L0,200 Z" fill="${sandLight}" opacity="0.65"/>`,
    // Winding trail path with texture
    `<path class="trail" d="M105,200 C110,186 116,174 124,164 C132,154 142,152 152,154 C162,156 167,160 165,167 C163,174 155,180 147,187 C139,194 132,198 127,200" fill="${sandBase}" opacity="0.55" stroke="${espresso}" stroke-width="0.6" stroke-opacity="0.18"/>`,
    // Stepping stones on trail
    `<ellipse cx="118" cy="178" rx="4" ry="2" fill="${espressoLight}" opacity="0.2"/>`,
    `<ellipse cx="130" cy="168" rx="3.5" ry="1.8" fill="${espressoLight}" opacity="0.18"/>`,
    `<ellipse cx="148" cy="162" rx="3" ry="1.5" fill="${espressoLight}" opacity="0.15"/>`,
    // Fence post — weathered
    `<rect x="178" y="142" width="5" height="32" fill="${espresso}" opacity="0.65" rx="1"/>`,
    `<rect x="176" y="140" width="9" height="4" fill="${espresso}" opacity="0.55" rx="1"/>`,
    // Cross beam on fence
    `<rect x="175" y="152" width="11" height="2" fill="${espresso}" opacity="0.35" rx="0.5"/>`,
    // Pack frame leaning against post (empty cart metaphor) — more detailed
    `<path d="M188,146 C190,138 195,128 193,120 C191,112 186,110 183,114 C180,118 181,128 184,140 L188,146" fill="${mountainBlue}" opacity="0.45" stroke="${espresso}" stroke-width="0.7" stroke-opacity="0.35"/>`,
    // Pack frame straps
    `<line x1="184" y1="122" x2="192" y2="124" stroke="${espresso}" stroke-width="0.6" opacity="0.4"/>`,
    `<line x1="183" y1="130" x2="191" y2="132" stroke="${espresso}" stroke-width="0.6" opacity="0.4"/>`,
    `<line x1="185" y1="116" x2="190" y2="118" stroke="${espresso}" stroke-width="0.5" opacity="0.35"/>`,
    // Buckle detail
    `<rect x="186" y="120" width="2" height="2" fill="${sunsetCoral}" opacity="0.3" rx="0.5"/>`,
    // Pine trees at edges — richer
    '<g class="pine" opacity="0.55">',
    // Left pine — tall with 4 branch layers
    `<rect x="28" y="136" width="3.5" height="26" fill="${espresso}" opacity="0.7" rx="1"/>`,
    `<path d="M16,142 C21,130 27,122 30,114 C33,122 39,130 44,142" fill="${espresso}" opacity="0.4"/>`,
    `<path d="M19,135 C23,125 28,119 30,112 C32,119 37,125 41,135" fill="${espresso}" opacity="0.5"/>`,
    `<path d="M22,128 C25,120 28,116 30,110 C32,116 35,120 38,128" fill="${espresso}" opacity="0.6"/>`,
    `<path d="M25,121 C27,116 29,114 30,108 C31,114 33,116 35,121" fill="${espresso}" opacity="0.7"/>`,
    // Left companion — smaller
    `<rect x="48" y="148" width="2.5" height="16" fill="${espresso}" opacity="0.5" rx="0.5"/>`,
    `<path d="M40,152 C43,144 47,140 50,136 C53,140 57,144 60,152" fill="${espresso}" opacity="0.35"/>`,
    `<path d="M42,148 C45,142 48,139 50,135 C52,139 55,142 58,148" fill="${espresso}" opacity="0.42"/>`,
    // Right pine — tall
    `<rect x="248" y="138" width="3" height="24" fill="${espresso}" opacity="0.65" rx="1"/>`,
    `<path d="M238,142 C242,132 246,126 250,120 C254,126 258,132 262,142" fill="${espresso}" opacity="0.35"/>`,
    `<path d="M240,136 C244,128 247,124 250,118 C253,124 256,128 260,136" fill="${espresso}" opacity="0.45"/>`,
    `<path d="M242,130 C245,124 248,122 250,116 C252,122 255,124 258,130" fill="${espresso}" opacity="0.55"/>`,
    // Right companion
    `<rect x="262" y="148" width="2.5" height="16" fill="${espresso}" opacity="0.5" rx="0.5"/>`,
    `<path d="M255,152 C258,146 261,142 264,139 C267,142 270,146 273,152" fill="${espresso}" opacity="0.32"/>`,
    '</g>',
    // Wildflowers & grass — richer
    '<g class="flora" opacity="0.55">',
    // Coral wildflowers
    `<line x1="58" y1="164" x2="58" y2="155" stroke="${success}" stroke-width="0.9" opacity="0.6"/>`,
    `<circle cx="58" cy="153" r="2.5" fill="${sunsetCoral}" opacity="0.65"/>`,
    `<line x1="70" y1="166" x2="71" y2="158" stroke="${success}" stroke-width="0.8" opacity="0.5"/>`,
    `<circle cx="71" cy="156" r="2" fill="${sandBase}" opacity="0.55"/>`,
    `<line x1="82" y1="165" x2="82" y2="157" stroke="${success}" stroke-width="0.7" opacity="0.45"/>`,
    `<circle cx="82" cy="155" r="1.8" fill="${sunsetCoral}" opacity="0.5"/>`,
    // Blue wildflowers
    `<line x1="210" y1="162" x2="210" y2="154" stroke="${success}" stroke-width="0.9" opacity="0.55"/>`,
    `<circle cx="210" cy="152" r="2.4" fill="${sunsetCoral}" opacity="0.6"/>`,
    `<line x1="224" y1="165" x2="225" y2="157" stroke="${success}" stroke-width="0.7" opacity="0.4"/>`,
    `<circle cx="225" cy="155" r="1.6" fill="${mountainBlueLight}" opacity="0.45"/>`,
    `<line x1="236" y1="164" x2="236" y2="157" stroke="${success}" stroke-width="0.7" opacity="0.4"/>`,
    `<circle cx="236" cy="155" r="1.5" fill="${sunsetCoral}" opacity="0.4"/>`,
    // Grass tufts
    `<path d="M95,168 C97,162 99,166 101,160 C103,166 105,162 107,168" fill="none" stroke="${success}" stroke-width="0.5" opacity="0.3"/>`,
    `<path d="M155,170 C157,164 159,168 161,162 C163,168 165,164 167,170" fill="none" stroke="${success}" stroke-width="0.5" opacity="0.25"/>`,
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
    `<rect width="${SCENE_VB_W}" height="${SCENE_VB_H}" filter="url(#ec-paper-grain)" opacity="0.10" fill="${espresso}"/>`,
    '</svg>',
  ].join('');
}

// ══════════════════════════════════════════════════════════════════════
// ── Checkout Progress (full-width, 1440×120) ─────────────────────────
// ══════════════════════════════════════════════════════════════════════

const PROG_VB_W = 1440;
const PROG_VB_H = 120;
const PROG_STEPS = 4;

const PROG_SKY_GRADIENT = [
  { offset: '0%', color: colors.skyGradientTop, opacity: 0.85 },
  { offset: '25%', color: colors.mountainBlueLight, opacity: 0.7 },
  { offset: '50%', color: colors.skyGradientBottom, opacity: 0.55 },
  { offset: '75%', color: colors.sandLight, opacity: 0.65 },
  { offset: '100%', color: colors.sandBase, opacity: 0.5 },
];

const PROG_RIDGELINES = [
  {
    name: 'ridge-distant',
    path: 'M0,120 L0,58 C80,50 160,38 280,42 C400,46 480,32 600,28 C720,24 800,36 920,32 C1040,28 1120,40 1240,36 C1320,34 1400,44 1440,40 L1440,120 Z',
    color: colors.mountainBlue,
    opacity: 0.15,
  },
  {
    name: 'ridge-mid',
    path: 'M0,120 L0,72 C100,66 180,54 300,58 C420,62 500,48 620,44 C740,40 820,52 940,48 C1060,44 1140,56 1260,52 C1340,50 1410,58 1440,56 L1440,120 Z',
    color: colors.mountainBlueDark,
    opacity: 0.25,
  },
  {
    name: 'ridge-near',
    path: 'M0,120 L0,86 C120,80 200,70 320,74 C440,78 520,64 640,60 C760,56 840,68 960,64 C1080,60 1160,72 1280,68 C1360,66 1420,74 1440,72 L1440,120 Z',
    color: colors.espresso,
    opacity: 0.35,
  },
  {
    name: 'ridge-front',
    path: 'M0,120 L0,96 C140,92 220,84 340,88 C460,92 540,80 660,76 C780,72 860,84 980,80 C1100,76 1180,86 1300,82 C1380,80 1430,88 1440,86 L1440,120 Z',
    color: colors.espresso,
    opacity: 0.55,
  },
];

// Trail marker x-positions for 4 steps, evenly spaced
const MARKER_POSITIONS = [240, 560, 880, 1200];

function buildProgressTrailPath() {
  return `M${MARKER_POSITIONS[0] - 60},90 C${MARKER_POSITIONS[0]},82 ${MARKER_POSITIONS[1] - 80},78 ${MARKER_POSITIONS[1]},74 C${MARKER_POSITIONS[1] + 80},70 ${MARKER_POSITIONS[2] - 80},72 ${MARKER_POSITIONS[2]},68 C${MARKER_POSITIONS[2] + 80},64 ${MARKER_POSITIONS[3] - 80},66 ${MARKER_POSITIONS[3] + 60},62`;
}

function buildProgressMarker(x, y, isActive, isCompleted) {
  const fill = (isActive || isCompleted) ? colors.sunsetCoral : colors.mountainBlueLight;
  const ringColor = (isActive || isCompleted) ? colors.sunsetCoralLight : colors.mutedBrown;
  const innerOpacity = isCompleted ? 1 : (isActive ? 0.85 : 0.4);
  const parts = [];
  // Outer glow for active
  if (isActive) {
    parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="${colors.sunsetCoralLight}" opacity="0.2"/>`);
  }
  // Ring
  parts.push(`<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${ringColor}" stroke-width="2" opacity="0.6"/>`);
  // Inner fill
  parts.push(`<circle cx="${x}" cy="${y}" r="8" fill="${fill}" opacity="${innerOpacity}"/>`);
  // Checkmark for completed steps
  if (isCompleted) {
    parts.push(`<path d="M${x - 4},${y} L${x - 1},${y + 3} L${x + 4},${y - 3}" fill="none" stroke="${colors.offWhite}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  return parts.join('');
}

function buildProgressBirds() {
  const c = colors.espresso;
  return [
    `<path d="M400,22 C403,19 406,17 408,19 C410,17 413,19 416,22" fill="none" stroke="${c}" stroke-width="0.8" stroke-linecap="round" opacity="0.3"/>`,
    `<path d="M1020,16 C1022,14 1024,13 1025,14 C1026,13 1028,14 1030,16" fill="none" stroke="${c}" stroke-width="0.6" stroke-linecap="round" opacity="0.25"/>`,
    `<path d="M700,12 C703,9 706,8 708,10 C710,8 713,9 716,12" fill="none" stroke="${c}" stroke-width="0.7" stroke-linecap="round" opacity="0.28"/>`,
  ].join('');
}

function buildProgressPines() {
  const c = colors.espresso;
  return [
    // Left cluster
    `<rect x="120" y="86" width="3" height="18" fill="${c}" opacity="0.4" rx="1"/>`,
    `<path d="M112,90 C116,82 120,78 122,74 C124,78 128,82 132,90" fill="${c}" opacity="0.25"/>`,
    `<path d="M114,86 C117,80 120,77 122,73 C124,77 127,80 130,86" fill="${c}" opacity="0.32"/>`,
    // Right cluster
    `<rect x="1340" y="78" width="3" height="16" fill="${c}" opacity="0.35" rx="1"/>`,
    `<path d="M1332,82 C1335,76 1339,72 1342,68 C1345,72 1349,76 1352,82" fill="${c}" opacity="0.22"/>`,
    `<path d="M1334,78 C1337,73 1340,70 1342,67 C1344,70 1347,73 1350,78" fill="${c}" opacity="0.3"/>`,
  ].join('');
}

function buildProgressFlora() {
  const p = colors.sunsetCoral;
  const g = colors.success;
  return [
    `<line x1="160" y1="98" x2="160" y2="92" stroke="${g}" stroke-width="0.7" opacity="0.4"/>`,
    `<circle cx="160" cy="91" r="1.8" fill="${p}" opacity="0.45"/>`,
    `<line x1="1380" y1="90" x2="1380" y2="84" stroke="${g}" stroke-width="0.6" opacity="0.35"/>`,
    `<circle cx="1380" cy="83" r="1.5" fill="${colors.sandBase}" opacity="0.4"/>`,
    `<line x1="720" y1="78" x2="720" y2="72" stroke="${g}" stroke-width="0.6" opacity="0.35"/>`,
    `<circle cx="720" cy="71" r="1.5" fill="${p}" opacity="0.4"/>`,
  ].join('');
}

/**
 * Generate checkout progress illustration SVG — a mountain trail with
 * step markers showing progress through Cart, Shipping, Payment, Confirmation.
 * @param {Object} [options]
 * @param {number} [options.step=1] - Current step (1-4)
 * @returns {string} Complete inline SVG markup
 */
export function generateCheckoutProgressSVG(options) {
  const opts = options || {};
  const step = Math.max(1, Math.min(PROG_STEPS, typeof opts.step === 'number' ? opts.step : 1));

  const gradId = 'prog-sky-grad';
  const stops = PROG_SKY_GRADIENT.map(
    (s) => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`
  ).join('');

  const ridges = PROG_RIDGELINES.map(
    (r) => `<path class="${r.name}" d="${r.path}" fill="${r.color}" opacity="${r.opacity}"/>`
  ).join('');

  const trailPath = buildProgressTrailPath();
  // Trail segments: completed portion in coral, remaining in muted
  const trail = [
    `<path d="${trailPath}" fill="none" stroke="${colors.mutedBrown}" stroke-width="2" stroke-dasharray="8 4" opacity="0.3"/>`,
  ].join('');

  // Y positions along the trail for each marker
  const markerYs = [90, 74, 68, 62];
  const markers = MARKER_POSITIONS.map((x, i) => {
    const stepNum = i + 1;
    const isCompleted = stepNum < step;
    const isActive = stepNum === step;
    return buildProgressMarker(x, markerYs[i], isActive, isCompleted);
  }).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="80" viewBox="0 0 ${PROG_VB_W} ${PROG_VB_H}" preserveAspectRatio="none" aria-hidden="true" role="presentation">`,
    `<defs>`,
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`,
    `</defs>`,
    `<rect width="${PROG_VB_W}" height="${PROG_VB_H}" fill="url(#${gradId})"/>`,
    buildProgressBirds(),
    ridges,
    trail,
    buildProgressPines(),
    buildProgressFlora(),
    markers,
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
 * Inject checkout progress illustration into a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {number} [options.step=1] - Current checkout step (1-4)
 */
export function initCheckoutProgress($w, options) {
  try {
    if (!$w) return;
    const container = $w('#checkoutProgress');
    if (!container) return;
    container.html = generateCheckoutProgressSVG(options);
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
