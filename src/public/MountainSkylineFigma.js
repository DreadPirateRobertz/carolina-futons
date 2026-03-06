/**
 * MountainSkylineFigma.js — Static SVG mountain skyline (Figma-first approach)
 *
 * Loads a pre-designed, pipeline-processed SVG asset instead of generating
 * SVG programmatically. The SVG content below is the optimized output from
 * the Figma export pipeline (scripts/svgPipeline.js) — NOT a JS template string.
 *
 * Source: src/assets/illustrations/mountain-skyline-figma.svg
 * Pipeline: Figma export -> optimizeSvg -> ridge classes -> embed here
 *
 * To update: edit the source SVG, re-run the pipeline, copy the optimized
 * inner content into SVG_CONTENT below.
 *
 * hq-zvz2: POC — Figma Draw redesign proves quality improvement
 *
 * @module MountainSkylineFigma
 */

const DEFAULT_HEIGHT = 120;

// Static SVG inner content from pipeline output (mountain-skyline-figma.optimized.svg).
// This is a literal string — no template interpolation, no programmatic generation.
// All colors are from sharedTokens.js (verified by pipeline token injection step).
// eslint-disable-next-line
const SVG_CONTENT = '<defs><linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3" stop-opacity="1"/><stop offset="15%" stop-color="#A8CCD8" stop-opacity="0.95"/><stop offset="30%" stop-color="#B8D4E3" stop-opacity="0.8"/><stop offset="50%" stop-color="#F0C87A" stop-opacity="0.65"/><stop offset="70%" stop-color="#F2E8D5" stop-opacity="0.75"/><stop offset="85%" stop-color="#F2A882" stop-opacity="0.45"/><stop offset="100%" stop-color="#F2E8D5" stop-opacity="0.55"/></linearGradient><filter id="haze"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="soft-edge"><feGaussianBlur stdDeviation="1.2"/></filter><linearGradient id="haze-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B8D4E3" stop-opacity="0"/><stop offset="40%" stop-color="#B8D4E3" stop-opacity="0.06"/><stop offset="100%" stop-color="#A8CCD8" stop-opacity="0.12"/></linearGradient></defs><rect width="1440" height="200" fill="url(#sky-grad)"/><path class="ridge-1" d="M0,200 L0,102 C32,98 58,78 95,71 C132,64 158,74 195,68 C232,62 262,48 310,42 C358,36 382,52 425,46 C468,40 498,28 548,32 C598,36 622,52 668,48 C714,44 742,30 792,34 C842,38 868,55 915,50 C962,45 988,58 1038,52 C1088,46 1118,38 1165,42 C1212,46 1238,60 1288,55 C1338,50 1368,40 1408,44 C1428,46 1436,52 1440,58 L1440,200 Z" fill="#5B8FA8" opacity="0.10" filter="url(#soft-edge)"/><path class="ridge-2" d="M0,200 L0,115 C38,110 62,88 108,82 C154,76 178,92 225,86 C272,80 298,60 348,55 C398,50 425,68 472,62 C519,56 548,40 598,44 C648,48 675,65 722,60 C769,55 798,38 848,42 C898,46 925,62 972,58 C1019,54 1048,42 1098,46 C1148,50 1175,64 1222,60 C1269,56 1298,44 1348,48 C1398,52 1422,66 1440,70 L1440,200 Z" fill="#5B8FA8" opacity="0.16"/><path class="ridge-3" d="M0,200 L0,128 C35,123 55,100 98,92 C141,84 162,102 208,94 C254,86 278,62 328,56 C378,50 402,70 448,65 C494,60 522,42 572,38 C622,34 648,58 698,54 C748,50 775,35 825,40 C875,45 902,64 948,58 C994,52 1022,42 1068,46 C1114,50 1142,68 1188,62 C1234,56 1262,44 1308,48 C1354,52 1382,68 1440,74 L1440,200 Z" fill="#3A2518" opacity="0.22"/><path class="ridge-4" d="M0,200 L0,138 C42,133 65,112 112,106 C159,100 185,118 232,112 C279,106 308,86 358,82 C408,78 435,96 482,90 C529,84 558,68 608,64 C658,60 685,78 732,74 C779,70 808,55 858,58 C908,61 935,78 982,72 C1029,66 1058,82 1108,78 C1158,74 1185,62 1232,66 C1279,70 1308,84 1358,80 C1408,76 1428,88 1440,92 L1440,200 Z" fill="#3A2518" opacity="0.32"/><rect x="0" y="65" width="1440" height="45" fill="url(#haze-grad)" filter="url(#haze)"/><path class="ridge-5" d="M0,200 L0,146 C38,140 60,118 108,112 C156,106 182,126 230,120 C278,114 305,92 355,88 C405,84 432,104 480,98 C528,92 558,72 608,68 C658,64 685,85 732,80 C779,75 808,62 858,66 C908,70 935,88 982,82 C1029,76 1058,92 1108,88 C1158,84 1188,72 1238,76 C1288,80 1318,96 1368,90 C1418,84 1432,98 1440,104 L1440,200 Z" fill="#3A2518" opacity="0.45"/><path class="ridge-6" d="M0,200 L0,154 C35,150 58,136 105,131 C152,126 178,140 228,136 C278,132 305,118 355,114 C405,110 432,126 482,122 C532,118 562,106 612,102 C662,98 688,114 738,110 C788,106 818,96 868,100 C918,104 948,118 998,114 C1048,110 1078,122 1128,118 C1178,114 1208,102 1258,106 C1308,110 1338,126 1388,122 C1418,120 1432,130 1440,134 L1440,200 Z" fill="#5C4033" opacity="0.60"/><path class="ridge-7" d="M0,200 L0,162 C32,158 55,144 100,140 C145,136 172,150 222,146 C272,142 302,128 352,125 C402,122 432,136 482,132 C532,128 562,116 612,112 C662,108 692,126 742,122 C792,118 822,108 872,112 C922,116 952,130 1002,126 C1052,122 1082,134 1132,130 C1182,126 1212,116 1262,120 C1312,124 1342,138 1392,134 C1422,132 1434,142 1440,146 L1440,200 Z" fill="#3A2518" opacity="0.78"/><g class="birds" opacity="0.35"><path d="M308,32 C314,26 320,24 326,28 C332,24 338,26 344,32" fill="none" stroke="#3A2518" stroke-width="1.3" stroke-linecap="round"/><path d="M335,28 C339,24 343,23 347,26 C351,23 355,24 359,28" fill="none" stroke="#3A2518" stroke-width="1.0" stroke-linecap="round"/><path d="M565,22 C570,17 575,15 580,19 C585,15 590,17 595,22" fill="none" stroke="#3A2518" stroke-width="1.1" stroke-linecap="round"/><path d="M590,19 C593,16 596,15 599,17 C602,15 605,16 608,19" fill="none" stroke="#3A2518" stroke-width="0.8" stroke-linecap="round"/><path d="M842,38 C846,34 850,32 854,35 C858,32 862,34 866,38" fill="none" stroke="#3A2518" stroke-width="0.9" stroke-linecap="round"/><path d="M1088,28 C1092,24 1096,22 1100,25 C1104,22 1108,24 1112,28" fill="none" stroke="#3A2518" stroke-width="1.0" stroke-linecap="round"/></g><g class="pine-trees" opacity="0.55"><rect x="188" y="140" width="4" height="32" fill="#3A2518" opacity="0.7" rx="1"/><path d="M172,146 C180,128 188,118 190,110 C192,118 200,128 208,146" fill="#5C4033" opacity="0.45"/><path d="M176,139 C182,126 187,117 190,109 C193,117 198,126 204,139" fill="#5C4033" opacity="0.55"/><path d="M180,132 C185,122 188,115 190,108 C192,115 195,122 200,132" fill="#5C4033" opacity="0.65"/><rect x="1212" y="144" width="3" height="28" fill="#3A2518" opacity="0.65" rx="1"/><path d="M1198,148 C1204,136 1210,128 1214,122 C1218,128 1224,136 1230,148" fill="#5C4033" opacity="0.42"/><path d="M1201,142 C1206,132 1211,126 1214,120 C1217,126 1222,132 1227,142" fill="#5C4033" opacity="0.52"/><path d="M1204,136 C1208,128 1212,124 1214,118 C1216,124 1220,128 1224,136" fill="#5C4033" opacity="0.62"/><rect x="932" y="148" width="3" height="22" fill="#3A2518" opacity="0.5" rx="1"/><path d="M922,152 C926,142 930,136 934,132 C938,136 942,142 946,152" fill="#5C4033" opacity="0.35"/><path d="M925,147 C929,139 932,134 934,130 C936,134 939,139 943,147" fill="#5C4033" opacity="0.45"/></g><g class="wildflowers" opacity="0.48"><line x1="132" y1="180" x2="132" y2="170" stroke="#5C4033" stroke-width="1" opacity="0.5"/><circle cx="132" cy="168" r="2.8" fill="#E8845C" opacity="0.6"/><line x1="152" y1="182" x2="153" y2="173" stroke="#5C4033" stroke-width="0.8" opacity="0.4"/><circle cx="153" cy="171" r="2.2" fill="#E8D5B7" opacity="0.55"/><line x1="172" y1="179" x2="172" y2="171" stroke="#5C4033" stroke-width="0.9" opacity="0.45"/><circle cx="172" cy="169" r="2.5" fill="#F2A882" opacity="0.5"/><line x1="668" y1="178" x2="668" y2="168" stroke="#5C4033" stroke-width="1" opacity="0.5"/><circle cx="668" cy="166" r="3" fill="#E8845C" opacity="0.55"/><line x1="688" y1="180" x2="689" y2="172" stroke="#5C4033" stroke-width="0.8" opacity="0.4"/><circle cx="689" cy="170" r="2" fill="#A8CCD8" opacity="0.45"/><line x1="708" y1="177" x2="708" y2="169" stroke="#5C4033" stroke-width="0.9" opacity="0.42"/><circle cx="708" cy="167" r="2.3" fill="#E8D5B7" opacity="0.5"/><line x1="1292" y1="176" x2="1292" y2="167" stroke="#5C4033" stroke-width="0.9" opacity="0.45"/><circle cx="1292" cy="165" r="2.5" fill="#E8845C" opacity="0.52"/><line x1="1312" y1="179" x2="1313" y2="171" stroke="#5C4033" stroke-width="0.7" opacity="0.38"/><circle cx="1313" cy="169" r="1.8" fill="#E8D5B7" opacity="0.48"/></g><rect x="0" y="105" width="1440" height="25" fill="#B8D4E3" opacity="0.06" filter="url(#haze)"/><rect x="0" y="130" width="1440" height="18" fill="#B8D4E3" opacity="0.04"/>';

/**
 * Get the Figma-designed mountain skyline SVG markup.
 * Returns the static pipeline-processed SVG wrapped with responsive attributes.
 * @param {Object} [options]
 * @param {number} [options.height=120] - SVG height in pixels
 * @returns {string} Complete inline SVG markup
 */
export function getMountainSkylineSvg(options) {
  const opts = options || {};
  const height = (typeof opts.height === 'number' && opts.height > 0) ? opts.height : DEFAULT_HEIGHT;

  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="' + height + '" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true" role="presentation">' + SVG_CONTENT + '</svg>';
}

/**
 * Initialize Figma-designed mountain skyline on a Wix HtmlComponent.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.containerId='#mountainSkyline'] - Container element ID
 * @param {number} [options.height=120] - SVG height in pixels
 */
export function initMountainSkylineFigma($w, options) {
  try {
    if (!$w) { return; }
    const opts = options || {};
    const containerId = opts.containerId || '#mountainSkyline';
    const container = $w(containerId);
    if (!container) { return; }
    container.html = getMountainSkylineSvg({ height: opts.height });
  } catch (_e) { /* Element may not exist on all pages */ }
}
