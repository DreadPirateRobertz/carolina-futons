/**
 * @module illustrationShared
 * @description Shared constants and path-generation utilities for web SVG illustrations.
 * Ported from cfutons_mobile/src/components/illustrations/shared.ts.
 *
 * Uses the warm Blue Ridge Mountain palette (not the blue/navy UI palette in sharedTokens).
 * All path generation is deterministic via seeded PRNG — same seed always produces the same ridge.
 */

// ── Warm illustration palette (matches mobile tokens.ts) ────────────
// These are the ORIGINAL warm mountain colors, NOT the UI palette from sharedTokens.js.

export const ILLUSTRATION_COLORS = {
  sandBase: '#E8D5B7',
  sandLight: '#F2E8D5',
  sandDark: '#D4BC96',
  espresso: '#3A2518',
  espressoLight: '#5C4033',
  mountainBlue: '#5B8FA8',
  mountainBlueDark: '#3D6B80',
  mountainBlueLight: '#A8CCD8',
  sunsetCoral: '#E8845C',
  sunsetCoralDark: '#C96B44',
  sunsetCoralLight: '#F2A882',
  skyGradientTop: '#B8D4E3',
  skyGradientBottom: '#F0C87A',
  offWhite: '#FAF7F2',
  white: '#FFFFFF',
};

// ── 7-layer mountain configs (distant → front) ──────────────────────

export const MOUNTAIN_LAYER_CONFIGS = [
  { name: 'distant', baseHeight: 0.32, seed: 42 },
  { name: 'far', baseHeight: 0.41, seed: 17 },
  { name: 'back', baseHeight: 0.48, seed: 73 },
  { name: 'mid-far', baseHeight: 0.55, seed: 29 },
  { name: 'mid', baseHeight: 0.62, seed: 61 },
  { name: 'mid-near', baseHeight: 0.72, seed: 88 },
  { name: 'front', baseHeight: 0.8, seed: 55 },
];

// Atmospheric opacity ramp: distant (faint) → front (solid)
export const STANDARD_OPACITIES = [0.12, 0.18, 0.25, 0.38, 0.5, 0.68, 0.85];
export const TRANSPARENT_OPACITIES = [0.12, 0.18, 0.28, 0.35, 0.42, 0.52, 0.6];

export const STANDARD_LAYER_COLORS = [
  ILLUSTRATION_COLORS.mountainBlue,
  ILLUSTRATION_COLORS.mountainBlue,
  ILLUSTRATION_COLORS.espresso,
  ILLUSTRATION_COLORS.espresso,
  ILLUSTRATION_COLORS.espresso,
  ILLUSTRATION_COLORS.espresso,
  ILLUSTRATION_COLORS.espresso,
];

export const TRANSPARENT_LAYER_COLORS = [
  ILLUSTRATION_COLORS.mountainBlueLight,
  ILLUSTRATION_COLORS.mountainBlueLight,
  ILLUSTRATION_COLORS.mountainBlueLight,
  ILLUSTRATION_COLORS.sandBase,
  ILLUSTRATION_COLORS.sandBase,
  ILLUSTRATION_COLORS.espressoLight,
  ILLUSTRATION_COLORS.espressoLight,
];

// ── Seeded pseudo-random for deterministic path wobble ───────────────

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── C-curve bezier mountain path generator ───────────────────────────

/**
 * Generates a closed SVG path string for a single mountain ridge.
 * @param {number} vbH - ViewBox height
 * @param {number} baseHeightFraction - Where the ridge sits (0 = top, 1 = bottom)
 * @param {number} seed - PRNG seed for deterministic wobble
 * @param {number} [vbW=1440] - ViewBox width
 * @param {number} [segments=10] - Number of cubic Bezier segments
 * @returns {string} SVG path d attribute
 */
export function buildCBezierMountainPath(vbH, baseHeightFraction, seed, vbW = 1440, segments = 10) {
  const rand = seededRandom(seed);
  const baseY = vbH * baseHeightFraction;
  const amplitude = vbH * 0.15;
  const segWidth = vbW / segments;

  let d = `M0,${vbH} L0,${Math.round(baseY)}`;

  for (let i = 0; i < segments; i++) {
    const x3 = (i + 1) * segWidth;
    const x0 = i * segWidth;
    const wobble1 = (rand() - 0.5) * amplitude;
    const wobble2 = (rand() - 0.5) * amplitude;
    const wobble3 = (rand() - 0.5) * amplitude * 0.8;
    const cp1x = x0 + segWidth * 0.33;
    const cp1y = baseY + wobble1;
    const cp2x = x0 + segWidth * 0.66;
    const cp2y = baseY + wobble2;
    const endY = baseY + wobble3;
    d += ` C${Math.round(cp1x)},${Math.round(cp1y)} ${Math.round(cp2x)},${Math.round(cp2y)} ${Math.round(x3)},${Math.round(endY)}`;
  }

  d += ` L${vbW},${vbH} Z`;
  return d;
}

/**
 * Convenience wrapper tuned for small 280×200 illustration viewboxes.
 * @param {number} vbW - ViewBox width
 * @param {number} vbH - ViewBox height
 * @param {number} baseHeightFraction - Ridge position
 * @param {number} seed - PRNG seed
 * @param {number} [segments=6] - Fewer segments for cleaner lines at small sizes
 * @returns {string} SVG path d attribute
 */
