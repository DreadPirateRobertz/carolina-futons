/**
 * MountainSkyline.js — Programmatic SVG mountain skyline border
 *
 * Signature brand element: a hand-illustrated watercolor mountain silhouette
 * with 7 ridgeline layers for Blue Ridge depth, rich sky gradients,
 * organic irregular paths, SVG filter effects (feTurbulence watercolor
 * texture, atmospheric haze, paper grain noise), and detail elements
 * (birds, pine trees, wildflowers). Uses brand tokens for all colors.
 *
 * Two modes:
 * - Standard (initMountainSkyline): sky gradient background for light pages
 * - Transparent (initMountainSkylineTransparent): no background for dark section dividers
 *
 * cf-989f: Mountain skyline SVG border for all page headers
 *
 * @module MountainSkyline
 */
import { colors } from 'public/sharedTokens';

const DEFAULT_HEIGHT = 120;
const VB_W = 1440;
const VB_H = 200;

// ── Gradient presets (5+ stops each for rich sky) ───────────────────

const GRADIENT_PRESETS = {
  sunrise: [
    { offset: '0%', color: colors.skyGradientTop, opacity: 1 },
    { offset: '20%', color: '#C5DCE8', opacity: 0.9 },
    { offset: '45%', color: colors.skyGradientBottom, opacity: 0.7 },
    { offset: '70%', color: '#F2D898', opacity: 0.8 },
    { offset: '85%', color: colors.sunsetCoralLight, opacity: 0.5 },
    { offset: '100%', color: colors.sandLight, opacity: 0.6 },
  ],
  sunset: [
    { offset: '0%', color: '#6B4E71', opacity: 0.6 },
    { offset: '15%', color: colors.sunsetCoral, opacity: 0.7 },
    { offset: '35%', color: colors.skyGradientBottom, opacity: 0.8 },
    { offset: '55%', color: '#E8A84C', opacity: 0.7 },
    { offset: '80%', color: colors.sunsetCoralLight, opacity: 0.5 },
    { offset: '100%', color: colors.sandLight, opacity: 0.4 },
  ],
};

// ── 7 ridgeline layers for Blue Ridge atmospheric depth ─────────────
// Each layer uses organic C-curve beziers with wobble offsets.
// Layers progress from distant (high, light, bluish haze) to near (low, dark).

