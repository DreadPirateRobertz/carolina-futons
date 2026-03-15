/**
 * @module roomPlannerCanvas
 * @description Pure logic for the Room Planner 2D canvas visualization.
 * Coordinate transforms, hit testing, fit detection, and render state
 * computation — all testable without a DOM or canvas context.
 */

/** Padding (px) around room rectangle inside the canvas. */
export const CANVAS_PADDING = 20;

/**
 * Convert room coordinates (inches) to canvas coordinates (pixels).
 * @param {number} roomX - X position in inches.
 * @param {number} roomY - Y position in inches.
 * @param {number} scale - Pixels per inch.
 * @returns {{ x: number, y: number }}
 */
export function roomToCanvas(roomX, roomY, scale) {
  return {
    x: CANVAS_PADDING + roomX * scale,
    y: CANVAS_PADDING + roomY * scale,
  };
}

/**
 * Convert canvas coordinates (pixels) back to room coordinates (inches).
 * @param {number} canvasX - X position in pixels.
 * @param {number} canvasY - Y position in pixels.
 * @param {number} scale - Pixels per inch.
 * @returns {{ x: number, y: number }}
 */
export function canvasToRoom(canvasX, canvasY, scale) {
  return {
    x: Math.max(0, (canvasX - CANVAS_PADDING) / scale),
    y: Math.max(0, (canvasY - CANVAS_PADDING) / scale),
  };
}

/**
 * Get bounding rectangle for a product considering rotation and bed mode.
 * @param {Object} product
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function getProductBounds(product) {
  const depth = product.isBedMode ? product.depthBed : product.depth;
  const isSwapped = product.rotation === 90 || product.rotation === 270;
  return {
    x: product.x,
    y: product.y,
    w: isSwapped ? depth : product.width,
    h: isSwapped ? product.width : depth,
  };
}

/**
 * Check if a product fits within the room boundaries.
 * @param {Object} product
 * @param {number} roomWidth - Room width in inches.
 * @param {number} roomLength - Room length in inches.
 * @returns {boolean}
 */
export function checkFit(product, roomWidth, roomLength) {
  const bounds = getProductBounds(product);
  if (bounds.x < 0 || bounds.y < 0) return false;
  return (bounds.x + bounds.w <= roomWidth) && (bounds.y + bounds.h <= roomLength);
}

/**
 * Find which product (if any) is under a canvas coordinate.
 * Returns the last (topmost) match.
 * @param {number} canvasX - Canvas X in pixels.
 * @param {number} canvasY - Canvas Y in pixels.
 * @param {Array} products - Product array.
 * @param {number} scale - Pixels per inch.
 * @returns {Object|null}
 */
export function hitTestProduct(canvasX, canvasY, products, scale) {
  for (let i = products.length - 1; i >= 0; i--) {
    const bounds = getProductBounds(products[i]);
    const topLeft = roomToCanvas(bounds.x, bounds.y, scale);
    const w = bounds.w * scale;
    const h = bounds.h * scale;
    if (
      canvasX >= topLeft.x && canvasX <= topLeft.x + w &&
      canvasY >= topLeft.y && canvasY <= topLeft.y + h
    ) {
      return products[i];
    }
  }
  return null;
}

/**
 * Build complete render state for the canvas from room + products.
 * @param {{ width: number, length: number }} room
 * @param {Array} products
 * @param {number} containerW - Canvas container width in pixels.
 * @param {number} containerH - Canvas container height in pixels.
 * @returns {{ scale: number, roomRect: Object, productRects: Array }}
 */
export function buildRenderState(room, products, containerW, containerH) {
  const availW = containerW - 2 * CANVAS_PADDING;
  const availH = containerH - 2 * CANVAS_PADDING;

  const scale = (room.width <= 0 || room.length <= 0)
    ? 1
    : Math.min(availW / room.width, availH / room.length);

  const roomRect = {
    x: CANVAS_PADDING,
    y: CANVAS_PADDING,
    w: room.width * scale,
    h: room.length * scale,
  };

  const productRects = products.map((p) => {
    const bounds = getProductBounds(p);
    const topLeft = roomToCanvas(bounds.x, bounds.y, scale);
    return {
      id: p.id,
      label: p.label || '',
      canvasX: topLeft.x,
      canvasY: topLeft.y,
      canvasW: bounds.w * scale,
      canvasH: bounds.h * scale,
      fits: checkFit(p, room.width, room.length),
      isBedMode: Boolean(p.isBedMode),
      rotation: p.rotation || 0,
    };
  });

  return { scale, roomRect, productRects };
}
