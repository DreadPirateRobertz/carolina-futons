/**
 * Tests for CF-gkh2: Room Planner S3 — Selected item controls.
 * Covers: selectProduct, deselectProduct, deleteSelected, resizeSelected,
 * rotateSelected, bringForward, sendBackward, bringToFront, sendToBack.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_PRODUCT_SIZE,
  MAX_PRODUCT_SIZE,
  ROTATION_STEPS,
  selectProduct,
  deselectProduct,
  deleteSelected,
  resizeSelected,
  rotateSelected,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
} from '../src/public/roomPlannerSelection.js';

function makeState(overrides = {}) {
  return {
    room: { width: 240, depth: 180 },
    products: [],
    selectedProductId: null,
    ...overrides,
  };
}

function makeProduct(id, overrides = {}) {
  return { _id: id, width: 60, depth: 36, rotation: 0, x: 0, y: 0, ...overrides };
}

// ── Constants ─────────────────────────────────────────────────────

describe('constants', () => {
  it('MIN_PRODUCT_SIZE is 6', () => expect(MIN_PRODUCT_SIZE).toBe(6));
  it('MAX_PRODUCT_SIZE is 480', () => expect(MAX_PRODUCT_SIZE).toBe(480));
  it('ROTATION_STEPS has 4 entries', () => expect(ROTATION_STEPS).toHaveLength(4));
  it('ROTATION_STEPS cycles through 0/90/180/270', () => {
    expect(ROTATION_STEPS).toEqual([0, 90, 180, 270]);
  });
});

// ── selectProduct ─────────────────────────────────────────────────

describe('selectProduct', () => {
  it('sets selectedProductId', () => {
    const state = makeState();
    const next = selectProduct(state, 'p1');
    expect(next.selectedProductId).toBe('p1');
  });

  it('does not mutate input state', () => {
    const state = makeState();
    selectProduct(state, 'p1');
    expect(state.selectedProductId).toBeNull();
  });

  it('deselects when called with null', () => {
    const state = makeState({ selectedProductId: 'p1' });
    expect(selectProduct(state, null).selectedProductId).toBeNull();
  });

  it('deselects when called with undefined', () => {
    const state = makeState({ selectedProductId: 'p1' });
    expect(selectProduct(state, undefined).selectedProductId).toBeNull();
  });

  it('preserves other state fields', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    const next = selectProduct(state, 'p1');
    expect(next.products).toEqual(state.products);
    expect(next.room).toEqual(state.room);
  });
});

// ── deselectProduct ───────────────────────────────────────────────

describe('deselectProduct', () => {
  it('clears selectedProductId', () => {
    const state = makeState({ selectedProductId: 'p1' });
    expect(deselectProduct(state).selectedProductId).toBeNull();
  });

  it('does not mutate input state', () => {
    const state = makeState({ selectedProductId: 'p1' });
    deselectProduct(state);
    expect(state.selectedProductId).toBe('p1');
  });

  it('is a no-op when nothing is selected', () => {
    const state = makeState();
    expect(deselectProduct(state).selectedProductId).toBeNull();
  });

  it('preserves products array', () => {
    const products = [makeProduct('p1')];
    const state = makeState({ selectedProductId: 'p1', products });
    expect(deselectProduct(state).products).toBe(products);
  });
});

// ── deleteSelected ────────────────────────────────────────────────

describe('deleteSelected', () => {
  it('removes the selected product', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2')],
      selectedProductId: 'p1',
    });
    const next = deleteSelected(state);
    expect(next.products.map(p => p._id)).toEqual(['p2']);
  });

  it('clears selectedProductId after delete', () => {
    const state = makeState({
      products: [makeProduct('p1')],
      selectedProductId: 'p1',
    });
    expect(deleteSelected(state).selectedProductId).toBeNull();
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(deleteSelected(state)).toBe(state);
  });

  it('does not mutate products array', () => {
    const products = [makeProduct('p1'), makeProduct('p2')];
    const state = makeState({ products, selectedProductId: 'p1' });
    deleteSelected(state);
    expect(products).toHaveLength(2);
  });

  it('handles deleting last product', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    const next = deleteSelected(state);
    expect(next.products).toHaveLength(0);
  });
});

// ── resizeSelected ────────────────────────────────────────────────

describe('resizeSelected', () => {
  it('updates width and depth of selected product', () => {
    const state = makeState({
      products: [makeProduct('p1', { width: 60, depth: 36 })],
      selectedProductId: 'p1',
    });
    const next = resizeSelected(state, 72, 48);
    expect(next.products[0]).toMatchObject({ width: 72, depth: 48 });
  });

  it('clamps width to MIN_PRODUCT_SIZE', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, 2, 36).products[0].width).toBe(MIN_PRODUCT_SIZE);
  });

  it('clamps depth to MIN_PRODUCT_SIZE', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, 60, 1).products[0].depth).toBe(MIN_PRODUCT_SIZE);
  });

  it('clamps width to MAX_PRODUCT_SIZE', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, 9999, 36).products[0].width).toBe(MAX_PRODUCT_SIZE);
  });

  it('clamps depth to MAX_PRODUCT_SIZE', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, 60, 9999).products[0].depth).toBe(MAX_PRODUCT_SIZE);
  });

  it('rounds fractional dimensions', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    const next = resizeSelected(state, 60.7, 36.3);
    expect(next.products[0].width).toBe(61);
    expect(next.products[0].depth).toBe(36);
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(resizeSelected(state, 72, 48)).toBe(state);
  });

  it('returns same state when selectedProductId not in products', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'ghost' });
    expect(resizeSelected(state, 72, 48)).toBe(state);
  });

  it('does not mutate input products', () => {
    const p1 = makeProduct('p1', { width: 60, depth: 36 });
    const state = makeState({ products: [p1], selectedProductId: 'p1' });
    resizeSelected(state, 72, 48);
    expect(p1.width).toBe(60);
  });

  it('preserves other product fields', () => {
    const state = makeState({
      products: [makeProduct('p1', { x: 100, y: 200, rotation: 90 })],
      selectedProductId: 'p1',
    });
    const next = resizeSelected(state, 72, 48);
    expect(next.products[0]).toMatchObject({ x: 100, y: 200, rotation: 90 });
  });

  it('returns same state when newWidth is NaN', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, NaN, 48)).toBe(state);
  });

  it('returns same state when newHeight is NaN', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, 72, NaN)).toBe(state);
  });

  it('returns same state when dimensions are Infinity', () => {
    const state = makeState({ products: [makeProduct('p1')], selectedProductId: 'p1' });
    expect(resizeSelected(state, Infinity, 48)).toBe(state);
  });
});

// ── rotateSelected ────────────────────────────────────────────────

describe('rotateSelected', () => {
  it('advances rotation from 0 to 90', () => {
    const state = makeState({ products: [makeProduct('p1', { rotation: 0 })], selectedProductId: 'p1' });
    expect(rotateSelected(state).products[0].rotation).toBe(90);
  });

  it('advances rotation from 90 to 180', () => {
    const state = makeState({ products: [makeProduct('p1', { rotation: 90 })], selectedProductId: 'p1' });
    expect(rotateSelected(state).products[0].rotation).toBe(180);
  });

  it('advances rotation from 180 to 270', () => {
    const state = makeState({ products: [makeProduct('p1', { rotation: 180 })], selectedProductId: 'p1' });
    expect(rotateSelected(state).products[0].rotation).toBe(270);
  });

  it('wraps rotation from 270 back to 0', () => {
    const state = makeState({ products: [makeProduct('p1', { rotation: 270 })], selectedProductId: 'p1' });
    expect(rotateSelected(state).products[0].rotation).toBe(0);
  });

  it('snaps unknown rotation to 0 (first valid step)', () => {
    // indexOf(45) === -1 → nextStep = 0 → ROTATION_STEPS[0] = 0
    const state = makeState({ products: [makeProduct('p1', { rotation: 45 })], selectedProductId: 'p1' });
    expect(rotateSelected(state).products[0].rotation).toBe(0);
  });

  it('treats missing rotation as 0 and advances to 90', () => {
    const p = makeProduct('p1');
    delete p.rotation;
    const state = makeState({ products: [p], selectedProductId: 'p1' });
    expect(rotateSelected(state).products[0].rotation).toBe(90);
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(rotateSelected(state)).toBe(state);
  });

  it('does not mutate input product', () => {
    const p1 = makeProduct('p1', { rotation: 0 });
    const state = makeState({ products: [p1], selectedProductId: 'p1' });
    rotateSelected(state);
    expect(p1.rotation).toBe(0);
  });
});

// ── bringForward ──────────────────────────────────────────────────

describe('bringForward', () => {
  it('swaps selected product with the one above it', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
      selectedProductId: 'p1',
    });
    const next = bringForward(state);
    expect(next.products.map(p => p._id)).toEqual(['p2', 'p1', 'p3']);
  });

  it('does not change order when already on top', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2')],
      selectedProductId: 'p2',
    });
    expect(bringForward(state)).toBe(state);
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(bringForward(state)).toBe(state);
  });

  it('does not mutate original products array', () => {
    const products = [makeProduct('p1'), makeProduct('p2')];
    const state = makeState({ products, selectedProductId: 'p1' });
    bringForward(state);
    expect(products[0]._id).toBe('p1');
  });
});

// ── sendBackward ──────────────────────────────────────────────────

describe('sendBackward', () => {
  it('swaps selected product with the one below it', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
      selectedProductId: 'p3',
    });
    const next = sendBackward(state);
    expect(next.products.map(p => p._id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('does not change order when already at bottom', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2')],
      selectedProductId: 'p1',
    });
    expect(sendBackward(state)).toBe(state);
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(sendBackward(state)).toBe(state);
  });

  it('does not mutate original products array', () => {
    const products = [makeProduct('p1'), makeProduct('p2')];
    const state = makeState({ products, selectedProductId: 'p2' });
    sendBackward(state);
    expect(products[1]._id).toBe('p2');
  });
});

// ── bringToFront ──────────────────────────────────────────────────

describe('bringToFront', () => {
  it('moves selected product to top of stack', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
      selectedProductId: 'p1',
    });
    const next = bringToFront(state);
    expect(next.products.map(p => p._id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('is a no-op when already on top', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2')],
      selectedProductId: 'p2',
    });
    expect(bringToFront(state)).toBe(state);
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(bringToFront(state)).toBe(state);
  });

  it('works with product in the middle', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
      selectedProductId: 'p2',
    });
    const next = bringToFront(state);
    expect(next.products.map(p => p._id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('does not mutate original products array', () => {
    const products = [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')];
    const state = makeState({ products, selectedProductId: 'p1' });
    bringToFront(state);
    expect(products[0]._id).toBe('p1');
  });
});

// ── sendToBack ────────────────────────────────────────────────────

describe('sendToBack', () => {
  it('moves selected product to bottom of stack', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
      selectedProductId: 'p3',
    });
    const next = sendToBack(state);
    expect(next.products.map(p => p._id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('is a no-op when already at bottom', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2')],
      selectedProductId: 'p1',
    });
    expect(sendToBack(state)).toBe(state);
  });

  it('returns same state when nothing is selected', () => {
    const state = makeState({ products: [makeProduct('p1')] });
    expect(sendToBack(state)).toBe(state);
  });

  it('works with product in the middle', () => {
    const state = makeState({
      products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
      selectedProductId: 'p2',
    });
    const next = sendToBack(state);
    expect(next.products.map(p => p._id)).toEqual(['p2', 'p1', 'p3']);
  });

  it('does not mutate original products array', () => {
    const products = [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')];
    const state = makeState({ products, selectedProductId: 'p3' });
    sendToBack(state);
    expect(products[2]._id).toBe('p3');
  });
});
