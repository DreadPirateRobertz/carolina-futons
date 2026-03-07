/**
 * CartIllustrationsFigma.js — Static SVG cart illustrations (Figma-first approach)
 *
 * Two illustrations for the cart page:
 *  1. Cart header skyline (1440x200, decorative) — mountain panorama
 *  2. Empty cart scene (280x200, meaningful) — mountain trail with empty pack
 *
 * The SVG content below is the optimized output from the Figma export pipeline.
 * All colors are from sharedTokens.js (verified by pipeline token injection step).
 *
 * Source: Figma Draw → export → SVGO → token injection → embed
 * Pipeline: scripts/svgPipeline.js
 *
 * cf-aij: Cart illustrations redesign (Figma-first pipeline)
 *
 * @module CartIllustrationsFigma
 */

const DEFAULT_HEIGHT = 120;

// ── Cart Skyline (1440x200 decorative header) ────────────────────────
// Static SVG inner content — no template interpolation.
// eslint-disable-next-line
const CART_SKYLINE_SVG = '<defs><linearGradient id="cart-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3" stop-opacity="1"/><stop offset="12%" stop-color="#A8CCD8" stop-opacity="0.95"/><stop offset="28%" stop-color="#B8D4E3" stop-opacity="0.82"/><stop offset="45%" stop-color="#F0C87A" stop-opacity="0.68"/><stop offset="62%" stop-color="#F2E8D5" stop-opacity="0.72"/><stop offset="80%" stop-color="#F2A882" stop-opacity="0.48"/><stop offset="100%" stop-color="#F2E8D5" stop-opacity="0.55"/></linearGradient><filter id="cart-haze"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="cart-soft"><feGaussianBlur stdDeviation="1.0"/></filter><linearGradient id="cart-haze-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3" stop-opacity="0"/><stop offset="45%" stop-color="#B8D4E3" stop-opacity="0.07"/><stop offset="100%" stop-color="#A8CCD8" stop-opacity="0.13"/></linearGradient></defs><rect width="1440" height="200" fill="url(#cart-sky)"/><path class="ridge-1" d="M0,200 L0,105 C40,100 68,80 110,72 C152,64 180,76 225,70 C270,64 305,48 355,42 C405,36 435,55 480,48 C525,41 558,30 610,34 C662,38 690,54 740,50 C790,46 822,32 875,36 C928,40 958,58 1008,52 C1058,46 1090,36 1140,40 C1190,44 1220,62 1272,56 C1324,50 1358,42 1408,46 C1430,48 1438,54 1440,60 L1440,200 Z" fill="#5B8FA8" opacity="0.10" filter="url(#cart-soft)"/><path class="ridge-2" d="M0,200 L0,118 C42,112 66,90 115,84 C164,78 190,95 240,88 C290,81 318,62 370,56 C422,50 452,70 505,64 C558,58 588,42 642,46 C696,50 725,68 778,62 C831,56 862,40 918,44 C974,48 1005,65 1058,60 C1111,55 1142,44 1198,48 C1254,52 1285,66 1340,62 C1395,58 1420,68 1440,72 L1440,200 Z" fill="#5B8FA8" opacity="0.17"/><path class="ridge-3" d="M0,200 L0,130 C38,124 60,102 108,94 C156,86 180,106 230,98 C280,90 310,65 362,58 C414,51 442,72 495,66 C548,60 578,44 632,40 C686,36 715,60 768,55 C821,50 852,36 908,42 C964,48 995,66 1048,60 C1101,54 1132,44 1188,48 C1244,52 1275,70 1330,64 C1385,58 1412,70 1440,76 L1440,200 Z" fill="#3A2518" opacity="0.23"/><path class="ridge-4" d="M0,200 L0,140 C45,135 70,114 120,108 C170,102 198,120 250,114 C302,108 335,88 388,84 C441,80 472,98 525,92 C578,86 610,70 665,66 C720,62 750,80 805,76 C860,72 892,58 948,62 C1004,66 1035,82 1090,76 C1145,70 1178,84 1232,80 C1286,76 1318,64 1372,68 C1426,72 1436,90 1440,94 L1440,200 Z" fill="#3A2518" opacity="0.34"/><rect x="0" y="68" width="1440" height="42" fill="url(#cart-haze-grad)" filter="url(#cart-haze)"/><path class="ridge-5" d="M0,200 L0,148 C40,142 62,120 112,114 C162,108 190,128 242,122 C294,116 325,94 378,90 C431,86 462,106 515,100 C568,94 600,74 655,70 C710,66 740,88 795,82 C850,76 882,64 938,68 C994,72 1025,90 1080,84 C1135,78 1168,94 1222,90 C1276,86 1308,74 1362,78 C1416,82 1434,100 1440,106 L1440,200 Z" fill="#3A2518" opacity="0.46"/><path class="ridge-6" d="M0,200 L0,156 C38,152 62,138 112,133 C162,128 188,142 242,138 C296,134 325,120 378,116 C431,112 462,128 515,124 C568,120 600,108 655,104 C710,100 742,116 798,112 C854,108 885,98 940,102 C995,106 1028,120 1082,116 C1136,112 1168,124 1222,120 C1276,116 1308,104 1362,108 C1416,112 1434,132 1440,136 L1440,200 Z" fill="#5C4033" opacity="0.61"/><path class="ridge-7" d="M0,200 L0,164 C35,160 58,146 108,142 C158,138 185,152 238,148 C291,144 322,130 375,127 C428,124 458,138 512,134 C566,130 598,118 652,114 C706,110 738,128 792,124 C846,120 878,110 932,114 C986,118 1018,132 1072,128 C1126,124 1158,136 1212,132 C1266,128 1298,118 1352,122 C1406,126 1434,144 1440,148 L1440,200 Z" fill="#3A2518" opacity="0.78"/><g class="birds" opacity="0.36"><path d="M280,35 C286,29 292,27 298,31 C304,27 310,29 316,35" fill="none" stroke="#3A2518" stroke-width="1.3" stroke-linecap="round"/><path d="M310,30 C314,26 318,25 322,28 C326,25 330,26 334,30" fill="none" stroke="#3A2518" stroke-width="1.0" stroke-linecap="round"/><path d="M520,24 C525,19 530,17 535,21 C540,17 545,19 550,24" fill="none" stroke="#3A2518" stroke-width="1.1" stroke-linecap="round"/><path d="M548,20 C551,17 554,16 557,18 C560,16 563,17 566,20" fill="none" stroke="#3A2518" stroke-width="0.8" stroke-linecap="round"/><path d="M810,40 C814,36 818,34 822,37 C826,34 830,36 834,40" fill="none" stroke="#3A2518" stroke-width="0.9" stroke-linecap="round"/><path d="M1060,30 C1064,26 1068,24 1072,27 C1076,24 1080,26 1084,30" fill="none" stroke="#3A2518" stroke-width="1.0" stroke-linecap="round"/></g><g class="pine-trees" opacity="0.55"><rect x="205" y="142" width="4" height="30" fill="#3A2518" opacity="0.68" rx="1"/><path d="M190,148 C198,130 205,120 207,112 C209,120 216,130 224,148" fill="#5C4033" opacity="0.44"/><path d="M194,141 C200,128 205,119 207,111 C209,119 214,128 220,141" fill="#5C4033" opacity="0.54"/><path d="M198,134 C202,124 205,117 207,110 C209,117 212,124 216,134" fill="#5C4033" opacity="0.64"/><rect x="1180" y="146" width="3" height="26" fill="#3A2518" opacity="0.62" rx="1"/><path d="M1167,150 C1173,138 1179,130 1182,124 C1185,130 1191,138 1197,150" fill="#5C4033" opacity="0.40"/><path d="M1170,144 C1175,134 1180,128 1182,122 C1184,128 1189,134 1194,144" fill="#5C4033" opacity="0.50"/><path d="M1173,138 C1177,130 1180,126 1182,120 C1184,126 1187,130 1191,138" fill="#5C4033" opacity="0.60"/><rect x="900" y="150" width="3" height="20" fill="#3A2518" opacity="0.48" rx="1"/><path d="M891,154 C895,144 899,138 902,134 C905,138 909,144 913,154" fill="#5C4033" opacity="0.34"/><path d="M894,149 C898,141 901,136 902,132 C903,136 906,141 910,149" fill="#5C4033" opacity="0.44"/></g><g class="wildflowers" opacity="0.46"><line x1="140" y1="182" x2="140" y2="172" stroke="#5C4033" stroke-width="1" opacity="0.48"/><circle cx="140" cy="170" r="2.8" fill="#E8845C" opacity="0.58"/><line x1="160" y1="184" x2="161" y2="175" stroke="#5C4033" stroke-width="0.8" opacity="0.38"/><circle cx="161" cy="173" r="2.2" fill="#E8D5B7" opacity="0.52"/><line x1="180" y1="181" x2="180" y2="173" stroke="#5C4033" stroke-width="0.9" opacity="0.43"/><circle cx="180" cy="171" r="2.5" fill="#F2A882" opacity="0.48"/><line x1="640" y1="180" x2="640" y2="170" stroke="#5C4033" stroke-width="1" opacity="0.48"/><circle cx="640" cy="168" r="3" fill="#E8845C" opacity="0.53"/><line x1="660" y1="182" x2="661" y2="174" stroke="#5C4033" stroke-width="0.8" opacity="0.38"/><circle cx="661" cy="172" r="2" fill="#A8CCD8" opacity="0.43"/><line x1="680" y1="179" x2="680" y2="171" stroke="#5C4033" stroke-width="0.9" opacity="0.40"/><circle cx="680" cy="169" r="2.3" fill="#E8D5B7" opacity="0.48"/><line x1="1260" y1="178" x2="1260" y2="169" stroke="#5C4033" stroke-width="0.9" opacity="0.43"/><circle cx="1260" cy="167" r="2.5" fill="#E8845C" opacity="0.50"/><line x1="1280" y1="181" x2="1281" y2="173" stroke="#5C4033" stroke-width="0.7" opacity="0.36"/><circle cx="1281" cy="171" r="1.8" fill="#E8D5B7" opacity="0.46"/></g><rect x="0" y="108" width="1440" height="22" fill="#B8D4E3" opacity="0.05" filter="url(#cart-haze)"/><rect x="0" y="132" width="1440" height="16" fill="#B8D4E3" opacity="0.04"/>';

