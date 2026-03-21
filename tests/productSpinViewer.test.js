/**
 * Tests for CF-0e6p: 360-degree product spin viewer.
 * Covers: computeFrameIndex, buildAutoSpinSequence, shouldShowSpinViewer,
 * initProductSpinViewer (auto-spin, drag, touch, fallback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeFrameIndex,
  buildAutoSpinSequence,
  shouldShowSpinViewer,
  initProductSpinViewer,
} from '../src/public/ProductSpinViewer.js';

// ── computeFrameIndex ────────────────────────────────────────────

describe('computeFrameIndex', () => {
  it('returns 0 for zero delta', () => {
    expect(computeFrameIndex(0, 0, 8)).toBe(0);
  });

  it('advances frame by dragging right (positive delta)', () => {
    expect(computeFrameIndex(0, 8, 8)).toBe(1);
  });

  it('goes back by dragging left (negative delta)', () => {
    expect(computeFrameIndex(2, -8, 8)).toBe(1);
  });

  it('wraps around forward (past last frame)', () => {
    expect(computeFrameIndex(7, 8, 8)).toBe(0);
  });

  it('wraps around backward (before first frame)', () => {
    expect(computeFrameIndex(0, -8, 8)).toBe(7);
  });

  it('handles large deltas spanning multiple frames', () => {
    expect(computeFrameIndex(0, 24, 8)).toBe(3);
  });

  it('rounds partial drag to nearest frame', () => {
    // 4px / 8pxPerFrame = 0.5 → rounds to 1 frame advance
    expect(computeFrameIndex(2, 4, 8)).toBe(3);
  });

  it('returns 0 for zero totalFrames (guard)', () => {
    expect(computeFrameIndex(0, 100, 0)).toBe(0);
  });

  it('uses custom pxPerFrame', () => {
    expect(computeFrameIndex(0, 20, 10, 10)).toBe(2);
  });
});

// ── buildAutoSpinSequence ────────────────────────────────────────

describe('buildAutoSpinSequence', () => {
  it('returns empty array for 0 frames', () => {
    expect(buildAutoSpinSequence(0, 3)).toEqual([]);
  });

  it('returns empty array for 0 rotations', () => {
    expect(buildAutoSpinSequence(8, 0)).toEqual([]);
  });

  it('returns 1 full rotation for 8 frames × 1 rotation', () => {
    const seq = buildAutoSpinSequence(8, 1);
    expect(seq).toHaveLength(8);
    expect(seq[0]).toBe(0);
    expect(seq[7]).toBe(7);
  });

  it('returns 3 full rotations for 8 frames × 3 rotations', () => {
    const seq = buildAutoSpinSequence(8, 3);
    expect(seq).toHaveLength(24);
    expect(seq[8]).toBe(0); // start of second rotation
    expect(seq[16]).toBe(0); // start of third rotation
  });

  it('frame indices never exceed totalFrames-1', () => {
    const seq = buildAutoSpinSequence(6, 3);
    for (const f of seq) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(6);
    }
  });
});

// ── shouldShowSpinViewer ─────────────────────────────────────────

describe('shouldShowSpinViewer', () => {
  it('returns true when product has 2+ spinImages', () => {
    expect(shouldShowSpinViewer({ spinImages: ['a.jpg', 'b.jpg'] })).toBe(true);
  });

  it('returns true for 8+ spin images', () => {
    const imgs = Array.from({ length: 8 }, (_, i) => `img${i}.jpg`);
    expect(shouldShowSpinViewer({ spinImages: imgs })).toBe(true);
  });

  it('returns false when spinImages has only 1 image', () => {
    expect(shouldShowSpinViewer({ spinImages: ['a.jpg'] })).toBe(false);
  });

  it('returns false when spinImages is empty array', () => {
    expect(shouldShowSpinViewer({ spinImages: [] })).toBe(false);
  });

  it('returns false when spinImages is missing', () => {
    expect(shouldShowSpinViewer({ name: 'Product' })).toBe(false);
  });

  it('returns false for null product', () => {
    expect(shouldShowSpinViewer(null)).toBe(false);
  });

  it('returns false for undefined product', () => {
    expect(shouldShowSpinViewer(undefined)).toBe(false);
  });
});

// ── initProductSpinViewer ────────────────────────────────────────

function makeEl() {
  return {
    src: '',
    show: vi.fn(),
    hide: vi.fn(),
    collapse: vi.fn(),
    expand: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  };
}

function make$w() {
  const map = new Map();
  return (sel) => {
    if (!map.has(sel)) map.set(sel, makeEl());
    return map.get(sel);
  };
}

function makeProduct(overrides = {}) {
  const spinImages = Array.from({ length: 8 }, (_, i) => `https://example.com/spin-${i}.jpg`);
  return { _id: 'prod-1', name: 'Test Product', spinImages, ...overrides };
}

describe('initProductSpinViewer', () => {
  let $w;
  let timers;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    timers = { intervals: [], setInterval: vi.fn((fn, ms) => { const id = timers.intervals.length; timers.intervals.push({ fn, ms, id }); return id; }), clearInterval: vi.fn((id) => { if (timers.intervals[id]) timers.intervals[id].cancelled = true; }) };
  });

  it('collapses spin container when product has no spinImages', () => {
    initProductSpinViewer($w, { product: { _id: 'p1' } }, timers);
    expect($w('#productSpinContainer').collapse).toHaveBeenCalled();
    expect($w('#spin360Badge').hide).toHaveBeenCalled();
  });

  it('collapses when state.product is null', () => {
    initProductSpinViewer($w, { product: null }, timers);
    expect($w('#productSpinContainer').collapse).toHaveBeenCalled();
  });

  it('collapses when state is empty', () => {
    initProductSpinViewer($w, {}, timers);
    expect($w('#productSpinContainer').collapse).toHaveBeenCalled();
  });

  it('expands spin container when product has spinImages', () => {
    initProductSpinViewer($w, { product: makeProduct() }, timers);
    expect($w('#productSpinContainer').expand).toHaveBeenCalled();
  });

  it('shows spin badge when spinImages present', () => {
    initProductSpinViewer($w, { product: makeProduct() }, timers);
    expect($w('#spin360Badge').show).toHaveBeenCalled();
  });

  it('sets initial frame src to first spin image', () => {
    const product = makeProduct();
    initProductSpinViewer($w, { product }, timers);
    expect($w('#productSpinCanvas').src).toBe(product.spinImages[0]);
  });

  it('starts auto-spin interval', () => {
    initProductSpinViewer($w, { product: makeProduct() }, timers);
    expect(timers.setInterval).toHaveBeenCalled();
  });

  it('auto-spin advances frames through spin sequence', () => {
    const product = makeProduct();
    initProductSpinViewer($w, { product }, timers);
    const { fn } = timers.intervals[0];
    // First tick: spinSequence[0] = frame 0 (same as initial render)
    fn();
    expect($w('#productSpinCanvas').src).toBe(product.spinImages[0]);
    // Second tick: spinSequence[1] = frame 1
    fn();
    expect($w('#productSpinCanvas').src).toBe(product.spinImages[1]);
  });

  it('auto-spin stops and clears after 3 full rotations', () => {
    const product = makeProduct();
    initProductSpinViewer($w, { product }, timers);
    const { fn } = timers.intervals[0];
    const totalSteps = product.spinImages.length * 3;
    for (let i = 0; i < totalSteps + 5; i++) fn();
    expect(timers.clearInterval).toHaveBeenCalled();
  });

  it('registers mouse event handlers on spinCanvas', () => {
    initProductSpinViewer($w, { product: makeProduct() }, timers);
    expect($w('#productSpinCanvas').onMouseDown).toHaveBeenCalled();
    expect($w('#productSpinCanvas').onMouseMove).toHaveBeenCalled();
    expect($w('#productSpinCanvas').onMouseUp).toHaveBeenCalled();
  });

  it('registers touch event handlers on spinCanvas', () => {
    initProductSpinViewer($w, { product: makeProduct() }, timers);
    expect($w('#productSpinCanvas').onTouchStart).toHaveBeenCalled();
    expect($w('#productSpinCanvas').onTouchMove).toHaveBeenCalled();
    expect($w('#productSpinCanvas').onTouchEnd).toHaveBeenCalled();
  });

  it('mousedown cancels auto-spin', () => {
    initProductSpinViewer($w, { product: makeProduct() }, timers);
    const mouseDownCb = $w('#productSpinCanvas').onMouseDown.mock.calls[0][0];
    mouseDownCb({ clientX: 100 });
    expect(timers.clearInterval).toHaveBeenCalled();
  });

  it('mousemove updates frame based on drag delta', () => {
    const product = makeProduct();
    initProductSpinViewer($w, { product }, timers);
    const mouseDownCb = $w('#productSpinCanvas').onMouseDown.mock.calls[0][0];
    const mouseMoveCb = $w('#productSpinCanvas').onMouseMove.mock.calls[0][0];
    mouseDownCb({ clientX: 0 });
    mouseMoveCb({ clientX: 8 }); // 8px = 1 frame
    expect($w('#productSpinCanvas').src).toBe(product.spinImages[1]);
  });

  it('mousemove does nothing before mousedown', () => {
    const product = makeProduct();
    initProductSpinViewer($w, { product }, timers);
    const mouseMoveCb = $w('#productSpinCanvas').onMouseMove.mock.calls[0][0];
    const initialSrc = $w('#productSpinCanvas').src;
    mouseMoveCb({ clientX: 100 });
    expect($w('#productSpinCanvas').src).toBe(initialSrc);
  });

  it('cleanup() cancels auto-spin timer', () => {
    const { cleanup } = initProductSpinViewer($w, { product: makeProduct() }, timers);
    cleanup();
    expect(timers.clearInterval).toHaveBeenCalled();
  });

  it('returns cleanup function', () => {
    const result = initProductSpinViewer($w, { product: makeProduct() }, timers);
    expect(typeof result.cleanup).toBe('function');
  });
});
