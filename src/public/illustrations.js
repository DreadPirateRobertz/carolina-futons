/**
 * @module illustrations
 * @description Web SVG illustrations for Carolina Futons empty states and section headers.
 * Ported from cfutons_mobile React Native SVG components to plain SVG markup strings.
 *
 * Each builder returns an SVG string that can be injected via $w('#element').html = svg.
 * All use the warm Blue Ridge Mountain palette from illustrationShared.js.
 *
 * @see cfutons_mobile/src/components/illustrations/ (source of truth for visual design)
 */
import { ILLUSTRATION_COLORS as c, buildSmallMountainPath } from 'public/illustrationShared';

const VBW = 280;
const VBH = 200;

function dims(opts) {
  const w = (opts && opts.width) || VBW;
  const h = (opts && opts.height) || VBH;
  return { w, h };
}

function svgOpen(w, h) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${VBW} ${VBH}" xmlns="http://www.w3.org/2000/svg">`;
}

function mountainLayers5(seeds, baseHeights, colors, opacities) {
  return seeds.map((seed, i) =>
    `<path d="${buildSmallMountainPath(VBW, VBH, baseHeights[i], seed)}" fill="${colors[i]}" opacity="${opacities[i]}"/>`
  ).join('');
}

// Standard 5-layer mountain set shared across most illustrations
const STD_SEEDS = [42, 17, 73, 29, 61];
const STD_BASE_HEIGHTS = [0.55, 0.62, 0.7, 0.78, 0.85];
const STD_COLORS = [c.mountainBlueDark, c.mountainBlue, c.espresso, c.espressoLight, c.sandDark];
const STD_OPACITIES = [0.2, 0.3, 0.35, 0.4, 0.5];

// ── CartIllustration ─────────────────────────────────────────────