// ── Empty Cart Scene (280x200 meaningful illustration) ────────────────
// eslint-disable-next-line
const EMPTY_CART_SVG = '<defs><linearGradient id="empty-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3" stop-opacity="1"/><stop offset="20%" stop-color="#A8CCD8" stop-opacity="0.92"/><stop offset="40%" stop-color="#B8D4E3" stop-opacity="0.78"/><stop offset="65%" stop-color="#F0C87A" stop-opacity="0.62"/><stop offset="85%" stop-color="#F2E8D5" stop-opacity="0.70"/><stop offset="100%" stop-color="#F2A882" stop-opacity="0.50"/></linearGradient><filter id="empty-haze"><feGaussianBlur stdDeviation="1.8"/></filter></defs><rect width="280" height="200" fill="url(#empty-sky)"/><path class="ridge-1" d="M0,200 L0,82 C18,78 32,65 52,60 C72,55 88,66 108,62 C128,58 148,45 172,40 C196,35 212,50 235,46 C258,42 270,52 280,56 L280,200 Z" fill="#5B8FA8" opacity="0.12" filter="url(#empty-haze)"/><path class="ridge-2" d="M0,200 L0,95 C20,90 38,76 62,70 C86,64 105,78 130,73 C155,68 175,54 200,50 C225,46 245,60 265,56 C275,54 278,60 280,64 L280,200 Z" fill="#5B8FA8" opacity="0.20"/><path class="ridge-3" d="M0,200 L0,110 C22,105 42,90 68,84 C94,78 115,94 142,88 C169,82 192,66 220,62 C248,58 265,72 278,76 L280,200 Z" fill="#3A2518" opacity="0.28"/><path class="ridge-4" d="M0,200 L0,125 C25,120 48,106 78,100 C108,94 132,110 162,105 C192,100 215,86 245,82 C262,80 274,90 280,94 L280,200 Z" fill="#3A2518" opacity="0.40"/><path class="ridge-5" d="M0,200 L0,140 C28,135 52,120 82,115 C112,110 138,126 168,120 C198,114 222,100 252,96 C268,94 276,104 280,108 L280,200 Z" fill="#5C4033" opacity="0.58"/><path d="M60,170 C80,165 105,162 130,158 C155,155 180,160 200,165 C220,170 240,175 260,178" fill="none" stroke="#E8D5B7" stroke-width="1.5" opacity="0.45" stroke-dasharray="4,3"/><rect x="125" y="135" width="30" height="35" rx="3" fill="none" stroke="#E8D5B7" stroke-width="1.5" opacity="0.55"/><path d="M130,135 L140,120 L150,135" fill="none" stroke="#E8D5B7" stroke-width="1.2" opacity="0.50"/><line x1="140" y1="120" x2="140" y2="112" stroke="#E8D5B7" stroke-width="1" opacity="0.40"/><rect x="15" y="155" width="3" height="18" fill="#3A2518" opacity="0.35" rx="0.5"/><rect x="15" y="150" width="3" height="5" fill="#E8D5B7" opacity="0.30" rx="0.5"/><path d="M235,148 L250,148 L250,175 L220,175 L220,158 L235,158 Z" fill="#3A2518" opacity="0.30"/><path d="M228,148 L242,138 L256,148" fill="none" stroke="#3A2518" stroke-width="1" opacity="0.25"/><rect x="232" y="160" width="8" height="10" fill="#F0C87A" opacity="0.35" rx="1"/><g class="birds" opacity="0.30"><path d="M40,30 C44,25 48,23 52,27 C56,23 60,25 64,30" fill="none" stroke="#3A2518" stroke-width="0.9" stroke-linecap="round"/><path d="M62,26 C65,23 68,22 71,24 C74,22 77,23 80,26" fill="none" stroke="#3A2518" stroke-width="0.7" stroke-linecap="round"/><path d="M190,22 C193,18 196,17 199,20 C202,17 205,18 208,22" fill="none" stroke="#3A2518" stroke-width="0.8" stroke-linecap="round"/></g><g class="wildflowers" opacity="0.42"><line x1="50" y1="185" x2="50" y2="177" stroke="#5C4033" stroke-width="0.8" opacity="0.40"/><circle cx="50" cy="175" r="2" fill="#E8845C" opacity="0.50"/><line x1="65" y1="183" x2="65" y2="176" stroke="#5C4033" stroke-width="0.7" opacity="0.35"/><circle cx="65" cy="174" r="1.8" fill="#F2A882" opacity="0.45"/><line x1="200" y1="182" x2="200" y2="175" stroke="#5C4033" stroke-width="0.8" opacity="0.38"/><circle cx="200" cy="173" r="2" fill="#E8D5B7" opacity="0.48"/><line x1="215" y1="180" x2="215" y2="174" stroke="#5C4033" stroke-width="0.7" opacity="0.35"/><circle cx="215" cy="172" r="1.5" fill="#E8845C" opacity="0.42"/></g>';