export function buildSmallMountainPath(vbW, vbH, baseHeightFraction, seed, segments = 6) {
  return buildCBezierMountainPath(vbH, baseHeightFraction, seed, vbW, segments);
}

// ── Detail element builders ──────────────────────────────────────────

/**
 * Generates four bird silhouette configs distributed across the upper sky.
 * @param {number} vbW
 * @param {number} vbH
 * @returns {Array<{path: string, strokeWidth: number, x: number, y: number}>}
 */
export function buildBirds(vbW, vbH) {
  const spread = vbW / 5;
  return [
    {
      path: `M${spread},${vbH * 0.18} C${spread + 5},${vbH * 0.15} ${spread + 10},${vbH * 0.14} ${spread + 15},${vbH * 0.16} C${spread + 20},${vbH * 0.14} ${spread + 25},${vbH * 0.15} ${spread + 30},${vbH * 0.18}`,
      strokeWidth: 1.2,
      x: spread,
      y: vbH * 0.18,
    },
    {
      path: `M${spread * 2.5},${vbH * 0.13} C${spread * 2.5 + 4},${vbH * 0.1} ${spread * 2.5 + 7},${vbH * 0.09} ${spread * 2.5 + 10},${vbH * 0.11} C${spread * 2.5 + 13},${vbH * 0.09} ${spread * 2.5 + 16},${vbH * 0.1} ${spread * 2.5 + 20},${vbH * 0.13}`,
      strokeWidth: 1.0,
      x: spread * 2.5,
      y: vbH * 0.13,
    },
    {
      path: `M${spread * 3.5},${vbH * 0.2} C${spread * 3.5 + 3},${vbH * 0.18} ${spread * 3.5 + 5},${vbH * 0.17} ${spread * 3.5 + 8},${vbH * 0.19} C${spread * 3.5 + 11},${vbH * 0.17} ${spread * 3.5 + 13},${vbH * 0.18} ${spread * 3.5 + 16},${vbH * 0.2}`,
      strokeWidth: 0.8,
      x: spread * 3.5,
      y: vbH * 0.2,
    },
    {
      path: `M${spread * 4},${vbH * 0.15} C${spread * 4 + 3},${vbH * 0.13} ${spread * 4 + 6},${vbH * 0.12} ${spread * 4 + 8},${vbH * 0.14} C${spread * 4 + 10},${vbH * 0.12} ${spread * 4 + 13},${vbH * 0.13} ${spread * 4 + 16},${vbH * 0.15}`,
      strokeWidth: 0.9,
      x: spread * 4,
      y: vbH * 0.15,
    },
  ];
}

/**
 * Generates three pine trees with trunk rectangles and layered canopy curves.
 * @param {number} vbW
 * @param {number} vbH
 * @returns {Array<{trunk: {x,y,width,height}, canopyLayers: Array<{path,opacity}>}>}
 */
export function buildPineTrees(vbW, vbH) {
  const positions = [vbW * 0.14, vbW * 0.65, vbW * 0.85];
  return positions.map((x) => {
    const trunkH = vbH * 0.15;
    const trunkW = vbW * 0.003;
    const trunkY = vbH * 0.7;
    const spread = vbW * 0.014;
    return {
      trunk: { x, y: trunkY, width: trunkW, height: trunkH },
      canopyLayers: [
        {
          path: `M${x - spread},${trunkY + trunkH * 0.35} C${x - spread * 0.5},${trunkY - trunkH * 0.1} ${x + spread * 0.5},${trunkY - trunkH * 0.1} ${x + spread},${trunkY + trunkH * 0.35}`,
          opacity: 0.45,
        },
        {
          path: `M${x - spread * 0.8},${trunkY + trunkH * 0.2} C${x - spread * 0.3},${trunkY - trunkH * 0.25} ${x + spread * 0.3},${trunkY - trunkH * 0.25} ${x + spread * 0.8},${trunkY + trunkH * 0.2}`,
          opacity: 0.55,
        },
        {
          path: `M${x - spread * 0.6},${trunkY + trunkH * 0.05} C${x - spread * 0.15},${trunkY - trunkH * 0.35} ${x + spread * 0.15},${trunkY - trunkH * 0.35} ${x + spread * 0.6},${trunkY + trunkH * 0.05}`,
          opacity: 0.65,
        },
      ],
    };
  });
}

/**
 * Generates small wildflower elements (stem + bloom circle) for foreground detail.
 * @param {number} vbW
 * @param {number} vbH
 * @returns {Array<{stem: {x1,y1,x2,y2,strokeWidth}, bloom: {cx,cy,r,color}}>}
 */
export function buildFlora(vbW, vbH) {
  const c = ILLUSTRATION_COLORS;
  const positions = [
    { x: vbW * 0.1, bloomColor: c.sunsetCoral },
    { x: vbW * 0.11, bloomColor: c.sandBase },
    { x: vbW * 0.47, bloomColor: c.sunsetCoral },
    { x: vbW * 0.49, bloomColor: c.mountainBlueLight },
    { x: vbW * 0.9, bloomColor: c.sunsetCoral },
    { x: vbW * 0.92, bloomColor: c.sandBase },
  ];
  return positions.map(({ x, bloomColor }) => ({
    stem: { x1: x, y1: vbH * 0.9, x2: x + 1, y2: vbH * 0.84, strokeWidth: 1 },
    bloom: { cx: x, cy: vbH * 0.83, r: vbW * 0.002 + 1.5, color: bloomColor },
  }));
}