/**
 * Empty cart mountain scene — sunset sky, trail markers, winding footpath.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildCartIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="cart-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.skyGradientTop}" stop-opacity="0.8"/>
    <stop offset="25%" stop-color="${c.mountainBlueLight}" stop-opacity="0.6"/>
    <stop offset="50%" stop-color="${c.sunsetCoralLight}" stop-opacity="0.4"/>
    <stop offset="75%" stop-color="${c.sandLight}" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="${c.offWhite}"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#cart-sky)"/>
<circle cx="200" cy="50" r="22" fill="${c.sunsetCoralLight}" opacity="0.7"/>
<circle cx="200" cy="50" r="15" fill="${c.sunsetCoral}" opacity="0.5"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS, STD_COLORS, STD_OPACITIES)}
<line x1="80" y1="158" x2="80" y2="145" stroke="${c.espresso}" stroke-width="1.5" opacity="0.5"/>
<line x1="78" y1="145" x2="82" y2="145" stroke="${c.espresso}" stroke-width="1" opacity="0.5"/>
<line x1="180" y1="162" x2="180" y2="150" stroke="${c.espresso}" stroke-width="1.5" opacity="0.4"/>
<line x1="178" y1="150" x2="182" y2="150" stroke="${c.espresso}" stroke-width="1" opacity="0.4"/>
<path d="M60 190 Q100 178 140 180 Q180 176 220 185 Q250 182 270 190" fill="none" stroke="${c.sandBase}" stroke-width="1.5" opacity="0.4"/>
</svg>`;
}

// ── ErrorIllustration ────────────────────────────────────────────

/**
 * Stormy mountain scene — dark clouds, lightning, for error/crash states.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildErrorIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="err-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.espresso}" stop-opacity="0.5"/>
    <stop offset="20%" stop-color="${c.mountainBlueDark}" stop-opacity="0.6"/>
    <stop offset="45%" stop-color="${c.espressoLight}" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="${c.mountainBlueDark}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="${c.sandDark}" stop-opacity="0.6"/>
  </linearGradient>
  <radialGradient id="err-lightning" cx="50%" cy="30%" r="25%">
    <stop offset="0%" stop-color="${c.sunsetCoralLight}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${c.sunsetCoralLight}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#err-sky)"/>
<ellipse cx="90" cy="45" rx="65" ry="18" fill="${c.espressoLight}" opacity="0.45"/>
<ellipse cx="180" cy="38" rx="55" ry="15" fill="${c.espresso}" opacity="0.5"/>
<ellipse cx="140" cy="55" rx="70" ry="20" fill="${c.espressoLight}" opacity="0.38"/>
<ellipse cx="210" cy="50" rx="50" ry="14" fill="${c.espresso}" opacity="0.42"/>
<path d="M130,60 L125,80 L132,78 L128,100" fill="none" stroke="${c.sunsetCoral}" stroke-width="2" opacity="0.6"/>
<path d="M160,55 L157,72 L163,70 L159,88" fill="none" stroke="${c.sunsetCoralLight}" stroke-width="1.5" opacity="0.45"/>
<path d="M195,62 L192,78 L197,76 L194,92" fill="none" stroke="${c.sunsetCoral}" stroke-width="1" opacity="0.35"/>
<circle cx="145" cy="70" r="30" fill="url(#err-lightning)"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS, STD_COLORS, STD_OPACITIES)}
</svg>`;
}

// ── SearchIllustration ───────────────────────────────────────────

/**
 * Open sky vista — fog wisps, distant bird — for search empty state.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildSearchIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="search-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.skyGradientTop}" stop-opacity="0.9"/>
    <stop offset="25%" stop-color="${c.mountainBlueLight}" stop-opacity="0.7"/>
    <stop offset="50%" stop-color="${c.skyGradientBottom}" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="${c.sandLight}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c.offWhite}"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#search-sky)"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS,
  [c.mountainBlueDark, c.mountainBlue, c.espressoLight, c.espressoLight, c.sandDark],
  [0.2, 0.3, 0.35, 0.4, 0.5])}
<ellipse cx="70" cy="110" rx="60" ry="10" fill="${c.offWhite}" opacity="0.35"/>
<ellipse cx="200" cy="100" rx="45" ry="8" fill="${c.offWhite}" opacity="0.45"/>
<ellipse cx="140" cy="120" rx="55" ry="9" fill="${c.offWhite}" opacity="0.5"/>
<path d="M190 40 C193 37 196 36 199 38 C202 36 205 37 208 40" fill="none" stroke="${c.espresso}" stroke-width="0.8" opacity="0.3"/>
</svg>`;
}

// ── ReviewsIllustration ──────────────────────────────────────────

/**
 * Sunrise golden-hour scene — radial sun glow, warm rays — for reviews.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildReviewsIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <radialGradient id="rev-sun" cx="50%" cy="55%" r="35%">
    <stop offset="0%" stop-color="${c.skyGradientBottom}" stop-opacity="0.9"/>
    <stop offset="30%" stop-color="${c.sunsetCoral}" stop-opacity="0.6"/>
    <stop offset="60%" stop-color="${c.sunsetCoralLight}" stop-opacity="0.3"/>
    <stop offset="100%" stop-color="${c.sunsetCoralDark}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="rev-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.mountainBlue}" stop-opacity="0.6"/>
    <stop offset="20%" stop-color="${c.skyGradientTop}" stop-opacity="0.7"/>
    <stop offset="45%" stop-color="${c.skyGradientBottom}" stop-opacity="0.8"/>
    <stop offset="70%" stop-color="${c.sandLight}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c.sandBase}" stop-opacity="0.6"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#rev-sky)"/>
<circle cx="140" cy="110" r="70" fill="url(#rev-sun)"/>
<line x1="140" y1="110" x2="90" y2="60" stroke="${c.sunsetCoralLight}" stroke-width="0.8" opacity="0.3"/>
<line x1="140" y1="110" x2="200" y2="55" stroke="${c.sunsetCoralLight}" stroke-width="0.8" opacity="0.25"/>
<line x1="140" y1="110" x2="60" y2="90" stroke="${c.sunsetCoralLight}" stroke-width="0.6" opacity="0.2"/>
<line x1="140" y1="110" x2="230" y2="80" stroke="${c.sunsetCoralLight}" stroke-width="0.6" opacity="0.2"/>
<line x1="140" y1="110" x2="140" y2="40" stroke="${c.sunsetCoralLight}" stroke-width="0.7" opacity="0.25"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS, STD_COLORS, STD_OPACITIES)}
</svg>`;
}

// ── WishlistIllustration ─────────────────────────────────────────

/**
 * Cozy cabin in mountains — chimney smoke, pine trees — for wishlist empty state.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildWishlistIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="wish-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.skyGradientTop}" stop-opacity="0.9"/>
    <stop offset="25%" stop-color="${c.mountainBlueLight}" stop-opacity="0.7"/>
    <stop offset="50%" stop-color="${c.skyGradientBottom}" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="${c.sandLight}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c.offWhite}"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#wish-sky)"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS, STD_COLORS, STD_OPACITIES)}
<polygon points="122,130 140,112 158,130" fill="${c.espresso}" opacity="0.8"/>
<rect x="122" y="130" width="36" height="28" fill="${c.espressoLight}"/>
<rect x="133" y="140" width="14" height="18" fill="${c.sandBase}"/>
<path d="M150,120 C151,114 148,108 152,104" fill="none" stroke="${c.espressoLight}" stroke-width="1" opacity="0.3"/>
<path d="M152,118 C153,112 150,106 154,102" fill="none" stroke="${c.espressoLight}" stroke-width="0.8" opacity="0.2"/>
<path d="M80,168 L80,140 M76,155 C72,148 80,140 84,148 C88,140 88,148 84,155 M78,148 C74,142 80,135 84,142 C88,135 88,142 84,148" fill="none" stroke="${c.mountainBlueDark}" stroke-width="1" opacity="0.5"/>
<path d="M220,172 L220,148 M216,160 C212,154 220,148 224,154 C228,148 228,154 224,160 M218,154 C214,148 220,142 224,148 C228,142 228,148 224,154" fill="none" stroke="${c.mountainBlueDark}" stroke-width="0.8" opacity="0.4"/>
<circle cx="155" cy="120" r="3" fill="${c.sunsetCoral}" opacity="0.6"/>
</svg>`;
}

// ── NotFoundIllustration ─────────────────────────────────────────

/**
 * Fog-shrouded mountains — heavy fog, fading trail — for 404 pages.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildNotFoundIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="nf-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.mountainBlueLight}" stop-opacity="0.7"/>
    <stop offset="25%" stop-color="${c.skyGradientTop}" stop-opacity="0.6"/>
    <stop offset="50%" stop-color="${c.sandLight}" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="${c.offWhite}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c.offWhite}"/>
  </linearGradient>
  <linearGradient id="nf-fog" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${c.offWhite}" stop-opacity="0"/>
    <stop offset="25%" stop-color="${c.offWhite}" stop-opacity="0.7"/>
    <stop offset="75%" stop-color="${c.offWhite}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c.offWhite}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#nf-sky)"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS,
  [c.mountainBlueDark, c.mountainBlue, c.espressoLight, c.espressoLight, c.sandDark],
  [0.2, 0.25, 0.3, 0.35, 0.4])}
<rect x="0" y="95" width="${VBW}" height="30" fill="url(#nf-fog)" opacity="0.6"/>
<rect x="0" y="130" width="${VBW}" height="25" fill="url(#nf-fog)" opacity="0.5"/>
<ellipse cx="100" cy="108" rx="55" ry="10" fill="${c.offWhite}" opacity="0.45"/>
<ellipse cx="200" cy="118" rx="50" ry="9" fill="${c.offWhite}" opacity="0.5"/>
<ellipse cx="150" cy="140" rx="60" ry="11" fill="${c.offWhite}" opacity="0.6"/>
<path d="M100 185 Q130 175 160 180 Q190 172 220 182" fill="none" stroke="${c.sandDark}" stroke-width="1" opacity="0.3"/>
<path d="M120 190 Q145 182 170 186 Q195 178 215 188" fill="none" stroke="${c.sandDark}" stroke-width="0.8" opacity="0.15"/>
</svg>`;
}

// ── CategoryIllustration ─────────────────────────────────────────

/**
 * Forest-and-mountain landscape — pine trees, winding path — for category browse.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildCategoryIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="cat-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.skyGradientTop}" stop-opacity="0.9"/>
    <stop offset="25%" stop-color="${c.mountainBlueLight}" stop-opacity="0.7"/>
    <stop offset="50%" stop-color="${c.skyGradientBottom}" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="${c.sandLight}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c.offWhite}"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#cat-sky)"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS, STD_COLORS, STD_OPACITIES)}
<path d="M50,175 L50,148 M46,162 C42,155 50,148 54,155 C58,148 58,155 54,162" fill="none" stroke="${c.mountainBlueDark}" stroke-width="1" opacity="0.5"/>
<path d="M200,170 L200,145 M196,158 C192,152 200,145 204,152 C208,145 208,152 204,158 M198,152 C194,146 200,140 204,146 C208,140 208,146 204,152" fill="none" stroke="${c.mountainBlueDark}" stroke-width="0.8" opacity="0.45"/>
<path d="M230,172 L230,150 M226,162 C222,156 230,150 234,156 C238,150 238,156 234,162" fill="none" stroke="${c.mountainBlue}" stroke-width="0.7" opacity="0.4"/>
<path d="M245,175 L245,155 M241,165 C238,160 245,155 249,160 C252,155 252,160 249,165" fill="none" stroke="${c.mountainBlue}" stroke-width="0.6" opacity="0.35"/>
<path d="M80 190 Q120 175 160 178 Q200 172 240 185" fill="${c.sandBase}" stroke="${c.espressoLight}" stroke-width="0.5" opacity="0.5"/>
<ellipse cx="95" cy="178" rx="3" ry="2" fill="${c.sunsetCoral}" opacity="0.5"/>
<ellipse cx="155" cy="176" rx="2.5" ry="1.8" fill="${c.sunsetCoralLight}" opacity="0.45"/>
<ellipse cx="210" cy="180" rx="2" ry="1.5" fill="${c.sunsetCoral}" opacity="0.4"/>
</svg>`;
}

// ── StreamIllustration ───────────────────────────────────────────

/**
 * Mountain creek — water ripples, rocks, sandy banks — for activity stream.
 * @param {Object} [opts] - { width, height }
 * @returns {string} SVG markup
 */
