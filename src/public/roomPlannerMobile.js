/**
 * @module roomPlannerMobile
 * @description Mobile experience for the Room Planner: touch drag/pinch zoom, simplified controls.
 * Pure logic for touch gesture handling and mobile UI configuration — all testable without DOM.
 *
 * Editor elements (Room Planner page):
 *   #plannerInstructionsSection (Box) — how-to steps, collapsed on mobile
 *   #roomPresetsSection (Box) — preset size buttons, collapsed on mobile
 *   #productPaletteSection (Box) — furniture palette, collapsed on mobile
 *   #mobilePlannerControls (Box) — compact controls shown only on mobile
 *   #plannerCanvas (HtmlComponent) — receives 'setMobileMode' postMessage
 *
 * CF-7f32: Room Planner S7 — Mobile experience
 */

/** Maximum viewport width (px) considered "mobile". */
export const MOBILE_BREAKPOINT = 768;

/** Minimum zoom scale allowed by pinch gesture. */
export const MIN_PINCH_SCALE = 0.5;

/** Maximum zoom scale allowed by pinch gesture. */
export const MAX_PINCH_SCALE = 4.0;

/** Minimum touch distance (px) to register as a pinch gesture (avoids noise). */
export const MIN_PINCH_DISTANCE = 10;

/**
 * Determine whether the given viewport width is considered mobile.
 * @param {number} [width=globalThis.innerWidth] - Viewport width in pixels.
 * @returns {boolean}
 */
export function isMobileViewport(width = globalThis.innerWidth) {
  return typeof width === 'number' && width <= MOBILE_BREAKPOINT;
}

/**
 * Compute the center point and distance between two touch points.
 * Returns null when fewer than two touches are provided.
 *
 * @param {Array<{ clientX: number, clientY: number }>} touches - Touch list (at least 2 elements).
 * @returns {{ centerX: number, centerY: number, distance: number } | null}
 */
export function getPinchState(touches) {
  if (!touches || touches.length < 2) return null;
  const a = touches[0];
  const b = touches[1];
  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return {
    centerX: (a.clientX + b.clientX) / 2,
    centerY: (a.clientY + b.clientY) / 2,
    distance,
  };
}

/**
 * Compute the new scale after a pinch gesture, clamped to [MIN_PINCH_SCALE, MAX_PINCH_SCALE].
 *
 * @param {number} startDistance - Pinch distance (px) at gesture start.
 * @param {number} currentDistance - Current pinch distance (px).
 * @param {number} baseScale - Canvas scale at gesture start.
 * @returns {number} New scale value.
 */
export function computePinchScale(startDistance, currentDistance, baseScale) {
  if (startDistance <= 0 || currentDistance <= 0) return baseScale;
  const ratio = currentDistance / startDistance;
  return Math.min(MAX_PINCH_SCALE, Math.max(MIN_PINCH_SCALE, baseScale * ratio));
}

/**
 * Convert a touch point to canvas-relative coordinates.
 *
 * @param {{ clientX: number, clientY: number }} touch - Touch event touch point.
 * @param {{ left: number, top: number }} canvasRect - Canvas element bounding rect.
 * @returns {{ x: number, y: number }}
 */
export function touchToCanvasCoords(touch, canvasRect) {
  return {
    x: touch.clientX - canvasRect.left,
    y: touch.clientY - canvasRect.top,
  };
}

/**
 * Return the UI section IDs to collapse and expand based on mobile state.
 * On mobile: collapse desktop-only panels, expand compact mobile controls.
 * On desktop: collapse mobile controls, expand full desktop panels.
 *
 * @param {boolean} isMobile
 * @returns {{ collapseIds: string[], expandIds: string[] }}
 */
export function getMobileUIConfig(isMobile) {
  if (isMobile) {
    return {
      collapseIds: [
        '#plannerInstructionsSection',
        '#roomPresetsSection',
        '#productPaletteSection',
      ],
      expandIds: ['#mobilePlannerControls'],
    };
  }
  return {
    collapseIds: ['#mobilePlannerControls'],
    expandIds: [
      '#plannerInstructionsSection',
      '#roomPresetsSection',
      '#productPaletteSection',
    ],
  };
}

/**
 * Initialize mobile-specific behavior on the Room Planner page.
 * Collapses desktop panels and expands compact mobile controls when on a small screen.
 * Notifies the canvas HtmlComponent of mobile mode so it can enable touch handlers.
 *
 * @param {Function} $w - Wix selector function.
 * @param {{ viewportWidth?: number }} [state={}] - Page state; falls back to globalThis.innerWidth.
 */
export function initMobileRoomPlanner($w, state = {}) {
  const width = state?.viewportWidth ?? globalThis.innerWidth;
  const mobile = isMobileViewport(width);
  const config = getMobileUIConfig(mobile);

  for (const id of config.collapseIds) {
    try { $w(id).collapse(); } catch (_) {}
  }
  for (const id of config.expandIds) {
    try { $w(id).expand(); } catch (_) {}
  }

  try {
    $w('#plannerCanvas').postMessage({ type: 'setMobileMode', enabled: mobile });
  } catch (e) {
    console.error('[roomPlannerMobile] postMessage setMobileMode:', e);
  }
}
