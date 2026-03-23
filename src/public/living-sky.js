/**
 * @module living-sky
 * @description STUB — Phase 7 Living Blue Ridge Sky core interpolation engine.
 *
 * This is a placeholder stub. The full implementation is built in CF-4el
 * (assigned to miquella). When cf-4el lands, replace this file with the
 * real implementation — all exports are API-compatible.
 *
 * CF-4el depends on: docs/superpowers/specs/2026-03-23-phase7-living-sky-design.md
 *
 * @stub CF-4el
 */

/**
 * @typedef {Object} LivingSkyState
 * @property {[string,string,string,string]} skyColors - 4 gradient stop colors (top→bottom)
 * @property {[string,string]} glowColors - Horizon radial gradient colors
 * @property {{ r1:string, r2:string, r3:string, r4:string, tree:string }} ridgeColors
 * @property {{ cx:number, cy:number, r:number, opacity:number }} sunPos
 * @property {{ cx:number, cy:number, opacity:number, phase:number, shadowOffset:{dx:number,dy:number} }} moonPos
 * @property {number} starOpacity
 * @property {number} cloudOpacity
 * @property {number} birdOpacity
 */

/** Midday default state — daytime Blue Ridge palette. */
const DEFAULT_STATE = {
  skyColors: ['#3A78A8', '#6098B8', '#80B0C8', '#A0C8D8'],
  glowColors: ['#FFE080', '#FFF0A0'],
  ridgeColors: {
    r1: '#2A3A50',
    r2: '#5B8FA8',
    r3: '#8BB5C9',
    r4: '#B8D4E3',
    tree: '#1A2830',
  },
  sunPos: { cx: 520, cy: 10, r: 14, opacity: 1 },
  moonPos: { cx: 730, cy: 200, opacity: 0, phase: 0, shadowOffset: { dx: 0, dy: 0 } },
  starOpacity: 0,
  cloudOpacity: 0.2,
  birdOpacity: 0.8,
};

/**
 * Compute the living sky state for a given time of day.
 *
 * STUB: returns the same default state regardless of time.
 * Replace with full implementation from CF-4el.
 *
 * @param {number} totalMinutes - Minutes since midnight (0–1439)
 * @returns {LivingSkyState}
 */
export function useLivingSky(totalMinutes) { // eslint-disable-line no-unused-vars
  return { ...DEFAULT_STATE };
}

/**
 * Detect the current season from a Date.
 *
 * STUB: always returns 'summer'. Replace with full implementation from CF-4el.
 *
 * @param {Date} [date]
 * @returns {'spring'|'summer'|'fall'|'winter'}
 */
export function getSeason(date) { // eslint-disable-line no-unused-vars
  return 'summer';
}
