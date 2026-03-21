/**
 * @module roomPlannerSelection
 * @description Selected-item control logic for the Room Planner canvas.
 *
 * Handles: selection, resize (with min/max bounds), rotation (90° steps),
 * z-index reordering (bring forward/send backward), and delete.
 *
 * All functions are pure: they take the current state/products array and
 * return a new one, never mutating inputs.
 *
 * CF-gkh2: Room Planner S3 — Selected item controls
 */

/** Minimum size (inches) for any placed product dimension. */
export const MIN_PRODUCT_SIZE = 6;

/** Maximum size (inches) for any placed product dimension. */
export const MAX_PRODUCT_SIZE = 480;

/** Rotation cycle: 4 orientations in 90° steps. */
export const ROTATION_STEPS = [0, 90, 180, 270];

/**
 * Select a product by ID (or deselect by passing null).
 * @param {Object} canvasState
 * @param {string|null} productId
 * @returns {Object} new state with updated selectedProductId
 */
export function selectProduct(canvasState, productId) {
  return { ...canvasState, selectedProductId: productId ?? null };
}

/**
 * Deselect the currently selected product.
 * @param {Object} canvasState
 * @returns {Object}
 */
export function deselectProduct(canvasState) {
  return { ...canvasState, selectedProductId: null };
}

/**
 * Delete the selected product from the canvas.
 * Returns same state if nothing is selected.
 * @param {Object} canvasState
 * @returns {Object}
 */
export function deleteSelected(canvasState) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;
  return {
    ...canvasState,
    products: products.filter(p => p._id !== selectedProductId),
    selectedProductId: null,
  };
}

/**
 * Resize the selected product.
 * Width and height are clamped to [MIN_PRODUCT_SIZE, MAX_PRODUCT_SIZE].
 * Returns same state if nothing is selected or product not found.
 *
 * @param {Object} canvasState
 * @param {number} newWidth - New width in inches
 * @param {number} newHeight - New height (depth) in inches
 * @returns {Object}
 */
export function resizeSelected(canvasState, newWidth, newHeight) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;

  const idx = products.findIndex(p => p._id === selectedProductId);
  if (idx === -1) return canvasState;

  const clampedW = Math.max(MIN_PRODUCT_SIZE, Math.min(MAX_PRODUCT_SIZE, Math.round(newWidth)));
  const clampedH = Math.max(MIN_PRODUCT_SIZE, Math.min(MAX_PRODUCT_SIZE, Math.round(newHeight)));

  const newProducts = [...products];
  newProducts[idx] = { ...products[idx], width: clampedW, depth: clampedH };

  return { ...canvasState, products: newProducts };
}

/**
 * Rotate the selected product 90° clockwise (cycles through ROTATION_STEPS).
 * Returns same state if nothing is selected.
 * @param {Object} canvasState
 * @returns {Object}
 */
export function rotateSelected(canvasState) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;

  const idx = products.findIndex(p => p._id === selectedProductId);
  if (idx === -1) return canvasState;

  const current = products[idx].rotation ?? 0;
  const currentStep = ROTATION_STEPS.indexOf(current);
  const nextStep = (currentStep === -1 ? 0 : currentStep + 1) % ROTATION_STEPS.length;
  const nextRotation = ROTATION_STEPS[nextStep];

  const newProducts = [...products];
  newProducts[idx] = { ...products[idx], rotation: nextRotation };

  return { ...canvasState, products: newProducts };
}

/**
 * Bring the selected product one step forward in z-order.
 * Products are ordered by their array index (higher index = on top).
 * @param {Object} canvasState
 * @returns {Object}
 */
export function bringForward(canvasState) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;

  const idx = products.findIndex(p => p._id === selectedProductId);
  if (idx === -1 || idx === products.length - 1) return canvasState; // already on top

  const newProducts = [...products];
  [newProducts[idx], newProducts[idx + 1]] = [newProducts[idx + 1], newProducts[idx]];

  return { ...canvasState, products: newProducts };
}

/**
 * Send the selected product one step backward in z-order.
 * @param {Object} canvasState
 * @returns {Object}
 */
export function sendBackward(canvasState) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;

  const idx = products.findIndex(p => p._id === selectedProductId);
  if (idx <= 0) return canvasState; // already at bottom

  const newProducts = [...products];
  [newProducts[idx], newProducts[idx - 1]] = [newProducts[idx - 1], newProducts[idx]];

  return { ...canvasState, products: newProducts };
}

/**
 * Bring the selected product to the very top of the z-order.
 * @param {Object} canvasState
 * @returns {Object}
 */
export function bringToFront(canvasState) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;

  const idx = products.findIndex(p => p._id === selectedProductId);
  if (idx === -1 || idx === products.length - 1) return canvasState;

  const newProducts = [...products.slice(0, idx), ...products.slice(idx + 1), products[idx]];
  return { ...canvasState, products: newProducts };
}

/**
 * Send the selected product to the very bottom of the z-order.
 * @param {Object} canvasState
 * @returns {Object}
 */
export function sendToBack(canvasState) {
  const { selectedProductId, products } = canvasState;
  if (!selectedProductId) return canvasState;

  const idx = products.findIndex(p => p._id === selectedProductId);
  if (idx <= 0) return canvasState;

  const newProducts = [products[idx], ...products.slice(0, idx), ...products.slice(idx + 1)];
  return { ...canvasState, products: newProducts };
}