const MOUNTAIN_LAYERS = [
  {
    name: 'distant',
    path: [
      'M0,200 L0,105',
      'C60,98 85,72 150,65',
      'C215,58 240,82 310,75',
      'C380,68 410,48 480,42',
      'C550,36 580,55 650,50',
      'C720,45 755,30 830,35',
      'C905,40 935,58 1010,52',
      'C1085,46 1115,62 1190,56',
      'C1265,50 1300,40 1370,45',
      'C1410,48 1430,58 1440,62',
      'L1440,200 Z',
    ].join(' '),
  },
  {
    name: 'far',
    path: [
      'M0,200 L0,118',
      'C48,112 70,88 135,82',
      'C200,76 225,98 290,90',
      'C355,82 385,60 450,55',
      'C515,50 545,72 615,66',
      'C685,60 715,42 790,46',
      'C865,50 895,68 965,62',
      'C1035,56 1070,44 1140,48',
      'C1210,52 1245,66 1310,60',
      'C1375,54 1405,70 1440,68',
      'L1440,200 Z',
    ].join(' '),
  },
  {
    name: 'back',
    path: [
      'M0,200 L0,130',
      'C40,125 55,98 100,90',
      'C145,82 165,105 210,95',
      'C255,85 280,58 340,52',
      'C400,46 420,72 480,68',
      'C540,64 570,42 640,38',
      'C710,34 730,62 800,58',
      'C870,54 895,36 960,42',
      'C1025,48 1050,72 1120,65',
      'C1190,58 1220,44 1280,48',
      'C1340,52 1370,68 1440,75',
      'L1440,200 Z',
    ].join(' '),
  },
  {
    name: 'mid-far',
    path: [
      'M0,200 L0,140',
      'C55,134 80,112 140,106',
      'C200,100 230,120 290,114',
      'C350,108 380,88 440,84',
      'C500,80 530,100 590,95',
      'C650,90 685,72 750,68',
      'C815,64 845,82 910,78',
      'C975,74 1005,90 1070,85',
      'C1135,80 1165,96 1230,92',
      'C1295,88 1325,74 1380,78',
      'C1415,80 1432,92 1440,96',
      'L1440,200 Z',
    ].join(' '),
  },
  {
    name: 'mid',
    path: [
      'M0,200 L0,148',
      'C50,140 75,118 130,112',
      'C185,106 210,128 270,122',
      'C330,116 355,92 420,88',
      'C485,84 510,108 570,102',
      'C630,96 665,72 730,68',
      'C795,64 820,88 880,85',
      'C940,82 965,96 1030,90',
      'C1095,84 1130,105 1190,100',
      'C1250,95 1285,78 1340,82',
      'C1395,86 1420,102 1440,108',
      'L1440,200 Z',
    ].join(' '),
  },
  {
    name: 'mid-near',
    path: [
      'M0,200 L0,155',
      'C42,150 68,135 125,130',
      'C182,125 208,142 268,138',
      'C328,134 355,118 418,115',
      'C481,112 510,128 572,124',
      'C634,120 668,108 728,105',
      'C788,102 818,118 878,116',
      'C938,114 968,124 1028,120',
      'C1088,116 1125,130 1185,128',
      'C1245,126 1282,115 1342,118',
      'C1402,121 1425,132 1440,136',
      'L1440,200 Z',
    ].join(' '),
  },
  {
    name: 'front',
    path: [
      'M0,200 L0,162',
      'C45,158 70,145 120,142',
      'C170,139 200,152 260,148',
      'C320,144 350,128 410,125',
      'C470,122 500,138 560,135',
      'C620,132 660,118 720,115',
      'C780,112 810,130 870,128',
      'C930,126 960,135 1020,132',
      'C1080,129 1120,140 1180,138',
      'C1240,136 1280,125 1340,128',
      'C1400,131 1425,142 1440,148',
      'L1440,200 Z',
    ].join(' '),
  },
];

// Opacity ramp: distant → front (atmospheric perspective)
const STANDARD_OPACITIES = [0.12, 0.18, 0.25, 0.38, 0.5, 0.68, 0.85];
const TRANSPARENT_OPACITIES = [0.12, 0.18, 0.28, 0.35, 0.42, 0.52, 0.6];

const STANDARD_LAYER_COLORS = [
  colors.mountainBlue,      // distant: blue haze
  colors.mountainBlue,      // far: blue haze
  colors.espresso,          // back
  colors.espresso,          // mid-far
  colors.espresso,          // mid
  colors.espresso,          // mid-near
  colors.espresso,          // front
];

const TRANSPARENT_LAYER_COLORS = [
  colors.mountainBlueLight, // distant
  colors.mountainBlueLight, // far
  colors.mountainBlueLight, // back
  colors.sandBase,          // mid-far
  colors.sandBase,          // mid
  colors.espressoLight,     // mid-near
  colors.espressoLight,     // front
];

function getLayerFills(transparent) {
  const opacities = transparent ? TRANSPARENT_OPACITIES : STANDARD_OPACITIES;
  const layerColors = transparent ? TRANSPARENT_LAYER_COLORS : STANDARD_LAYER_COLORS;
  return MOUNTAIN_LAYERS.map((layer, i) => ({
    name: layer.name,
    path: layer.path,
    color: layerColors[i],
    opacity: opacities[i],
  }));
}

