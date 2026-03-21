/**
 * @module ProductSpinViewer
 * @description 360-degree product spin viewer for the PDP.
 * Uses a `spinImages` array on the product (CDN URLs in 360° angle order).
 * Supports mouse-drag and touch-swipe to cycle through frames.
 * Auto-spins 3 full rotations on first load, then stops.
 * Falls back to standard gallery when no spinImages are present.
 *
 * Editor elements:
 *   #productSpinContainer (Box) — wrapper shown/hidden
 *   #productSpinCanvas (Image) — displays current spin frame
 *   #spinDragHint (Text) — "Drag to rotate" hint
 *   #spin360Badge (Text) — "360°" badge on gallery
 *
 * CF-0e6p: 360-degree product viewer — image sequence spin on PDP
 */

const AUTO_SPIN_ROTATIONS = 3;
const AUTO_SPIN_INTERVAL_MS = 60; // ~16fps

/**
 * Compute the frame index from a drag delta (pixels → frame index).
 * @param {number} currentIndex - Current frame index
 * @param {number} deltaPx - Drag delta in pixels (positive = right = forward)
 * @param {number} totalFrames - Total number of frames
 * @param {number} [pxPerFrame=8] - Pixels of drag per frame step
 * @returns {number} New frame index (clamped to [0, totalFrames-1])
 */
export function computeFrameIndex(currentIndex, deltaPx, totalFrames, pxPerFrame = 8) {
  if (totalFrames <= 0) return 0;
  const frameDelta = Math.round(deltaPx / pxPerFrame);
  return ((currentIndex + frameDelta) % totalFrames + totalFrames) % totalFrames;
}

/**
 * Build an auto-spin sequence: frame indices for N full rotations.
 * @param {number} totalFrames
 * @param {number} rotations
 * @returns {number[]} sequence of frame indices
 */
export function buildAutoSpinSequence(totalFrames, rotations) {
  if (totalFrames <= 0 || rotations <= 0) return [];
  const frames = [];
  for (let r = 0; r < rotations; r++) {
    for (let i = 0; i < totalFrames; i++) frames.push(i);
  }
  return frames;
}

/**
 * Determine whether to show the spin viewer for a product.
 * @param {Object} product - Product object from state
 * @returns {boolean}
 */
export function shouldShowSpinViewer(product) {
  return !!(
    product &&
    Array.isArray(product.spinImages) &&
    product.spinImages.length >= 2
  );
}

/**
 * Initialize the 360° spin viewer on the PDP.
 * Shows the spin viewer if the product has `spinImages`; otherwise collapses.
 *
 * @param {Function} $w - Wix Velo selector
 * @param {{ product: Object }} state - Page state with product data
 * @param {Object} [opts] - Testable dependencies
 * @param {Function} [opts.setInterval] - Injected for testing
 * @param {Function} [opts.clearInterval] - Injected for testing
 * @returns {{ cleanup: Function }} cleanup function to cancel auto-spin
 */
export function initProductSpinViewer($w, state, opts = {}) {
  const _setInterval = opts.setInterval ?? globalThis.setInterval;
  const _clearInterval = opts.clearInterval ?? globalThis.clearInterval;

  let autoSpinTimer = null;
  let currentFrame = 0;
  let dragStartX = null;
  let frameAtDragStart = 0;
  // Deactivates all event handlers from this init when cleanup() is called.
  // Prevents stale handlers from firing if initProductSpinViewer is called
  // again on the same element (Wix Velo provides no removeEventListener).
  let destroyed = false;

  function cancelAutoSpin() {
    if (autoSpinTimer !== null) {
      _clearInterval(autoSpinTimer);
      autoSpinTimer = null;
    }
  }

  function cleanup() {
    destroyed = true;
    cancelAutoSpin();
  }

  try {
    const product = state?.product;

    if (!shouldShowSpinViewer(product)) {
      _collapseSpinViewer($w);
      return { cleanup };
    }

    const spinImages = product.spinImages;
    const totalFrames = spinImages.length;

    // Show the spin container and badge
    try { $w('#productSpinContainer').expand(); } catch (_) {}
    try { $w('#spin360Badge').show(); } catch (_) {}
    try { $w('#spinDragHint').show(); } catch (_) {}

    // Render the first frame
    _setFrame($w, spinImages, currentFrame);

    // ── Auto-spin: 3 rotations, then stop ───────────────────────
    const spinSequence = buildAutoSpinSequence(totalFrames, AUTO_SPIN_ROTATIONS);
    let spinStep = 0;

    autoSpinTimer = _setInterval(() => {
      if (spinStep >= spinSequence.length) {
        cancelAutoSpin();
        try { $w('#spinDragHint').show(); } catch (_) {}
        return;
      }
      currentFrame = spinSequence[spinStep++];
      _setFrame($w, spinImages, currentFrame);
    }, AUTO_SPIN_INTERVAL_MS);

    // ── Mouse drag handler ────────────────────────────────────────
    try {
      $w('#productSpinCanvas').onMouseDown((event) => {
        if (destroyed) return;
        cancelAutoSpin(); // Cancel auto-spin on manual interaction
        dragStartX = event.clientX ?? event.pageX ?? 0;
        frameAtDragStart = currentFrame;
      });
    } catch (_) {}

    try {
      $w('#productSpinCanvas').onMouseMove((event) => {
        if (destroyed || dragStartX === null) return;
        const delta = (event.clientX ?? event.pageX ?? 0) - dragStartX;
        currentFrame = computeFrameIndex(frameAtDragStart, delta, totalFrames);
        _setFrame($w, spinImages, currentFrame);
      });
    } catch (_) {}

    try {
      $w('#productSpinCanvas').onMouseUp(() => { if (!destroyed) dragStartX = null; });
    } catch (_) {}

    // Clears stuck drag state if user drags off the canvas edge without releasing.
    try {
      $w('#productSpinCanvas').onMouseLeave(() => { if (!destroyed) dragStartX = null; });
    } catch (_) {}

    // ── Touch handler ─────────────────────────────────────────────
    try {
      $w('#productSpinCanvas').onTouchStart((event) => {
        cleanup();
        dragStartX = event.touches?.[0]?.clientX ?? 0;
        frameAtDragStart = currentFrame;
      });
    } catch (_) {}

    try {
      $w('#productSpinCanvas').onTouchMove((event) => {
        if (destroyed || dragStartX === null) return;
        // Prevent page scroll while spinning. Wix Velo event objects may not
        // expose preventDefault — the call is defensive (no-op if unsupported).
        event.preventDefault?.();
        const delta = (event.touches?.[0]?.clientX ?? 0) - dragStartX;
        currentFrame = computeFrameIndex(frameAtDragStart, delta, totalFrames);
        _setFrame($w, spinImages, currentFrame);
      });
    } catch (_) {}

    try {
      $w('#productSpinCanvas').onTouchEnd(() => { if (!destroyed) dragStartX = null; });
    } catch (_) {}

  } catch (err) {
    console.warn('[ProductSpinViewer] initProductSpinViewer failed:', err?.message ?? err);
    cleanup();
    _collapseSpinViewer($w);
  }

  return { cleanup };
}

function _setFrame($w, spinImages, frameIndex) {
  try {
    $w('#productSpinCanvas').src = spinImages[frameIndex];
  } catch (_) {}
}

function _collapseSpinViewer($w) {
  try { $w('#productSpinContainer').collapse(); } catch (_) {}
  try { $w('#spin360Badge').hide(); } catch (_) {}
  try { $w('#spinDragHint').hide(); } catch (_) {}
}