/**
 * Get the cart page header skyline SVG markup.
 * Returns the static pipeline-processed SVG wrapped with responsive attributes.
 * @param {Object} [options]
 * @param {number} [options.height=120] - SVG height in pixels
 * @returns {string} Complete inline SVG markup (decorative, aria-hidden)
 */
export function getCartSkylineSvg(options) {
  const opts = options || {};
  const height = (typeof opts.height === 'number' && opts.height > 0) ? opts.height : DEFAULT_HEIGHT;

  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="' + height + '" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true" role="presentation">' + CART_SKYLINE_SVG + '</svg>';
}

/**
 * Get the empty cart illustration SVG markup.
 * Returns a meaningful illustration with accessible title.
 * @returns {string} Complete inline SVG markup (meaningful, role="img")
 */
export function getEmptyCartSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="empty-cart-title"><title id="empty-cart-title">Your cart is empty — explore our collection</title>' + EMPTY_CART_SVG + '</svg>';
}

/**
 * Initialize cart header skyline on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {number} [options.height=120] - SVG height in pixels
 */
export function initCartSkyline($w, options) {
  try {
    if (!$w) { return; }
    const container = $w('#cartHeroSkyline');
    if (!container) { return; }
    container.html = getCartSkylineSvg(options);
  } catch (_e) { /* Element may not exist on all pages */ }
}

/**
 * Initialize empty cart illustration on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 */
export function initEmptyCartIllustration($w) {
  try {
    if (!$w) { return; }
    const container = $w('#emptyCartIllustration');
    if (!container) { return; }
    container.html = getEmptyCartSvg();
  } catch (_e) { /* Element may not exist on all pages */ }
}