function buildFilters() {
  return [
    '<filter id="cf-watercolor" x="-5%" y="-5%" width="110%" height="110%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="42" result="turbulence"/>',
    '<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="3" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    '<filter id="cf-paper-grain" x="0" y="0" width="100%" height="100%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="7" result="grain"/>',
    '<feColorMatrix in="grain" type="saturate" values="0" result="greyGrain"/>',
    '<feBlend in="SourceGraphic" in2="greyGrain" mode="multiply"/>',
    '</filter>',
    '<filter id="cf-haze" x="0" y="0" width="100%" height="100%">',
    '<feGaussianBlur stdDeviation="2" />',
    '</filter>',
  ].join('');
}

function buildAtmosphericHaze(transparent) {
  const hazeColor = transparent ? colors.mountainBlueLight : colors.skyGradientTop;
  return [
    '<g class="atmospheric-haze">',
    `<rect x="0" y="60" width="${VB_W}" height="40" fill="${hazeColor}" opacity="0.08" filter="url(#cf-haze)"/>`,
    `<rect x="0" y="100" width="${VB_W}" height="30" fill="${hazeColor}" opacity="0.05" filter="url(#cf-haze)"/>`,
    `<rect x="0" y="130" width="${VB_W}" height="20" fill="${hazeColor}" opacity="0.03"/>`,
    '</g>',
  ].join('');
}

function buildBirds(layerFills) {
  const c = layerFills[layerFills.length - 1].color;
  return [
    '<g class="bird" opacity="0.4">',
    `<path d="M320,35 C325,30 330,28 335,32 C340,28 345,30 350,35" fill="none" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>`,
    `<path d="M580,25 C584,21 587,19 590,22 C593,19 596,21 600,25" fill="none" stroke="${c}" stroke-width="1" stroke-linecap="round"/>`,
    `<path d="M850,40 C853,37 856,35 858,37 C860,35 863,37 866,40" fill="none" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>`,
    `<path d="M1100,30 C1103,27 1106,25 1108,27 C1110,25 1113,27 1116,30" fill="none" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/>`,
    '</g>',
  ].join('');
}

function buildPineTrees(layerFills) {
  const t = layerFills[layerFills.length - 1].color;
  const b = layerFills[4].color;
  return [
    '<g class="pine" opacity="0.6">',
    `<rect x="198" y="140" width="4" height="30" fill="${t}" opacity="0.7" rx="1"/>`,
    `<path d="M180,145 C188,128 196,118 200,110 C204,118 212,128 220,145" fill="${b}" opacity="0.45"/>`,
    `<path d="M184,138 C190,124 196,116 200,108 C204,116 210,124 216,138" fill="${b}" opacity="0.55"/>`,
    `<path d="M188,130 C194,118 198,112 200,106 C202,112 206,118 212,130" fill="${b}" opacity="0.65"/>`,
    `<rect x="1218" y="145" width="3" height="25" fill="${t}" opacity="0.6" rx="1"/>`,
    `<path d="M1204,150 C1210,138 1216,130 1220,124 C1224,130 1230,138 1236,150" fill="${b}" opacity="0.4"/>`,
    `<path d="M1207,144 C1212,134 1217,128 1220,122 C1223,128 1228,134 1233,144" fill="${b}" opacity="0.5"/>`,
    `<path d="M1210,138 C1214,130 1218,126 1220,120 C1222,126 1226,130 1230,138" fill="${b}" opacity="0.6"/>`,
    `<rect x="938" y="150" width="3" height="20" fill="${t}" opacity="0.5" rx="1"/>`,
    `<path d="M928,154 C932,144 937,138 940,134 C943,138 948,144 952,154" fill="${b}" opacity="0.35"/>`,
    `<path d="M931,149 C935,141 938,137 940,133 C942,137 945,141 949,149" fill="${b}" opacity="0.45"/>`,
    '</g>',
  ].join('');
}