export function buildStreamIllustration(opts) {
  const { w, h } = dims(opts);
  return `${svgOpen(w, h)}
<defs>
  <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.skyGradientTop}" stop-opacity="0.8"/>
    <stop offset="25%" stop-color="${c.mountainBlueLight}" stop-opacity="0.6"/>
    <stop offset="50%" stop-color="${c.skyGradientBottom}" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="${c.sandLight}" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="${c.sandLight}"/>
  </linearGradient>
  <linearGradient id="sc-water" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0%" stop-color="${c.mountainBlueLight}" stop-opacity="0.7"/>
    <stop offset="50%" stop-color="${c.mountainBlue}" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="${c.mountainBlue}" stop-opacity="0.6"/>
  </linearGradient>
</defs>
<rect width="${VBW}" height="${VBH}" fill="url(#sc-sky)"/>
${mountainLayers5(STD_SEEDS, STD_BASE_HEIGHTS, STD_COLORS, STD_OPACITIES)}
<path d="M100 165 Q130 155 155 160 Q180 152 210 158 Q235 155 260 165 L260 190 Q235 182 210 185 Q180 178 155 183 Q130 178 100 185 Z" fill="url(#sc-water)"/>
<path d="M120 170 Q140 167 160 170" fill="none" stroke="${c.offWhite}" stroke-width="0.8" opacity="0.5"/>
<path d="M175 165 Q195 162 215 166" fill="none" stroke="${c.offWhite}" stroke-width="0.6" opacity="0.4"/>
<circle cx="145" cy="172" r="1.5" fill="${c.offWhite}" opacity="0.6"/>
<circle cx="185" cy="168" r="1" fill="${c.offWhite}" opacity="0.4"/>
<circle cx="205" cy="175" r="1.2" fill="${c.offWhite}" opacity="0.5"/>
<ellipse cx="95" cy="178" rx="8" ry="4" fill="${c.espressoLight}" opacity="0.35"/>
<ellipse cx="90" cy="180" rx="6" ry="3" fill="${c.espresso}" opacity="0.25"/>
<ellipse cx="250" cy="175" rx="7" ry="3.5" fill="${c.espressoLight}" opacity="0.4"/>
<ellipse cx="255" cy="177" rx="5" ry="2.5" fill="${c.espresso}" opacity="0.3"/>
<path d="M85 185 Q100 178 115 182 Q130 176 140 183" fill="${c.sandBase}" opacity="0.4"/>
<path d="M230 182 Q245 176 260 180 Q270 175 280 185" fill="${c.sandBase}" opacity="0.4"/>
</svg>`;
}
