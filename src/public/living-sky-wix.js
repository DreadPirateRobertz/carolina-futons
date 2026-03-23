/**
 * @module living-sky-wix
 * @description Wix Velo integration shim for Phase 7 Living Blue Ridge Sky.
 *
 * Bridges living-sky.js (pure JS, no DOM deps) with the Wix HtmlComponent
 * (#livingSkyFrame) via the postMessage API. The HtmlComponent hosts the SVG
 * and updates its elements in response to LivingSkyState messages.
 *
 * Usage (Home.js onReady):
 *   import { initLivingSky } from 'public/living-sky-wix.js';
 *   const sky = initLivingSky($w);
 *   // sky.stop() to halt updates (e.g. page teardown)
 *
 * CF-ad3
 * Depends on: CF-4el (living-sky.js core engine)
 */

import { useLivingSky } from 'public/living-sky.js';

/** Update interval in milliseconds. */
const UPDATE_INTERVAL_MS = 60_000;

/**
 * Get total minutes since midnight for a given Date.
 * @param {Date} [now]
 * @returns {number} 0–1439
 */
function totalMinutesNow(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Post a LivingSkyState to the #livingSkyFrame HtmlComponent.
 * Errors are swallowed so missing elements (page doesn't have the frame)
 * never crash the page.
 *
 * @param {Function} $w - Wix element selector
 * @param {import('./living-sky.js').LivingSkyState} state
 */
export function updateSkyToState($w, state) {
  try {
    $w('#livingSkyFrame').postMessage(state);
  } catch {
    // HtmlComponent absent — no-op
  }
}

/**
 * Initialize the living sky animation loop.
 *
 * Immediately renders the sky at the visitor's current local time, then
 * re-renders every 60 seconds to track time-of-day changes live.
 *
 * Reduced-motion mode: renders once only — no animation loop.
 *
 * @param {Function} $w - Wix element selector
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {{ stop: () => void }} Handle — call stop() to halt the update loop.
 */
export function initLivingSky($w, { reducedMotion = false } = {}) {
  function tick() {
    const state = useLivingSky(totalMinutesNow());
    updateSkyToState($w, state);
  }

  tick();

  if (reducedMotion) {
    return { stop: () => {} };
  }

  const intervalId = setInterval(tick, UPDATE_INTERVAL_MS);
  return { stop: () => clearInterval(intervalId) };
}