function buildFlora(layerFills) {
  const p = colors.sunsetCoral;
  const s = layerFills[4].color;
  return [
    '<g class="flora" opacity="0.5">',
    `<line x1="140" y1="180" x2="140" y2="170" stroke="${s}" stroke-width="1" opacity="0.5"/>`,
    `<circle cx="140" cy="168" r="2.5" fill="${p}" opacity="0.6"/>`,
    `<line x1="160" y1="182" x2="161" y2="173" stroke="${s}" stroke-width="0.8" opacity="0.4"/>`,
    `<circle cx="161" cy="171" r="2" fill="${colors.sandBase}" opacity="0.5"/>`,
    `<line x1="680" y1="178" x2="680" y2="168" stroke="${s}" stroke-width="1" opacity="0.5"/>`,
    `<circle cx="680" cy="166" r="3" fill="${p}" opacity="0.55"/>`,
    `<line x1="700" y1="180" x2="701" y2="172" stroke="${s}" stroke-width="0.8" opacity="0.4"/>`,
    `<circle cx="701" cy="170" r="2" fill="${colors.mountainBlueLight}" opacity="0.4"/>`,
    `<line x1="1300" y1="176" x2="1300" y2="167" stroke="${s}" stroke-width="0.9" opacity="0.45"/>`,
    `<circle cx="1300" cy="165" r="2.5" fill="${p}" opacity="0.5"/>`,
    `<line x1="1320" y1="179" x2="1321" y2="171" stroke="${s}" stroke-width="0.7" opacity="0.35"/>`,
    `<circle cx="1321" cy="169" r="1.8" fill="${colors.sandBase}" opacity="0.45"/>`,
    '</g>',
  ].join('');
}

function buildMountainLayers(layerFills) {
  return layerFills.map((lf) =>
    `<path class="mountain-${lf.name}" d="${lf.path}" fill="${lf.color}" opacity="${lf.opacity}" filter="url(#cf-watercolor)"/>`
  ).join('');
}

/**
 * Generate a richly illustrated mountain skyline SVG string.
 * 7 ridgeline layers with atmospheric haze for Blue Ridge depth.
 * @param {Object} [options]
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Gradient variant
 * @param {boolean} [options.transparent=false] - Omit sky background for dark pages
 * @param {number} [options.height=120] - SVG height in pixels
 * @returns {string} Complete inline SVG markup
 */
export function generateMountainSVG(options) {
  const opts = options || {};
  const variant = GRADIENT_PRESETS[opts.variant] ? opts.variant : 'sunrise';
  const transparent = Boolean(opts.transparent);
  const height = (typeof opts.height === 'number' && opts.height > 0) ? opts.height : DEFAULT_HEIGHT;
  const grad = GRADIENT_PRESETS[variant];
  const layerFills = getLayerFills(transparent);
  const gradId = `cf-sky-grad-${variant}`;

  const stops = grad.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`).join('');
  const skyRect = transparent ? '' : `<rect width="${VB_W}" height="${VB_H}" fill="url(#${gradId})"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none" aria-hidden="true" role="presentation">`,
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>${buildFilters()}</defs>`,
    skyRect,
    buildBirds(layerFills),
    buildMountainLayers(layerFills),
    buildAtmosphericHaze(transparent),
    buildPineTrees(layerFills),
    buildFlora(layerFills),
    `<rect width="${VB_W}" height="${VB_H}" filter="url(#cf-paper-grain)" opacity="0.06" fill="${colors.espresso}"/>`,
    '</svg>',
  ].join('');
}

/**
 * Initialize mountain skyline on a Wix HtmlComponent (light page headers).
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
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
    container.html = generateMountainSVG({ variant: opts.variant, height: opts.height });
  } catch (_e) { /* Element may not exist on all pages */ }
}

/**
 * Initialize mountain skyline for dark bg section dividers (no sky background).
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.containerId='#mountainSkyline'] - Container element ID
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Gradient variant
 * @param {number} [options.height=120] - SVG height in pixels
 */
export function initMountainSkylineTransparent($w, options) {
  try {
    if (!$w) { return; }
    const opts = options || {};
    const containerId = opts.containerId || '#mountainSkyline';
    const container = $w(containerId);
    if (!container) { return; }
    container.html = generateMountainSVG({ variant: opts.variant, height: opts.height, transparent: true });
  } catch (_e) { /* Element may not exist on all pages */ }
}
