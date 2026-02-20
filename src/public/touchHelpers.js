// Touch gesture helpers for mobile-first product browsing
// Provides swipe detection and pinch-zoom for product galleries

/**
 * Enable swipe detection on an element.
 * Calls onSwipe('left'|'right'|'up'|'down') when a swipe gesture is detected.
 * @param {HTMLElement} element - The target element
 * @param {Function} onSwipe - Callback receiving direction string
 * @param {Object} [options] - Configuration
 * @param {number} [options.threshold=50] - Min distance in px to qualify as swipe
 * @param {number} [options.maxTime=300] - Max time in ms for the gesture
 * @returns {Function} cleanup function to remove listeners
 */
export function enableSwipe(element, onSwipe, options = {}) {
  if (!element || typeof onSwipe !== 'function') return () => {};

  const threshold = options.threshold || 50;
  const maxTime = options.maxTime || 300;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  function handleTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
  }

  function handleTouchEnd(e) {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const elapsed = Date.now() - startTime;

    if (elapsed > maxTime) return;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < threshold && absDy < threshold) return;

    if (absDx > absDy) {
      onSwipe(dx > 0 ? 'right' : 'left');
    } else {
      onSwipe(dy > 0 ? 'down' : 'up');
    }
  }

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
  };
}

/**
 * Detect swipe direction from touch coordinates.
 * Pure function for testing — no DOM dependency.
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 * @param {number} [threshold=50]
 * @returns {string|null} 'left'|'right'|'up'|'down' or null if below threshold
 */
export function detectSwipeDirection(startX, startY, endX, endY, threshold = 50) {
  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < threshold && absDy < threshold) return null;

  if (absDx > absDy) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/**
 * Calculate pinch-zoom scale from two touch points.
 * @param {Object} startTouches - { distance: number }
 * @param {Object} currentTouches - Two touch points
 * @returns {number} scale factor (1 = no change, >1 = zoom in, <1 = zoom out)
 */
export function calculatePinchScale(startDistance, currentDistance) {
  if (!startDistance || startDistance === 0) return 1;
  return currentDistance / startDistance;
}

/**
 * Calculate distance between two touch points.
 * @param {Touch} touch1
 * @param {Touch} touch2
 * @returns {number} distance in pixels
 */
export function getTouchDistance(touch1, touch2) {
  if (!touch1 || !touch2) return 0;
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a value between min and max.
 * Useful for limiting zoom scale.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampScale(value, min = 1, max = 3) {
  return Math.min(Math.max(value, min), max);
}
